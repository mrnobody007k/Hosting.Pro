"use client"

import { useEffect, useState } from "react"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, useCustomerOverview, money, customerStatus } from "../CustomerUI"

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
  rerentedAt: string | null
  createdAt: string
}

export default function RevenuePage() {
  const { data, loading, error, reload } = useCustomerOverview({ includeFinancials: true })
  const user = data?.user
  const transactions = data?.transactions || []
  const earnings = data?.earnings
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)

  useEffect(() => {
    async function loadOrders() {
      try {
        setOrdersLoading(true)
        const res = await fetch("/api/user/orders", { cache: "no-store" })
        const json = await res.json()
        if (res.ok) setOrders(json.orders || [])
      } catch {
        // ignore
      } finally {
        setOrdersLoading(false)
      }
    }
    loadOrders()
  }, [])

  const recentEarnings = transactions
    .filter((item) => item.type === "PROFIT" || item.type === "WELCOME_BONUS")
    .slice(0, 20)
  const rerentedOrders = orders.filter((order) => order.status === "RE_RENTED" || order.status === "COMPLETED")

  function earningsLabel(item: (typeof transactions)[number]) {
    if (item.type === "WELCOME_BONUS") return "Welcome Bonus"
    if (item.note?.startsWith("Re-Rent profit")) return "Re-Rent Earnings"
    if (item.note?.startsWith("Day 2")) return "Day 2 Task Earnings"
    if (item.note?.startsWith("Day 3")) return "Day 3 Official Task Earnings"
    return "Task Earnings"
  }

  return <UserShell userName={user?.name || "Client"} membership={user?.membershipStatus?.replaceAll("_", " ")}>
    <CustomerPageHeader eyebrow="YOUR EARNINGS" title="Revenue" description="Track your task profits and re-rent income from Housing.pro bookings." />
    <CustomerPageState loading={loading} error={error} retry={() => void reload()} />

    {!loading && !error && <>
      <section className="revenue-summary">
        <article className="revenue-card primary">
          <span>Total Earnings</span>
          <strong>{money(earnings?.total ?? "0")}</strong>
          <small>Completed task and Re-Rent profit ledger credits</small>
        </article>
        <article className="revenue-card">
          <span>Task Profits</span>
          <strong>{money(earnings?.taskProfit ?? "0")}</strong>
          <small>Day 2 (1.2%) + Day 3 (1.4%)</small>
        </article>
        <article className="revenue-card">
          <span>Re-Rent Income</span>
          <strong>{money(earnings?.rerentProfit ?? "0")}</strong>
          <small>Profit from completed Re-Rent activities</small>
        </article>
        <article className="revenue-card">
          <span>Completed Tasks</span>
          <strong>
            {earnings?.taskCount ?? 0}
          </strong>
          <small>Task profit entries recorded</small>
        </article>
      </section>

      <section className="revenue-breakdown">
        <h2>Task Profit Breakdown</h2>
        <div className="breakdown-grid">
          <div className="breakdown-item">
            <div className="breakdown-label">Day 2 Tasks (1.2%)</div>
            <div className="breakdown-value">{money(earnings?.day2TaskProfit ?? "0")}</div>
          </div>
          <div className="breakdown-item">
            <div className="breakdown-label">Day 3 Official (1.4%)</div>
            <div className="breakdown-value">{money(earnings?.day3TaskProfit ?? "0")}</div>
          </div>
        </div>
      </section>

      <section className="customer-surface customer-history revenue-transactions">
        <h2>Recent Earnings Activity</h2>
        {recentEarnings.length === 0 ? (
          <CustomerPageState emptyTitle="No earnings yet" emptyText="Complete tasks and re-rent orders to see your earnings here." />
        ) : (
          recentEarnings
            .map((item) => (
              <div className="customer-history-row" key={item.id}>
                <span>{earningsLabel(item)}</span>
                <strong>{money(item.amount)}</strong>
                <small>{new Date(item.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small>
                {item.note && <small className="ref-tag">{item.note}</small>}
              </div>
            ))
        )}
      </section>

      {ordersLoading ? (
        <div style={{ padding: 20, textAlign: "center", color: "#64748b" }}>Loading re-rent data…</div>
      ) : (
        <section className="customer-surface customer-history revenue-rerents">
          <h2>Re-Rented Bookings</h2>
          {rerentedOrders.length === 0 ? (
            <CustomerPageState emptyTitle="No re-rented bookings" emptyText="Completed Re-Rent bookings appear here. Their earnings are recorded once in the activity ledger above." />
          ) : (
            rerentedOrders
              .slice(0, 20)
              .map((order) => (
                <div className="customer-history-row" key={order.id}>
                  <span>Re-Rent: {order.property?.title || order.orderCode}</span>
                  <strong>Completed</strong>
                  <small>{order.rerentedAt ? new Date(order.rerentedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Completed"}</small>
                </div>
              ))
          )}
        </section>
      )}
    </>}

    <style jsx>{`
      .revenue-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 24px;
      }
      .revenue-card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 20px;
        box-shadow: 0 5px 20px rgba(15,23,42,.04);
      }
      .revenue-card.primary {
        border-color: #bbf7d0;
        background: linear-gradient(135deg, #f0fdf4, #fff);
      }
      .revenue-card span,
      .revenue-card strong,
      .revenue-card small {
        display: block;
      }
      .revenue-card span {
        color: #64748b;
        font-size: 11px;
        font-weight: 750;
      }
      .revenue-card strong {
        margin-top: 8px;
        color: #0f172a;
        font-size: 24px;
      }
      .revenue-card small {
        margin-top: 6px;
        color: #94a3b8;
        font-size: 11px;
      }
      .revenue-breakdown,
      .revenue-transactions,
      .revenue-rerents {
        margin-bottom: 24px;
      }
      .revenue-breakdown h2,
      .revenue-transactions h2,
      .revenue-rerents h2 {
        margin: 0 0 14px;
        font-size: 17px;
        color: #0f172a;
      }
      .breakdown-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .breakdown-item {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        text-align: center;
      }
      .breakdown-label {
        color: #64748b;
        font-size: 11px;
        font-weight: 700;
        margin-bottom: 6px;
      }
      .breakdown-value {
        color: #166534;
        font-size: 20px;
        font-weight: 800;
      }
      .customer-history-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 16px;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid #eef2f7;
      }
      .customer-history-row:last-child {
        border-bottom: 0;
      }
      .customer-history-row span:first-child {
        color: #334155;
        font-size: 13px;
        font-weight: 600;
      }
      .customer-history-row strong {
        color: #166534;
        font-size: 15px;
        text-align: right;
      }
      .customer-history-row small {
        color: #64748b;
        font-size: 11px;
        text-align: right;
      }
      .ref-tag {
        background: #eef2ff;
        color: #3730a3;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
      }
      @media (max-width: 1000px) {
        .revenue-summary {
          grid-template-columns: 1fr 1fr;
        }
        .breakdown-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 640px) {
        .revenue-summary {
          grid-template-columns: 1fr;
        }
        .customer-history-row {
          grid-template-columns: 1fr;
          gap: 4px;
        }
        .customer-history-row strong,
        .customer-history-row small {
          text-align: left;
        }
      }
    `}</style>
  </UserShell>
}
