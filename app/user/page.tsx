"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import UserShell from "./UserShell";
import { Decimal } from "decimal.js";
import { customerStatus } from "./CustomerUI";

type Property = {
  id: string;
  title: string;
  location?: string | null;
  description?: string | null;
  price: number | string;
  imageUrl?: string | null;
  propertyUrl?: string | null;
  status?: string;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  type?: string;
  status?: string;
  profitRate?: number;
  profitAmount?: number;
  propertyUrl?: string | null;
  assignedAt?: string;
};

type Order = {
  id: string;
  orderCode: string;
  amount: number;
  profit?: number;
  profitRate?: number;
  status: string;
  paymentStatus?: string;
  paymentReference?: string | null;
  createdAt?: string;
  updatedAt?: string;
  property?: {
    id: string;
    title: string;
    location?: string | null;
    imageUrl?: string | null;
  };
  tasks?: Task[];
};

type Overview = {
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    membershipStatus?: string;
    createdAt?: string;
    approvedAt?: string | null;
    officialMemberAt?: string | null;
  };
  availableBalance?: number | string;
  wallet?: {
    balance?: number | string | null;
    reservedBalance?: number | string | null;
  };
  stats?: {
    totalOrders?: number;
    activeOrders?: number;
    completedOrders?: number;
    pendingTasks?: number;
    completedTasks?: number;
    totalProfit?: number;
    totalDeposits?: number;
    totalWithdrawals?: number;
  };
  settings?: {
    welcomeBalance?: number;
    day2ProfitRate?: number;
    day3ProfitRate?: number;
    rerentProfitRate?: number;
  };
  setting?: { depositInstructions?: string };
};

function money(value: unknown) {
  let amount: Decimal;
  try { amount = new Decimal(String(value ?? "0")); } catch { amount = new Decimal(0); }
  if (!amount.isFinite()) amount = new Decimal(0);
  const [integer, fraction] = amount.abs().toFixed(2).split(".");
  const grouped = integer.length <= 3 ? integer : `${integer.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${integer.slice(-3)}`;
  return `${amount.isNegative() ? "-" : ""}₹${grouped}.${fraction}`;
}

