"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ManagerShell from "./ManagerShell";
import { Decimal } from "decimal.js";

type Client = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  signupStatus?: string;
  membershipStatus?: string;
  status?: string;
  createdAt?: string;
  approvedAt?: string | null;
  wallet?: { balance?: number | string | null } | null;
  clientDay?: number | null;
};

type Signup = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  createdAt?: string;
  signupStatus?: string;
  membershipStatus?: string;
  clientDay?: number | null;
};

type Order = {
  id: string;
  orderCode: string;
  amount: number;
  profit?: number;
  profitRate?: number;
  status: string;
  paymentStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  property?: {
    id: string;
    title: string;
    location?: string | null;
  };
};

type Overview = {
  manager?: {
    id: string;
    name: string;
    email: string;
    referralCode?: string;
  };
  stats?: {
    totalClients?: number;
    pendingSignups?: number;
    activeClients?: number;
    officialMembers?: number;
    totalOrders?: number;
    pendingOrders?: number;
    activeOrders?: number;
    completedOrders?: number;
    totalDeposits?: number;
    totalWithdrawals?: number;
    totalProfit?: number;
  };
  clients?: Client[];
  pendingSignups?: Signup[];
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

  if (["ACTIVE", "APPROVED", "COMPLETED", "PAID", "OFFICIAL_MEMBER"].includes(s)) {
    return "hp-status hp-status-success";
  }

  if (["PENDING", "PAYMENT_PENDING", "PAYMENT_SUBMITTED", "RE_RENT_PENDING"].includes(s)) {
    return "hp-status hp-status-warning";
  }

  if (["REJECTED", "CANCELLED", "DISABLED", "SUSPENDED"].includes(s)) {
    return "hp-status hp-status-danger";
  }

  return "hp-status hp-status-neutral";
}

