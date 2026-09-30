"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import UserShell from "../UserShell"

type Notice = { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string }

export default function NotificationsPage() {
  const [items, setItems] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const cursorRef = useRef<string | null>(null)

  const load = useCallback(async (append = false) => {
    if (append) setLoadingMore(true); else setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (append && cursorRef.current) params.set("cursor", cursorRef.current)
      const response = await fetch(`/api/user/notifications?${params}`, { cache: "no-store" })
      if (response.status === 401) { window.location.href = "/login"; return }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Unable to load notifications.")
      const page = Array.isArray(data.notifications) ? data.notifications : []
      setItems((current) => append ? [...current, ...page] : page)
      cursorRef.current = data.nextCursor || null
      setNextCursor(data.nextCursor || null)
      window.dispatchEvent(new CustomEvent("housingpro:unread-count", { detail: Number(data.unreadCount || 0) }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load notifications.")
    } finally { setLoading(false); setLoadingMore(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function markRead(ids?: string[]) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { markAll: true }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Unable to update notifications.")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update notifications.")
    } finally { setBusy(false) }
  }

  const unread = items.filter((item) => !item.isRead).length
  return <UserShell>
    <div className="customer-page-heading"><div><span>YOUR ACCOUNT</span><h1>Notifications</h1><p>Booking and account updates, all in one place.</p></div>{unread > 0 && <button className="customer-action-button" onClick={() => markRead()} disabled={busy}>Mark all as read</button>}</div>
    {error && <div className="customer-page-error" role="alert">{error}<button onClick={() => void load()}>Try again</button></div>}
    <section className="customer-list-card" aria-live="polite">
      {loading ? <div className="customer-inline-state"><span className="customer-spinner" />Loading your updates…</div>
        : items.length === 0 ? <div className="customer-inline-state"><strong>You’re all caught up</strong><span>New booking and account updates will appear here.</span></div>
          : items.map((item) => <article key={item.id} className={`customer-notice ${item.isRead ? "read" : "unread"}`}>
            <span className="customer-notice-icon" aria-hidden="true">{item.type === "ORDER" ? "⌂" : item.type === "WALLET" ? "₹" : "•"}</span>
            <div className="customer-notice-copy"><div><strong>{item.title}</strong>{!item.isRead && <span className="customer-unread-dot" aria-label="Unread" />}</div><p>{item.message}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time></div>
            {!item.isRead && <button className="customer-mark-read" onClick={() => markRead([item.id])} disabled={busy}>Mark read</button>}
          </article>)}
    </section>
    {nextCursor && !loading && <div className="customer-notification-more"><button onClick={() => void load(true)} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load older notifications"}</button></div>}
    <style jsx global>{`.customer-page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin:4px 0 22px}.customer-page-heading>div>span{color:#63816e;font-size:10px;font-weight:800;letter-spacing:.13em}.customer-page-heading h1{margin:7px 0 5px;color:#20382f;font-family:Georgia,serif;font-size:32px;font-weight:500;letter-spacing:-.03em}.customer-page-heading p{margin:0;color:#68766e;font-size:13px}.customer-action-button,.customer-mark-read{border:1px solid #dce4dc;border-radius:8px;background:#fff;color:#345646;font-size:11px;font-weight:700;cursor:pointer}.customer-action-button{min-height:38px;padding:0 12px}.customer-mark-read{padding:8px 10px;white-space:nowrap}.customer-action-button:disabled,.customer-mark-read:disabled{opacity:.5;cursor:wait}.customer-page-error{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px;padding:12px;border:1px solid #f2cdca;border-radius:9px;background:#fff4f2;color:#9e3029;font-size:12px}.customer-page-error button{border:0;background:transparent;color:inherit;font-weight:750}.customer-list-card{overflow:hidden;border:1px solid #e7ebe4;border-radius:14px;background:#fff}.customer-inline-state{min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#7b887f;font-size:12px}.customer-inline-state strong{color:#20382f;font-size:15px}.customer-notice{display:flex;align-items:flex-start;gap:14px;padding:18px 20px;border-bottom:1px solid #eef1eb}.customer-notice:last-child{border-bottom:0}.customer-notice.unread{background:#f7faf6}.customer-notice-icon{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:10px;background:#e7efe6;color:#45634f;font-weight:800}.customer-notice-copy{min-width:0;flex:1}.customer-notice-copy>div{display:flex;align-items:center;gap:8px}.customer-notice-copy strong{font-size:13px;color:#20382f}.customer-notice-copy p{margin:5px 0;color:#59675f;font-size:12px;line-height:1.55}.customer-notice-copy time{color:#8b968e;font-size:10px}.customer-unread-dot{width:7px;height:7px;border-radius:50%;background:#63816e}.customer-spinner{width:18px;height:18px;border:2px solid #dce4dc;border-top-color:#63816e;border-radius:50%;animation:customer-spin .7s linear infinite}@keyframes customer-spin{to{transform:rotate(360deg)}}@media(max-width:620px){.customer-page-heading{align-items:flex-start;flex-direction:column}.customer-notice{padding:15px 12px;gap:10px}.customer-mark-read{font-size:10px;padding:7px}.customer-notice-copy p{font-size:11px}}`}</style>
  </UserShell>
}
