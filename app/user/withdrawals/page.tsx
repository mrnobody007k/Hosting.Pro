"use client"

import { FormEvent, useState } from "react"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, money, useCustomerOverview } from "../CustomerUI"

export default function WithdrawalsPage() {
  const { data, loading, error, reload } = useCustomerOverview()
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("Bank")
  const [accountDetails, setAccountDetails] = useState("")
  const [paymentPassword, setPaymentPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [actionError, setActionError] = useState("")
  const user = data?.user

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
      await reload()
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
      <form className="customer-form customer-surface withdraw-form" onSubmit={submit}>
        <h2>New withdrawal request</h2>
        <label>Amount (INR)<input type="number" min="0.01" max="100000000000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <label>Payout method<select value={method} onChange={(event) => setMethod(event.target.value)}><option>Bank</option><option>Wallet</option><option>Other</option></select></label>
        <label>Account details<textarea value={accountDetails} onChange={(event) => setAccountDetails(event.target.value)} maxLength={1000} placeholder="Enter the details needed to send your payout" required /></label>
        <label>Payment password<input type="password" value={paymentPassword} onChange={(event) => setPaymentPassword(event.target.value)} autoComplete="current-password" minLength={6} maxLength={200} required /></label>
        <button disabled={busy}>{busy ? "Submitting…" : "Submit withdrawal request"}</button>
      </form>
      <section className="customer-surface customer-history">
        <h2>Withdrawal history</h2>
        {(data?.withdrawals || []).length === 0 ? <CustomerPageState emptyTitle="No withdrawal requests yet" emptyText="Your payout requests and their status will appear here." /> : data?.withdrawals?.map((item) => <div className="customer-history-row" key={item.id}><span>{money(item.amount)}{item.method ? " · " + item.method : ""}</span><b className="customer-status-pill">{customerStatus(item.status)}</b><small>{new Date(item.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></div>)}
      </section>
    </>}
  </UserShell>
}