export default function ManagerDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const [overviewRes, ordersRes] = await Promise.all([
        fetch("/api/manager/overview", { cache: "no-store" }),
        fetch("/api/manager/orders", { cache: "no-store" }),
      ]);

      if (overviewRes.status === 401 || ordersRes.status === 401) {
        window.location.href="/manager-login";
        return;
      }

      const overviewJson = await overviewRes.json();
      const ordersJson = await ordersRes.json();

      if (!overviewRes.ok) {
        throw new Error(overviewJson?.error || "Unable to load manager dashboard.");
      }

      setData(overviewJson);
      setOrders(Array.isArray(ordersJson) ? ordersJson : ordersJson?.orders || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function signupAction(userId: string, action: "APPROVE" | "REJECT") {
    try {
      setBusy(`signup-${userId}`);
      setError("");

      const res = await fetch("/api/manager/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Signup action failed.");
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function orderAction(orderId: string, action: "VERIFY_PAYMENT" | "CANCEL") {
    try {
      setBusy(`order-${orderId}`);
      setError("");

      const res = await fetch("/api/manager/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Order action failed.");
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function rerent(orderId: string) {
    try {
      setBusy(`rerent-${orderId}`);
      setError("");

      const res = await fetch("/api/manager/orders/rerent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Unable to create re-rent task.");
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create re-rent task.");
    } finally {
      setBusy(null);
    }
  }

  async function handleBulkSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/manager/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Sync failed");
      const synced = json.results?.filter((r: any) => r.ok).length || 0;
      setSyncResult("Bulk sync complete. " + synced + " of " + (json.results?.length || 0) + " clients synced.");
    } catch (e) {
      setSyncResult("Error: " + (e instanceof Error ? e.message : "Sync failed"));
    } finally {
      setSyncing(false);
    }
  }

  const stats = data?.stats || {};
  const clients = data?.clients || [];
  const signups = data?.pendingSignups || [];

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;

    return clients.filter((client) =>
      [
        client.name,
        client.email,
        client.phone,
        client.membershipStatus,
        client.signupStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [clients, search]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((order) =>
      [
        order.orderCode,
        order.user?.name,
        order.user?.email,
        order.property?.title,
        order.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [orders, orderSearch]);

  const managerName = data?.manager?.name || "Manager";

  return (
    <ManagerShell
      managerName={managerName}
      notificationCount={signups.length}
    >
      <div className="hp-page-head">
        <div>
          <div className="hp-eyebrow">MANAGER WORKSPACE</div>
          <h1>Manager Dashboard</h1>
          <p>
            Manage your assigned clients, signups, orders and operational
            activity from one Housing.pro workspace.
          </p>
        </div>

        <div className="hp-head-actions">
          <button className="hp-btn hp-btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            className="hp-btn hp-btn-primary"
            onClick={handleBulkSync}
            disabled={syncing || loading}
          >
            {syncing ? "Syncing All..." : "Sync All Clients"}
          </button>
          <Link href="/manager/clients" className="hp-btn hp-btn-secondary">
            View Clients
          </Link>
        </div>

        {syncResult && (
          <div
            className="hp-alert"
            style={{
              marginTop: 12,
              background: syncResult.startsWith("Error") ? "#fef2f2" : "#f0fdf4",
              borderColor: syncResult.startsWith("Error") ? "#fecaca" : "#bbf7d0",
              color: syncResult.startsWith("Error") ? "#b91c1c" : "#166534",
            }}
          >
            {syncResult}
          </div>
        )}
      </div>

      {error && (
        <div className="hp-alert hp-alert-danger">
          <strong>Action required:</strong> {error}
        </div>
      )}

      <section className="hp-kpi-grid">
        <div className="hp-kpi-card">
          <div className="hp-kpi-label">My Clients</div>
          <div className="hp-kpi-value">{stats.totalClients ?? clients.length}</div>
          <div className="hp-kpi-note">Clients assigned to your referral</div>
        </div>

        <div className="hp-kpi-card">
          <div className="hp-kpi-label">New Signups</div>
          <div className="hp-kpi-value">{stats.pendingSignups ?? signups.length}</div>
          <div className="hp-kpi-note">Awaiting manager action</div>
        </div>

        <div className="hp-kpi-card">
          <div className="hp-kpi-label">Active Clients</div>
          <div className="hp-kpi-value">{stats.activeClients ?? 0}</div>
          <div className="hp-kpi-note">Currently active accounts</div>
        </div>

        <div className="hp-kpi-card">
          <div className="hp-kpi-label">Official Members</div>
          <div className="hp-kpi-value">{stats.officialMembers ?? 0}</div>
          <div className="hp-kpi-note">Clients reaching official tier</div>
        </div>

        <div className="hp-kpi-card">
          <div className="hp-kpi-label">Orders</div>
          <div className="hp-kpi-value">{stats.totalOrders ?? orders.length}</div>
          <div className="hp-kpi-note">Orders under your management</div>
        </div>

        <div className="hp-kpi-card">
          <div className="hp-kpi-label">Platform Profit</div>
          <div className="hp-kpi-value">{money(stats.totalProfit)}</div>
          <div className="hp-kpi-note">Recorded order/task profit</div>
        </div>
      </section>

      <div className="hp-section-grid">
        <section className="hp-panel hp-panel-wide">
          <div className="hp-panel-head">
            <div>
              <div className="hp-section-kicker">ACTION CENTER</div>
              <h2>New Signups</h2>
              <p>Review clients who registered through your referral code.</p>
            </div>
            <Link href="/manager/signups" className="hp-text-link">
              Open all
            </Link>
          </div>

          {signups.length === 0 ? (
            <div className="hp-empty">
              <div className="hp-empty-icon">✓</div>
              <h3>No pending signups</h3>
              <p>New referral registrations will appear here.</p>
            </div>
          ) : (
            <div className="hp-list">
              {signups.slice(0, 6).map((signup) => (
                <div className="hp-list-row" key={signup.id}>
                  <div className="hp-avatar">
                    {(signup.name || "U").charAt(0).toUpperCase()}
                  </div>

                  <div className="hp-list-main">
                    <strong>{signup.name}</strong>
                    <span>{signup.email}</span>
                    <small>
                      Registered {date(signup.createdAt)}
                      {signup.clientDay ? ` · Client day ${signup.clientDay}` : ""}
                    </small>
                  </div>

                  <div className="hp-row-actions">
                    <button
                      className="hp-btn hp-btn-success"
                      disabled={busy === `signup-${signup.id}`}
                      onClick={() => signupAction(signup.id, "APPROVE")}
                    >
                      Approve
                    </button>
                    <button
                      className="hp-btn hp-btn-danger-soft"
                      disabled={busy === `signup-${signup.id}`}
                      onClick={() => signupAction(signup.id, "REJECT")}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="hp-panel">
          <div className="hp-panel-head">
            <div>
              <div className="hp-section-kicker">REFERRAL</div>
              <h2>Your Referral</h2>
              <p>Use this code to associate new clients with your account.</p>
            </div>
          </div>

          <div className="hp-referral-box">
            <span>Referral Code</span>
            <strong>{data?.manager?.referralCode || "—"}</strong>
          </div>

          <div className="hp-mini-grid">
            <div>
              <span>Deposits</span>
              <strong>{money(stats.totalDeposits)}</strong>
            </div>
            <div>
              <span>Withdrawals</span>
              <strong>{money(stats.totalWithdrawals)}</strong>
            </div>
            <div>
              <span>Active Orders</span>
              <strong>{stats.activeOrders ?? 0}</strong>
            </div>
            <div>
              <span>Completed</span>
              <strong>{stats.completedOrders ?? 0}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="hp-panel">
        <div className="hp-panel-head">
          <div>
            <div className="hp-section-kicker">CLIENT MANAGEMENT</div>
            <h2>My Clients</h2>
            <p>Only clients assigned to your Housing.pro referral are shown.</p>
          </div>

          <div className="hp-toolbar">
            <input
              className="hp-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
            />
            <Link href="/manager/clients" className="hp-btn hp-btn-secondary">
              Full Client List
            </Link>
          </div>
        </div>

        <div className="hp-table-wrap">
          <table className="hp-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Client Day</th>
                <th>Tier</th>
                <th>Wallet</th>
                <th>Signup</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredClients.slice(0, 10).map((client) => (
                <tr key={client.id}>
                  <td>
                    <div className="hp-table-person">
                      <div className="hp-avatar hp-avatar-small">
                        {(client.name || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong>{client.name}</strong>
                        <span>{client.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{client.clientDay ?? "—"}</strong>
                  </td>
                  <td>
                    <span className={statusClass(client.membershipStatus)}>
                      {client.membershipStatus || "Pending"}
                    </span>
                  </td>
                  <td>{money(client.wallet?.balance)}</td>
                  <td>{date(client.createdAt)}</td>
                  <td>
                    <span className={statusClass(client.status)}>
                      {client.status || "ACTIVE"}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/manager/clients/${client.id}`}
                      className="hp-icon-link"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredClients.length === 0 && (
            <div className="hp-empty hp-empty-small">
              <h3>No clients found</h3>
              <p>Try another search term.</p>
            </div>
          )}
        </div>
      </section>

      <section className="hp-panel">
        <div className="hp-panel-head">
          <div>
            <div className="hp-section-kicker">ORDER OPERATIONS</div>
            <h2>Client Orders</h2>
            <p>Review payment submissions and manage re-rent workflow.</p>
          </div>

          <div className="hp-toolbar">
            <input
              className="hp-search"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Search orders..."
            />
            <Link href="/manager/orders" className="hp-btn hp-btn-secondary">
              Full Order Center
            </Link>
          </div>
        </div>

        <div className="hp-table-wrap">
          <table className="hp-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Client</th>
                <th>Property</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.slice(0, 12).map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderCode}</strong>
                  </td>
                  <td>
                    <div>
                      <strong>{order.user?.name || "—"}</strong>
                      <span className="hp-table-sub">
                        {order.user?.email || ""}
                      </span>
                    </div>
                  </td>
                  <td>{order.property?.title || "—"}</td>
                  <td>{money(order.amount)}</td>
                  <td>
                    <span className={statusClass(order.status)}>
                      {order.status}
                    </span>
                  </td>
                  <td>{date(order.createdAt)}</td>
                  <td>
                    <div className="hp-row-actions hp-row-actions-tight">
                      {order.status === "PAYMENT_SUBMITTED" && (
                        <button
                          className="hp-btn hp-btn-success"
                          disabled={busy === `order-${order.id}`}
                          onClick={() => orderAction(order.id, "VERIFY_PAYMENT")}
                        >
                          Verify
                        </button>
                      )}

                      {order.status === "ACTIVE" && (
                        <button
                          className="hp-btn hp-btn-primary"
                          disabled={busy === `rerent-${order.id}`}
                          onClick={() => rerent(order.id)}
                        >
                          Re-Rent
                        </button>
                      )}

                      {!["COMPLETED", "CANCELLED", "RE_RENTED"].includes(order.status) && (
                        <button
                          className="hp-btn hp-btn-danger-soft"
                          disabled={busy === `order-${order.id}`}
                          onClick={() => orderAction(order.id, "CANCEL")}
                        >
                          Cancel
                        </button>
                      )}

                      <Link
                        href={`/manager/orders/${order.id}`}
                        className="hp-icon-link"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredOrders.length === 0 && (
            <div className="hp-empty hp-empty-small">
              <h3>No orders found</h3>
              <p>Orders created by your assigned clients will appear here.</p>
            </div>
          )}
        </div>
      </section>

      <style jsx global>{`
        .hp-page-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 24px;
        }

        .hp-page-head h1 {
          margin: 4px 0 8px;
          font-size: 30px;
          letter-spacing: -0.03em;
        }

        .hp-page-head p {
          margin: 0;
          color: #64748b;
          max-width: 700px;
          line-height: 1.6;
        }

        .hp-eyebrow,
        .hp-section-kicker {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .12em;
          color: #64748b;
        }

        .hp-head-actions,
        .hp-toolbar,
        .hp-row-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .hp-kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .hp-kpi-card,
        .hp-panel {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 5px 20px rgba(15, 23, 42, .045);
        }

        .hp-kpi-card {
          padding: 18px;
        }

        .hp-kpi-label {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
        }

        .hp-kpi-value {
          margin-top: 8px;
          font-size: 25px;
          font-weight: 850;
          color: #0f172a;
        }

        .hp-kpi-note {
          margin-top: 6px;
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.4;
        }

        .hp-section-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(320px, .8fr);
          gap: 18px;
          margin-bottom: 18px;
        }

        .hp-panel {
          padding: 20px;
          margin-bottom: 18px;
          overflow: hidden;
        }

        .hp-section-grid .hp-panel {
          margin-bottom: 0;
        }

        .hp-panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .hp-panel-head h2 {
          margin: 4px 0 5px;
          font-size: 19px;
        }

        .hp-panel-head p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }

        .hp-text-link,
        .hp-icon-link {
          color: #2563eb;
          text-decoration: none;
          font-weight: 750;
          font-size: 13px;
        }

        .hp-btn {
          border: 0;
          border-radius: 9px;
          padding: 9px 13px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          transition: .15s ease;
        }

        .hp-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .hp-btn-primary {
          background: #0f172a;
          color: white;
        }

        .hp-btn-secondary {
          background: #f1f5f9;
          color: #334155;
        }

        .hp-btn-success {
          background: #dcfce7;
          color: #166534;
        }

        .hp-btn-danger-soft {
          background: #fee2e2;
          color: #b91c1c;
        }

        .hp-alert {
          padding: 13px 15px;
          border-radius: 12px;
          margin-bottom: 18px;
          font-size: 13px;
        }

        .hp-alert-danger {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .hp-list {
          display: flex;
          flex-direction: column;
        }

        .hp-list-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 0;
          border-top: 1px solid #f1f5f9;
        }

        .hp-list-row:first-child {
          border-top: 0;
        }

        .hp-avatar {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          background: #e2e8f0;
          color: #0f172a;
          font-weight: 850;
        }

        .hp-avatar-small {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          font-size: 12px;
        }

        .hp-list-main,
        .hp-table-person {
          min-width: 0;
          flex: 1;
        }

        .hp-list-main strong,
        .hp-list-main span,
        .hp-list-main small {
          display: block;
        }

        .hp-list-main strong {
          font-size: 13px;
        }

        .hp-list-main span {
          font-size: 12px;
          color: #64748b;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hp-list-main small {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 11px;
        }

        .hp-referral-box {
          padding: 18px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .hp-referral-box span {
          display: block;
          font-size: 11px;
          color: #64748b;
          font-weight: 700;
        }

        .hp-referral-box strong {
          display: block;
          margin-top: 6px;
          font-size: 24px;
          letter-spacing: .04em;
        }

        .hp-mini-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          margin-top: 18px;
          overflow: hidden;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #e2e8f0;
        }

        .hp-mini-grid > div {
          background: white;
          padding: 13px;
        }

        .hp-mini-grid span,
        .hp-mini-grid strong {
          display: block;
        }

        .hp-mini-grid span {
          font-size: 11px;
          color: #64748b;
        }

        .hp-mini-grid strong {
          margin-top: 4px;
          font-size: 15px;
        }

        .hp-search {
          height: 36px;
          width: 210px;
          border: 1px solid #dbe1ea;
          border-radius: 9px;
          padding: 0 11px;
          outline: none;
          font-size: 12px;
        }

        .hp-search:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, .12);
        }

        .hp-table-wrap {
          overflow-x: auto;
          border: 1px solid #eef2f7;
          border-radius: 12px;
        }

        .hp-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }

        .hp-table th {
          background: #f8fafc;
          text-align: left;
          padding: 11px 13px;
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .07em;
          white-space: nowrap;
        }

        .hp-table td {
          padding: 13px;
          border-top: 1px solid #eef2f7;
          font-size: 12px;
          color: #334155;
          vertical-align: middle;
        }

        .hp-table td strong {
          color: #0f172a;
        }

        .hp-table-sub,
        .hp-table-person span {
          display: block;
          color: #64748b;
          font-size: 11px;
          margin-top: 2px;
        }

        .hp-table-person {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .hp-status {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 8px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .hp-status-success {
          background: #dcfce7;
          color: #166534;
        }

        .hp-status-warning {
          background: #fef3c7;
          color: #92400e;
        }

        .hp-status-danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .hp-status-neutral {
          background: #f1f5f9;
          color: #475569;
        }

        .hp-empty {
          padding: 35px 20px;
          text-align: center;
          color: #64748b;
        }

        .hp-empty-small {
          padding: 30px 15px;
        }

        .hp-empty-icon {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: #dcfce7;
          color: #166534;
          display: grid;
          place-items: center;
          margin: 0 auto 10px;
          font-weight: 900;
        }

        .hp-empty h3 {
          margin: 0 0 5px;
          color: #334155;
          font-size: 14px;
        }

        .hp-empty p {
          margin: 0;
          font-size: 12px;
        }

        .hp-row-actions-tight {
          flex-wrap: nowrap;
        }

        @media (max-width: 1250px) {
          .hp-kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .hp-page-head,
          .hp-panel-head {
            flex-direction: column;
          }

          .hp-section-grid {
            grid-template-columns: 1fr;
          }

          .hp-toolbar {
            width: 100%;
          }

          .hp-search {
            width: 100%;
            flex: 1;
          }
        }

        @media (max-width: 620px) {
          .hp-kpi-grid {
            grid-template-columns: 1fr 1fr;
          }

          .hp-kpi-card {
            padding: 14px;
          }

          .hp-kpi-value {
            font-size: 21px;
          }

          .hp-list-row {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .hp-row-actions {
            width: 100%;
          }

          .hp-head-actions,
          .hp-head-actions .hp-btn {
            width: 100%;
          }
        }
      `}</style>
    </ManagerShell>
  );
}

