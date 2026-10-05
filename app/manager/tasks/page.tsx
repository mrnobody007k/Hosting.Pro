"use client"

import { useEffect, useState } from "react"
import Decimal from "decimal.js"
import ManagerShell from "../ManagerShell"

type Task = {
  id: string; title: string; description: string | null; type: string; dayNumber: number
  profitRate: string; profitAmount: string; status: string; assignedAt: string
  submittedAt: string | null; completedAt: string | null; settlementEligibleAt?: string | null
  user: { id: string; name: string; email: string }
  order: { id: string; orderCode: string; amount: string; profit: string; finalReturnAmount: string | null; status: string; paymentStatus: string; property: { title: string } } | null
}

export default function ManagerTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [manager, setManager] = useState("Manager")
  const [status, setStatus] = useState("ALL")
  const [cursor, setCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [finalReturns, setFinalReturns] = useState<Record<string, string>>({})
  const [clock, setClock] = useState(Date.now())

  async function load(append = false, pageCursor?: string) {
    if (append) setLoadingMore(true); else setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ status })
      if (pageCursor) params.set("cursor", pageCursor)
      const response = await fetch(`/api/manager/tasks?${params}`, { cache: "no-store" })
      if (response.status === 401) { window.location.href = "/manager-login"; return }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load manager tasks.")
      const page = Array.isArray(result.tasks) ? result.tasks : []
      setTasks((current) => append ? [...current, ...page] : page)
      setManager(result.manager?.name || "Manager")
      setCursor(page.at(-1)?.id || null)
      setNextCursor(result.nextCursor || null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load manager tasks.") }
    finally { setLoading(false); setLoadingMore(false) }
  }

  useEffect(() => { setCursor(null); void load(false) }, [status])

  useEffect(() => {
    const nextEligible = tasks
      .filter((task) => task.type === "RE_RENT" && ["SUBMITTED", "VERIFIED"].includes(task.status) && task.settlementEligibleAt)
      .map((task) => new Date(task.settlementEligibleAt!).getTime())
      .filter((time) => time > Date.now())
      .sort((left, right) => left - right)[0]
    if (!nextEligible) return
    const timer = window.setTimeout(() => setClock(Date.now()), Math.max(1, nextEligible - Date.now() + 5))
    return () => window.clearTimeout(timer)
  }, [tasks])

  function settlementPreview(task: Task) {
    const input = finalReturns[task.id]?.trim() || ""
    if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(input) || !task.order) return null
    try {
      const amount = new Decimal(input)
      const principal = new Decimal(task.order.amount)
      if (!amount.isFinite() || !amount.gt(0) || amount.gt("9999999999999999.99") || amount.lt(principal)) return null
      return { finalReturn: amount, revenue: amount.minus(principal) }
    } catch { return null }
  }

  async function review(task: Task, decision: "APPROVE" | "REJECT", finalReturnAmount?: string) {
    setBusy(task.id); setError("")
    try {
      const response = await fetch(`/api/manager/tasks/${encodeURIComponent(task.id)}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, ...(finalReturnAmount ? { finalReturnAmount } : {}) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to review this task.")
      await load(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to review this task.") }
    finally { setBusy("") }
  }

  return <ManagerShell managerName={manager}>
    <div className="mt-head"><div><span>TASK OPERATIONS</span><h1>Task Center</h1><p>Review client activity and approve final Re-Rent returns.</p></div><button onClick={() => void load(false)} disabled={loading}>Refresh</button></div>
    <div className="mt-filter"><label>Task status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="SUBMITTED">Awaiting review</option><option value="VERIFIED">Verified</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option></select></label></div>
    {error && <div className="mt-error" role="alert">{error} <button onClick={() => void load(false)}>Retry</button></div>}
    <section className="mt-panel">{tasks.map((task) => {
      const preview = settlementPreview(task)
      const settlementTask = task.type === "RE_RENT" && ["SUBMITTED", "VERIFIED"].includes(task.status) && Boolean(task.order)
      const eligibleAt = task.settlementEligibleAt ? new Date(task.settlementEligibleAt).getTime() : Number.POSITIVE_INFINITY
      const waitSeconds = Math.max(0, Math.ceil((eligibleAt - clock) / 1000))
      return <article className="mt-row" key={task.id}>
        <div className="mt-main"><strong>{task.title}</strong><small>{task.user.name} · {task.user.email} · {task.order?.orderCode || "No linked order"} · {task.order?.property.title || "Property unavailable"}</small>{task.description && <p>{task.description}</p>}<small>{task.type.replaceAll("_", " ")} · Day {task.dayNumber}{task.type !== "RE_RENT" ? ` · ${task.profitRate}% task tier` : ""} · Assigned {new Date(task.assignedAt).toLocaleString("en-GB")}</small>{task.order && <small>Original Rent ₹{task.order.amount} · {task.order.paymentStatus} · {task.order.status}</small>}{task.submittedAt && <small>Submitted {new Date(task.submittedAt).toLocaleString("en-GB")}</small>}{task.completedAt && <small>Completed {new Date(task.completedAt).toLocaleString("en-GB")} · revenue recorded ₹{task.profitAmount}{task.order?.finalReturnAmount ? ` · final return ₹${task.order.finalReturnAmount}` : ""}</small>}</div>
        <div className="mt-review"><b className={`mt-status ${task.status.toLowerCase()}`}>{settlementTask ? "Pending manager settlement" : task.status === "SUBMITTED" ? "Awaiting review" : task.status === "VERIFIED" ? "Verified · awaiting settlement" : task.status === "REJECTED" ? "Not approved" : task.status}</b>
          {settlementTask && task.order && <div className="mt-settlement"><label>Final Return Amount (₹)<input type="number" min={task.order.amount} step="0.01" inputMode="decimal" value={finalReturns[task.id] || ""} onChange={(event) => setFinalReturns((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Enter approved return" /></label><div className="mt-preview"><span>Original Rent <b>₹{new Decimal(task.order.amount).toFixed(2)}</b></span>{preview && <><span>Revenue / Profit <b>₹{preview.revenue.toFixed(2)}</b></span><span>Client Credit <b>₹{preview.finalReturn.toFixed(2)}</b></span></>}</div>{waitSeconds > 0 && <small>Settlement available in {waitSeconds} seconds after submission.</small>}<button className="mt-settle-button" disabled={busy === task.id || !preview || waitSeconds > 0} onClick={() => preview && void review(task, "APPROVE", preview.finalReturn.toFixed(2))}>{busy === task.id ? "Settling…" : "Approve settlement"}</button><button className="mt-reject-button" disabled={busy === task.id} onClick={() => void review(task, "REJECT")}>Reject activity</button></div>}
          {task.status === "SUBMITTED" && task.type !== "RE_RENT" && <div className="mt-actions"><button disabled={busy === task.id} onClick={() => void review(task, "APPROVE")}>{busy === task.id ? "Saving…" : "Approve"}</button><button disabled={busy === task.id} onClick={() => void review(task, "REJECT")}>Reject</button></div>}
        </div>
      </article>
    })}{loading && !tasks.length && <div className="mt-empty">Loading tasks…</div>}{!loading && !error && !tasks.length && <div className="mt-empty">No tasks match this status.</div>}{nextCursor && <div className="mt-more"><button onClick={() => void load(true, cursor || undefined)} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more tasks"}</button></div>}</section>
    <style jsx global>{`.mt-head{display:flex;justify-content:space-between;gap:20px;margin-bottom:18px}.mt-head span{font-size:11px;font-weight:800;letter-spacing:.12em;color:#64748b}.mt-head h1{margin:5px 0;font-size:30px}.mt-head p{margin:0;color:#64748b;font-size:13px}.mt-head>button,.mt-more button{height:38px;border:1px solid #dbe1ea;border-radius:9px;background:white;padding:0 14px;font-weight:700}.mt-filter{margin-bottom:14px}.mt-filter label{display:flex;align-items:center;gap:9px;color:#475467;font-size:12px}.mt-filter select{height:36px;border:1px solid #dbe1ea;border-radius:8px;background:white;padding:0 10px}.mt-error{margin-bottom:13px;padding:12px;border-radius:9px;background:#fef2f2;color:#991b1b;font-size:12px}.mt-error button{margin-left:8px}.mt-panel{background:white;border:1px solid #e5e7eb;border-radius:15px;padding:8px 18px}.mt-row{display:flex;align-items:flex-start;gap:14px;padding:16px 0;border-bottom:1px solid #eef2f7}.mt-row:last-of-type{border-bottom:0}.mt-main{flex:1;min-width:0}.mt-main>*{display:block}.mt-main strong{font-size:13px}.mt-main small{margin-top:5px;color:#64748b;font-size:10px;overflow-wrap:anywhere}.mt-main p{margin:6px 0;color:#475467;font-size:11px;line-height:1.5}.mt-review{display:grid;gap:10px;justify-items:end}.mt-actions{display:flex;gap:8px}.mt-actions button,.mt-settle-button,.mt-reject-button{border:1px solid #dbe1ea;border-radius:8px;background:white;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer}.mt-actions button:first-child,.mt-settle-button{background:#183a33;color:white}.mt-actions button:last-child,.mt-reject-button{color:#991b1b}.mt-actions button:disabled,.mt-settle-button:disabled,.mt-reject-button:disabled{opacity:.55;cursor:not-allowed}.mt-status{flex:none;font-size:9px;padding:5px 8px;border-radius:999px;background:#f1f5f9}.mt-status.completed{background:#dcfce7;color:#166534}.mt-status.pending,.mt-status.submitted{background:#fef3c7;color:#92400e}.mt-status.verified{background:#dbeafe;color:#1e40af}.mt-status.rejected{background:#fee2e2;color:#991b1b}.mt-empty{text-align:center;padding:42px;color:#64748b}.mt-more{text-align:center;padding:15px}.mt-settlement{width:min(100%,330px);display:grid;gap:9px}.mt-settlement label{display:grid;gap:5px;font-size:10px;font-weight:700;color:#475467}.mt-settlement input{min-height:37px;border:1px solid #d6dce4;border-radius:8px;padding:0 10px;font:inherit}.mt-preview{display:grid;gap:4px;padding:10px;border-radius:9px;background:#f6f7f5;font-size:10px;color:#64716a}.mt-preview span{display:flex;justify-content:space-between;gap:8px}.mt-preview b{color:#20382f}.mt-settlement>small{color:#8a6228;font-size:10px}@media(max-width:620px){.mt-head{flex-direction:column}.mt-row{flex-direction:column}.mt-review{justify-items:start}.mt-filter label{align-items:flex-start;flex-direction:column}}`}</style>
  </ManagerShell>
}
