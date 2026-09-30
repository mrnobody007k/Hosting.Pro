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

export default function ManagerDepositsPage() {
  const [deposits, setDeposits] = useState<any[]>([])
  const [manager, setManager] = useState("Manager")
  const [busy, setBusy] = useState("")
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
      const response = await fetch(`/api/manager/deposits?${params}`, { cache: "no-store" })
      if (response.status === 401) { window.location.href = "/manager-login"; return }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load deposit requests.")
      setDeposits((current) => pageCursor ? [...current, ...(result.deposits || [])] : (result.deposits || [])); setManager(result.manager?.name || "Manager")
      setNextCursor(result.nextCursor || null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load deposit requests.") }
    finally { setLoading(false); setLoadingMore(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function act(id: string, action: "APPROVE" | "REJECT") {
    setBusy(id); setError(""); setNotice("")
    try {
      const response = await fetch("/api/manager/deposits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to process this deposit.")
      setNotice(action === "APPROVE" ? "Deposit approved and credited to the client wallet." : "Deposit rejected.")
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to process this deposit.") }
    finally { setBusy("") }
  }

  return <ManagerShell managerName={manager}>
    <div className="mf-head"><span>FINANCE</span><h1>Deposit Requests</h1><p>Review manual client deposits. Approval credits the submitted amount once.</p><button onClick={() => void load()} disabled={loading}>Refresh</button></div>
    {error && <div className="mf-message error" role="alert">{error}</div>}{notice && <div className="mf-message success" role="status">{notice}</div>}
    <section className="mf-panel"><div className="mf-table-wrap"><table><thead><tr><th>Client</th><th>Amount</th><th>Reference</th><th>Proof</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>{deposits.map((deposit) => <tr key={deposit.id}><td><b>{deposit.user?.name || deposit.user?.email || "Client"}</b></td><td>{money(deposit.amount)}</td><td>{deposit.reference || "—"}</td><td>{deposit.proofUrl ? <a href={deposit.proofUrl} target="_blank" rel="noopener noreferrer">Open proof ↗</a> : "—"}</td><td>{deposit.status}</td><td>{new Date(deposit.createdAt).toLocaleDateString("en-GB")}</td><td>{deposit.status === "PENDING" && <div className="mf-actions"><button disabled={busy === deposit.id} onClick={() => void act(deposit.id, "APPROVE")}>Approve</button><button disabled={busy === deposit.id} onClick={() => void act(deposit.id, "REJECT")}>Reject</button></div>}</td></tr>)}</tbody></table></div>{loading && <div className="mf-empty">Loading deposit requests…</div>}{!loading && !error && !deposits.length && <div className="mf-empty">No pending deposit requests.</div>}{nextCursor && <div className="mf-more"><button disabled={loadingMore} onClick={() => void load(nextCursor)}>{loadingMore ? "Loading…" : "Load more requests"}</button></div>}</section>
    <style jsx global>{`.mf-head{position:relative;margin-bottom:20px}.mf-head span{font-size:11px;font-weight:800;letter-spacing:.12em;color:#64748b}.mf-head h1{margin:5px 0;font-size:30px}.mf-head p{margin:0;color:#64748b;font-size:13px}.mf-head>button{position:absolute;right:0;top:5px;padding:9px 14px;border:1px solid #dbe1ea;border-radius:8px;background:#fff}.mf-message{margin:12px 0;padding:12px;border-radius:9px;font-size:12px}.mf-message.error{background:#fef2f2;color:#991b1b}.mf-message.success{background:#f0fdf4;color:#166534}.mf-panel{background:#fff;border:1px solid #e5e7eb;border-radius:15px;padding:18px}.mf-table-wrap{overflow:auto}.mf-panel table{width:100%;min-width:800px;border-collapse:collapse}.mf-panel th{background:#f8fafc;text-align:left;padding:11px;font-size:9px;color:#64748b;text-transform:uppercase}.mf-panel td{padding:12px;border-top:1px solid #eef2f7;font-size:11px}.mf-actions{display:flex;gap:5px}.mf-actions button{border:0;border-radius:7px;padding:7px 9px;font-size:10px;font-weight:800;cursor:pointer}.mf-actions button:first-child{background:#dcfce7;color:#166534}.mf-actions button:last-child{background:#fee2e2;color:#991b1b}.mf-empty{text-align:center;padding:35px;color:#64748b}.mf-more{text-align:center;padding:12px}.mf-more button{padding:9px 13px;border:1px solid #dbe1ea;border-radius:8px;background:white}`}</style>
  </ManagerShell>
}
