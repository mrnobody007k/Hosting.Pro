"use client";

import { useEffect, useState } from "react";
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
};

export default function ManagersPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/admin/overview", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load managers");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load managers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

          <button
            onClick={load}
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
              Active Managers
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {managers.filter((m) => m.status === "ACTIVE").length}
            </div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Manager Seats
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {managers.length} / {limit || "—"}
            </div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Total Clients
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {managers.reduce(
                (sum, manager) => sum + (manager._count?.users || 0),
                0
              )}
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
                      {manager.name}
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
        </div>
      </div>
    </AdminShell>
  );
}