function date(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClass(status?: string) {
  const s = String(status || "").toUpperCase();

  if (
    ["ACTIVE", "APPROVED", "COMPLETED", "PAID", "OFFICIAL_MEMBER"].includes(s)
  ) {
    return "hp-user-status hp-user-status-success";
  }

  if (
    ["PENDING", "PAYMENT_PENDING", "PAYMENT_SUBMITTED", "RE_RENT_PENDING"].includes(
      s
    )
  ) {
    return "hp-user-status hp-user-status-warning";
  }

  if (["REJECTED", "CANCELLED", "DISABLED", "SUSPENDED"].includes(s)) {
    return "hp-user-status hp-user-status-danger";
  }

  return "hp-user-status hp-user-status-neutral";
}

function tierLabel(status?: string) {
  const s = String(status || "").toUpperCase();

  if (s === "OFFICIAL_MEMBER") return "Diamond Official";
  if (s === "DAY_2") return "Progress Member";
  if (s === "DAY_1") return "Starter";
  return "Getting Started";
}

export default function UserDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [propertySearch, setPropertySearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const [overviewRes, propertiesRes, ordersRes] = await Promise.all([
        fetch("/api/user/overview", { cache: "no-store" }),
        fetch("/api/user/properties", { cache: "no-store" }),
        fetch("/api/user/orders", { cache: "no-store" }),
      ]);

      if (
        overviewRes.status === 401 ||
        propertiesRes.status === 401 ||
        ordersRes.status === 401
      ) {
        window.location.href = "/login";
        return;
      }

      const overviewJson = await overviewRes.json();
      const propertiesJson = await propertiesRes.json();
      const ordersJson = await ordersRes.json();

      if (!overviewRes.ok) {
        throw new Error(
          overviewJson?.error || "Unable to load your Housing.pro account."
        );
      }

      setOverview(overviewJson);
      setProperties(
        Array.isArray(propertiesJson)
          ? propertiesJson
          : propertiesJson?.properties || []
      );
      setOrders(
        Array.isArray(ordersJson) ? ordersJson : ordersJson?.orders || []
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load your dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function bookProperty(property: Property) {
    try {
      setBusy(`book-${property.id}`);
      setError("");

      const res = await fetch("/api/user/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property.id, amount: String(property.price) }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Unable to create booking.");
      }

      setPaymentOrder(json.order || json);
      setPaymentMessage(
        "Your booking has been created. Follow the payment instructions shown for your account, then share your payment reference."
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create booking.");
    } finally {
      setBusy(null);
    }
  }

  async function submitPayment() {
    if (!paymentOrder) return;

    try {
      setBusy(`payment-${paymentOrder.id}`);
      setError("");

      const res = await fetch("/api/user/orders/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: paymentOrder.id,
          paymentReference: paymentReference.trim() || undefined,
          paymentProofUrl: paymentProofUrl.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Unable to submit payment.");
      }

      setPaymentMessage(
        "Payment details submitted. Your payment will be checked and your booking status will update here."
      );
      setPaymentReference("");
      setPaymentProofUrl("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit payment.");
    } finally {
      setBusy(null);
    }
  }

  async function settleTask(task: Task) {
    try {
      setBusy(`task-${task.id}`);
      setError("");

      const res = await fetch("/api/user/tasks/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Task cannot be completed yet.");
      }

      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Task cannot be completed yet."
      );
    } finally {
      setBusy(null);
    }
  }

  const user = overview?.user;
  const wallet = overview?.wallet || {};
  const stats = overview?.stats || {};
  const tier = tierLabel(user?.membershipStatus);

  const pendingTasks = useMemo(
    () =>
      orders
        .flatMap((order) =>
          (order.tasks || []).map((task) => ({
            ...task,
            orderCode: order.orderCode,
            propertyTitle: order.property?.title,
          }))
        )
        .filter((task) => !["COMPLETED", "REJECTED"].includes(String(task.status))),
    [orders]
  );

  const filteredProperties = useMemo(() => {
    const q = propertySearch.trim().toLowerCase();
    if (!q) return properties;

    return properties.filter((property) =>
      [property.title, property.location, property.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [properties, propertySearch]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((order) =>
      [order.orderCode, order.property?.title, order.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [orders, orderSearch]);

  return (
    <UserShell
      userName={user?.name || "Client"}
      membership={tier}
      notificationCount={0}
    >
      <div className="hp-user-head">
        <div>
          <div className="hp-user-eyebrow">Housing.pro marketplace</div>
          <h1>Welcome back, {user?.name || "Client"}</h1>
          <p>
            Manage your properties, orders, tasks and wallet from your
            Housing.pro account.
          </p>
        </div>

        <div className="hp-user-head-actions">
          <button
            className="hp-user-btn hp-user-btn-secondary"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link
            href="/user/profile"
            className="hp-user-btn hp-user-btn-primary"
          >
            My Profile
          </Link>
        </div>
      </div>

      {error && (
        <div className="hp-user-alert hp-user-alert-danger">
          <strong>Notice:</strong> {error}
        </div>
      )}

      <section className="hp-user-tier-card">
        <div>
          <div className="hp-user-section-kicker">CURRENT MEMBERSHIP</div>
          <h2>{tier}</h2>
          <p>
            Your account progress is managed automatically as you complete the
            required activities.
          </p>
        </div>

        <div className="hp-user-tier-side">
          <span>Current balance</span>
          <strong>{money(overview?.availableBalance ?? wallet.balance)}</strong>
        </div>
      </section>

      <section className="hp-user-kpi-grid">
        <div className="hp-user-kpi">
          <span>Available Balance</span>
          <strong>{money(wallet.balance)}</strong>
          <small>Ready balance</small>
        </div>

        <div className="hp-user-kpi">
          <span>Reserved Balance</span>
          <strong>{money(wallet.reservedBalance)}</strong>
          <small>Temporarily reserved</small>
        </div>

        <div className="hp-user-kpi">
          <span>My Orders</span>
          <strong>{stats.totalOrders ?? orders.length}</strong>
          <small>{stats.activeOrders ?? 0} active</small>
        </div>

        <div className="hp-user-kpi">
          <span>Pending Tasks</span>
          <strong>{stats.pendingTasks ?? pendingTasks.length}</strong>
          <small>Tasks awaiting completion</small>
        </div>

        <div className="hp-user-kpi">
          <span>Completed Tasks</span>
          <strong>{stats.completedTasks ?? 0}</strong>
          <small>Successfully completed</small>
        </div>

        <div className="hp-user-kpi">
          <span>Total Profit</span>
          <strong>{money(stats.totalProfit)}</strong>
          <small>Recorded earnings</small>
        </div>
      </section>

      <section className="hp-user-panel">
        <div className="hp-user-panel-head">
          <div>
            <div className="hp-user-section-kicker">MARKETPLACE</div>
            <h2>Available Properties</h2>
            <p>
              Browse available properties and create a booking when you are
              ready.
            </p>
          </div>

          <div className="hp-user-toolbar">
            <input
              className="hp-user-search"
              value={propertySearch}
              onChange={(e) => setPropertySearch(e.target.value)}
              placeholder="Search properties..."
            />
            <Link
              href="/user/properties"
              className="hp-user-btn hp-user-btn-secondary"
            >
              View All
            </Link>
          </div>
        </div>

        {filteredProperties.length === 0 ? (
          <div className="hp-user-empty">
            <div className="hp-user-empty-icon">⌂</div>
            <h3>No properties available</h3>
            <p>New property listings will appear here when they are available.</p>
          </div>
        ) : (
          <div className="hp-property-grid">
            {filteredProperties.slice(0, 8).map((property) => (
              <article className="hp-property-card" key={property.id}>
                <div className="hp-property-media">
                  {property.imageUrl ? (
                    <img src={property.imageUrl} alt={property.title} />
                  ) : (
                    <div className="hp-property-placeholder">
                      Housing.pro
                    </div>
                  )}

                  <span className="hp-property-badge">
                    {property.status || "ACTIVE"}
                  </span>
                </div>

                <div className="hp-property-body">
                  <div className="hp-property-location">
                    {property.location || "Property Marketplace"}
                  </div>
                  <h3>{property.title}</h3>
                  <p>
                    {property.description ||
                      "View the property details before starting your booking."}
                  </p>

                  <div className="hp-property-footer">
                    <strong>{money(property.price)}</strong>

                    <div className="hp-property-actions">
                      <Link
                        href={`/user/properties/${property.id}`}
                        className="hp-user-btn hp-user-btn-secondary"
                      >
                        Details
                      </Link>
                      <button
                        className="hp-user-btn hp-user-btn-primary"
                        disabled={busy === `book-${property.id}`}
                        onClick={() => bookProperty(property)}
                      >
                        {busy === `book-${property.id}`
                          ? "Booking..."
                          : "Book Now"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="hp-user-two-col">
        <section className="hp-user-panel">
          <div className="hp-user-panel-head">
            <div>
              <div className="hp-user-section-kicker">MY RENTALS</div>
              <h2>Recent bookings</h2>
              <p>Track your property booking activity.</p>
            </div>

            <div className="hp-user-toolbar">
              <input
                className="hp-user-search"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search bookings..."
              />
              <Link
                href="/user/orders"
                className="hp-user-text-link"
              >
                View all →
              </Link>
            </div>
          </div>

          <div className="hp-user-table-wrap">
            <table className="hp-user-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Property</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.slice(0, 8).map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link
                        href={`/user/orders/${order.id}`}
                        className="hp-user-order-link"
                      >
                        {order.orderCode}
                      </Link>
                    </td>
                    <td>{order.property?.title || "—"}</td>
                    <td>{money(order.amount)}</td>
                    <td>
                      <span className={statusClass(order.status)}>
                        {customerStatus(order.status)}
                      </span>
                    </td>
                    <td>{date(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredOrders.length === 0 && (
              <div className="hp-user-empty hp-user-empty-small">
                <h3>No bookings yet</h3>
                <p>Your bookings will appear here.</p>
              </div>
            )}
          </div>
        </section>

        <section className="hp-user-panel">
          <div className="hp-user-panel-head">
            <div>
              <div className="hp-user-section-kicker">TASK CENTER</div>
              <h2>Current Tasks</h2>
              <p>Complete available tasks to continue your account progress.</p>
            </div>

            <Link href="/user/tasks" className="hp-user-text-link">
              Task Center →
            </Link>
          </div>

          {pendingTasks.length === 0 ? (
            <div className="hp-user-empty hp-user-empty-small">
              <div className="hp-user-empty-icon">✓</div>
              <h3>All caught up</h3>
              <p>No pending tasks require your attention.</p>
            </div>
          ) : (
            <div className="hp-task-list">
              {pendingTasks.slice(0, 6).map((task) => (
                <div className="hp-task-row" key={task.id}>
                  <div className="hp-task-icon">✓</div>

                  <div className="hp-task-main">
                    <strong>{task.title}</strong>
                    <span>{task.propertyTitle || "Housing.pro task"}</span>
                    {task.description && <small>{task.description}</small>}
                  </div>

                  <div className="hp-task-side">
                    {task.profitRate ? (
                      <b>{new Decimal(String(task.profitRate)).toFixed(2)}%</b>
                    ) : null}

                    <button
                      className="hp-user-btn hp-user-btn-primary"
                      disabled={busy === `task-${task.id}`}
                      onClick={() => settleTask(task)}
                    >
                      {busy === `task-${task.id}` ? "Processing..." : "Complete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="hp-user-panel">
        <div className="hp-user-panel-head">
          <div>
            <div className="hp-user-section-kicker">ACCOUNT SNAPSHOT</div>
            <h2>Account Overview</h2>
            <p>Your Housing.pro account information and activity summary.</p>
          </div>
        </div>

        <div className="hp-account-grid">
          <div>
            <span>Name</span>
            <strong>{user?.name || "—"}</strong>
          </div>

          <div>
            <span>Email</span>
            <strong>{user?.email || "—"}</strong>
          </div>

          <div>
            <span>Phone</span>
            <strong>{user?.phone || "—"}</strong>
          </div>

          <div>
            <span>Joined</span>
            <strong>{date(user?.createdAt)}</strong>
          </div>

          <div>
            <span>Membership</span>
            <strong>{tier}</strong>
          </div>

        </div>
      </section>

      <section className="hp-user-quick-grid">
        <Link href="/user/properties" className="hp-user-quick-card">
          <span>Properties</span>
          <strong>Browse listings →</strong>
          <small>Find and book available properties.</small>
        </Link>

        <Link href="/user/tasks" className="hp-user-quick-card">
          <span>Tasks</span>
          <strong>Complete tasks →</strong>
          <small>Earn profit and advance your membership.</small>
        </Link>

        <Link href="/user/revenue" className="hp-user-quick-card">
          <span>Revenue</span>
          <strong>View earnings →</strong>
          <small>Track task profits and re-rent income.</small>
        </Link>

        <Link href="/user/support" className="hp-user-quick-card">
          <span>Support</span>
          <strong>Get help →</strong>
          <small>Guidance for bookings, tasks, and account.</small>
        </Link>
      </section>

      {paymentOrder && (
        <div className="hp-user-modal-backdrop">
          <div className="hp-user-modal">
            <div className="hp-user-modal-head">
              <div>
                <div className="hp-user-section-kicker">BOOKING PAYMENT</div>
                <h2>Complete your payment</h2>
                <p>
                  Order {paymentOrder.orderCode} ·{" "}
                  {money(paymentOrder.amount)}
                </p>
              </div>

              <button
                className="hp-user-modal-close"
                onClick={() => setPaymentOrder(null)}
              >
                ×
              </button>
            </div>

            <div className="hp-user-payment-notice">
              <strong>Manual payment</strong>
              <span>
                Housing.pro does not process this payment through an online
                gateway. Complete payment using these instructions, then submit
                the payment reference below.
              </span>
              <p>{overview?.setting?.depositInstructions || "Follow the payment instructions provided for your account, then submit your transaction reference or proof."}</p>
            </div>

            {paymentMessage && (
              <div className="hp-user-alert hp-user-alert-success">
                {paymentMessage}
              </div>
            )}

            <label className="hp-user-field">
              <span>Payment Reference</span>
              <input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Enter transaction/reference number"
              />
            </label>

            <label className="hp-user-field">
              <span>Payment Proof URL (optional)</span>
              <input
                value={paymentProofUrl}
                onChange={(e) => setPaymentProofUrl(e.target.value)}
                placeholder="Paste proof URL if available"
              />
            </label>

            <div className="hp-user-modal-actions">
              <button
                className="hp-user-btn hp-user-btn-secondary"
                onClick={() => setPaymentOrder(null)}
              >
                Close
              </button>

              <button
                className="hp-user-btn hp-user-btn-primary"
                disabled={busy === `payment-${paymentOrder.id}`}
                onClick={submitPayment}
              >
                {busy === `payment-${paymentOrder.id}`
                  ? "Submitting..."
                  : "Submit Payment Details"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .hp-user-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 22px;
        }

        .hp-user-eyebrow,
        .hp-user-section-kicker {
          font-size: 11px;
          font-weight: 850;
          letter-spacing: .12em;
          color: #64748b;
        }

        .hp-user-head h1 {
          margin: 4px 0 7px;
          font-size: 30px;
          letter-spacing: -0.035em;
          color: #0f172a;
        }

        .hp-user-head p {
          margin: 0;
          max-width: 720px;
          color: #64748b;
          line-height: 1.6;
          font-size: 13px;
        }

        .hp-user-head-actions,
        .hp-user-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .hp-user-btn {
          border: 0;
          border-radius: 9px;
          padding: 9px 13px;
          min-height: 36px;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: .15s ease;
        }

        .hp-user-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .hp-user-btn-primary {
          background: #0f172a;
          color: #fff;
        }

        .hp-user-btn-secondary {
          background: #f1f5f9;
          color: #334155;
        }

        .hp-user-alert {
          padding: 13px 15px;
          border-radius: 12px;
          margin-bottom: 18px;
          font-size: 13px;
        }

        .hp-user-alert-danger {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .hp-user-alert-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .hp-user-tier-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 22px;
          margin-bottom: 16px;
          border-radius: 17px;
          background: linear-gradient(135deg, #0f172a, #1e293b);
          color: #fff;
          box-shadow: 0 10px 30px rgba(15, 23, 42, .14);
        }

        .hp-user-tier-card .hp-user-section-kicker {
          color: #94a3b8;
        }

        .hp-user-tier-card h2 {
          margin: 5px 0;
          font-size: 24px;
        }

        .hp-user-tier-card p {
          margin: 0;
          color: #cbd5e1;
          font-size: 12px;
        }

        .hp-user-tier-side {
          min-width: 170px;
          text-align: right;
        }

        .hp-user-tier-side span,
        .hp-user-tier-side strong {
          display: block;
        }

        .hp-user-tier-side span {
          color: #94a3b8;
          font-size: 11px;
        }

        .hp-user-tier-side strong {
          margin-top: 5px;
          font-size: 24px;
        }

        .hp-user-kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 18px;
        }

        .hp-user-kpi,
        .hp-user-panel,
        .hp-user-quick-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 5px 20px rgba(15, 23, 42, .045);
        }

        .hp-user-kpi {
          padding: 17px;
          border-radius: 15px;
        }

        .hp-user-kpi span,
        .hp-user-kpi strong,
        .hp-user-kpi small {
          display: block;
        }

        .hp-user-kpi span {
          color: #64748b;
          font-size: 11px;
          font-weight: 750;
        }

        .hp-user-kpi strong {
          margin-top: 7px;
          color: #0f172a;
          font-size: 22px;
        }

        .hp-user-kpi small {
          margin-top: 5px;
          color: #94a3b8;
          font-size: 10px;
        }

        .hp-user-panel {
          padding: 20px;
          border-radius: 16px;
          margin-bottom: 18px;
          overflow: hidden;
        }

        .hp-user-panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 17px;
        }

        .hp-user-panel-head h2 {
          margin: 4px 0 5px;
          color: #0f172a;
          font-size: 19px;
        }

        .hp-user-panel-head p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
        }

        .hp-user-search {
          height: 36px;
          width: 210px;
          border: 1px solid #dbe1ea;
          border-radius: 9px;
          padding: 0 11px;
          outline: none;
          font-size: 12px;
        }

        .hp-user-search:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, .12);
        }

        .hp-user-text-link,
        .hp-user-order-link {
          color: #2563eb;
          text-decoration: none;
          font-weight: 800;
          font-size: 12px;
        }

        .hp-property-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .hp-property-card {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #fff;
        }

        .hp-property-media {
          position: relative;
          height: 145px;
          background: #f1f5f9;
          overflow: hidden;
        }

        .hp-property-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .hp-property-placeholder {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          color: #94a3b8;
          font-weight: 850;
          letter-spacing: .04em;
        }

        .hp-property-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          padding: 5px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,.94);
          color: #166534;
          font-size: 9px;
          font-weight: 850;
        }

        .hp-property-body {
          padding: 14px;
        }

        .hp-property-location {
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
        }

        .hp-property-body h3 {
          margin: 4px 0 5px;
          color: #0f172a;
          font-size: 14px;
        }

        .hp-property-body p {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin: 0;
          min-height: 32px;
          color: #64748b;
          font-size: 11px;
          line-height: 1.45;
        }

        .hp-property-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 8px;
          margin-top: 13px;
        }

        .hp-property-footer > strong {
          color: #0f172a;
          font-size: 15px;
          white-space: nowrap;
        }

        .hp-property-actions {
          display: flex;
          gap: 5px;
        }

        .hp-property-actions .hp-user-btn {
          padding: 7px 9px;
          min-height: 32px;
          font-size: 10px;
        }

        .hp-user-two-col {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(330px, .65fr);
          gap: 18px;
        }

        .hp-user-two-col .hp-user-panel {
          min-width: 0;
        }

        .hp-user-table-wrap {
          overflow-x: auto;
          border: 1px solid #eef2f7;
          border-radius: 11px;
        }

        .hp-user-table {
          width: 100%;
          min-width: 620px;
          border-collapse: collapse;
        }

        .hp-user-table th {
          padding: 10px 12px;
          text-align: left;
          background: #f8fafc;
          color: #64748b;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: .07em;
        }

        .hp-user-table td {
          padding: 12px;
          border-top: 1px solid #eef2f7;
          color: #334155;
          font-size: 11px;
        }

        .hp-task-list {
          display: flex;
          flex-direction: column;
        }

        .hp-task-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 0;
          border-top: 1px solid #eef2f7;
        }

        .hp-task-row:first-child {
          border-top: 0;
        }

        .hp-task-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          background: #f1f5f9;
          color: #334155;
          font-weight: 900;
        }

        .hp-task-main {
          min-width: 0;
          flex: 1;
        }

        .hp-task-main strong,
        .hp-task-main span,
        .hp-task-main small {
          display: block;
        }

        .hp-task-main strong {
          font-size: 12px;
          color: #0f172a;
        }

        .hp-task-main span {
          margin-top: 2px;
          color: #64748b;
          font-size: 10px;
        }

        .hp-task-main small {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.4;
        }

        .hp-task-side {
          text-align: right;
        }

        .hp-task-side b {
          display: block;
          margin-bottom: 5px;
          color: #166534;
          font-size: 11px;
        }

        .hp-task-side .hp-user-btn {
          padding: 7px 9px;
          min-height: 31px;
          font-size: 10px;
        }

        .hp-account-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          background: #e2e8f0;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }

        .hp-account-grid > div {
          padding: 14px;
          background: #fff;
        }

        .hp-account-grid span,
        .hp-account-grid strong {
          display: block;
        }

        .hp-account-grid span {
          color: #64748b;
          font-size: 10px;
        }

        .hp-account-grid strong {
          margin-top: 5px;
          color: #0f172a;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hp-user-quick-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
        }

        .hp-user-quick-card {
          border-radius: 14px;
          padding: 16px;
          text-decoration: none;
          transition: .15s ease;
        }

        .hp-user-quick-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(15, 23, 42, .08);
        }

        .hp-user-quick-card span,
        .hp-user-quick-card strong,
        .hp-user-quick-card small {
          display: block;
        }

        .hp-user-quick-card span {
          color: #64748b;
          font-size: 10px;
          font-weight: 750;
        }

        .hp-user-quick-card strong {
          margin-top: 6px;
          color: #0f172a;
          font-size: 13px;
        }

        .hp-user-quick-card small {
          margin-top: 5px;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.4;
        }

        .hp-user-status {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 850;
          white-space: nowrap;
        }

        .hp-user-status-success {
          background: #dcfce7;
          color: #166534;
        }

        .hp-user-status-warning {
          background: #fef3c7;
          color: #92400e;
        }

        .hp-user-status-danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .hp-user-status-neutral {
          background: #f1f5f9;
          color: #475569;
        }

        .hp-user-empty {
          padding: 38px 20px;
          text-align: center;
          color: #64748b;
        }

        .hp-user-empty-small {
          padding: 28px 15px;
        }

        .hp-user-empty-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          margin: 0 auto 9px;
          border-radius: 50%;
          background: #f1f5f9;
          color: #475569;
          font-weight: 900;
        }

        .hp-user-empty h3 {
          margin: 0 0 4px;
          color: #334155;
          font-size: 13px;
        }

        .hp-user-empty p {
          margin: 0;
          font-size: 11px;
        }

        .hp-user-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(15, 23, 42, .58);
        }

        .hp-user-modal {
          width: min(560px, 100%);
          max-height: calc(100vh - 40px);
          overflow: auto;
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, .25);
          padding: 22px;
        }

        .hp-user-modal-head {
          display: flex;
          justify-content: space-between;
          gap: 15px;
        }

        .hp-user-modal-head h2 {
          margin: 4px 0 5px;
          font-size: 20px;
        }

        .hp-user-modal-head p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
        }

        .hp-user-modal-close {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 9px;
          background: #f1f5f9;
          color: #475569;
          font-size: 22px;
          cursor: pointer;
        }

        .hp-user-payment-notice {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin: 18px 0;
          padding: 14px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .hp-user-payment-notice strong {
          font-size: 12px;
          color: #0f172a;
        }

        .hp-user-payment-notice span {
          font-size: 11px;
          line-height: 1.5;
          color: #64748b;
        }

        .hp-user-field {
          display: block;
          margin-top: 13px;
        }

        .hp-user-field span {
          display: block;
          margin-bottom: 6px;
          color: #334155;
          font-size: 11px;
          font-weight: 750;
        }

        .hp-user-field input {
          width: 100%;
          box-sizing: border-box;
          height: 40px;
          padding: 0 11px;
          border: 1px solid #dbe1ea;
          border-radius: 9px;
          outline: none;
          font-size: 12px;
        }

        .hp-user-field input:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, .12);
        }

        .hp-user-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 18px;
        }

        @media (max-width: 1250px) {
          .hp-user-kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .hp-property-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .hp-user-quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .hp-user-head,
          .hp-user-panel-head {
            flex-direction: column;
          }

          .hp-user-two-col {
            grid-template-columns: 1fr;
          }

          .hp-user-toolbar {
            width: 100%;
          }

          .hp-user-search {
            flex: 1;
            width: 100%;
          }

          .hp-account-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 620px) {
          .hp-user-kpi-grid,
          .hp-property-grid,
          .hp-user-quick-grid {
            grid-template-columns: 1fr 1fr;
          }

          .hp-user-tier-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .hp-user-tier-side {
            text-align: left;
          }

          .hp-user-head-actions,
          .hp-user-head-actions .hp-user-btn {
            width: 100%;
          }

          .hp-account-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </UserShell>
  );
}

