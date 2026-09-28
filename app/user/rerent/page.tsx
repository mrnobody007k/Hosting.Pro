"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Decimal } from "decimal.js"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, money, customerStatus } from "../CustomerUI"

function statusClass(status?: string) {
  const s = String(status || "").toUpperCase()

  if (["ACTIVE", "APPROVED", "COMPLETED", "PAID", "OFFICIAL_MEMBER"].includes(s)) {
    return "hp-status hp-status-success"
  }

  if (["PENDING", "PAYMENT_PENDING", "PAYMENT_SUBMITTED", "RE_RENT_PENDING"].includes(s)) {
    return "hp-status hp-status-warning"
  }

  if (["REJECTED", "CANCELLED", "DISABLED", "SUSPENDED"].includes(s)) {
    return "hp-status hp-status-danger"
  }

  return "hp-status hp-status-neutral"
}

type Order = {
  id: string
  orderCode: string
  amount: number | string
  profit: number | string
  profitRate: number | string
  status: string
  paymentStatus: string
  property: {
    id: string
    title: string
    location: string | null
    imageUrl: string | null
  } | null
  rerentRequestedAt: string | null
  rerentedAt: string | null
  createdAt: string
}

export default function RerentPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function load() {
    try {
      setLoading(true)
      setError("")
      const res = await fetch("/api/user/orders", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Unable to load orders")
      setOrders(json.orders || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const activeOrders = orders.filter(o => o.status === "ACTIVE" && o.paymentStatus === "PAID")
  const rerentPending = orders.filter(o => o.status === "RE_RENT_PENDING")
  const rerented = orders.filter(o => o.status === "RE_RENTED" || o.status === "COMPLETED")

  return <UserShell>
    <CustomerPageHeader eyebrow="RE-RENT CENTER" title="Re-Rent Your Properties" description="When a rental period ends, submit a Re-Rent request to re-list the property and earn additional profit." />
    <CustomerPageState loading={loading} error={error} retry={load} />

    {!loading && !error && <>
      <section className="rerent-stats">
        <article className="rerent-stat">
          <span>Eligible for Re-Rent</span>
          <strong>{activeOrders.length}</strong>
          <small>Active orders ready for re-rent</small>
        </article>
        <article className="rerent-stat">
          <span>Re-Rent Pending</span>
          <strong>{rerentPending.length}</strong>
          <small>Awaiting processing</small>
        </article>
        <article className="rerent-stat">
          <span>Completed Re-Rents</span>
          <strong>{rerented.length}</strong>
          <small>Re-rented and earning</small>
        </article>
      </section>

      {activeOrders.length > 0 && (
        <section className="rerent-section">
          <h2>Available for Re-Rent</h2>
          <p className="rerent-section-desc">These active orders have completed their rental period. Submit a Re-Rent request to re-list the property and earn 1.2% re-rent profit.</p>
          <div className="rerent-grid">
            {activeOrders.map((order) => (
              <article className="rerent-card" key={order.id}>
                <div className="rerent-media">
                  {order.property?.imageUrl ? (
                    <img src={order.property.imageUrl} alt={order.property.title} />
                  ) : (
                    <div className="rerent-placeholder">Housing.pro</div>
                  )}
                  <span className="rerent-badge">Active</span>
                </div>
                <div className="rerent-body">
                  <div className="rerent-location">{order.property?.location || "Property Marketplace"}</div>
                  <h3>{order.property?.title || "Property"}</h3>
                  <div className="rerent-details">
                    <div><strong>Order:</strong> {order.orderCode}</div>
                    <div><strong>Original Amount:</strong> {money(order.amount)}</div>
                    <div><strong>Re-Rent Profit Rate:</strong> 1.2%</div>
                    <div><strong>Est. Re-Rent Profit:</strong> {money(new Decimal(String(order.amount)).mul(1.2).div(100))}</div>
                  </div>
                  <div className="rerent-actions">
                    <Link href={`/user/orders/${order.id}`} className="hp-user-btn hp-user-btn-secondary">View Details</Link>
                    <form action="/api/user/tasks/rerent" method="POST">
                      <input type="hidden" name="orderId" value={order.id} />
                      <button className="hp-user-btn hp-user-btn-primary" type="submit">Request Re-Rent</button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {rerentPending.length > 0 && (
        <section className="rerent-section">
          <h2>Re-Rent Pending</h2>
          <p className="rerent-section-desc">Your Re-Rent requests are being processed. You will be notified when complete.</p>
          <div className="rerent-list">
            {rerentPending.map((order) => (
              <div className="rerent-row" key={order.id}>
                <div>
                  <strong>{order.property?.title || order.orderCode}</strong>
                  <div className="rerent-row-meta">Order {order.orderCode} · Requested {order.rerentRequestedAt ? new Date(order.rerentRequestedAt).toLocaleString() : "recently"}</div>
                </div>
                <span className={`rerent-status ${statusClass(order.status)}`}>
                  {customerStatus(order.status)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {rerented.length > 0 && (
        <section className="rerent-section">
          <h2>Completed Re-Rents</h2>
          <p className="rerent-section-desc">These properties have been successfully re-rented and are earning profit.</p>
          <div className="rerent-grid">
            {rerented.map((order) => (
              <article className="rerent-card completed" key={order.id}>
                <div className="rerent-media">
                  {order.property?.imageUrl ? (
                    <img src={order.property.imageUrl} alt={order.property.title} />
                  ) : (
                    <div className="rerent-placeholder">Housing.pro</div>
                  )}
                  <span className="rerent-badge completed">Re-Rented</span>
                </div>
                <div className="rerent-body">
                  <div className="rerent-location">{order.property?.location || "Property Marketplace"}</div>
                  <h3>{order.property?.title || "Property"}</h3>
                  <div className="rerent-details">
                    <div><strong>Order:</strong> {order.orderCode}</div>
                    <div><strong>Re-Rent Profit:</strong> {money(order.profit)}</div>
                    <div><strong>Completed:</strong> {order.rerentedAt ? new Date(order.rerentedAt).toLocaleString() : "—"}</div>
                  </div>
                  <div className="rerent-actions">
                    <Link href={`/user/orders/${order.id}`} className="hp-user-btn hp-user-btn-secondary">View Details</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeOrders.length === 0 && rerentPending.length === 0 && rerented.length === 0 && (
        <div className="rerent-empty">
          <div className="rerent-empty-icon">↻</div>
          <h3>No Re-Rent Activity</h3>
          <p>When your rental orders complete, they will appear here for Re-Rent opportunities.</p>
          <Link href="/user/properties" className="hp-user-btn hp-user-btn-primary">Browse Properties</Link>
        </div>
      )}
    </>}

    <style jsx>{`
      .rerent-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
        margin-bottom: 24px;
      }
      .rerent-stat {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 20px;
        box-shadow: 0 5px 20px rgba(15,23,42,.04);
      }
      .rerent-stat span, .rerent-stat strong, .rerent-stat small { display: block; }
      .rerent-stat span { color: #64748b; font-size: 11px; font-weight: 750; }
      .rerent-stat strong { margin-top: 8px; color: #0f172a; font-size: 24px; }
      .rerent-stat small { margin-top: 6px; color: #94a3b8; font-size: 11px; }
      .rerent-section { margin-bottom: 28px; }
      .rerent-section h2 { margin: 0 0 6px; font-size: 19px; color: #0f172a; }
      .rerent-section-desc { margin: 0 0 16px; color: #64748b; font-size: 13px; }
      .rerent-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
      .rerent-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; box-shadow: 0 5px 20px rgba(15,23,42,.04); }
      .rerent-card.completed { border-color: #bbf7d0; }
      .rerent-media { position: relative; height: 160px; background: #f1f5f9; overflow: hidden; }
      .rerent-media img { width: 100%; height: 100%; object-fit: cover; }
      .rerent-placeholder { width: 100%; height: 100%; display: grid; place-items: center; color: #94a3b8; font-weight: 850; }
      .rerent-badge { position: absolute; top: 12px; right: 12px; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,.94); color: #166534; font-size: 9px; font-weight: 850; }
      .rerent-badge.completed { background: #dcfce7; color: #166534; }
      .rerent-body { padding: 16px; }
      .rerent-location { color: #64748b; font-size: 10px; font-weight: 700; margin-bottom: 4px; }
      .rerent-body h3 { margin: 0 0 12px; font-size: 15px; color: #0f172a; }
      .rerent-details { font-size: 12px; color: #475569; line-height: 2; margin-bottom: 16px; }
      .rerent-details strong { color: #0f172a; }
      .rerent-actions { display: flex; gap: 8px; }
      .rerent-actions .hp-user-btn { flex: 1; text-align: center; }
      .rerent-list { display: flex; flex-direction: column; gap: 10px; }
      .rerent-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; }
      .rerent-row strong { display: block; color: #0f172a; font-size: 14px; }
      .rerent-row-meta { margin-top: 4px; color: #64748b; font-size: 11px; }
      .rerent-status { padding: 5px 10px; border-radius: 999px; font-size: 10px; font-weight: 800; }
      .rerent-empty { text-align: center; padding: 60px 20px; color: #64748b; }
      .rerent-empty-icon { width: 56px; height: 56px; border-radius: 50%; background: #f1f5f9; display: grid; place-items: center; margin: 0 auto 12px; font-size: 24px; }
      .rerent-empty h3 { margin: 0 0 6px; color: #334155; font-size: 15px; }
      .rerent-empty p { margin: 0 0 18px; font-size: 13px; }
      @media (max-width: 760px) {
        .rerent-stats { grid-template-columns: 1fr; }
        .rerent-grid { grid-template-columns: 1fr; }
        .rerent-row { flex-direction: column; align-items: flex-start; gap: 8px; }
      }
    `}</style>
  </UserShell>
}