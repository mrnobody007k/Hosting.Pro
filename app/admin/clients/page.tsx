"use client";

import { useEffect, useMemo, useState } from "react";
import { Decimal } from "decimal.js";
import Link from "next/link";
import AdminShell from "../AdminShell";

type Client = {
  id: string;
  name: string;
  email: string;
  age: number | null;
  profession: string | null;
  phone: string | null;
  status: string;
  signupStatus: string;
  membershipStatus: string;
  approvedAt: string | null;
  officialMemberAt: string | null;
  createdAt: string;
  manager: {
    id: string;
    name: string;
    referralCode: string;
  };
  wallet: {
    balance: number | string;
    reservedBalance: number | string;
  } | null;
  _count: {
    orders: number;
    tasks: number;
    deposits: number;
    withdrawals: number;
  };
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [manager, setManager] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [membership, setMembership] = useState("ALL");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncResult, setSyncResult] = useState<{ userId: string; message: string } | null>(null);

  async function loadClients(cursor?: string, append = false) {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      setError("");

      const url = new URLSearchParams({ limit: "100", search: search.trim(), managerId: manager, status, membership });
      if (cursor) url.set("cursor", cursor);
      const res = await fetch(`/api/admin/clients?${url}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load clients");
      }

      setClients((current) => append ? [...current, ...(json.clients || [])] : (json.clients || []));
      setNextCursor(json.nextCursor || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load clients"
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function handleSync(userId: string, userName: string) {
    setSyncing(userId);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Sync failed");
      setSyncResult({ userId, message: `Synced ${userName}: ${json.results[0]?.membershipStatus || "done"}` });
    } catch (e) {
      setSyncResult({ userId, message: "Error: " + (e instanceof Error ? e.message : "Sync failed") });
    } finally {
      setSyncing(null);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadClients(); }, search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [search, manager, status, membership]);

  const managers = useMemo(() => {
    const map = new Map<string, string>();

    clients.forEach((client) => {
      map.set(client.manager.id, client.manager.name);
    });

    return Array.from(map.entries());
  }, [clients]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesSearch =
        !q ||
        client.name.toLowerCase().includes(q) ||
        client.email.toLowerCase().includes(q) ||
        (client.phone || "").toLowerCase().includes(q) ||
        client.manager.name.toLowerCase().includes(q) ||
        client.manager.referralCode.toLowerCase().includes(q);

      const matchesManager =
        manager === "ALL" || client.manager.id === manager;

      const matchesStatus =
        status === "ALL" || client.status === status;

      const matchesMembership =
        membership === "ALL" ||
        client.membershipStatus === membership;

      return (
        matchesSearch &&
        matchesManager &&
        matchesStatus &&
        matchesMembership
      );
    });
  }, [clients, search, manager, status, membership]);

  const totalBalance = clients.reduce((sum, client) => sum.plus(String(client.wallet?.balance || 0)), new Decimal(0));

  const officialMembers = clients.filter(
    (client) => client.membershipStatus === "OFFICIAL_MEMBER"
  ).length;

  const pendingApproval = clients.filter(
    (client) => client.signupStatus === "PENDING"
  ).length;

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
            <h2 className="admin-page-title">Clients</h2>
            <p className="admin-page-subtitle">
              Complete client directory with manager ownership, membership,
              wallet and activity information.
            </p>
          </div>

          <button
            onClick={() => loadClients()}
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
          </button>
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
              Total Clients
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {clients.length}
            </div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Pending Approval
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {pendingApproval}
            </div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Official Members
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {officialMembers}
            </div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Total Wallet Balance
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {totalBalance.toFixed(2)}
            </div>
          </div>
        </div>

        <div
          className="admin-card"
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "minmax(220px,2fr) repeat(3,minmax(160px,1fr))",
            gap: 12,
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, manager..."
            style={{
              width: "100%",
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              outline: "none",
            }}
          />

          <select
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            style={{
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              background: "#fff",
            }}
          >
            <option value="ALL">All Managers</option>
            {managers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              background: "#fff",
            }}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DISABLED">Disabled</option>
          </select>

          <select
            value={membership}
            onChange={(e) => setMembership(e.target.value)}
            style={{
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              background: "#fff",
            }}
          >
            <option value="ALL">All Membership</option>
            <option value="PENDING_APPROVAL">Pending</option>
            <option value="DAY_1">Day 1</option>
            <option value="DAY_2">Day 2</option>
            <option value="OFFICIAL_MEMBER">Official Member</option>
          </select>
        </div>

        {syncResult && (
          <div
            className="admin-card"
            style={{
              marginTop: 16,
              borderColor: syncResult.message.startsWith("Error") ? "#fecaca" : "#bbf7d0",
              background: syncResult.message.startsWith("Error") ? "#fff7f7" : "#f0fdf4",
              color: syncResult.message.startsWith("Error") ? "#b91c1c" : "#166534",
            }}
          >
            {syncResult.message}
          </div>
        )}

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
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <strong>Client Directory</strong>
            <span style={{ color: "#64748b", fontSize: 13 }}>
              Showing {filteredClients.length} of {clients.length}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 1300,
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    "Client",
                    "Manager",
                    "Signup",
                    "Membership",
                    "Wallet",
                    "Orders",
                    "Tasks",
                    "Status",
                    "Sync",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        textAlign: "left",
                        padding: "13px 16px",
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
                {!loading && filteredClients.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: 45,
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      No clients match the current filters.
                    </td>
                  </tr>
                )}

                {filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    style={{ borderTop: "1px solid #eef2f7" }}
                  >
                    <td style={{ padding: "15px 16px" }}>
                      <Link href={`/admin/clients/${client.id}`} style={{ color: "#1d4ed8", fontWeight: 800, textDecoration: "none" }}>{client.name}</Link>
                      <div
                        style={{
                          color: "#64748b",
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        {client.email}
                      </div>
                    </td>

                    <td style={{ padding: "15px 16px" }}>
                      <strong>{client.manager.name}</strong>
                      <div
                        style={{
                          color: "#64748b",
                          fontSize: 11,
                          marginTop: 4,
                        }}
                      >
                        {client.manager.referralCode}
                      </div>
                    </td>

                    <td
                      style={{
                        padding: "15px 16px",
                        color: "#475569",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(client.createdAt).toLocaleDateString()}
                    </td>

                    <td style={{ padding: "15px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "5px 8px",
                          borderRadius: 999,
                          background: "#eef2ff",
                          color: "#3730a3",
                          fontSize: 11,
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {client.membershipStatus.replaceAll("_", " ")}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "15px 16px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {client.wallet?.balance?.toLocaleString() || "0"}
                    </td>

                    <td style={{ padding: "15px 16px" }}>
                      {client._count.orders}
                    </td>

                    <td style={{ padding: "15px 16px" }}>
                      {client._count.tasks}
                    </td>

                    <td style={{ padding: "15px 16px" }}>
                      <span
                        style={{
                          color:
                            client.status === "ACTIVE"
                              ? "#166534"
                              : "#991b1b",
                          fontWeight: 800,
                          fontSize: 12,
                        }}
                      >
                        {client.status}
                      </span>
                    </td>

                    <td style={{ padding: "15px 16px" }}>
                      <button
                        onClick={() => handleSync(client.id, client.name)}
                        disabled={syncing === client.id || loading}
                        style={{
                          border: 0,
                          borderRadius: 8,
                          padding: "8px 12px",
                          background: syncing === client.id ? "#94a3b8" : "#2563eb",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: syncing === client.id || loading ? "wait" : "pointer",
                        }}
                      >
                        {syncing === client.id ? "Syncing..." : "Sync"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor && <div style={{ padding: 16, textAlign: "center" }}><button className="admin-button" onClick={() => loadClients(nextCursor, true)} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more clients"}</button></div>}
        </div>
      </div>
    </AdminShell>
  );
}
