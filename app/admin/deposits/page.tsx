"use client";

import { useEffect, useMemo, useState } from "react";
import { Decimal } from "decimal.js";
import AdminShell from "../AdminShell";

type Deposit = {
  id: string;
  userId: string;
  managerId: string;
  amount: number | string;
  reference: string | null;
  proofUrl: string | null;
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
    return "deposit-status deposit-status-success";
  }

  if (status === "REJECTED") {
    return "deposit-status deposit-status-danger";
  }

  return "deposit-status deposit-status-warning";
}

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [manager, setManager] = useState("ALL");
  const [selected, setSelected] = useState<Deposit | null>(null);

  async function loadDeposits() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/deposits", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load deposits.");
      }

      setDeposits(data.deposits || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load deposits."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeposits();
  }, []);

  const managers = useMemo(() => {
    const map = new Map<string, string>();

    for (const deposit of deposits) {
      map.set(deposit.manager.id, deposit.manager.name);
    }

    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [deposits]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return deposits.filter((deposit) => {
      const matchesSearch =
        !query ||
        deposit.id.toLowerCase().includes(query) ||
        deposit.user.name.toLowerCase().includes(query) ||
        deposit.user.email.toLowerCase().includes(query) ||
        (deposit.user.phone || "").toLowerCase().includes(query) ||
        deposit.manager.name.toLowerCase().includes(query) ||
        deposit.manager.referralCode.toLowerCase().includes(query) ||
        (deposit.reference || "").toLowerCase().includes(query);

      const matchesStatus =
        status === "ALL" || deposit.status === status;

      const matchesManager =
        manager === "ALL" || deposit.managerId === manager;

      return matchesSearch && matchesStatus && matchesManager;
    });
  }, [deposits, search, status, manager]);

  const stats = useMemo(() => {
    const totalAmount = deposits.reduce((sum, item) => sum.plus(String(item.amount)), new Decimal(0));

    const pendingAmount = deposits
      .filter((item) => item.status === "PENDING")
      .reduce((sum, item) => sum.plus(String(item.amount)), new Decimal(0));

    const approvedAmount = deposits
      .filter(
        (item) =>
          item.status === "APPROVED" ||
          item.status === "PAID"
      )
      .reduce((sum, item) => sum.plus(String(item.amount)), new Decimal(0));

    const rejectedAmount = deposits
      .filter((item) => item.status === "REJECTED")
      .reduce((sum, item) => sum.plus(String(item.amount)), new Decimal(0));

    return {
      total: deposits.length,
      totalAmount,
      pending: deposits.filter(
        (item) => item.status === "PENDING"
      ).length,
      pendingAmount,
      approved: deposits.filter(
        (item) =>
          item.status === "APPROVED" ||
          item.status === "PAID"
      ).length,
      approvedAmount,
      rejected: deposits.filter(
        (item) => item.status === "REJECTED"
      ).length,
      rejectedAmount,
    };
  }, [deposits]);

  return (
    <AdminShell>
      <div className="admin-page">
        <div className="admin-page-head">
          <div>
            <h1>Deposits & Payments</h1>
            <p>
              Complete administrative visibility of manually handled
              deposits.
            </p>
          </div>

          <button
            type="button"
            className="admin-button"
            onClick={loadDeposits}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="deposit-stat-grid">
          <div className="admin-card deposit-stat-card">
            <span>Total Deposits</span>
            <strong>{stats.total}</strong>
            <small>{money(stats.totalAmount)} total value</small>
          </div>

          <div className="admin-card deposit-stat-card">
            <span>Pending</span>
            <strong>{stats.pending}</strong>
            <small>{money(stats.pendingAmount)} awaiting review</small>
          </div>

          <div className="admin-card deposit-stat-card">
            <span>Approved / Paid</span>
            <strong>{stats.approved}</strong>
            <small>{money(stats.approvedAmount)} processed value</small>
          </div>

          <div className="admin-card deposit-stat-card">
            <span>Rejected</span>
            <strong>{stats.rejected}</strong>
            <small>{money(stats.rejectedAmount)} rejected value</small>
          </div>
        </div>

        <div className="admin-card deposit-filter-card">
          <div className="deposit-filter-row">
            <input
              className="admin-input"
              placeholder="Search client, email, phone, manager, reference..."
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

          <div className="deposit-filter-summary">
            Showing <strong>{filtered.length}</strong> of{" "}
            <strong>{deposits.length}</strong> deposits
          </div>
        </div>

        {loading ? (
          <div className="admin-card deposit-state">
            <div className="deposit-spinner" />
            <h3>Loading deposits</h3>
            <p>Fetching the latest payment records...</p>
          </div>
        ) : error ? (
          <div className="admin-card deposit-state deposit-error">
            <h3>Unable to load deposits</h3>
            <p>{error}</p>
            <button
              type="button"
              className="admin-button"
              onClick={loadDeposits}
            >
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-card deposit-state">
            <h3>No deposits found</h3>
            <p>
              No deposit records match the current search and filters.
            </p>
          </div>
        ) : (
          <div className="admin-card deposit-table-card">
            <div className="deposit-table-wrap">
              <table className="deposit-table">
                <thead>
                  <tr>
                    <th>Deposit</th>
                    <th>Client</th>
                    <th>Manager</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((deposit) => (
                    <tr key={deposit.id}>
                      <td>
                        <div className="deposit-primary">
                          #{deposit.id.slice(-8).toUpperCase()}
                        </div>
                        <div className="deposit-secondary">
                          {deposit.id}
                        </div>
                      </td>

                      <td>
                        <div className="deposit-primary">
                          {deposit.user.name}
                        </div>
                        <div className="deposit-secondary">
                          {deposit.user.email}
                        </div>
                      </td>

                      <td>
                        <div className="deposit-primary">
                          {deposit.manager.name}
                        </div>
                        <div className="deposit-secondary">
                          {deposit.manager.referralCode}
                        </div>
                      </td>

                      <td>
                        <strong>{money(deposit.amount)}</strong>
                      </td>

                      <td>
                        <span className="deposit-reference">
                          {deposit.reference || "—"}
                        </span>
                      </td>

                      <td>
                        <span className={statusClass(deposit.status)}>
                          {statusLabels[deposit.status] ||
                            deposit.status}
                        </span>
                      </td>

                      <td>
                        <span className="deposit-secondary">
                          {dateTime(deposit.createdAt)}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="deposit-view-button"
                          onClick={() => setSelected(deposit)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selected && (
          <div
            className="deposit-overlay"
            onClick={() => setSelected(null)}
          >
            <aside
              className="deposit-drawer"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="deposit-drawer-head">
                <div>
                  <span className="deposit-eyebrow">
                    Deposit Details
                  </span>
                  <h2>
                    #{selected.id.slice(-8).toUpperCase()}
                  </h2>
                </div>

                <button
                  type="button"
                  className="deposit-close"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="deposit-drawer-body">
                <div className="deposit-detail-status">
                  <span className={statusClass(selected.status)}>
                    {statusLabels[selected.status]}
                  </span>
                  <strong>{money(selected.amount)}</strong>
                </div>

                <section className="deposit-detail-section">
                  <h3>Client</h3>

                  <div className="deposit-detail-grid">
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
                      <strong>{selected.user.phone || "—"}</strong>
                    </div>

                    <div>
                      <span>Membership</span>
                      <strong>
                        {selected.user.membershipStatus}
                      </strong>
                    </div>

                    <div>
                      <span>Wallet Balance</span>
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
                          selected.user.wallet?.reservedBalance || 0
                        )}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="deposit-detail-section">
                  <h3>Manager Ownership</h3>

                  <div className="deposit-manager-box">
                    <strong>{selected.manager.name}</strong>
                    <span>{selected.manager.email}</span>
                    <span>
                      Referral: {selected.manager.referralCode}
                    </span>
                  </div>
                </section>

                <section className="deposit-detail-section">
                  <h3>Payment Information</h3>

                  <div className="deposit-detail-grid">
                    <div>
                      <span>Reference</span>
                      <strong>
                        {selected.reference || "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Proof</span>
                      {selected.proofUrl ? (
                        <a
                          href={selected.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="deposit-proof-link"
                        >
                          Open Proof
                        </a>
                      ) : (
                        <strong>Not provided</strong>
                      )}
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

                <section className="deposit-detail-section">
                  <h3>Admin Notes</h3>

                  <div className="deposit-note-box">
                    {selected.note || "No note recorded."}
                  </div>
                </section>

                <section className="deposit-detail-section">
                  <h3>Security</h3>

                  <div className="deposit-security-note">
                    <strong>Manager isolation enforced</strong>
                    <span>
                      This record is permanently associated with{" "}
                      {selected.manager.name} through the client
                      referral ownership chain.
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

        .deposit-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .deposit-stat-card {
          padding: 20px;
        }

        .deposit-stat-card span,
        .deposit-stat-card small {
          display: block;
          color: #64748b;
        }

        .deposit-stat-card span {
          font-size: 13px;
          font-weight: 700;
        }

        .deposit-stat-card strong {
          display: block;
          margin: 9px 0 4px;
          font-size: 27px;
          letter-spacing: -0.6px;
        }

        .deposit-stat-card small {
          font-size: 12px;
        }

        .deposit-filter-card {
          padding: 16px;
          margin-bottom: 18px;
        }

        .deposit-filter-row {
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
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.16);
        }

        .deposit-filter-summary {
          margin-top: 12px;
          color: #64748b;
          font-size: 12px;
        }

        .deposit-table-card {
          overflow: hidden;
        }

        .deposit-table-wrap {
          overflow-x: auto;
        }

        .deposit-table {
          width: 100%;
          min-width: 1050px;
          border-collapse: collapse;
        }

        .deposit-table th {
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

        .deposit-table td {
          padding: 15px 16px;
          border-bottom: 1px solid #eef2f7;
          vertical-align: middle;
          font-size: 13px;
        }

        .deposit-table tbody tr:hover {
          background: #fafafa;
        }

        .deposit-primary {
          font-weight: 700;
          color: #0f172a;
        }

        .deposit-secondary {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 11px;
        }

        .deposit-reference {
          color: #475569;
          font-size: 12px;
        }

        .deposit-status {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .deposit-status-success {
          background: #dcfce7;
          color: #166534;
        }

        .deposit-status-danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .deposit-status-warning {
          background: #fef3c7;
          color: #92400e;
        }

        .deposit-view-button {
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          padding: 7px 11px;
          cursor: pointer;
          font-weight: 700;
          font-size: 12px;
        }

        .deposit-view-button:hover {
          background: #f8fafc;
        }

        .deposit-state {
          padding: 55px 20px;
          text-align: center;
        }

        .deposit-state h3 {
          margin: 12px 0 6px;
        }

        .deposit-state p {
          margin: 0 0 16px;
          color: #64748b;
        }

        .deposit-error {
          border-color: #fecaca;
        }

        .deposit-spinner {
          width: 28px;
          height: 28px;
          margin: 0 auto;
          border: 3px solid #e2e8f0;
          border-top-color: #111827;
          border-radius: 50%;
          animation: deposit-spin 0.8s linear infinite;
        }

        @keyframes deposit-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .deposit-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(15, 23, 42, 0.42);
          display: flex;
          justify-content: flex-end;
        }

        .deposit-drawer {
          width: min(620px, 100%);
          height: 100%;
          background: white;
          box-shadow: -18px 0 45px rgba(15, 23, 42, 0.16);
          display: flex;
          flex-direction: column;
        }

        .deposit-drawer-head {
          padding: 22px 24px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .deposit-drawer-head h2 {
          margin: 5px 0 0;
          font-size: 24px;
        }

        .deposit-eyebrow {
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-size: 10px;
          font-weight: 800;
        }

        .deposit-close {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 9px;
          background: #f1f5f9;
          font-size: 25px;
          cursor: pointer;
          color: #334155;
        }

        .deposit-drawer-body {
          overflow-y: auto;
          padding: 22px 24px 35px;
        }

        .deposit-detail-status {
          padding: 18px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 22px;
        }

        .deposit-detail-status strong {
          font-size: 24px;
        }

        .deposit-detail-section {
          padding: 18px 0;
          border-bottom: 1px solid #eef2f7;
        }

        .deposit-detail-section:last-child {
          border-bottom: 0;
        }

        .deposit-detail-section h3 {
          margin: 0 0 14px;
          font-size: 14px;
        }

        .deposit-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .deposit-detail-grid div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .deposit-detail-grid span {
          color: #64748b;
          font-size: 11px;
        }

        .deposit-detail-grid strong {
          color: #0f172a;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .deposit-manager-box,
        .deposit-note-box,
        .deposit-security-note {
          border-radius: 12px;
          padding: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .deposit-manager-box {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .deposit-manager-box strong {
          font-size: 14px;
        }

        .deposit-manager-box span {
          color: #64748b;
          font-size: 12px;
        }

        .deposit-note-box {
          color: #475569;
          font-size: 13px;
          line-height: 1.6;
        }

        .deposit-security-note {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .deposit-security-note strong {
          font-size: 13px;
        }

        .deposit-security-note span {
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        .deposit-proof-link {
          color: #2563eb;
          font-weight: 700;
          text-decoration: none;
          font-size: 13px;
        }

        @media (max-width: 1100px) {
          .deposit-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .deposit-filter-row {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .admin-page-head {
            flex-direction: column;
          }

          .deposit-stat-grid {
            grid-template-columns: 1fr;
          }

          .deposit-drawer-head,
          .deposit-drawer-body {
            padding-left: 16px;
            padding-right: 16px;
          }

          .deposit-detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AdminShell>
  );
}
