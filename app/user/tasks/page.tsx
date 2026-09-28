"use client"

import { useCallback, useEffect, useState } from "react"
import { Decimal } from "decimal.js"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, money } from "../CustomerUI"

type Task = { id: string; title: string; description?: string | null; type?: string; status?: string; profitRate?: number | string; profitAmount?: string | number; principalAmount?: string | null; dayNumber?: number; orderCode?: string; propertyTitle?: string; propertyUrl?: string | null }
type Order = { orderCode: string; tasks?: Task[]; property?: { title: string } }

export default function UserTasksPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [daily, setDaily] = useState<any>(null)
  const [name, setName] = useState("Client")
  const [busy, setBusy] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [ordersResponse, accountResponse, dailyResponse] = await Promise.all([fetch("/api/user/orders", { cache: "no-store" }), fetch("/api/user/overview", { cache: "no-store" }), fetch("/api/user/tasks/daily", { cache: "no-store" })])
      if ([ordersResponse, accountResponse, dailyResponse].some((response) => response.status === 401)) { window.location.href = "/login"; return }
      const [ordersData, accountData, dailyData] = await Promise.all([ordersResponse.json(), accountResponse.json(), dailyResponse.json()])
      if (!ordersResponse.ok) throw new Error(ordersData.error || "Unable to load your tasks.")
      if (!accountResponse.ok) throw new Error(accountData.error || "Unable to load your account.")
      if (!dailyResponse.ok) throw new Error(dailyData.error || "Unable to load your progress.")
      setOrders(Array.isArray(ordersData) ? ordersData : ordersData.orders || [])
      setName(accountData.user?.name || "Client")
      setDaily(dailyData)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load your tasks.") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const rerent = orders.flatMap((order) => (order.tasks || []).filter((task) => task.type === "RE_RENT" && !["COMPLETED", "REJECTED"].includes(String(task.status))).map((task) => ({ ...task, orderCode: order.orderCode, propertyTitle: order.property?.title })))
  const dailyTasks: Task[] = (daily?.tasks || []).filter((task: Task) => !["COMPLETED", "REJECTED"].includes(String(task.status)))

  async function completeTask(task: Task, mode: "daily" | "rerent") {
    setBusy(task.id); setError(""); setNotice("")
    try {
      const isReRentRequest = mode === "rerent" && ["PENDING", "IN_PROGRESS"].includes(String(task.status))
      const endpoint = mode === "daily" ? "/api/user/tasks/daily" : isReRentRequest ? "/api/user/tasks" : "/api/user/tasks/settle"
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task.id }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "This task could not be completed.")
      setNotice(result.completed ? "Your order has been re-rented successfully." : result.message || (isReRentRequest ? "Your re-rental request has been submitted." : "Task updated."))
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This task could not be completed.") }
    finally { setBusy("") }
  }

  const taskRows = (tasks: Task[], mode: "daily" | "rerent") => tasks.map((task) => <article className="customer-task-row" key={task.id}>
    <div className="customer-task-icon">{mode === "daily" ? `D${task.dayNumber || ""}` : "✓"}</div>
    <div className="customer-task-main"><strong>{task.title}</strong><span>{mode === "daily" ? `Day ${task.dayNumber} · ${String(task.type || "").replaceAll("_", " ")}` : `${task.propertyTitle || "Property"} · Booking ${task.orderCode}`}</span>{task.description && <small>{task.description}</small>}{mode === "rerent" && task.propertyUrl && <a href={task.propertyUrl} target="_blank" rel="noopener noreferrer">Open property details ↗</a>}{mode === "daily" && task.principalAmount && <small>Based on verified booking amount: {money(task.principalAmount)}</small>}</div>
    <div className="customer-task-value">{task.profitRate ? `${new Decimal(String(task.profitRate)).toFixed(2)}%` : "Task"}<small>{money(task.profitAmount)}</small></div>
    <button disabled={busy === task.id || loading} onClick={() => void completeTask(task, mode)}>{busy === task.id ? "Saving…" : mode === "daily" ? "Complete task" : task.status === "SUBMITTED" ? "Check re-rent status" : "Request re-rent"}</button>
  </article>)

  return <UserShell userName={name} membership={customerStatus(daily?.membershipStatus)}>
    <CustomerPageHeader eyebrow="YOUR ACCOUNT" title="My tasks" description="Complete the activities available for your membership and bookings." />
    {notice && <div className="customer-inline-success" role="status">{notice}</div>}
    <CustomerPageState loading={loading} error={error} retry={() => void load()} />
    {!loading && !error && <>
      <section className="customer-task-progress"><div><span>Platform day</span><strong>Day {daily?.clientDay ?? "—"}</strong></div><div><span>Membership</span><strong>{customerStatus(daily?.membershipStatus)}</strong></div><div><span>Day 2</span><strong>{daily?.day2Complete ? "Completed" : "In progress"}</strong></div><div><span>Task rates</span><strong>Day 2 {new Decimal(String(daily?.rates?.day2 ?? "1.20")).toFixed(2)}% · Day 3 {new Decimal(String(daily?.rates?.day3 ?? "1.40")).toFixed(2)}%</strong></div></section>
      <section className="customer-task-panel"><h2>Daily activities</h2>{dailyTasks.length ? taskRows(dailyTasks, "daily") : <div className="customer-task-empty"><strong>No daily activities available</strong><p>{daily?.clientDay < 2 ? "Daily activities become available as you progress through your membership." : !daily?.hasVerifiedActiveOrder ? "A payment-confirmed booking is needed before these activities become available." : "New activities appear here as you progress through your membership."}</p></div>}</section>
      <section className="customer-task-panel"><h2>Booking activities</h2>{rerent.length ? taskRows(rerent, "rerent") : <div className="customer-task-empty"><strong>No booking activities yet</strong><p>Any activities linked to your bookings will appear here.</p></div>}</section>
    </>}
    <style jsx global>{`.customer-task-progress{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.customer-task-progress>div{background:#0f172a;color:white;border-radius:14px;padding:16px}.customer-task-progress span,.customer-task-progress strong{display:block}.customer-task-progress span{font-size:11px;color:#aab7c8}.customer-task-progress strong{margin-top:7px;font-size:13px}.customer-task-panel{background:white;border:1px solid #e5e7eb;border-radius:16px;padding:8px 20px;margin-bottom:16px}.customer-task-panel h2{font-size:17px;margin:15px 0 5px}.customer-task-row{display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid #eef2f7}.customer-task-row:last-child{border:0}.customer-task-icon{width:40px;height:40px;border-radius:12px;background:#eff6f2;color:#176644;display:grid;place-items:center;font-weight:800}.customer-task-main{flex:1;min-width:0}.customer-task-main strong,.customer-task-main span,.customer-task-main small{display:block}.customer-task-main span,.customer-task-main small{margin-top:4px;color:#64748b;font-size:12px}.customer-task-value{text-align:right;font-weight:700;color:#176644}.customer-task-value small{display:block;color:#64748b;font-weight:500;margin-top:4px}.customer-task-row button{border:0;border-radius:9px;background:#102a22;color:white;padding:10px 14px;font-weight:700;cursor:pointer}.customer-task-row button:disabled{opacity:.55;cursor:wait}.customer-task-empty{text-align:center;padding:30px 10px;color:#64748b}.customer-task-empty strong{color:#273548}.customer-task-empty p{font-size:13px}@media(max-width:800px){.customer-task-progress{grid-template-columns:1fr 1fr}}@media(max-width:600px){.customer-task-progress{grid-template-columns:1fr}.customer-task-row{align-items:flex-start;flex-wrap:wrap}.customer-task-main{min-width:calc(100% - 60px)}.customer-task-value{margin-left:54px;text-align:left}.customer-task-row button{margin-left:auto}}`}</style>
  </UserShell>
}
