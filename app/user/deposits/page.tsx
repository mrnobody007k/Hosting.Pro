"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, money, useCustomerOverview } from "../CustomerUI"

type DepositRecord = { id: string; amount: string; reference: string | null; status: string; createdAt: string; processedAt?: string | null }

export default function DepositsPage() {
  const { data, loading, error, reload } = useCustomerOverview()
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [proofUrl, setProofUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [actionError, setActionError] = useState("")
  const [history, setHistory] = useState<DepositRecord[]>([])
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
      const response = await fetch(`/api/user/deposits?${params}`, { cache: "no-store" })
      if (response.status === 401) { window.location.href = "/login"; return }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load deposit history.")
      const page = Array.isArray(result.deposits) ? result.deposits : []
      setHistory((current) => append ? [...current, ...page] : page)
      setHistoryCursor(page.at(-1)?.id || null)
      setHistoryNextCursor(result.nextCursor || null)
    } catch (cause) { setHistoryError(cause instanceof Error ? cause.message : "Unable to load deposit history.") }
    finally { setHistoryLoading(false); setHistoryLoadingMore(false) }
  }, [historyCursor])
  useEffect(() => { void loadHistory(false) }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    setActionError("")
    try {
      const response = await fetch("/api/user/deposits", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reference, proofUrl }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to submit your deposit request.")
      setMessage("Your deposit request was submitted. Its status will update here.")
      setAmount(""); setReference(""); setProofUrl("")
      await Promise.all([reload(), loadHistory(false)])
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to submit your deposit request.")
    } finally { setBusy(false) }
  }

  return <UserShell userName={user?.name || "Client"} membership={customerStatus(user?.membershipStatus)}>
    <CustomerPageHeader eyebrow="YOUR WALLET" title="Add funds" description="Follow the payment instructions, then submit your transaction details." />
    <CustomerPageState loading={loading} error={error} retry={() => void reload()} />
    {!loading && !error && <>
      {message && <div className="customer-inline-success" role="status">{message}</div>}
      {actionError && <div className="customer-inline-error" role="alert">{actionError}</div>}
      <div className="deposit-layout">
        <form className="customer-form customer-surface" onSubmit={submit}>
          <h2>Submit a deposit</h2>
          <label>Amount (INR)<input type="number" min="0.01" max="100000000000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <label>Transaction reference <span className="customer-optional">(optional if proof is provided)</span><input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={300} placeholder="Enter the reference from your payment" /></label>
          <label>Payment proof link <span className="customer-optional">(optional if reference is provided)</span><input type="url" pattern="https://.+" value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} maxLength={1000} placeholder="https://" /></label>
          <button disabled={busy || (!reference.trim() && !proofUrl.trim())}>{busy ? "Submitting…" : "Submit deposit details"}</button>
        </form>
        <aside className="deposit-instructions"><span>PAYMENT INSTRUCTIONS</span><h2>Complete payment separately</h2><p>{data?.setting?.depositInstructions || "Follow the payment instructions provided for your account, then submit your transaction reference or proof."}</p><div>Housing.pro does not collect payments online. Keep your payment confirmation until this request is complete.</div></aside>
      </div>
      <section className="customer-surface customer-history">
        <h2>Deposit history</h2>
        {historyLoading ? <CustomerPageState loading /> : historyError ? <CustomerPageState error={historyError} retry={() => void loadHistory(false)} /> : history.length === 0 ? <CustomerPageState emptyTitle="No deposits yet" emptyText="Submitted deposit requests will appear here." /> : history.map((item) => <div className="customer-history-row" key={item.id}><span>{money(item.amount)}{item.reference ? <small className="deposit-history-reference">Reference: {item.reference}</small> : null}</span><b className="customer-status-pill">{customerStatus(item.status)}</b><small>{new Date(item.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></div>)}
        {historyNextCursor && <div className="customer-load-more"><button className="customer-primary-button" onClick={() => void loadHistory(true)} disabled={historyLoadingMore}>{historyLoadingMore ? "Loading…" : "Load older deposits"}</button></div>}
      </section>
    </>}
  </UserShell>
}
