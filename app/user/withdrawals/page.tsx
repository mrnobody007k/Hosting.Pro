"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, money, useCustomerOverview } from "../CustomerUI"

type WithdrawalRecord = { id: string; amount: string; method?: string | null; accountDetails?: string | null; status: string; createdAt: string; processedAt?: string | null }

export default function WithdrawalsPage() {
  const { data, loading, error, reload } = useCustomerOverview()
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("Bank")
  const [accountDetails, setAccountDetails] = useState("")
  const [paymentPassword, setPaymentPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [actionError, setActionError] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [history, setHistory] = useState<WithdrawalRecord[]>([])
  const [historyCursor, setHistoryCursor] = useState<string | null>(null)
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const user = data?.user

  const loadHistory = useCallback(async (append = false) => {
    if (append) setHistoryLoadingMore(true); else setHistoryLoading(true)
    setHistoryError("")
    try {
      const params = new URLSearchParams()
      if (append && historyCursor) params.set("cursor", historyCursor)
      const response = await fetch(`/api/user/withdrawals?${params}`, { cache: "no-store" })
      if (response.status === 401) { window.location.href = "/login"; return }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load withdrawal history.")
      const page = Array.isArray(result.withdrawals) ? result.withdrawals : []
      setHistory((current) => append ? [...current, ...page] : page)
      setHistoryCursor(page.at(-1)?.id || null)
      setHistoryNextCursor(result.nextCursor || null)
    } catch (cause) { setHistoryError(cause instanceof Error ? cause.message : "Unable to load withdrawal history.") }
    finally { setHistoryLoading(false); setHistoryLoadingMore(false) }
  }, [historyCursor])
  useEffect(() => { void loadHistory(false) }, [])

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionError("")
    setConfirming(true)
  }

  async function submit() {
    setBusy(true); setMessage(""); setActionError("")
    try {
      const response = await fetch("/api/user/withdrawals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method, accountDetails, paymentPassword }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to submit your withdrawal request.")
      setMessage("Your withdrawal request was submitted. The reserved amount and request status are shown below.")
      setAmount(""); setAccountDetails(""); setPaymentPassword("")
      setConfirming(false)
      await Promise.all([reload(), loadHistory(false)])
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to submit your withdrawal request.")
    } finally { setBusy(false) }
  }

  return <UserShell userName={user?.name || "Client"} membership={customerStatus(user?.membershipStatus)}>
    <CustomerPageHeader eyebrow="YOUR WALLET" title="Withdraw funds" description="Request a payout from the available balance in your Housing.pro wallet." />
    <CustomerPageState loading={loading} error={error} retry={() => void reload()} />
    {!loading && !error && <>
      <div className="withdraw-available"><span>Available balance</span><strong>{money(data?.availableBalance)}</strong><small>Pending withdrawal requests are reserved until they are completed or declined.</small></div>
      {message && <div className="customer-inline-success" role="status">{message}</div>}
      {actionError && <div className="customer-inline-error" role="alert">{actionError}</div>}
      <form className="customer-form customer-surface withdraw-form" onSubmit={review}>
        <h2>New withdrawal request</h2>
        <label>Amount (INR)<input type="number" min="0.01" max="100000000000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <label>Payout method<select value={method} onChange={(event) => setMethod(event.target.value)}><option>Bank</option><option>Wallet</option><option>Other</option></select></label>
        <label>Account details<textarea value={accountDetails} onChange={(event) => setAccountDetails(event.target.value)} maxLength={1000} placeholder="Enter the details needed to send your payout" required /></label>
        <label>Payment password<input type="password" value={paymentPassword} onChange={(event) => setPaymentPassword(event.target.value)} autoComplete="current-password" minLength={6} maxLength={200} required /></label>
        <button disabled={busy}>{busy ? "Submitting…" : "Submit withdrawal request"}</button>
      </form>
      {confirming && <div className="withdraw-confirm-backdrop" role="presentation"><section className="withdraw-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="withdraw-confirm-title"><span className="withdraw-confirm-icon" aria-hidden="true">₹</span><h2 id="withdraw-confirm-title">Confirm withdrawal request</h2><p>Submit a request for <strong>{money(amount)}</strong> using <strong>{method}</strong>? The amount will be reserved while your request is reviewed. Housing.pro does not process the payout automatically.</p>{actionError && <div className="customer-inline-error" role="alert">{actionError}</div>}<div><button type="button" onClick={() => setConfirming(false)} disabled={busy}>Go back</button><button type="button" onClick={() => void submit()} disabled={busy}>{busy ? "Submitting…" : "Confirm request"}</button></div></section></div>}
      <section className="customer-surface customer-history">
        <h2>Withdrawal history</h2>
        {historyLoading ? <CustomerPageState loading /> : historyError ? <CustomerPageState error={historyError} retry={() => void loadHistory(false)} /> : history.length === 0 ? <CustomerPageState emptyTitle="No withdrawal requests yet" emptyText="Your payout requests and their status will appear here." /> : history.map((item) => <div className="customer-history-row" key={item.id}><span>{money(item.amount)}{item.method ? ` · ${item.method}` : ""}{item.accountDetails ? <small className="deposit-history-reference">Payout details: ••••{item.accountDetails.replace(/\s/g, "").slice(-4)}</small> : null}</span><b className="customer-status-pill">{customerStatus(item.status)}</b><small>{new Date(item.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></div>)}
        {historyNextCursor && <div className="customer-load-more"><button className="customer-primary-button" onClick={() => void loadHistory(true)} disabled={historyLoadingMore}>{historyLoadingMore ? "Loading…" : "Load older withdrawals"}</button></div>}
      </section>
    </>}
    <style jsx global>{`.withdraw-confirm-backdrop{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:18px;background:rgba(19,35,27,.48)}.withdraw-confirm-dialog{width:min(460px,100%);padding:23px;border-radius:16px;background:#fff;box-shadow:0 24px 70px rgba(16,34,24,.24)}.withdraw-confirm-dialog h2{margin:14px 0 7px;color:#20382f;font-size:20px}.withdraw-confirm-dialog p{color:#68766e;font-size:13px;line-height:1.65}.withdraw-confirm-dialog p strong{color:#20382f}.withdraw-confirm-dialog>div:last-child{display:flex;justify-content:flex-end;gap:9px;margin-top:20px}.withdraw-confirm-dialog button{min-height:40px;padding:0 14px;border:1px solid #dce4dc;border-radius:9px;background:#fff;color:#315c45;font:inherit;font-size:12px;font-weight:750}.withdraw-confirm-dialog button:last-child{border-color:#315c45;background:#315c45;color:#fff}.withdraw-confirm-dialog button:disabled{opacity:.6}.withdraw-confirm-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#eaf4eb;color:#315c45;font-weight:900}`}</style>
  </UserShell>
}
