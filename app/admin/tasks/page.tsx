"use client";

import { useEffect, useMemo, useState } from "react";
import { Decimal } from "decimal.js";
import AdminShell from "../AdminShell";

type Task = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  dayNumber: number;
  profitRate: number | string;
  profitAmount: number | string;
  status: string;
  assignedAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
    membershipStatus: string;
    manager: {
      id: string;
      name: string;
      referralCode: string;
    };
  };
  manager: {
    id: string;
    name: string;
    referralCode: string;
  };
  order: {
    id: string;
    orderCode: string;
    amount: number | string;
    profit: number | string;
    profitRate: number | string;
    status: string;
    paymentStatus: string;
    property: {
      id: string;
      title: string;
      location: string | null;
    } | null;
  } | null;
};

const taskTypeLabels: Record<string, string> = {
  DAY_2_MORNING: "Day 2 — Morning",
  DAY_2_AFTERNOON: "Day 2 — Afternoon",
  DAY_3_OFFICIAL: "Day 3 — Official Member",
  RE_RENT: "Re-Rent",
};

const taskStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

function formatMoney(value: number | string | Decimal) {
  let amount: Decimal;
  try { amount = new Decimal(String(value)); } catch { amount = new Decimal(0); }
  if (!amount.isFinite()) amount = new Decimal(0);
  const [integer, fraction] = amount.abs().toFixed(2).split(".");
  const grouped = integer.length <= 3 ? integer : `${integer.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${integer.slice(-3)}`;
  return `${amount.isNegative() ? "-" : ""}${grouped}.${fraction}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: string) {
  if (["COMPLETED", "PAID"].includes(status)) {
    return { background: "#dcfce7", color: "#166534" };
  }
  if (["REJECTED", "CANCELLED"].includes(status)) {
    return { background: "#fee2e2", color: "#b91c1c" };
  }
  if (["SUBMITTED", "IN_PROGRESS"].includes(status)) {
    return { background: "#e0f2fe", color: "#0369a1" };
  }
  if (["PENDING"].includes(status)) {
    return { background: "#fef3c7", color: "#92400e" };
  }
  return { background: "#f1f5f9", color: "#475569" };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [managerId, setManagerId] = useState("ALL");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  async function loadTasks(append = false) {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status !== "ALL") params.set("status", status);
      if (type !== "ALL") params.set("type", type);
      if (managerId !== "ALL") params.set("managerId", managerId);
      if (append && nextCursor) params.set("cursor", nextCursor);

      const response = await fetch(`/api/admin/tasks?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load tasks.");
      }

      if (append) {
        setTasks((prev) => [...prev, ...(data.tasks || [])]);
      } else {
        setTasks(data.tasks || []);
      }
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.nextCursor));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks(false);
  }, [search, status, type, managerId]);

  const managers = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      if (task.manager) {
        map.set(task.manager.id, task.manager.name);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const task of tasks) {
      set.add(task.type);
    }
    return Array.from(set).sort();
  }, [tasks]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === "COMPLETED").length,
      pending: tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length,
      submitted: tasks.filter((t) => t.status === "SUBMITTED").length,
      totalProfit: tasks.reduce((sum, t) => sum.plus(String(t.profitAmount)), new Decimal(0)),
    };
  }, [tasks]);

  return (
    <AdminShell>
      <div>
        {/* HEADER */}
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
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#64748b",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              Housing.pro Admin Center
            </div>

            <h2 className="admin-page-title">Task Management</h2>

            <p className="admin-page-subtitle">
              Global task monitoring across all clients, managers, and order types.
            </p>
          </div>

          <button
            onClick={() => loadTasks(false)}
            disabled={loading}
            style={{
              border: 0,
              borderRadius: 9,
              padding: "11px 18px",
              background: "#111827",
              color: "#fff",
              fontWeight: 800,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Refreshing..." : "Refresh Tasks"}
          </button>
        </div>

        {/* STATS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
            gap: 16,
            marginTop: 24,
          }}
        >
          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>Total Tasks</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8 }}>{stats.total}</div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>Completed</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8, color: "#166534" }}>{stats.completed}</div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>Pending / In Progress</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8, color: "#92400e" }}>{stats.pending}</div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>Submitted</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8, color: "#0369a1" }}>{stats.submitted}</div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>Total Profit</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8 }}>{formatMoney(stats.totalProfit)}</div>
          </div>
        </div>

        {/* FILTERS */}
        <div
          className="admin-card"
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "minmax(240px,1fr) repeat(3,minmax(170px,210px))",
            gap: 12,
          }}
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search client, order, manager, or task..."
            style={{
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              outline: "none",
              minWidth: 0,
            }}
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            style={{
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              background: "#fff",
            }}
          >
            <option value="ALL">All Task Status</option>
            {Object.entries(taskStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            style={{
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              background: "#fff",
            }}
          >
            <option value="ALL">All Task Types</option>
            {Object.entries(taskTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
            {types.filter((t) => !taskTypeLabels[t]).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={managerId}
            onChange={(event) => setManagerId(event.target.value)}
            style={{
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              background: "#fff",
            }}
          >
            <option value="ALL">All Managers</option>
            {managers.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        {/* ERROR */}
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
            <strong>Tasks could not be loaded</strong>
            <div style={{ marginTop: 5, fontSize: 13 }}>{error}</div>
          </div>
        )}

        {/* TABLE */}
        <div
          className="admin-card"
          style={{
            marginTop: 24,
            padding: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "20px 22px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>Global Task Management</strong>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                Admin has global visibility across every manager and client.
              </div>
            </div>

            <span style={{ color: "#64748b", fontSize: 13 }}>
              Showing {tasks.length} tasks
            </span>
          </div>

          {loading && tasks.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
              Loading task database...
            </div>
          ) : tasks.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#334155" }}>
                No tasks found
              </div>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                Try changing your search or filters.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 1600,
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[
                      "Task",
                      "Client",
                      "Manager",
                      "Order",
                      "Property",
                      "Day / Type",
                      "Profit Rate",
                      "Profit Amount",
                      "Status",
                      "Assigned",
                      "Completed",
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
                  {tasks.map((task) => {
                    const taskBadge = statusBadge(task.status);
                    const orderStatusBadge = task.order ? statusBadge(task.order.status) : null;
                    const orderPaymentBadge = task.order ? statusBadge(task.order.paymentStatus) : null;

                    return (
                      <tr key={task.id} style={{ borderTop: "1px solid #eef2f7" }}>
                        <td style={{ padding: "15px 16px" }}>
                          <strong>{task.title}</strong>
                          <div style={{ color: "#94a3b8", fontSize: 10, marginTop: 4 }}>{task.id}</div>
                        </td>

                        <td style={{ padding: "15px 16px" }}>
                          <strong>{task.user.name}</strong>
                          <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>{task.user.email}</div>
                          {task.user.phone && (
                            <div style={{ color: "#94a3b8", fontSize: 10, marginTop: 2 }}>{task.user.phone}</div>
                          )}
                        </td>

                        <td style={{ padding: "15px 16px" }}>
                          <strong>{task.manager.name}</strong>
                          <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>{task.manager.referralCode}</div>
                        </td>

                        <td style={{ padding: "15px 16px" }}>
                          {task.order ? (
                            <>
                              <strong>{task.order.orderCode}</strong>
                              <div style={{ color: "#64748b", fontSize: 10, marginTop: 4 }}>
                                {orderStatusBadge ? (
                                  <span style={{ ...orderStatusBadge, padding: "3px 6px", borderRadius: 999, fontSize: 9, fontWeight: 900 }}>
                                    {task.order.status}
                                  </span>
                                ) : task.order.status}
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td style={{ padding: "15px 16px" }}>
                          {task.order?.property ? (
                            <>
                              <strong>{task.order.property.title}</strong>
                              <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>
                                {task.order.property.location || "No location"}
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td style={{ padding: "15px 16px", whiteSpace: "nowrap" }}>
                          <span style={{ color: "#2563eb", fontWeight: 700 }}>
                            {taskTypeLabels[task.type] || task.type}
                          </span>
                          <div style={{ color: "#64748b", fontSize: 10, marginTop: 3 }}>
                            Day {task.dayNumber}
                          </div>
                        </td>

                        <td style={{ padding: "15px 16px", fontWeight: 800, whiteSpace: "nowrap" }}>
                          {task.profitRate}%
                        </td>

                        <td style={{ padding: "15px 16px", fontWeight: 800, whiteSpace: "nowrap" }}>
                          {formatMoney(task.profitAmount)}
                        </td>

                        <td style={{ padding: "15px 16px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "5px 9px",
                              borderRadius: 999,
                              background: taskBadge.background,
                              color: taskBadge.color,
                              fontSize: 10,
                              fontWeight: 900,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {taskStatusLabels[task.status] || task.status}
                          </span>
                        </td>

                        <td style={{ padding: "15px 16px", color: "#64748b", whiteSpace: "nowrap", fontSize: 12 }}>
                          {formatDate(task.assignedAt)}
                        </td>

                        <td style={{ padding: "15px 16px", color: "#64748b", whiteSpace: "nowrap", fontSize: 12 }}>
                          {formatDate(task.completedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {hasMore && !loading && (
            <div style={{ padding: "20px 22px", borderTop: "1px solid #e5e7eb", textAlign: "center" }}>
              <button
                onClick={() => loadTasks(true)}
                disabled={loading}
                style={{
                  border: 0,
                  borderRadius: 9,
                  padding: "11px 24px",
                  background: "#111827",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}