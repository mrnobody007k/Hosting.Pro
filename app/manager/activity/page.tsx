"use client"

import { useCallback, useEffect, useState } from "react"
import ManagerShell from "../ManagerShell"

type Event = { id: string; actorType: string; action: string; targetType: string | null; targetId: string | null; amount: string | null; createdAt: string }

export default function ManagerActivityPage() {
  const [manager, setManager] = useState("Manager")
  const [events, setEvents] = useState<Event[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async (append = false) => {
    if (append) setLoadingMore(true); else setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (append && cursor) params.set("cursor", cursor)
      const response = await fetch(`/api/manager/activity?${params}`, { cache: "no-store" })
      if (response.status === 401) { window.location.href = "/manager-login"; return }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load manager activity.")
      const page = Array.isArray(result.events) ? result.events : []
      setEvents((current) => append ? [...current, ...page] : page)
      setManager(result.manager?.name || "Manager")
      setCursor(page.at(-1)?.id || null)
      setNextCursor(result.nextCursor || null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load manager activity.") }
    finally { setLoading(false); setLoadingMore(false) }
  }, [cursor])

  useEffect(() => { void load(false) }, [])

  return <ManagerShell managerName={manager}>
    <div className="ma-head"><div><span>WORKSPACE ACTIVITY</span><h1>Activity</h1><p>Recent manager-scoped changes recorded in the audit log.</p></div><button onClick={() => void load(false)} disabled={loading}>Refresh</button></div>
    {error && <div className="ma-error" role="alert">{error} <button onClick={() => void load(false)}>Retry</button></div>}
    <section className="ma-panel"><div className="ma-table-wrap"><table><thead><tr><th>Action</th><th>Actor</th><th>Record</th><th>Amount</th><th>Time</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{event.action.replaceAll("_", " ").toLowerCase()}</td><td>{event.actorType}</td><td>{event.targetType || "—"}{event.targetId ? ` · ${event.targetId}` : ""}</td><td>{event.amount === null ? "—" : `₹${event.amount}`}</td><td>{new Date(event.createdAt).toLocaleString("en-GB")}</td></tr>)}</tbody></table></div>{loading && <div className="ma-empty">Loading activity…</div>}{!loading && !error && !events.length && <div className="ma-empty">No recorded manager activity yet.</div>}{nextCursor && <div className="ma-more"><button onClick={() => void load(true)} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load older activity"}</button></div>}</section>
    <style jsx global>{`.ma-head{display:flex;justify-content:space-between;gap:20px;margin-bottom:20px}.ma-head span{font-size:11px;font-weight:800;letter-spacing:.12em;color:#64748b}.ma-head h1{margin:5px 0;font-size:30px}.ma-head p{margin:0;color:#64748b;font-size:13px}.ma-head button,.ma-more button{height:38px;border:1px solid #dbe1ea;border-radius:9px;background:#fff;padding:0 14px;font-weight:700}.ma-error{margin-bottom:14px;padding:12px;border-radius:9px;background:#fef2f2;color:#991b1b}.ma-panel{background:#fff;border:1px solid #e5e7eb;border-radius:15px;padding:18px}.ma-table-wrap{overflow:auto}.ma-panel table{width:100%;min-width:700px;border-collapse:collapse}.ma-panel th{background:#f8fafc;text-align:left;padding:11px;font-size:9px;color:#64748b;text-transform:uppercase}.ma-panel td{padding:12px;border-top:1px solid #eef2f7;font-size:11px;overflow-wrap:anywhere}.ma-empty{text-align:center;padding:45px;color:#64748b}.ma-more{text-align:center;padding:14px}`}</style>
  </ManagerShell>
}
