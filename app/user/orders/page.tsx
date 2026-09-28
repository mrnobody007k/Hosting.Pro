"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, money } from "../CustomerUI"

type Order = { id: string; orderCode: string; amount: string | number; profit?: string | number; status: string; paymentStatus?: string; createdAt: string; property?: { title: string; location?: string | null } }

export default function UserOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [name, setName] = useState("Client")
  const [membership, setMembership] = useState("Member")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [orderResponse, accountResponse] = await Promise.all([
        fetch("/api/user/orders", { cache: "no-store" }),
        fetch("/api/user/overview", { cache: "no-store" }),
      ])
      if (orderResponse.status === 401 || accountResponse.status === 401) { window.location.href = "/login"; return }
      const [orderData, accountData] = await Promise.all([orderResponse.json(), accountResponse.json()])
      if (!orderResponse.ok) throw new Error(orderData.error || "Unable to load your bookings.")
      if (!accountResponse.ok) throw new Error(accountData.error || "Unable to load your account.")
      setOrders(orderData.orders || [])
      setName(accountData.user?.name || "Client")
      setMembership(customerStatus(accountData.user?.membershipStatus))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your bookings.")
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return orders.filter((order) => !query || [order.orderCode, order.property?.title, order.status].filter(Boolean).join(" ").toLowerCase().includes(query))
  }, [orders, search])

  return <UserShell userName={name} membership={membership}>
    <CustomerPageHeader eyebrow="YOUR ACCOUNT" title="My bookings" description="Keep track of your property bookings and payment progress." />
    <div className="property-toolbar"><label htmlFor="orders-search">Find a booking</label><input id="orders-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by booking code or property" /></div>
    <CustomerPageState loading={loading} error={error} retry={() => void load()} />
    {!loading && !error && filtered.length === 0 && <CustomerPageState emptyTitle={search ? "No matching bookings" : "No bookings yet"} emptyText={search ? "Try a different code or property name." : "Bookings you create will appear here."} />}
    {!loading && !error && filtered.length > 0 && <section className="order-list">
      {filtered.map((order) => <article className="order-list-card customer-surface" key={order.id}>
        <div className="order-list-main"><span className="order-list-kicker">BOOKING {order.orderCode}</span><h2>{order.property?.title || "Property booking"}</h2><p>{order.property?.location || "Housing.pro marketplace"} · {new Date(order.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p></div>
        <div className="order-list-amount"><span>Amount</span><strong>{money(order.amount)}</strong></div>
        <div className="order-list-status"><span>Booking</span><b className="customer-status-pill">{customerStatus(order.status)}</b><small>Payment: {customerStatus(order.paymentStatus)}</small></div>
        <Link href={"/user/orders/" + order.id} className="order-list-link">View booking →</Link>
      </article>)}
    </section>}
  </UserShell>
}
