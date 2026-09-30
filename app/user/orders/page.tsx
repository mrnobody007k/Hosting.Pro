"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, money, useCustomerOverview } from "../CustomerUI"

type Order = { id: string; orderCode: string; amount: string | number; status: string; paymentStatus: string; createdAt: string; property?: { title: string; location?: string | null; imageUrl?: string | null } | null; tasks?: Array<{ type: string; status: string }> }
const tabs = [{ label: "All bookings", value: "ALL" }, { label: "Awaiting payment", value: "PENDING" }, { label: "Completed", value: "COMPLETED" }, { label: "Re-Rent", value: "RE_RENT" }]

export default function UserOrdersPage() {
  const { data: account } = useCustomerOverview()
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("ALL")
  const [cursor, setCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async (append = false, signal?: AbortSignal) => {
    if (append) setLoadingMore(true); else setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ q: search.trim(), status: filter })
      if (append && cursor) params.set("cursor", cursor)
      const response = await fetch(`/api/user/orders?${params}`, { cache: "no-store", signal })
      if (response.status === 401) { window.location.href = "/login"; return }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load your bookings.")
      const page = Array.isArray(result.orders) ? result.orders : []
      setOrders((current) => append ? [...current, ...page] : page)
      setCursor(page.at(-1)?.id || null)
      setNextCursor(result.nextCursor || null)
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return
      setError(cause instanceof Error ? cause.message : "Unable to load your bookings.")
    } finally { setLoading(false); setLoadingMore(false) }
  }, [search, filter, cursor])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => { setCursor(null); void load(false, controller.signal) }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [search, filter])

  return <UserShell userName={account?.user?.name || "Client"} membership={customerStatus(account?.user?.membershipStatus)}>
    <CustomerPageHeader eyebrow="YOUR ACCOUNT" title="My bookings" description="Review each property request, payment status, and Re-Rent activity." />
    <div className="customer-order-toolbar"><label htmlFor="orders-search">Search bookings</label><input id="orders-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Booking code, property, or location" /></div>
    <div className="customer-order-tabs" role="tablist" aria-label="Filter bookings">{tabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={filter === tab.value} className={filter === tab.value ? "active" : ""} onClick={() => setFilter(tab.value)}>{tab.label}</button>)}</div>
    <CustomerPageState loading={loading} error={error} retry={() => void load()} />
    {!loading && !error && orders.length === 0 && <CustomerPageState emptyTitle="No bookings in this view" emptyText="Property requests and their payment progress will appear here." />}
    {!loading && !error && orders.length > 0 && <section className="order-list" aria-label="Your property bookings">
      {orders.map((order) => <article className="order-list-card customer-surface" key={order.id}>
        <div className="customer-order-property">{order.property?.imageUrl ? <img src={order.property.imageUrl} alt="" loading="lazy" /> : <div aria-hidden="true">H</div>}<div className="order-list-main"><span className="order-list-kicker">BOOKING {order.orderCode}</span><h2>{order.property?.title || "Property booking"}</h2><p>{order.property?.location || "Housing.pro marketplace"} · {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p></div></div>
        <div className="order-list-amount"><span>Rental amount</span><strong>{money(order.amount)}</strong></div>
        <div className="order-list-status"><span>Booking</span><b className="customer-status-pill">{customerStatus(order.status)}</b><small>Payment: {customerStatus(order.paymentStatus)}</small>{order.tasks?.some((task) => task.type === "RE_RENT") && <small>Re-Rent activity assigned</small>}</div>
        <Link href={`/user/orders/${order.id}`} className="order-list-link">View details →</Link>
      </article>)}
      {nextCursor && <div className="customer-load-more"><button className="customer-primary-button" onClick={() => void load(true)} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more bookings"}</button></div>}
    </section>}
    <style jsx global>{`.customer-order-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:13px}.customer-order-toolbar label{font-size:12px;font-weight:700;color:#526158}.customer-order-toolbar input{width:min(500px,100%);min-height:42px;padding:0 12px;border:1px solid #dce4dc;border-radius:9px;background:#fff;font:inherit;font-size:12px}.customer-order-tabs{display:flex;gap:8px;overflow-x:auto;padding:0 0 16px}.customer-order-tabs button{flex:none;min-height:38px;padding:0 14px;border:1px solid #dce4dc;border-radius:999px;background:#fff;color:#526158;font:inherit;font-size:11px;font-weight:700}.customer-order-tabs button.active{border-color:#315c45;background:#315c45;color:white}.customer-order-property{display:flex;align-items:center;gap:13px;min-width:0}.customer-order-property>img,.customer-order-property>div{width:68px;height:60px;flex:none;object-fit:cover;border-radius:9px;background:#eff4ed}.customer-order-property>div{display:grid;place-items:center;color:#315c45;font-weight:800}.customer-load-more{display:flex;justify-content:center;padding:20px}.customer-primary-button{min-height:42px;padding:0 17px;border:0;border-radius:9px;background:#315c45;color:#fff;font:inherit;font-size:12px;font-weight:750;cursor:pointer}.customer-primary-button:disabled{opacity:.6;cursor:wait}@media(max-width:760px){.customer-order-toolbar{align-items:stretch;flex-direction:column;gap:6px}.customer-order-toolbar input{width:100%}}`}</style>
  </UserShell>
}
