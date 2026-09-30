"use client"

import { useCallback, useEffect, useState } from "react"
import ManagerShell from "../ManagerShell"
import { Decimal } from "decimal.js"

function money(value: unknown) {
  let amount: Decimal
  try { amount = new Decimal(String(value ?? 0)) } catch { amount = new Decimal(0) }
  if (!amount.isFinite()) amount = new Decimal(0)
  return `₹${amount.toFixed(2)}`
}

export default function ManagerWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [manager, setManager] = useState("Manager")
  const [busy, setBusy] = useState("")
  const [references, setReferences] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (pageCursor?: string) => {
    if (pageCursor) setLoadingMore(true); else setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (pageCursor) params.set("cursor", pageCursor)
      const response = await fetch(`/api/manager/withdrawals?${params}`, { cache: "no-store" })
      if (response.status === 401) { window.location.href = "/manager-login"; return }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load withdrawal requests.")
      setWithdrawals((current) => pageCursor ? [...current, ...(result.withdrawals || [])] : (result.withdrawals || [])); setManager(result.manager?.name || "Manager")
      setNextCursor(result.nextCursor || null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load withdrawal requests.") }
    finally { setLoading(false); setLoadingMore(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function act(id: string, action: "APPROVE" | "REJECT" | "PAID") {
    const reference = references[id]?.trim() || ""
    if (action === "PAID" && !reference) { setError("Enter the payout reference before marking a withdrawal paid."); return }
    setBusy(id); setError(""); setNotice("")
    try {
      const response = await fetch("/api/manager/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, ...(action === "PAID" ? { reference } : {}) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to process this withdrawal.")
      setNotice(action === "PAID" ? "Withdrawal marked paid and recorded." : action === "APPROVE" ? "Withdrawal approved; reserved funds remain held until payout." : "Withdrawal rejected and reserved funds released.")
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to process this withdrawal.") }
    finally { setBusy("") }
  }

  return <ManagerShell managerName={manager}>
    <div className="mw-head"><span>FINANCE</span><h1>Withdrawal Requests</h1><p>Approve, reject, or record manually processed client withdrawals.</p><button onClick={() => void load()} disabled={loading}>Refresh</button></div>
    {error && <div className="mw-message error" role="alert">{error}</div>}{notice && <div className="mw-message success" role="status">{notice}</div>}
    <section className="mw-panel"><div className="mw-table-wrap"><table><thead><tr><th>Client</th><th>Amount</th><th>Method</th><th>Payout details</th><th>Status</th><th>Date</th><th>Payout reference / action</th></tr></thead><tbody>{withdrawals.map((item) => <tr key={item.id}><td><b>{item.user?.name || item.user?.email || "Client"}</b></td><td>{money(item.amount)}</td><td>{item.method || "—"}</td><td>{item.accountDetails || "—"}</td><td>{item.status}</td><td>{new Date(item.createdAt).toLocaleDateString("en-GB")}</td><td>{item.status === "PENDING" && <div className="mw-actions"><button disabled={busy === item.id} onClick={() => void act(item.id, "APPROVE")}>Approve</button><button disabled={busy === item.id} onClick={() => void act(item.id, "REJECT")}>Reject</button></div>}{item.status === "APPROVED" && <div className="mw-paid"><input aria-label={`Payout reference for ${item.id}`} value={references[item.id] || ""} maxLength={300} onChange={(event) => setReferences((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Payout reference" /><button disabled={busy === item.id} onClick={() => void act(item.id, "PAID")}>Mark Paid</button></div>}</td></tr>)}</tbody></table></div>{loading && <div className="mw-empty">Loading withdrawal requests…</div>}{!loading && !error && !withdrawals.length && <div className="mw-empty">No pending withdrawals.</div>}{nextCursor && <div className="mw-more"><button disabled={loadingMore} onClick={() => void load(nextCursor)}>{loadingMore ? "Loading…" : "Load more requests"}</button></div>}</section>
    <style jsx global>{`.mw-head{position:relative;margin-bottom:20px}.mw-head span{font-size:11px;font-weight:800;letter-spacing:.12em;color:#64748b}.mw-head h1{margin:5px 0;font-size:30px}.mw-head p{margin:0;color:#64748b;font-size:13px}.mw-head>button{position:absolute;right:0;top:5px;padding:9px 14px;border:1px solid #dbe1ea;border-radius:8px;background:#fff}.mw-message{margin:12px 0;padding:12px;border-radius:9px;font-size:12px}.mw-message.error{background:#fef2f2;color:#991b1b}.mw-message.success{background:#f0fdf4;color:#166534}.mw-panel{background:#fff;border:1px solid #e5e7eb;border-radius:15px;padding:18px}.mw-table-wrap{overflow:auto}.mw-panel table{width:100%;min-width:1000px;border-collapse:collapse}.mw-panel th{background:#f8fafc;text-align:left;padding:11px;font-size:9px;color:#64748b;text-transform:uppercase}.mw-panel td{padding:12px;border-top:1px solid #eef2f7;font-size:11px}.mw-actions,.mw-paid{display:flex;gap:6px;align-items:center}.mw-actions button,.mw-paid button{border:0;border-radius:7px;padding:8px 9px;font-size:10px;font-weight:800;cursor:pointer}.mw-actions button:first-child{background:#dcfce7;color:#166534}.mw-actions button:last-child{background:#fee2e2;color:#991b1b}.mw-paid input{min-width:140px;height:32px;border:1px solid #dbe1ea;border-radius:7px;padding:0 8px}.mw-paid button{background:#0f172a;color:#fff}.mw-empty{text-align:center;padding:35px;color:#64748b}.mw-more{text-align:center;padding:12px}.mw-more button{padding:9px 13px;border:1px solid #dbe1ea;border-radius:8px;background:white}@media(max-width:600px){.mw-head>button{position:static;margin-top:12px}}`}</style>
  </ManagerShell>
}
