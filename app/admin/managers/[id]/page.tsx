"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "../../AdminShell";

type Detail = {
  manager: { id: string; name: string; email: string; referralCode: string; status: string; createdAt: string; paymentAccountLabel: string | null; paymentAccountDetails: string | null; _count: Record<string, number> };
  clients: Array<{ id: string; name: string; email: string; status: string; signupStatus: string; membershipStatus: string; createdAt: string }>;
  orders: Array<{ id: string; orderCode: string; amount: string; status: string; paymentStatus: string; createdAt: string; user: { id: string; name: string }; property: { id: string; title: string } }>;
  deposits: Array<{ id: string; amount: string; status: string; reference: string | null; createdAt: string; user: { id: string; name: string } }>;
  withdrawals: Array<{ id: string; amount: string; status: string; method: string | null; reference: string | null; createdAt: string; user: { id: string; name: string } }>;
  tasks: Array<{ id: string; type: string; title: string; dayNumber: number; profitRate: string; profitAmount: string; status: string; assignedAt: string; completedAt: string | null; user: { id: string; name: string }; order: { id: string; orderCode: string } | null }>;
  activity: Array<{ id: string; actorType: string; action: string; targetType: string | null; targetId: string | null; amount: string | null; createdAt: string }>;
};

const date = (value: string | null) => value ? new Date(value).toLocaleString() : "—";
const money = (value: string) => `₹${value}`;

export default function AdminManagerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [paymentLabel, setPaymentLabel] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/managers/${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load manager.");
      setData(result);
      setPaymentLabel(result.manager.paymentAccountLabel || "");
      setPaymentDetails(result.manager.paymentAccountDetails || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load manager."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function update(payload: Record<string, string>) {
    if (!data) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/managers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.manager.id, ...payload }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update manager.");
      setMessage("Manager details saved.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update manager."); }
    finally { setSaving(false); }
  }

  if (loading) return <AdminShell><div className="admin-card" aria-busy="true">Loading manager details…</div></AdminShell>;
  if (!data) return <AdminShell><div className="admin-card"><p>{error || "Manager not found."}</p><button onClick={() => void load()}>Retry</button></div></AdminShell>;

  const manager = data.manager;
  const table = (title: string, headers: string[], rows: React.ReactNode[], empty: string) => <section className="admin-card" style={{ marginTop: 18, overflow: "hidden" }}><h2>{title}</h2><div style={{ overflowX: "auto" }}><table className="hp-admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows : <tr><td colSpan={headers.length}>{empty}</td></tr>}</tbody></table></div><small>Showing up to 25 recent records.</small></section>;

  return <AdminShell><main className="hp-admin-detail">
    <Link href="/admin/managers">← Managers</Link>
    <header className="admin-detail-heading"><div><p>Manager operations</p><h1>{manager.name}</h1><span>{manager.email} · {manager.referralCode}</span></div><span className={`hp-badge ${manager.status === "ACTIVE" ? "success" : "warning"}`}>{manager.status}</span></header>
    {error && <div role="alert" className="admin-card" style={{ color: "#b91c1c", marginTop: 16 }}>{error}<button onClick={() => void load()}>Retry</button></div>}
    {message && <div role="status" className="admin-card" style={{ color: "#047857", marginTop: 16 }}>{message}</div>}
    <section className="hp-admin-kpis">{Object.entries(manager._count).map(([label, value]) => <div className="admin-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}<div className="admin-card"><span>Created</span><strong>{date(manager.createdAt)}</strong></div></section>
    <section className="admin-card" style={{ marginTop: 18 }}><h2>Account and payment instructions</h2><div className="hp-form-grid"><label>Payment label<input value={paymentLabel} maxLength={200} onChange={(event) => setPaymentLabel(event.target.value)} /></label><label>Payment details<textarea value={paymentDetails} maxLength={4000} rows={3} onChange={(event) => setPaymentDetails(event.target.value)} /></label></div><div className="hp-admin-actions"><button disabled={saving} onClick={() => void update({ paymentAccountLabel: paymentLabel, paymentAccountDetails: paymentDetails })}>{saving ? "Saving…" : "Save payment details"}</button><button disabled={saving} className="danger" onClick={() => { const next = manager.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"; if (window.confirm(`${next === "ACTIVE" ? "Activate" : "Suspend"} ${manager.name}?`)) void update({ status: next }); }}>{manager.status === "ACTIVE" ? "Suspend manager" : "Activate manager"}</button></div></section>
    {table("Referred clients", ["Client", "Account", "Signup", "Membership", "Joined"], data.clients.map((client) => <tr key={client.id}><td><Link href={`/admin/clients/${client.id}`}>{client.name}</Link><small>{client.email}</small></td><td>{client.status}</td><td>{client.signupStatus}</td><td>{client.membershipStatus}</td><td>{date(client.createdAt)}</td></tr>), "No referred clients.")}
    {table("Recent orders", ["Order", "Client", "Property", "Amount", "Payment", "Order status", "Created"], data.orders.map((row) => <tr key={row.id}><td>{row.orderCode}</td><td>{row.user.name}</td><td>{row.property.title}</td><td>{money(row.amount)}</td><td>{row.paymentStatus}</td><td>{row.status}</td><td>{date(row.createdAt)}</td></tr>), "No orders.")}
    {table("Recent deposits", ["Client", "Amount", "Reference", "Status", "Created"], data.deposits.map((row) => <tr key={row.id}><td>{row.user.name}</td><td>{money(row.amount)}</td><td>{row.reference || "—"}</td><td>{row.status}</td><td>{date(row.createdAt)}</td></tr>), "No deposits.")}
    {table("Recent withdrawals", ["Client", "Amount", "Method", "Status", "Created"], data.withdrawals.map((row) => <tr key={row.id}><td>{row.user.name}</td><td>{money(row.amount)}</td><td>{row.method || "—"}</td><td>{row.status}</td><td>{date(row.createdAt)}</td></tr>), "No withdrawals.")}
    {table("Recent tasks", ["Client", "Task", "Day", "Profit", "Status", "Assigned", "Completed"], data.tasks.map((row) => <tr key={row.id}><td>{row.user.name}</td><td>{row.title}<small>{row.type}</small></td><td>{row.dayNumber}</td><td>{money(row.profitAmount)} · {row.profitRate}%</td><td>{row.status}</td><td>{date(row.assignedAt)}</td><td>{date(row.completedAt)}</td></tr>), "No tasks.")}
    {table("Recent activity", ["Actor", "Action", "Target", "Amount", "Time"], data.activity.map((row) => <tr key={row.id}><td>{row.actorType}</td><td>{row.action}</td><td>{row.targetType || "—"} {row.targetId || ""}</td><td>{row.amount ? money(row.amount) : "—"}</td><td>{date(row.createdAt)}</td></tr>), "No activity.")}
  </main></AdminShell>;
}
