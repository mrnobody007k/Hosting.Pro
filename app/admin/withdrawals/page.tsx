"use client";

import { useEffect, useMemo, useState } from "react";
import { Decimal } from "decimal.js";
import AdminShell from "../AdminShell";

type Withdrawal = {
  id: string;
  userId: string;
  managerId: string;
  amount: number | string;
  method: string | null;
  accountDetails: string | null;
  reference: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  note: string | null;
  createdAt: string;
  processedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    managerId: string;
    status: string;
    signupStatus: string;
    membershipStatus: string;
    createdAt: string;
    wallet: {
      balance: number | string;
      reservedBalance: number | string;
    } | null;
  };
  manager: {
    id: string;
    name: string;
    email: string;
    referralCode: string;
    status: string;
  };
};

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};

function money(value: number | string | Decimal) {
  let amount: Decimal;
  try { amount = new Decimal(String(value)); } catch { amount = new Decimal(0); }
  if (!amount.isFinite()) amount = new Decimal(0);
  const [integer, fraction] = amount.abs().toFixed(2).split(".");
  const grouped = integer.length <= 3 ? integer : `${integer.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${integer.slice(-3)}`;
  return `${amount.isNegative() ? "-" : ""}₹${grouped}.${fraction}`;
}

function dateTime(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClass(status: string) {
  if (status === "APPROVED" || status === "PAID") {
    return "withdrawal-status withdrawal-status-success";
  }

  if (status === "REJECTED") {
    return "withdrawal-status withdrawal-status-danger";
  }

  return "withdrawal-status withdrawal-status-warning";
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [manager, setManager] = useState("ALL");
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadWithdrawals(cursor?: string, append = false) {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      setError("");

      const params = new URLSearchParams({ limit: "100", search: search.trim(), status, managerId: manager });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/admin/withdrawals?${params}`, { cache: "no-store" });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load withdrawals."
        );
      }

      setWithdrawals((current) => append ? [...current, ...(data.withdrawals || [])] : (data.withdrawals || []));
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load withdrawals."
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWithdrawals(); }, search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [search, status, manager]);

  const managers = useMemo(() => {
    const map = new Map<string, string>();

    for (const withdrawal of withdrawals) {
      map.set(withdrawal.manager.id, withdrawal.manager.name);
    }

    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [withdrawals]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return withdrawals.filter((withdrawal) => {
      const matchesSearch =
        !query ||
        withdrawal.id.toLowerCase().includes(query) ||
        withdrawal.user.name.toLowerCase().includes(query) ||
        withdrawal.user.email.toLowerCase().includes(query) ||
        (withdrawal.user.phone || "").toLowerCase().includes(query) ||
        withdrawal.manager.name.toLowerCase().includes(query) ||
        withdrawal.manager.referralCode.toLowerCase().includes(query) ||
        (withdrawal.method || "").toLowerCase().includes(query) ||
        (withdrawal.accountDetails || "")
          .toLowerCase()
          .includes(query) ||
        (withdrawal.reference || "").toLowerCase().includes(query);

      const matchesStatus =
        status === "ALL" || withdrawal.status === status;

      const matchesManager =
        manager === "ALL" ||
        withdrawal.managerId === manager;

      return matchesSearch && matchesStatus && matchesManager;
    });
  }, [withdrawals, search, status, manager]);

  const stats = useMemo(() => {
    const totalAmount = withdrawals.reduce((sum, item) => sum.plus(String(item.amount)), new Decimal(0));

    const pendingAmount = withdrawals
      .filter((item) => item.status === "PENDING")
      .reduce((sum, item) => sum.plus(String(item.amount)), new Decimal(0));

    const approvedAmount = withdrawals
      .filter(
        (item) =>
          item.status === "APPROVED" ||
          item.status === "PAID"
      )
      .reduce((sum, item) => sum.plus(String(item.amount)), new Decimal(0));

    const rejectedAmount = withdrawals
      .filter((item) => item.status === "REJECTED")
      .reduce((sum, item) => sum.plus(String(item.amount)), new Decimal(0));

    const paidAmount = withdrawals
      .filter((item) => item.status === "PAID")
      .reduce((sum, item) => sum.plus(String(item.amount)), new Decimal(0));

    return {
      total: withdrawals.length,
      totalAmount,
      pending: withdrawals.filter(
        (item) => item.status === "PENDING"
      ).length,
      pendingAmount,
      approved: withdrawals.filter(
        (item) => item.status === "APPROVED"
      ).length,
      approvedAmount,
      rejected: withdrawals.filter(
        (item) => item.status === "REJECTED"
      ).length,
      rejectedAmount,
      paid: withdrawals.filter(
        (item) => item.status === "PAID"
      ).length,
      paidAmount,
    };
  }, [withdrawals]);

  return (
    <AdminShell>
      <div className="admin-page">
        <div className="admin-page-head">
          <div>
            <h1>Withdrawals & Payouts</h1>
            <p>
              Monitor client withdrawal requests, payout status and
              manager ownership.
            </p>
          </div>

          <button
            type="button"
            className="admin-button"
            onClick={() => loadWithdrawals()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="withdrawal-stat-grid">
          <div className="admin-card withdrawal-stat-card">
            <span>Total Requests</span>
            <strong>{stats.total}</strong>
            <small>{money(stats.totalAmount)} total requested</small>
          </div>

          <div className="admin-card withdrawal-stat-card">
            <span>Pending</span>
            <strong>{stats.pending}</strong>
            <small>
              {money(stats.pendingAmount)} awaiting action
            </small>
          </div>

          <div className="admin-card withdrawal-stat-card">
            <span>Approved</span>
            <strong>{stats.approved}</strong>
            <small>{money(stats.approvedAmount)} approved value</small>
          </div>

          <div className="admin-card withdrawal-stat-card">
            <span>Paid</span>
            <strong>{stats.paid}</strong>
            <small>{money(stats.paidAmount)} paid out</small>
          </div>

          <div className="admin-card withdrawal-stat-card">
            <span>Rejected</span>
            <strong>{stats.rejected}</strong>
            <small>{money(stats.rejectedAmount)} rejected value</small>
          </div>
        </div>

        <div className="admin-card withdrawal-filter-card">
          <div className="withdrawal-filter-row">
            <input
              className="admin-input"
              placeholder="Search client, email, phone, manager, method, reference..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className="admin-input"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              className="admin-input"
              value={manager}
              onChange={(event) => setManager(event.target.value)}
            >
              <option value="ALL">All managers</option>
              {managers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="withdrawal-filter-summary">
            Showing <strong>{filtered.length}</strong> of{" "}
            <strong>{withdrawals.length}</strong> withdrawal requests
          </div>
        </div>

        {loading ? (
          <div className="admin-card withdrawal-state">
            <div className="withdrawal-spinner" />
            <h3>Loading withdrawals</h3>
            <p>Fetching the latest payout records...</p>
          </div>
        ) : error ? (
          <div className="admin-card withdrawal-state withdrawal-error">
            <h3>Unable to load withdrawals</h3>
            <p>{error}</p>

            <button
              type="button"
              className="admin-button"
              onClick={() => loadWithdrawals()}
            >
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-card withdrawal-state">
            <h3>No withdrawals found</h3>
            <p>
              No withdrawal records match the current search and
              filters.
            </p>
          </div>
        ) : (
          <div className="admin-card withdrawal-table-card">
            <div className="withdrawal-table-wrap">
              <table className="withdrawal-table">
                <thead>
                  <tr>
                    <th>Withdrawal</th>
                    <th>Client</th>
                    <th>Manager</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((withdrawal) => (
                    <tr key={withdrawal.id}>
                      <td>
                        <div className="withdrawal-primary">
                          #
                          {withdrawal.id
                            .slice(-8)
                            .toUpperCase()}
                        </div>

                        <div className="withdrawal-secondary">
                          {withdrawal.id}
                        </div>
                      </td>

                      <td>
                        <div className="withdrawal-primary">
                          {withdrawal.user.name}
                        </div>

                        <div className="withdrawal-secondary">
                          {withdrawal.user.email}
                        </div>
                      </td>

                      <td>
                        <div className="withdrawal-primary">
                          {withdrawal.manager.name}
                        </div>

                        <div className="withdrawal-secondary">
                          {withdrawal.manager.referralCode}
                        </div>
                      </td>

                      <td>
                        <strong>
                          {money(withdrawal.amount)}
                        </strong>
                      </td>

                      <td>
                        <span className="withdrawal-method">
                          {withdrawal.method || "Manual"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={statusClass(
                            withdrawal.status
                          )}
                        >
                          {statusLabels[withdrawal.status] ||
                            withdrawal.status}
                        </span>
                      </td>

                      <td>
                        <span className="withdrawal-secondary">
                          {dateTime(withdrawal.createdAt)}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="withdrawal-view-button"
                          onClick={() =>
                            setSelected(withdrawal)
                          }
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {nextCursor && <div style={{ padding: 16, textAlign: "center" }}><button onClick={() => loadWithdrawals(nextCursor, true)} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more withdrawals"}</button></div>}
            </div>
          </div>
        )}

        {selected && (
          <div
            className="withdrawal-overlay"
            onClick={() => setSelected(null)}
          >
            <aside
              className="withdrawal-drawer"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="withdrawal-drawer-head">
                <div>
                  <span className="withdrawal-eyebrow">
                    Withdrawal Details
                  </span>

                  <h2>
                    #{selected.id.slice(-8).toUpperCase()}
                  </h2>
                </div>

                <button
                  type="button"
                  className="withdrawal-close"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="withdrawal-drawer-body">
                <div className="withdrawal-detail-status">
                  <span
                    className={statusClass(selected.status)}
                  >
                    {statusLabels[selected.status]}
                  </span>

                  <strong>{money(selected.amount)}</strong>
                </div>

                <section className="withdrawal-detail-section">
                  <h3>Client</h3>

                  <div className="withdrawal-detail-grid">
                    <div>
                      <span>Name</span>
                      <strong>{selected.user.name}</strong>
                    </div>

                    <div>
                      <span>Email</span>
                      <strong>{selected.user.email}</strong>
                    </div>

                    <div>
                      <span>Phone</span>
                      <strong>
                        {selected.user.phone || "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Membership</span>
                      <strong>
                        {selected.user.membershipStatus}
                      </strong>
                    </div>

                    <div>
                      <span>Available Wallet</span>
                      <strong>
                        {money(
                          selected.user.wallet?.balance || 0
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Reserved Balance</span>
                      <strong>
                        {money(
                          selected.user.wallet
                            ?.reservedBalance || 0
                        )}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="withdrawal-detail-section">
                  <h3>Manager Ownership</h3>

                  <div className="withdrawal-manager-box">
                    <strong>{selected.manager.name}</strong>
                    <span>{selected.manager.email}</span>
                    <span>
                      Referral: {selected.manager.referralCode}
                    </span>
                  </div>
                </section>

                <section className="withdrawal-detail-section">
                  <h3>Payout Information</h3>

                  <div className="withdrawal-detail-grid">
                    <div>
                      <span>Method</span>
                      <strong>
                        {selected.method || "Manual"}
                      </strong>
                    </div>

                    <div>
                      <span>Reference</span>
                      <strong>
                        {selected.reference || "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Account Details</span>
                      <strong>
                        {selected.accountDetails || "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Created</span>
                      <strong>
                        {dateTime(selected.createdAt)}
                      </strong>
                    </div>

                    <div>
                      <span>Processed</span>
                      <strong>
                        {dateTime(selected.processedAt)}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="withdrawal-detail-section">
                  <h3>Admin Notes</h3>

                  <div className="withdrawal-note-box">
                    {selected.note || "No note recorded."}
                  </div>
                </section>

                <section className="withdrawal-detail-section">
                  <h3>Security & Ownership</h3>

                  <div className="withdrawal-security-note">
                    <strong>
                      Manager isolation enforced
                    </strong>

                    <span>
                      This withdrawal belongs to the manager
                      associated with the client referral chain.
                      Administrative access is global, while
                      manager access remains ownership-scoped.
                    </span>
                  </div>
                </section>
              </div>
            </aside>
          </div>
        )}
      </div>

      <style jsx global>{`
        .admin-page {
          width: 100%;
        }

        .admin-page-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .admin-page-head h1 {
          margin: 0;
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .admin-page-head p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .admin-button {
          border: 0;
          border-radius: 10px;
          background: #111827;
          color: white;
          padding: 11px 17px;
          font-weight: 700;
          cursor: pointer;
        }

        .admin-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .withdrawal-stat-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .withdrawal-stat-card {
          padding: 20px;
        }

        .withdrawal-stat-card span,
        .withdrawal-stat-card small {
          display: block;
          color: #64748b;
        }

        .withdrawal-stat-card span {
          font-size: 13px;
          font-weight: 700;
        }

        .withdrawal-stat-card strong {
          display: block;
          margin: 9px 0 4px;
          font-size: 27px;
          letter-spacing: -0.6px;
        }

        .withdrawal-stat-card small {
          font-size: 12px;
        }

        .withdrawal-filter-card {
          padding: 16px;
          margin-bottom: 18px;
        }

        .withdrawal-filter-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 12px;
        }

        .admin-input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: white;
          padding: 11px 13px;
          outline: none;
          color: #0f172a;
          font: inherit;
        }

        .admin-input:focus {
          border-color: #94a3b8;
          box-shadow:
            0 0 0 3px rgba(148, 163, 184, 0.16);
        }

        .withdrawal-filter-summary {
          margin-top: 12px;
          color: #64748b;
          font-size: 12px;
        }

        .withdrawal-table-card {
          overflow: hidden;
        }

        .withdrawal-table-wrap {
          overflow-x: auto;
        }

        .withdrawal-table {
          width: 100%;
          min-width: 1100px;
          border-collapse: collapse;
        }

        .withdrawal-table th {
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          text-align: left;
          padding: 14px 16px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .withdrawal-table td {
          padding: 15px 16px;
          border-bottom: 1px solid #eef2f7;
          vertical-align: middle;
          font-size: 13px;
        }

        .withdrawal-table tbody tr:hover {
          background: #fafafa;
        }

        .withdrawal-primary {
          font-weight: 700;
          color: #0f172a;
        }

        .withdrawal-secondary {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 11px;
        }

        .withdrawal-method {
          color: #475569;
          font-size: 12px;
        }

        .withdrawal-status {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .withdrawal-status-success {
          background: #dcfce7;
          color: #166534;
        }

        .withdrawal-status-danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .withdrawal-status-warning {
          background: #fef3c7;
          color: #92400e;
        }

        .withdrawal-view-button {
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          padding: 7px 11px;
          cursor: pointer;
          font-weight: 700;
          font-size: 12px;
        }

        .withdrawal-view-button:hover {
          background: #f8fafc;
        }

        .withdrawal-state {
          padding: 55px 20px;
          text-align: center;
        }

        .withdrawal-state h3 {
          margin: 12px 0 6px;
        }

        .withdrawal-state p {
          margin: 0 0 16px;
          color: #64748b;
        }

        .withdrawal-error {
          border-color: #fecaca;
        }

        .withdrawal-spinner {
          width: 28px;
          height: 28px;
          margin: 0 auto;
          border: 3px solid #e2e8f0;
          border-top-color: #111827;
          border-radius: 50%;
          animation: withdrawal-spin 0.8s linear infinite;
        }

        @keyframes withdrawal-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .withdrawal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(15, 23, 42, 0.42);
          display: flex;
          justify-content: flex-end;
        }

        .withdrawal-drawer {
          width: min(640px, 100%);
          height: 100%;
          background: white;
          box-shadow:
            -18px 0 45px rgba(15, 23, 42, 0.16);
          display: flex;
          flex-direction: column;
        }

        .withdrawal-drawer-head {
          padding: 22px 24px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .withdrawal-drawer-head h2 {
          margin: 5px 0 0;
          font-size: 24px;
        }

        .withdrawal-eyebrow {
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-size: 10px;
          font-weight: 800;
        }

        .withdrawal-close {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 9px;
          background: #f1f5f9;
          font-size: 25px;
          cursor: pointer;
          color: #334155;
        }

        .withdrawal-drawer-body {
          overflow-y: auto;
          padding: 22px 24px 35px;
        }

        .withdrawal-detail-status {
          padding: 18px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 22px;
        }

        .withdrawal-detail-status strong {
          font-size: 24px;
        }

        .withdrawal-detail-section {
          padding: 18px 0;
          border-bottom: 1px solid #eef2f7;
        }

        .withdrawal-detail-section:last-child {
          border-bottom: 0;
        }

        .withdrawal-detail-section h3 {
          margin: 0 0 14px;
          font-size: 14px;
        }

        .withdrawal-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .withdrawal-detail-grid div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .withdrawal-detail-grid span {
          color: #64748b;
          font-size: 11px;
        }

        .withdrawal-detail-grid strong {
          color: #0f172a;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .withdrawal-manager-box,
        .withdrawal-note-box,
        .withdrawal-security-note {
          border-radius: 12px;
          padding: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .withdrawal-manager-box {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .withdrawal-manager-box strong {
          font-size: 14px;
        }

        .withdrawal-manager-box span {
          color: #64748b;
          font-size: 12px;
        }

        .withdrawal-note-box {
          color: #475569;
          font-size: 13px;
          line-height: 1.6;
        }

        .withdrawal-security-note {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .withdrawal-security-note strong {
          font-size: 13px;
        }

        .withdrawal-security-note span {
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        @media (max-width: 1200px) {
          .withdrawal-stat-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .withdrawal-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .withdrawal-filter-row {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .admin-page-head {
            flex-direction: column;
          }

          .withdrawal-stat-grid {
            grid-template-columns: 1fr;
          }

          .withdrawal-drawer-head,
          .withdrawal-drawer-body {
            padding-left: 16px;
            padding-right: 16px;
          }

          .withdrawal-detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AdminShell>
  );
}
