"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "../AdminShell";

type Manager = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  status: string;
  createdAt: string;
  _count?: {
    users?: number;
  };
};

type Overview = {
  managers?: Manager[];
  managerSeatLimit?: number;
  activeManagers?: number;
  totalClients?: number;
};

export default function ManagersPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", referralCode: "" });

  async function load(cursor?: string, append = false) {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      setError("");
      const params = new URLSearchParams({ search: search.trim(), status, limit: "50" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/admin/managers?${params}`, { cache: "no-store" });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load managers");
      }

      setData((current) => ({
        ...json,
        managers: append ? [...(current?.managers || []), ...(json.managers || [])] : (json.managers || []),
      }));
      setNextCursor(json.nextCursor || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load managers");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [search, status]);

  async function createManager(event: React.FormEvent) {
    event.preventDefault(); setCreating(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/managers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create manager.");
      setForm({ name: "", email: "", password: "", referralCode: "" });
      setShowCreate(false); setMessage("Manager created."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create manager."); }
    finally { setCreating(false); }
  }

  const managers = data?.managers || [];
  const limit = data?.managerSeatLimit ?? 0;

  return (
    <AdminShell>
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 className="admin-page-title">Managers</h2>
            <p className="admin-page-subtitle">
              Manager accounts, referral ownership, status and client counts.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowCreate((visible) => !visible)} disabled={(data?.activeManagers ?? 0) >= (data?.managerSeatLimit ?? 0)} style={{ border: 0, borderRadius: 9, padding: "10px 14px", background: "#1d4ed8", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{showCreate ? "Close" : "Create manager"}</button>
          <button
            onClick={() => load()}
            disabled={loading}
            style={{
              border: 0,
              borderRadius: 9,
              padding: "10px 16px",
              background: "#111827",
              color: "#fff",
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button></div>
        </div>

        {message && <div role="status" className="admin-card" style={{ marginTop: 16, color: "#047857" }}>{message}</div>}
        {showCreate && <form className="admin-card" onSubmit={createManager} style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <input required maxLength={120} placeholder="Manager name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required type="email" maxLength={254} placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required type="password" minLength={12} maxLength={200} autoComplete="new-password" placeholder="Temporary password (12+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input required maxLength={100} placeholder="Referral code" value={form.referralCode} onChange={(e) => setForm({ ...form, referralCode: e.target.value.toUpperCase() })} />
          <button type="submit" disabled={creating || (data?.activeManagers ?? 0) >= (data?.managerSeatLimit ?? 0)}>{creating ? "Creating…" : "Create manager"}</button>
        </form>}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <input aria-label="Search managers" placeholder="Search name, email, or referral code" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 240, flex: 1, padding: 11, border: "1px solid #dbe1e8", borderRadius: 9 }} />
          <select aria-label="Filter managers by status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: 11, border: "1px solid #dbe1e8", borderRadius: 9 }}>
            <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="DISABLED">Disabled</option>
          </select>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
            gap: 16,
            marginTop: 24,
          }}
        >
          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Active Managers
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {data?.activeManagers ?? 0}
            </div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Manager Seats
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {data?.activeManagers ?? 0} / {limit || "—"}
            </div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Total Clients
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {data?.totalClients ?? 0}
            </div>
          </div>
        </div>

        {error && (
          <div
            className="admin-card"
            style={{
              marginTop: 20,
              borderColor: "#fecaca",
              background: "#fff7f7",
              color: "#b91c1c",
            }}
          >
            {error}
          </div>
        )}

        <div className="admin-card" style={{ marginTop: 24, padding: 0 }}>
          <div
            style={{
              padding: "20px 22px",
              borderBottom: "1px solid #e5e7eb",
              fontWeight: 800,
            }}
          >
            All Managers
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 760,
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    "Manager",
                    "Email",
                    "Referral Code",
                    "Clients",
                    "Status",
                    "Created",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        textAlign: "left",
                        padding: "13px 18px",
                        fontSize: 12,
                        color: "#64748b",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {!loading && managers.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: 40,
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      No managers found.
                    </td>
                  </tr>
                )}

                {managers.map((manager) => (
                  <tr
                    key={manager.id}
                    style={{
                      borderTop: "1px solid #eef2f7",
                    }}
                  >
                    <td style={{ padding: "16px 18px", fontWeight: 700 }}>
                      <Link href={`/admin/managers/${manager.id}`} style={{ color: "#1d4ed8", fontWeight: 800, textDecoration: "none" }}>{manager.name}</Link>
                    </td>

                    <td style={{ padding: "16px 18px", color: "#475569" }}>
                      {manager.email}
                    </td>

                    <td style={{ padding: "16px 18px" }}>
                      <code
                        style={{
                          background: "#f1f5f9",
                          padding: "5px 8px",
                          borderRadius: 6,
                        }}
                      >
                        {manager.referralCode}
                      </code>
                    </td>

                    <td style={{ padding: "16px 18px", fontWeight: 700 }}>
                      {manager._count?.users || 0}
                    </td>

                    <td style={{ padding: "16px 18px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "5px 9px",
                          borderRadius: 999,
                          background:
                            manager.status === "ACTIVE"
                              ? "#dcfce7"
                              : "#fee2e2",
                          color:
                            manager.status === "ACTIVE"
                              ? "#166534"
                              : "#991b1b",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {manager.status}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "16px 18px",
                        color: "#64748b",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(manager.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor && <div style={{ padding: 16, textAlign: "center" }}><button onClick={() => load(nextCursor, true)} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more managers"}</button></div>}
        </div>
      </div>
    </AdminShell>
  );
}
