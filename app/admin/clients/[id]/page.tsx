"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "../../AdminShell";
import { DISPLAY_TIERS, displayTierLabel, type DisplayTier } from "@/lib/display-tier";

type ClientDetail = {
  client: { id: string; name: string; email: string; phone: string | null; age: number | null; profession: string | null; status: string; signupStatus: string; membershipStatus: string; displayTier: DisplayTier | null; approvedAt: string | null; officialMemberAt: string | null; createdAt: string; manager: { id: string; name: string; email: string; referralCode: string }; wallet: { balance: string; reservedBalance: string; updatedAt: string } | null };
  orders: any[]; tasks: any[]; deposits: any[]; withdrawals: any[]; transactions: any[]; notifications: any[]; activity: any[];
};
const dt = (value?: string | null) => value ? new Date(value).toLocaleString() : "—";
const money = (value?: string | null) => value == null ? "—" : `₹${value}`;

export default function AdminClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTier, setSelectedTier] = useState<DisplayTier | "">("");
  const [tierSaving, setTierSaving] = useState(false);
  const [tierMessage, setTierMessage] = useState("");
  const [adminType, setAdminType] = useState("");
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupMessage, setSignupMessage] = useState("");
  const [signupError, setSignupError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      setAdminType("");
      const [response, meResponse] = await Promise.all([
        fetch(`/api/admin/clients/${encodeURIComponent(id)}`, { cache: "no-store" }),
        fetch("/api/admin/me", { cache: "no-store" }),
      ]);
      const [result, me] = await Promise.all([response.json(), meResponse.json()]);
      if (!response.ok) throw new Error(result.error || "Unable to load client.");
      if (!meResponse.ok) throw new Error(me.error || "Unable to verify Admin access.");
      setData(result);
      setSelectedTier(result.client.displayTier || "");
      setAdminType(me.admin?.adminType || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load client."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function saveTier() {
    if (!selectedTier || tierSaving) return;
    setTierSaving(true); setTierMessage("");
    try {
      const response = await fetch(`/api/admin/clients/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayTier: selectedTier }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update client tier.");
      setTierMessage(result.changed ? "Display tier updated." : "This tier is already assigned.");
      await load();
    } catch (cause) {
      setTierMessage(cause instanceof Error ? cause.message : "Unable to update client tier.");
    } finally { setTierSaving(false); }
  }

  async function approveSignup() {
    if (signupBusy) return;
    setSignupBusy(true); setSignupMessage(""); setSignupError("");
    try {
      const response = await fetch(`/api/admin/clients/${encodeURIComponent(id)}/signup`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to approve signup.");
      setSignupMessage("Signup approved. The one-time ₹120 welcome credit was recorded.");
      await load();
    } catch (cause) {
      setSignupError(cause instanceof Error ? cause.message : "Unable to approve signup.");
    } finally { setSignupBusy(false); }
  }

  if (loading) return <AdminShell><div className="admin-card" aria-busy="true">Loading client details…</div></AdminShell>;
  if (!data) return <AdminShell><div className="admin-card" role="alert">{error || "Client not found."}<button onClick={() => void load()}>Retry</button></div></AdminShell>;
  const { client } = data;
  const day = client.membershipStatus === "OFFICIAL_MEMBER" ? "Day 3 · Official member" : client.membershipStatus === "DAY_2" ? "Day 2" : client.membershipStatus === "DAY_1" ? "Day 1" : "Awaiting approval";
  const section = (title: string, headers: string[], values: any[], render: (row: any) => React.ReactNode[]) => <section className="admin-card" style={{ marginTop: 18, overflow: "hidden" }}><h2>{title}</h2><div style={{ overflowX: "auto" }}><table className="hp-admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{values.length ? values.map((row) => <tr key={row.id}>{render(row).map((cell, index) => <td key={index}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>No records yet.</td></tr>}</tbody></table></div><small>Recent records are bounded for performance.</small></section>;

  return <AdminShell><main className="hp-admin-detail">
    <Link href="/admin/clients">← Clients</Link>
    <header className="admin-detail-heading"><div><p>Client record</p><h1>{client.name}</h1><span>{client.email}{client.phone ? ` · ${client.phone}` : ""}</span></div><span className={`hp-badge ${client.status === "ACTIVE" ? "success" : "warning"}`}>{client.status}</span></header>
    <section className="hp-admin-kpis">
      <div className="admin-card"><span>Account</span><strong>{client.status}</strong></div><div className="admin-card"><span>Day / Membership</span><strong>{day}</strong></div><div className="admin-card"><span>Display tier</span><strong>{client.displayTier ? displayTierLabel(client.displayTier) : "Not assigned"}</strong></div><div className="admin-card"><span>Signup status</span><strong>{client.signupStatus}</strong></div><div className="admin-card"><span>Joined</span><strong>{dt(client.createdAt)}</strong></div>
    </section>
    {error && <p role="alert" className="admin-card" style={{ marginTop: 18 }}>{error}</p>}
    {adminType === "SUPER_ADMIN" && client.signupStatus === "PENDING" && <section className="admin-card" style={{ marginTop: 18 }} aria-labelledby="signup-override-heading"><h2 id="signup-override-heading">Super Admin signup approval</h2><p>Approve this pending signup and record the standard one-time ₹120 wallet credit, ledger entry, audit record, and notification.</p><button type="button" disabled={signupBusy} onClick={() => void approveSignup()}>{signupBusy ? "Approving…" : "Approve signup and credit ₹120"}</button>{signupMessage && <p role="status">{signupMessage}</p>}{signupError && <p role="alert">{signupError}</p>}</section>}
    <section className="admin-card" style={{ marginTop: 18 }} aria-labelledby="client-tier-heading"><h2 id="client-tier-heading">Assign display tier</h2><p>This is informational only and does not change tasks, earnings, payouts, or account access.</p><div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}><label htmlFor="client-display-tier">Tier</label><select id="client-display-tier" value={selectedTier} onChange={(event) => setSelectedTier(event.target.value as DisplayTier | "")}><option value="">Select a tier</option>{DISPLAY_TIERS.map((tier) => <option key={tier} value={tier}>{displayTierLabel(tier)}</option>)}</select><button type="button" disabled={!selectedTier || tierSaving || selectedTier === client.displayTier} onClick={() => void saveTier()}>{tierSaving ? "Saving…" : "Save tier"}</button>{tierMessage && <span role="status">{tierMessage}</span>}</div></section>
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
