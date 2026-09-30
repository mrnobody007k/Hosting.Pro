"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "../../AdminShell";

type ClientDetail = {
  client: { id: string; name: string; email: string; phone: string | null; age: number | null; profession: string | null; status: string; signupStatus: string; membershipStatus: string; approvedAt: string | null; officialMemberAt: string | null; createdAt: string; manager: { id: string; name: string; email: string; referralCode: string }; wallet: { balance: string; reservedBalance: string; updatedAt: string } | null };
  orders: any[]; tasks: any[]; deposits: any[]; withdrawals: any[]; transactions: any[]; notifications: any[]; activity: any[];
};
const dt = (value?: string | null) => value ? new Date(value).toLocaleString() : "—";
const money = (value?: string | null) => value == null ? "—" : `₹${value}`;

export default function AdminClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/clients/${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load client.");
      setData(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load client."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <AdminShell><div className="admin-card" aria-busy="true">Loading client details…</div></AdminShell>;
  if (!data) return <AdminShell><div className="admin-card" role="alert">{error || "Client not found."}<button onClick={() => void load()}>Retry</button></div></AdminShell>;
  const { client } = data;
  const day = client.membershipStatus === "OFFICIAL_MEMBER" ? "Day 3 · Official member" : client.membershipStatus === "DAY_2" ? "Day 2" : client.membershipStatus === "DAY_1" ? "Day 1" : "Awaiting approval";
  const section = (title: string, headers: string[], values: any[], render: (row: any) => React.ReactNode[]) => <section className="admin-card" style={{ marginTop: 18, overflow: "hidden" }}><h2>{title}</h2><div style={{ overflowX: "auto" }}><table className="hp-admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{values.length ? values.map((row) => <tr key={row.id}>{render(row).map((cell, index) => <td key={index}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>No records yet.</td></tr>}</tbody></table></div><small>Recent records are bounded for performance.</small></section>;

  return <AdminShell><main className="hp-admin-detail">
    <Link href="/admin/clients">← Clients</Link>
    <header className="admin-detail-heading"><div><p>Client record</p><h1>{client.name}</h1><span>{client.email}{client.phone ? ` · ${client.phone}` : ""}</span></div><span className={`hp-badge ${client.status === "ACTIVE" ? "success" : "warning"}`}>{client.status}</span></header>
    <section className="hp-admin-kpis">
      <div className="admin-card"><span>Account</span><strong>{client.status}</strong></div><div className="admin-card"><span>Day / Membership</span><strong>{day}</strong></div><div className="admin-card"><span>Signup status</span><strong>{client.signupStatus}</strong></div><div className="admin-card"><span>Joined</span><strong>{dt(client.createdAt)}</strong></div>
    </section>
    <section className="admin-card" style={{ marginTop: 18 }}><h2>Profile and manager</h2><dl className="hp-detail-grid"><div><dt>Age</dt><dd>{client.age ?? "—"}</dd></div><div><dt>Profession</dt><dd>{client.profession || "—"}</dd></div><div><dt>Manager</dt><dd><Link href={`/admin/managers/${client.manager.id}`}>{client.manager.name}</Link> · {client.manager.email}</dd></div><div><dt>Referral code</dt><dd><code>{client.manager.referralCode}</code></dd></div><div><dt>Approved</dt><dd>{dt(client.approvedAt)}</dd></div><div><dt>Official member since</dt><dd>{dt(client.officialMemberAt)}</dd></div></dl></section>
    <section className="hp-admin-kpis" style={{ marginTop: 18 }}><div className="admin-card"><span>Available balance</span><strong>{money(client.wallet?.balance || "0.00")}</strong></div><div className="admin-card"><span>Reserved balance</span><strong>{money(client.wallet?.reservedBalance || "0.00")}</strong></div><div className="admin-card"><span>Wallet updated</span><strong>{dt(client.wallet?.updatedAt)}</strong></div></section>
    {section("Orders", ["Order", "Property", "Amount", "Order status", "Payment", "Created"], data.orders, (x) => [x.orderCode, x.property ? `${x.property.title} · ${x.property.location || ""}` : "—", money(x.amount), x.status, x.paymentStatus, dt(x.createdAt)])}
    {section("Tasks", ["Task", "Type", "Day", "Profit", "Status", "Assigned", "Submitted", "Completed"], data.tasks, (x) => [x.title, x.type, x.dayNumber, `${money(x.profitAmount)} · ${x.profitRate}%`, x.status, dt(x.assignedAt), dt(x.submittedAt), dt(x.completedAt)])}
    {section("Deposits", ["Amount", "Status", "Reference", "Proof", "Created", "Processed"], data.deposits, (x) => [money(x.amount), x.status, x.reference || "—", x.proofUrl ? <a href={x.proofUrl} target="_blank" rel="noreferrer">View proof</a> : "—", dt(x.createdAt), dt(x.processedAt)])}
    {section("Withdrawals", ["Amount", "Status", "Method", "Reference", "Created", "Processed"], data.withdrawals, (x) => [money(x.amount), x.status, x.method || "—", x.reference || "—", dt(x.createdAt), dt(x.processedAt)])}
    {section("Wallet transactions", ["Type", "Amount", "Balance before", "Balance after", "Note", "Date"], data.transactions, (x) => [x.type, money(x.amount), money(x.balanceBefore), money(x.balanceAfter), x.note || x.reference || "—", dt(x.createdAt)])}
    {section("Notifications", ["Type", "Title", "Message", "Read", "Date"], data.notifications, (x) => [x.type, x.title, x.message, x.isRead ? "Read" : "Unread", dt(x.createdAt)])}
    {section("Audit activity", ["Actor", "Action", "Target", "Amount", "Date"], data.activity, (x) => [x.actorType, x.action, x.targetType || "—", money(x.amount), dt(x.createdAt)])}
  </main></AdminShell>;
}
