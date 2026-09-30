"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, money, customerStatus } from "../CustomerUI"

function statusClass(status?: string) {
  const s = String(status || "").toUpperCase()

  if (["ACTIVE", "APPROVED", "COMPLETED", "PAID", "OFFICIAL_MEMBER", "VERIFIED"].includes(s)) {
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
  tasks?: { id: string; type: string; status: string; dayNumber: number; assignedAt: string; submittedAt: string | null }[]
}
type AssignedTask = { id: string; type: string; title: string; status: string; dayNumber: number; assignedAt: string; submittedAt: string | null; completedAt?: string | null; profitAmount: string | number; order: { id: string; orderCode: string; status: string; rerentedAt: string | null; property: Order["property"] } | null }

export default function RerentPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function load() {
    try {
      setLoading(true)
      setError("")
      const [res, taskResponse] = await Promise.all([fetch("/api/user/orders", { cache: "no-store" }), fetch("/api/user/tasks", { cache: "no-store" })])
      if ([res, taskResponse].some((response) => response.status === 401)) { window.location.href = "/login"; return }
      const [json, taskData] = await Promise.all([res.json(), taskResponse.json()])
      if (!res.ok) throw new Error(json?.error || "Unable to load bookings")
      if (!taskResponse.ok) throw new Error(taskData?.error || "Unable to load assigned activities")
      setOrders(json.orders || [])
      setAssignedTasks(taskData.tasks || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const pendingTaskIds = assignedTasks.filter((task) => task.status === "VERIFIED").map((task) => task.id)
    if (!pendingTaskIds.length) return

    let stopped = false
    const settle = async () => {
      let completed = false
      for (const taskId of pendingTaskIds) {
        try {
          const response = await fetch("/api/user/tasks/settle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId }),
          })
          if (!response.ok) continue
          const result = await response.json()
          completed ||= result.completed === true
        } catch {
          // Retry on the next interval if the network is temporarily unavailable.
        }
      }
      if (completed && !stopped) await load()
    }

    let timer: number | undefined
    const poll = async () => {
      await settle()
      if (!stopped) timer = window.setTimeout(() => { void poll() }, 30000)
    }
    timer = window.setTimeout(() => { void poll() }, 30000)
    return () => { stopped = true; if (timer !== undefined) window.clearTimeout(timer) }
  }, [assignedTasks])

  const assignedOrderIds = new Set(assignedTasks.flatMap((task) => task.order ? [task.order.id] : []))
  const activeOrders = orders.filter(o => o.status === "ACTIVE" && o.paymentStatus === "PAID" && !assignedOrderIds.has(o.id))
  const taskOrders = assignedTasks.filter((task) => task.order).map((task) => ({
    id: task.order!.id, orderCode: task.order!.orderCode, amount: "0", profit: "0", profitRate: "0",
    status: task.order!.status, paymentStatus: "PAID", property: task.order!.property,
    rerentRequestedAt: task.submittedAt, rerentedAt: task.order!.rerentedAt, createdAt: task.assignedAt,
    tasks: [task],
  } as Order))
  const rerentPending = taskOrders.filter((order) => order.tasks?.some((task) => task.status !== "COMPLETED"))
  const rerented = taskOrders.filter((order) => order.tasks?.some((task) => task.status === "COMPLETED"))

  return <UserShell>
    <CustomerPageHeader eyebrow="RE-RENT CENTER" title="Re-Rent Activities" description="Your manager assigns Re-Rent activities to eligible bookings. Complete an assigned activity from your Task Center; settlement is then processed after the configured delay." action={<button className="hp-user-btn hp-user-btn-secondary" type="button" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh status"}</button>} />
    {error && !loading && <div role="alert" className="rerent-error">{error}</div>}
    <CustomerPageState loading={loading} error={error} retry={load} />

    {!loading && !error && <>
      <section className="rerent-stats">
        <article className="rerent-stat">
          <span>Recent Bookings Awaiting Assignment</span>
          <strong>{activeOrders.length}</strong>
          <small>Shown from your latest booking records</small>
        </article>
        <article className="rerent-stat">
          <span>Re-Rent Pending</span>
          <strong>{rerentPending.length}</strong>
          <small>Assigned or awaiting settlement</small>
        </article>
        <article className="rerent-stat">
          <span>Completed Re-Rents</span>
          <strong>{rerented.length}</strong>
          <small>Re-rented and earning</small>
        </article>
      </section>

      {activeOrders.length > 0 && (
        <section className="rerent-section">
          <h2>Awaiting Manager Assignment</h2>
          <p className="rerent-section-desc">These active, payment-confirmed bookings do not have a Re-Rent activity assigned yet. Your manager will assign the activity when it is ready; you cannot create a Re-Rent request directly.</p>
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
                  </div>
                  <div className="rerent-actions">
                    <Link href={`/user/orders/${order.id}`} className="hp-user-btn hp-user-btn-secondary">View Details</Link>
                    <Link href="/user/tasks" className="hp-user-btn hp-user-btn-primary">Task Center</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {rerentPending.length > 0 && (
        <section className="rerent-section">
          <h2>Assigned and Processing</h2>
          <p className="rerent-section-desc">Submit your assigned activity for manager verification. Settlement occurs only after approval and the configured delay from submission.</p>
          <div className="rerent-list">
            {rerentPending.map((order) => {
              const task = order.tasks?.find(item => item.type === "RE_RENT")
              const awaitingUser = task?.status === "PENDING" || task?.status === "IN_PROGRESS"
              const stateText = awaitingUser && task?.dayNumber === 0
                ? "Your existing Re-Rent request is ready to submit in the Task Center."
                : awaitingUser
                  ? "Your manager assigned an activity. Submit it in the Task Center for verification."
                : task?.status === "SUBMITTED"
                  ? "Your activity is awaiting manager verification. No profit is credited yet."
                : task?.status === "VERIFIED"
                  ? "Your activity is verified. Settlement will complete after the configured delay from submission."
                : task?.status === "REJECTED"
                  ? "Your activity was not approved; no profit was credited. Retry the activity in the Task Center."
                  : "This booking is awaiting a Re-Rent assignment from your manager."

              return <div className="rerent-row" key={order.id}>
                <div>
                  <strong>{order.property?.title || order.orderCode}</strong>
                  <div className="rerent-row-meta">Order {order.orderCode} · {stateText}</div>
                </div>
                <span className={`rerent-status ${statusClass(order.status)}`}>
                  {customerStatus(order.status)}
                </span>
                {task && <Link href="/user/tasks" className="hp-user-btn hp-user-btn-secondary">Open Task Center</Link>}
              </div>
            })}
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
                    <div><strong>Completed:</strong> {order.tasks?.find((task) => task.type === "RE_RENT")?.submittedAt ? new Date(order.tasks.find((task) => task.type === "RE_RENT")!.submittedAt!).toLocaleString("en-IN") : "Settlement recorded"}</div>
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
          <p>Eligible bookings wait for a Re-Rent activity assigned by your manager. Submitted activities update here when settlement completes.</p>
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
      .rerent-notice,.rerent-error{padding:12px 15px;border-radius:10px;margin-bottom:14px;font-size:13px}.rerent-notice{background:#ecfdf5;color:#166534}.rerent-error{background:#fef2f2;color:#991b1b}
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
