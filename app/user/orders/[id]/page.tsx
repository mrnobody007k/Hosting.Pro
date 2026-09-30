"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Decimal } from "decimal.js"
import UserShell from "../../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, money } from "../../CustomerUI"

type Booking = { id: string; orderCode: string; amount: string | number; status: string; paymentStatus?: string; createdAt: string; bookedAt?: string | null; paymentSubmittedAt?: string | null; paymentVerifiedAt?: string | null; activatedAt?: string | null; rerentRequestedAt?: string | null; rerentedAt?: string | null; completedAt?: string | null; cancelledAt?: string | null; property?: { title: string; location?: string | null; imageUrl?: string | null }; tasks?: Array<{ id: string; title: string; status: string; type?: string; assignedAt?: string; submittedAt?: string | null; completedAt?: string | null; profitRate?: number | string; profitAmount?: string | number }> }

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [name, setName] = useState("Client")
  const [membership, setMembership] = useState("Member")
  const [paymentInstructions, setPaymentInstructions] = useState("")
  const [reference, setReference] = useState("")
  const [proof, setProof] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [orderResponse, accountResponse] = await Promise.all([fetch(`/api/user/orders/${encodeURIComponent(id)}`, { cache: "no-store" }), fetch("/api/user/overview", { cache: "no-store" })])
      if (orderResponse.status === 401 || accountResponse.status === 401) { window.location.href = "/login"; return }
      const [orderData, accountData] = await Promise.all([orderResponse.json(), accountResponse.json()])
      if (!orderResponse.ok) throw new Error(orderData.error || "Unable to load this booking.")
      if (!accountResponse.ok) throw new Error(accountData.error || "Unable to load your account.")
      setBooking(orderData.order || null)
      setName(accountData.user?.name || "Client")
      setMembership(customerStatus(accountData.user?.membershipStatus))
      setPaymentInstructions(accountData.setting?.depositInstructions || "Follow the payment instructions shown in your account, then submit your payment reference or proof for confirmation.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load this booking.") }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { void load() }, [load])

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("")
    try {
      const response = await fetch("/api/user/orders/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: id, paymentReference: reference, paymentProofUrl: proof }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to submit your payment details.")
      setNotice(result.message || "Your payment details have been submitted.")
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit your payment details.") }
    finally { setBusy(false) }
  }

  const canSubmitPayment = booking?.status === "PAYMENT_PENDING" || booking?.status === "PAYMENT_SUBMITTED"
  return <UserShell userName={name} membership={membership}>
    <CustomerPageHeader eyebrow="BOOKING DETAILS" title={booking?.orderCode || "Your booking"} description={booking?.property?.title || "View your property booking and payment progress."} />
    <CustomerPageState loading={loading} error={error && !booking ? error : ""} retry={() => void load()} />
    {!loading && !error && !booking && <CustomerPageState emptyTitle="Booking not found" emptyText="This booking may have been removed or is no longer available." />}
    {booking && <>
      <section className="booking-detail-summary">
        <div><span>Booking status</span><strong>{customerStatus(booking.status)}</strong></div><div><span>Payment status</span><strong>{customerStatus(booking.paymentStatus)}</strong></div><div><span>Rental amount</span><strong>{money(booking.amount)}</strong></div><div><span>Re-Rent activity</span><strong>{booking.tasks?.some((task) => task.type === "RE_RENT") ? "Assigned when eligible" : "Awaiting assignment"}</strong></div>
        <p>{booking.property?.location || "Housing.pro marketplace"} · {new Date(booking.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
      </section>
      {error && <div className="customer-data-state customer-data-error" role="alert">{error}</div>}{notice && <div className="booking-notice" role="status">{notice}</div>}
      {canSubmitPayment && <form className="booking-payment-form" onSubmit={submitPayment}>
        <h2>Complete your rental payment</h2><p>Follow these instructions, then share your payment reference or an optional proof link. Payments are handled offline.</p>
        <div className="booking-payment-instructions"><strong>Payment instructions</strong><p>{paymentInstructions}</p></div>
        <label>Payment reference<input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={160} placeholder="Enter your transfer reference" /></label>
        <label>Proof link (optional)<input type="url" pattern="https://.+" value={proof} onChange={(event) => setProof(event.target.value)} maxLength={500} placeholder="https://…" /></label>
        <button type="submit" disabled={busy || (!reference.trim() && !proof.trim())}>{busy ? "Submitting…" : "Submit payment details"}</button>
      </form>}
      <section className="booking-timeline"><h2>Booking timeline</h2>{[
        { title: "Rental requested", date: booking.bookedAt || booking.createdAt, shown: true },
        { title: "Payment submitted", date: booking.paymentSubmittedAt, shown: Boolean(booking.paymentSubmittedAt) },
        { title: "Manager verification", date: booking.paymentVerifiedAt, shown: Boolean(booking.paymentVerifiedAt) || booking.status === "PAYMENT_SUBMITTED" },
        { title: "Rental activated", date: booking.activatedAt, shown: Boolean(booking.activatedAt) },
        { title: "Re-Rent assigned", date: booking.tasks?.find((task) => task.type === "RE_RENT")?.assignedAt, shown: Boolean(booking.tasks?.some((task) => task.type === "RE_RENT")) },
        { title: "Re-Rent submitted", date: booking.tasks?.find((task) => task.type === "RE_RENT" && task.submittedAt)?.submittedAt, shown: Boolean(booking.tasks?.some((task) => task.type === "RE_RENT" && task.submittedAt)) },
        { title: "Settlement completed", date: booking.tasks?.find((task) => task.type === "RE_RENT" && task.completedAt)?.completedAt, shown: Boolean(booking.tasks?.some((task) => task.type === "RE_RENT" && task.completedAt)) },
        { title: "Booking completed", date: booking.completedAt || booking.rerentedAt, shown: Boolean(booking.completedAt || booking.rerentedAt) },
        { title: "Booking cancelled", date: booking.cancelledAt, shown: Boolean(booking.cancelledAt) },
      ].filter((step) => step.shown).map((step) => <div key={step.title}><span>✓</span><strong>{step.title}</strong><time>{step.date ? new Date(step.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "In progress"}</time></div>)}</section>
      <section className="booking-task-list"><h2>Booking activity</h2>{booking.tasks?.length ? booking.tasks.map((task) => <article key={task.id}><div><strong>{task.title}</strong><span>{customerStatus(task.status)}</span></div><small>{task.status === "COMPLETED" ? "Earnings are recorded in Revenue." : `${task.profitRate ? `${new Decimal(String(task.profitRate)).toFixed(2)}% · ` : "Expected profit · "}${money(task.profitAmount)}`}</small></article>) : <p>There is no activity to show yet. Updates will appear here as your booking progresses.</p>}</section>
      <aside className="booking-help-note"><strong>Need help?</strong><span>Visit Support for help with payment instructions or this booking.</span></aside>
    </>}
    <style jsx global>{`.booking-detail-summary,.booking-payment-form,.booking-task-list,.booking-timeline,.booking-help-note{margin:0 0 16px;padding:20px;border:1px solid #e7ebe4;border-radius:14px;background:#fff}.booking-detail-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.booking-detail-summary>div span,.booking-detail-summary>div strong{display:block}.booking-detail-summary>div span{color:#728078;font-size:11px}.booking-detail-summary>div strong{margin-top:5px;color:#20382f;font-size:15px}.booking-detail-summary>p{grid-column:1/-1;margin:0;color:#728078;font-size:12px}.booking-payment-form h2,.booking-task-list h2,.booking-timeline h2{margin:0 0 7px;color:#20382f;font-size:18px}.booking-payment-form>p{margin:0 0 15px;color:#68766e;font-size:13px;line-height:1.6}.booking-payment-instructions{margin:0 0 16px;padding:14px;border-radius:10px;background:#f3f6f0;color:#31463a}.booking-payment-instructions strong{font-size:12px}.booking-payment-instructions p{margin:6px 0 0;white-space:pre-wrap;font-size:13px;line-height:1.6}.booking-payment-form label{display:block;margin:12px 0;color:#34483d;font-size:12px;font-weight:700}.booking-payment-form input{display:block;width:100%;min-height:43px;margin-top:6px;padding:10px 12px;border:1px solid #dce4dc;border-radius:8px}.booking-payment-form button{min-height:42px;padding:0 15px;border:0;border-radius:8px;background:#20382f;color:white;font-weight:700}.booking-timeline>div{display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:10px;padding:13px 0;border-bottom:1px solid #edf0eb}.booking-timeline>div:last-child{border:0}.booking-timeline>div span{width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:#eaf4eb;color:#315c45;font-size:11px}.booking-timeline>div strong{color:#34483d;font-size:12px}.booking-timeline>div time{color:#728078;font-size:11px}.booking-task-list article{display:flex;justify-content:space-between;gap:14px;padding:13px 0;border-bottom:1px solid #edf0eb}.booking-task-list article:last-child{border:0}.booking-task-list article span,.booking-task-list article small{display:block;margin-top:4px;color:#728078;font-size:12px}.booking-task-list>p,.booking-help-note span{color:#68766e;font-size:13px;line-height:1.6}.booking-help-note strong{display:block;margin-bottom:5px;color:#20382f}.booking-notice{margin:0 0 15px;padding:12px 14px;border:1px solid #cfe4d1;border-radius:9px;background:#f2faf2;color:#396047;font-size:12px}@media(max-width:700px){.booking-detail-summary{grid-template-columns:1fr 1fr}.booking-detail-summary>p{grid-column:1/-1}.booking-detail-summary,.booking-payment-form,.booking-task-list,.booking-timeline,.booking-help-note{padding:16px}.booking-timeline>div{grid-template-columns:24px 1fr}.booking-timeline>div time{grid-column:2}}`}</style>
  </UserShell>
}
