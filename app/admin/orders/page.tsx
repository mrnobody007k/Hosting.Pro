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
};

type Order = {
  id: string;
  orderCode: string;
  userId: string;
  managerId: string;
  propertyId: string;
  amount: number | string;
  storehousePrice: number | string;
  profit: number | string;
  profitRate: number | string;
  status: string;
  paymentStatus: string;
  paymentReference: string | null;
  paymentProofUrl: string | null;
  bookedAt: string | null;
  paymentSubmittedAt: string | null;
  paymentVerifiedAt: string | null;
  activatedAt: string | null;
  rerentRequestedAt: string | null;
  rerentedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;

  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    managerId: string;
    status: string;
    membershipStatus: string;
  };

  manager: {
    id: string;
    name: string;
    email: string;
    referralCode: string;
    status: string;
  };

  property: {
    id: string;
    title: string;
    location: string | null;
    price: number | string;
    status: string;
  } | null;

  tasks: Task[];
};

const orderStatusLabels: Record<string, string> = {
  PAYMENT_PENDING: "Payment Pending",
  PAYMENT_SUBMITTED: "Payment Submitted",
  PAYMENT_VERIFIED: "Payment Verified",
  ACTIVE: "Active",
  RE_RENT_PENDING: "Re-Rent Pending",
  RE_RENTED: "Re-Rented",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const paymentLabels: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
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
  if (
    status === "ACTIVE" ||
    status === "COMPLETED" ||
    status === "PAID"
  ) {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (
    status === "CANCELLED" ||
    status === "REJECTED"
  ) {
    return {
      background: "#fee2e2",
      color: "#b91c1c",
    };
  }

  if (
    status === "PAYMENT_SUBMITTED" ||
    status === "PAYMENT_VERIFIED" ||
    status === "RE_RENTED"
  ) {
    return {
      background: "#e0f2fe",
      color: "#0369a1",
    };
  }

  if (
    status === "RE_RENT_PENDING" ||
    status === "PENDING"
  ) {
    return {
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
  };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [managerId, setManagerId] = useState("ALL");

  const [selectedOrder, setSelectedOrder] =
    useState<Order | null>(null);

  async function loadOrders(cursor?: string, append = false) {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      setError("");

      const params = new URLSearchParams({ limit: "100", search: search.trim(), status, paymentStatus, managerId });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/admin/orders?${params}`, { cache: "no-store" });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to load orders."
        );
      }

      setOrders((current) => append ? [...current, ...(data.orders || [])] : (data.orders || []));
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load orders."
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOrders(); }, search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [search, status, paymentStatus, managerId]);

  const managers = useMemo(() => {
    const map = new Map<string, string>();

    for (const order of orders) {
      if (order.manager) {
        map.set(
          order.manager.id,
          order.manager.name
        );
      }
    }

    return Array.from(map.entries()).sort(
      (a, b) => a[1].localeCompare(b[1])
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const searchable = [
        order.orderCode,
        order.user.name,
        order.user.email,
        order.user.phone || "",
        order.manager.name,
        order.manager.email,
        order.manager.referralCode,
        order.property?.title || "",
        order.property?.location || "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesStatus =
        status === "ALL" ||
        order.status === status;

      const matchesPayment =
        paymentStatus === "ALL" ||
        order.paymentStatus === paymentStatus;

      const matchesManager =
        managerId === "ALL" ||
        order.managerId === managerId;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment &&
        matchesManager
      );
    });
  }, [
    orders,
    search,
    status,
    paymentStatus,
    managerId,
  ]);

  const stats = useMemo(() => {
    return {
      total: orders.length,

      totalValue: orders.reduce((sum, order) => sum.plus(String(order.amount)), new Decimal(0)),

      totalProfit: orders.reduce((sum, order) => sum.plus(String(order.profit)), new Decimal(0)),

      pending: orders.filter(
        (order) =>
          order.status === "PAYMENT_PENDING" ||
          order.status === "PAYMENT_SUBMITTED"
      ).length,

      active: orders.filter(
        (order) => order.status === "ACTIVE"
      ).length,

      rerented: orders.filter(
        (order) =>
          order.status === "RE_RENTED" ||
          order.status === "COMPLETED"
      ).length,

      cancelled: orders.filter(
        (order) => order.status === "CANCELLED"
      ).length,
    };
  }, [orders]);

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

            <h2 className="admin-page-title">
              Orders & Bookings
            </h2>

            <p className="admin-page-subtitle">
              Complete global order monitoring across
              clients, managers, properties, payments
              and re-rent activity.
            </p>
          </div>

          <button
            onClick={() => loadOrders()}
            disabled={loading}
            style={{
              border: 0,
              borderRadius: 9,
              padding: "11px 18px",
              background: "#111827",
              color: "#fff",
              fontWeight: 800,
              cursor: loading
                ? "wait"
                : "pointer",
            }}
          >
            {loading
              ? "Refreshing..."
              : "Refresh Orders"}
          </button>
        </div>

        {/* STATS */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(170px,1fr))",
            gap: 16,
            marginTop: 24,
          }}
        >
          <div className="admin-card">
            <div
              style={{
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Total Orders
            </div>

            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                marginTop: 8,
              }}
            >
              {stats.total}
            </div>
          </div>

          <div className="admin-card">
            <div
              style={{
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Total Order Value
            </div>

            <div
              style={{
                fontSize: 23,
                fontWeight: 900,
                marginTop: 8,
              }}
            >
              {formatMoney(stats.totalValue)}
            </div>
          </div>

          <div className="admin-card">
            <div
              style={{
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Recorded Profit
            </div>

            <div
              style={{
                fontSize: 23,
                fontWeight: 900,
                marginTop: 8,
              }}
            >
              {formatMoney(stats.totalProfit)}
            </div>
          </div>

          <div className="admin-card">
            <div
              style={{
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Payment Pending
            </div>

            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                marginTop: 8,
                color: "#c2410c",
              }}
            >
              {stats.pending}
            </div>
          </div>

          <div className="admin-card">
            <div
              style={{
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Active Orders
            </div>

            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                marginTop: 8,
                color: "#166534",
              }}
            >
              {stats.active}
            </div>
          </div>

          <div className="admin-card">
            <div
              style={{
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Re-Rented / Completed
            </div>

            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                marginTop: 8,
              }}
            >
              {stats.rerented}
            </div>
          </div>

          <div className="admin-card">
            <div
              style={{
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Cancelled
            </div>

            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                marginTop: 8,
                color: "#b91c1c",
              }}
            >
              {stats.cancelled}
            </div>
          </div>
        </div>

        {/* FILTERS */}

        <div
          className="admin-card"
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns:
              "minmax(240px,1fr) repeat(3,minmax(170px,210px))",
            gap: 12,
          }}
        >
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search order, client, manager or property..."
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
            onChange={(event) =>
              setStatus(event.target.value)
            }
            style={{
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              background: "#fff",
            }}
          >
            <option value="ALL">
              All Order Status
            </option>

            {Object.entries(
              orderStatusLabels
            ).map(([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </select>

          <select
            value={paymentStatus}
            onChange={(event) =>
              setPaymentStatus(
                event.target.value
              )
            }
            style={{
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              background: "#fff",
            }}
          >
            <option value="ALL">
              All Payment Status
            </option>

            <option value="PENDING">
              Pending
            </option>

            <option value="APPROVED">
              Approved
            </option>

            <option value="REJECTED">
              Rejected
            </option>

            <option value="PAID">
              Paid
            </option>
          </select>

          <select
            value={managerId}
            onChange={(event) =>
              setManagerId(event.target.value)
            }
            style={{
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              background: "#fff",
            }}
          >
            <option value="ALL">
              All Managers
            </option>

            {managers.map(
              ([id, name]) => (
                <option
                  key={id}
                  value={id}
                >
                  {name}
                </option>
              )
            )}
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
            <strong>
              Orders could not be loaded
            </strong>

            <div
              style={{
                marginTop: 5,
                fontSize: 13,
              }}
            >
              {error}
            </div>
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
              borderBottom:
                "1px solid #e5e7eb",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>
                Global Order Management
              </strong>

              <div
                style={{
                  color: "#64748b",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                Admin has global visibility across
                every manager and client.
              </div>
            </div>

            <span
              style={{
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Showing{" "}
              {filteredOrders.length} of{" "}
              {orders.length}
            </span>
          </div>

          {loading ? (
            <div
              style={{
                padding: 60,
                textAlign: "center",
                color: "#64748b",
              }}
            >
              Loading order database...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div
              style={{
                padding: 60,
                textAlign: "center",
                color: "#64748b",
              }}
            >
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#334155",
                }}
              >
                No orders found
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                }}
              >
                Try changing your search or
                filters.
              </div>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                  minWidth: 1500,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "#f8fafc",
                    }}
                  >
                    {[
                      "Order",
                      "Client",
                      "Manager",
                      "Property",
                      "Amount",
                      "Profit",
                      "Payment",
                      "Order Status",
                      "Tasks",
                      "Created",
                      "View",
                    ].map(
                      (heading) => (
                        <th
                          key={heading}
                          style={{
                            textAlign:
                              "left",
                            padding:
                              "13px 16px",
                            fontSize: 12,
                            color:
                              "#64748b",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map(
                    (order) => {
                      const orderBadge =
                        statusBadge(
                          order.status
                        );

                      const paymentBadge =
                        statusBadge(
                          order.paymentStatus
                        );

                      const completedTasks =
                        order.tasks.filter(
                          (task) =>
                            task.status ===
                            "COMPLETED"
                        ).length;

                      return (
                        <tr
                          key={order.id}
                          style={{
                            borderTop:
                              "1px solid #eef2f7",
                          }}
                        >
                          <td
                            style={{
                              padding:
                                "15px 16px",
                            }}
                          >
                            <strong>
                              {
                                order.orderCode
                              }
                            </strong>

                            <div
                              style={{
                                color:
                                  "#94a3b8",
                                fontSize:
                                  10,
                                marginTop:
                                  4,
                              }}
                            >
                              {
                                order.id
                              }
                            </div>
                          </td>

                          <td
                            style={{
                              padding:
                                "15px 16px",
                            }}
                          >
                            <strong>
                              {
                                order.user
                                  .name
                              }
                            </strong>

                            <div
                              style={{
                                color:
                                  "#64748b",
                                fontSize:
                                  11,
                                marginTop:
                                  4,
                              }}
                            >
                              {
                                order.user
                                  .email
                              }
                            </div>

                            {order.user
                              .phone && (
                              <div
                                style={{
                                  color:
                                    "#94a3b8",
                                  fontSize:
                                    10,
                                  marginTop:
                                    2,
                                }}
                              >
                                {
                                  order.user
                                    .phone
                                }
                              </div>
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                "15px 16px",
                            }}
                          >
                            <strong>
                              {
                                order
                                  .manager
                                  .name
                              }
                            </strong>

                            <div
                              style={{
                                color:
                                  "#64748b",
                                fontSize:
                                  11,
                                marginTop:
                                  4,
                              }}
                            >
                              {
                                order
                                  .manager
                                  .referralCode
                              }
                            </div>
                          </td>

                          <td
                            style={{
                              padding:
                                "15px 16px",
                            }}
                          >
                            {order.property ? (
                              <>
                                <strong>
                                  {
                                    order
                                      .property
                                      .title
                                  }
                                </strong>

                                <div
                                  style={{
                                    color:
                                      "#64748b",
                                    fontSize:
                                      11,
                                    marginTop:
                                      4,
                                  }}
                                >
                                  {
                                    order
                                      .property
                                      .location ||
                                    "No location"
                                  }
                                </div>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                "15px 16px",
                              fontWeight: 900,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {formatMoney(
                              order.amount
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                "15px 16px",
                              fontWeight: 800,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {formatMoney(
                              order.profit
                            )}

                            <div
                              style={{
                                color:
                                  "#64748b",
                                fontSize:
                                  10,
                                marginTop:
                                  3,
                              }}
                            >
                              {
                                order.profitRate
                              }
                              %
                            </div>
                          </td>

                          <td
                            style={{
                              padding:
                                "15px 16px",
                            }}
                          >
                            <span
                              style={{
                                display:
                                  "inline-block",
                                padding:
                                  "5px 9px",
                                borderRadius:
                                  999,
                                background:
                                  paymentBadge.background,
                                color:
                                  paymentBadge.color,
                                fontSize:
                                  10,
                                fontWeight:
                                  900,
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {
                                paymentLabels[
                                  order
                                    .paymentStatus
                                ] ||
                                order
                                  .paymentStatus
                              }
                            </span>
                          </td>

                          <td
                            style={{
                              padding:
                                "15px 16px",
                            }}
                          >
                            <span
                              style={{
                                display:
                                  "inline-block",
                                padding:
                                  "5px 9px",
                                borderRadius:
                                  999,
                                background:
                                  orderBadge.background,
                                color:
                                  orderBadge.color,
                                fontSize:
                                  10,
                                fontWeight:
                                  900,
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {
                                orderStatusLabels[
                                  order.status
                                ] ||
                                order.status
                              }
                            </span>
                          </td>

                          <td
                            style={{
                              padding:
                                "15px 16px",
                            }}
                          >
                            <strong>
                              {
                                order.tasks
                                  .length
                              }
                            </strong>

                            {order.tasks
                              .length >
                              0 && (
                              <div
                                style={{
                                  color:
                                    "#64748b",
                                  fontSize:
                                    10,
                                  marginTop:
                                    3,
                                }}
                              >
                                {
                                  completedTasks
                                }{" "}
                                completed
                              </div>
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                "15px 16px",
                              color:
                                "#64748b",
                              whiteSpace:
                                "nowrap",
                              fontSize: 12,
                            }}
                          >
                            {formatDate(
                              order.createdAt
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                "15px 16px",
                            }}
                          >
                            <button
                              onClick={() =>
                                setSelectedOrder(
                                  order
                                )
                              }
                              style={{
                                border:
                                  "1px solid #dbe1e8",
                                borderRadius:
                                  8,
                                background:
                                  "#fff",
                                padding:
                                  "8px 12px",
                                fontWeight:
                                  800,
                                cursor:
                                  "pointer",
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
            </table>
          </div>
          )}
          {nextCursor && <div style={{ padding: 16, textAlign: "center" }}><button onClick={() => loadOrders(nextCursor, true)} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more orders"}</button></div>}
        </div>

        {/* ORDER DETAIL DRAWER */}

        {selectedOrder && (
          <div
            onClick={() =>
              setSelectedOrder(null)
            }
            style={{
              position: "fixed",
              inset: 0,
              background:
                "rgba(15,23,42,0.45)",
              zIndex: 1000,
              display: "flex",
              justifyContent:
                "flex-end",
            }}
          >
            <div
              onClick={(event) =>
                event.stopPropagation()
              }
              style={{
                width: "min(720px, 100%)",
                height: "100%",
                background: "#fff",
                overflowY: "auto",
                boxShadow:
                  "-10px 0 35px rgba(0,0,0,.15)",
              }}
            >
              <div
                style={{
                  padding: "22px 24px",
                  borderBottom:
                    "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform:
                        "uppercase",
                    }}
                  >
                    Order Details
                  </div>

                  <h3
                    style={{
                      margin:
                        "5px 0 0",
                      fontSize: 22,
                    }}
                  >
                    {
                      selectedOrder
                        .orderCode
                    }
                  </h3>
                </div>

                <button
                  onClick={() =>
                    setSelectedOrder(
                      null
                    )
                  }
                  style={{
                    border: 0,
                    background:
                      "#f1f5f9",
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    cursor:
                      "pointer",
                    fontSize: 18,
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  padding: 24,
                }}
              >
                {/* STATUS */}

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 22,
                  }}
                >
                  <span
                    style={{
                      ...statusBadge(
                        selectedOrder.status
                      ),
                      padding:
                        "7px 11px",
                      borderRadius:
                        999,
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    {orderStatusLabels[
                      selectedOrder.status
                    ] ||
                      selectedOrder.status}
                  </span>

                  <span
                    style={{
                      ...statusBadge(
                        selectedOrder
                          .paymentStatus
                      ),
                      padding:
                        "7px 11px",
                      borderRadius:
                        999,
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    Payment:{" "}
                    {
                      selectedOrder
                        .paymentStatus
                    }
                  </span>
                </div>

                {/* FINANCIAL */}

                <section
                  style={{
                    marginBottom: 24,
                  }}
                >
                  <h4>
                    Financial Summary
                  </h4>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(3,1fr)",
                      gap: 10,
                      marginTop: 10,
                    }}
                  >
                    {[
                      [
                        "Order Value",
                        formatMoney(
                          selectedOrder.amount
                        ),
                      ],
                      [
                        "Profit",
                        formatMoney(
                          selectedOrder.profit
                        ),
                      ],
                      [
                        "Profit Rate",
                        `${selectedOrder.profitRate}%`,
                      ],
                    ].map(
                      ([label, value]) => (
                        <div
                          key={label}
                          style={{
                            padding: 14,
                            background:
                              "#f8fafc",
                            borderRadius: 10,
                          }}
                        >
                          <div
                            style={{
                              color:
                                "#64748b",
                              fontSize:
                                11,
                            }}
                          >
                            {label}
                          </div>

                          <strong
                            style={{
                              display:
                                "block",
                              marginTop:
                                6,
                              fontSize:
                                17,
                            }}
                          >
                            {value}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                </section>

                {/* CLIENT */}

                <section
                  style={{
                    marginBottom: 24,
                  }}
                >
                  <h4>
                    Client
                  </h4>

                  <div
                    style={{
                      marginTop: 10,
                      padding: 15,
                      border:
                        "1px solid #e5e7eb",
                      borderRadius: 10,
                    }}
                  >
                    <strong>
                      {
                        selectedOrder
                          .user.name
                      }
                    </strong>

                    <div
                      style={{
                        color:
                          "#64748b",
                        fontSize: 13,
                        marginTop: 5,
                      }}
                    >
                      {
                        selectedOrder
                          .user.email
                      }
                    </div>

                    {selectedOrder.user
                      .phone && (
                      <div
                        style={{
                          color:
                            "#64748b",
                          fontSize: 12,
                          marginTop: 3,
                        }}
                      >
                        {
                          selectedOrder
                            .user.phone
                        }
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: "#64748b",
                      }}
                    >
                      Membership:{" "}
                      {
                        selectedOrder
                          .user
                          .membershipStatus
                      }
                    </div>
                  </div>
                </section>

                {/* MANAGER */}

                <section
                  style={{
                    marginBottom: 24,
                  }}
                >
                  <h4>
                    Assigned Manager
                  </h4>

                  <div
                    style={{
                      marginTop: 10,
                      padding: 15,
                      border:
                        "1px solid #e5e7eb",
                      borderRadius: 10,
                    }}
                  >
                    <strong>
                      {
                        selectedOrder
                          .manager.name
                      }
                    </strong>

                    <div
                      style={{
                        color:
                          "#64748b",
                        fontSize: 13,
                        marginTop: 5,
                      }}
                    >
                      {
                        selectedOrder
                          .manager.email
                      }
                    </div>

                    <div
                      style={{
                        color:
                          "#64748b",
                        fontSize: 12,
                        marginTop: 3,
                      }}
                    >
                      Referral:{" "}
                      {
                        selectedOrder
                          .manager
                          .referralCode
                      }
                    </div>
                  </div>
                </section>

                {/* PROPERTY */}

                <section
                  style={{
                    marginBottom: 24,
                  }}
                >
                  <h4>
                    Property
                  </h4>

                  <div
                    style={{
                      marginTop: 10,
                      padding: 15,
                      border:
                        "1px solid #e5e7eb",
                      borderRadius: 10,
                    }}
                  >
                    {selectedOrder.property ? (
                      <>
                        <strong>
                          {
                            selectedOrder
                              .property
                              .title
                          }
                        </strong>

                        <div
                          style={{
                            color:
                              "#64748b",
                            fontSize:
                              12,
                            marginTop:
                              5,
                          }}
                        >
                          {
                            selectedOrder
                              .property
                              .location ||
                            "No location"
                          }
                        </div>

                        <div
                          style={{
                            marginTop:
                              8,
                            fontWeight:
                              800,
                          }}
                        >
                          Price:{" "}
                          {formatMoney(
                            selectedOrder
                              .property
                              .price
                          )}
                        </div>
                      </>
                    ) : (
                      "Property unavailable"
                    )}
                  </div>
                </section>

                {/* TASKS */}

                <section
                  style={{
                    marginBottom: 24,
                  }}
                >
                  <h4>
                    Order Tasks
                  </h4>

                  {selectedOrder
                    .tasks.length ===
                  0 ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 16,
                        background:
                          "#f8fafc",
                        borderRadius: 10,
                        color:
                          "#64748b",
                        fontSize: 13,
                      }}
                    >
                      No tasks assigned
                      to this order.
                    </div>
                  ) : (
                    <div
                      style={{
                        display:
                          "grid",
                        gap: 10,
                        marginTop:
                          10,
                      }}
                    >
                      {selectedOrder.tasks.map(
                        (task) => (
                          <div
                            key={
                              task.id
                            }
                            style={{
                              padding:
                                15,
                              border:
                                "1px solid #e5e7eb",
                              borderRadius:
                                10,
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                                gap: 10,
                              }}
                            >
                              <strong>
                                {
                                  task.title
                                }
                              </strong>

                              <span
                                style={{
                                  ...statusBadge(
                                    task.status
                                  ),
                                  padding:
                                    "4px 8px",
                                  borderRadius:
                                    999,
                                  fontSize:
                                    10,
                                  fontWeight:
                                    900,
                                }}
                              >
                                {
                                  task.status
                                }
                              </span>
                            </div>

                            <div
                              style={{
                                color:
                                  "#64748b",
                                fontSize:
                                  11,
                                marginTop:
                                  6,
                              }}
                            >
                              Type:{" "}
                              {
                                task.type
                              }{" "}
                              · Day{" "}
                              {
                                task.dayNumber
                              }{" "}
                              · Profit{" "}
                              {
                                task.profitRate
                              }%
                            </div>

                            <div
                              style={{
                                color:
                                  "#475569",
                                fontSize:
                                  12,
                                marginTop:
                                  5,
                              }}
                            >
                              Profit amount:{" "}
                              {formatMoney(
                                task.profitAmount
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </section>

                {/* TIMELINE */}

                <section>
                  <h4>
                    Order Timeline
                  </h4>

                  <div
                    style={{
                      display:
                        "grid",
                      gap: 8,
                      marginTop:
                        10,
                    }}
                  >
                    {[
                      [
                        "Created",
                        selectedOrder.createdAt,
                      ],
                      [
                        "Payment Submitted",
                        selectedOrder.paymentSubmittedAt,
                      ],
                      [
                        "Payment Verified",
                        selectedOrder.paymentVerifiedAt,
                      ],
                      [
                        "Activated",
                        selectedOrder.activatedAt,
                      ],
                      [
                        "Re-Rent Requested",
                        selectedOrder.rerentRequestedAt,
                      ],
                      [
                        "Re-Rented",
                        selectedOrder.rerentedAt,
                      ],
                      [
                        "Completed",
                        selectedOrder.completedAt,
                      ],
                      [
                        "Cancelled",
                        selectedOrder.cancelledAt,
                      ],
                    ].map(
                      ([label, date]) => (
                        <div
                          key={label}
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            gap: 15,
                            padding:
                              "9px 0",
                            borderBottom:
                              "1px solid #f1f5f9",
                          }}
                        >
                          <span
                            style={{
                              color:
                                "#64748b",
                              fontSize:
                                12,
                            }}
                          >
                            {label}
                          </span>

                          <span
                            style={{
                              fontSize:
                                12,
                              fontWeight:
                                700,
                            }}
                          >
                            {formatDate(
                              date
                            )}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}


