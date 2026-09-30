"use client";

import { useEffect, useMemo, useState } from "react";
import { Decimal } from "decimal.js";
import AdminShell from "../AdminShell";

type Activity = {
  id: string;
  actorType: "ADMIN" | "MANAGER" | "USER";
  actorId: string;
  managerId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  amount: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  manager: {
    id: string;
    name: string;
    email: string;
    referralCode: string;
  } | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function money(value: string | null) {
  if (value === null) return "—";
  try {
    const amount = new Decimal(value);
    return amount.isFinite() ? `₹${amount.toFixed(2)}` : "—";
  } catch {
    return "—";
  }
}

function actorClass(type: string) {
  if (type === "ADMIN") return "activity-badge admin";
  if (type === "MANAGER") return "activity-badge manager";
  return "activity-badge user";
}

export default function AdminActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [managers, setManagers] = useState<Activity["manager"][]>([]);
  const [search, setSearch] = useState("");
  const [actorType, setActorType] = useState("ALL");
  const [managerId, setManagerId] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Activity | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadActivity(cursor?: string, append = false) {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (actorType !== "ALL") params.set("actorType", actorType);
      if (managerId !== "ALL") params.set("managerId", managerId);
      params.set("limit", "100");
      if (cursor) params.set("cursor", cursor);

      const response = await fetch(
        `/api/admin/activity?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load activity.");
      }

      const rows: Activity[] = data.activities || [];
      setActivities((current) => append ? [...current, ...rows] : rows);
      setNextCursor(data.nextCursor || null);

      const uniqueManagers = new Map<string, Activity["manager"]>();
      rows.forEach((row) => {
        if (row.manager) {
          uniqueManagers.set(row.manager.id, row.manager);
        }
      });

      setManagers(Array.from(uniqueManagers.values()));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load activity."
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadActivity();
  }, [actorType, managerId]);

  const stats = useMemo(() => {
    return {
      total: activities.length,
      admins: activities.filter((x) => x.actorType === "ADMIN").length,
      managers: activities.filter((x) => x.actorType === "MANAGER").length,
      users: activities.filter((x) => x.actorType === "USER").length,
      financial: activities.filter((x) => x.amount !== null).length,
    };
  }, [activities]);

  return (
    <AdminShell>
      <div className="activity-page">
        <div className="activity-header">
          <div>
            <div className="activity-eyebrow">SECURITY & AUDIT</div>
            <h1>Activity Center</h1>
            <p>
              Complete administrative audit trail for platform activity,
              financial actions and ownership events.
            </p>
          </div>

          <button
            className="activity-refresh"
            onClick={() => loadActivity()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Activity"}
          </button>
        </div>

        <div className="activity-stats">
          <div className="activity-stat">
            <span>Total Events</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="activity-stat">
            <span>Admin Events</span>
            <strong>{stats.admins}</strong>
          </div>
          <div className="activity-stat">
            <span>Manager Events</span>
            <strong>{stats.managers}</strong>
          </div>
          <div className="activity-stat">
            <span>User Events</span>
            <strong>{stats.users}</strong>
          </div>
          <div className="activity-stat">
            <span>Financial Events</span>
            <strong>{stats.financial}</strong>
          </div>
        </div>

        <div className="activity-card">
          <div className="activity-toolbar">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") loadActivity();
              }}
              placeholder="Search action, target, actor ID..."
            />

            <select
              value={actorType}
              onChange={(event) => setActorType(event.target.value)}
            >
              <option value="ALL">All Actors</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="USER">User</option>
            </select>

            <select
              value={managerId}
              onChange={(event) => setManagerId(event.target.value)}
            >
              <option value="ALL">All Managers</option>
              {managers.map((manager) => (
                <option key={manager!.id} value={manager!.id}>
                  {manager!.name}
                </option>
              ))}
            </select>

            <button
              className="activity-search"
              onClick={() => loadActivity()}
            >
              Search
            </button>
          </div>

          {error && (
            <div className="activity-error">
              {error}
            </div>
          )}
          {loading ? (
            <div className="activity-state">
              Loading audit activity...
            </div>
          ) : activities.length === 0 ? (
            <div className="activity-state">
              <strong>No activity found</strong>
              <span>
                There are no audit records matching the current filters.
              </span>
            </div>
          ) : (
            <div className="activity-table-wrap">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Manager</th>
                    <th>Amount</th>
                    <th>Details</th>
                  </tr>
                </thead>

                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity.id}>
                      <td>
                        <div className="activity-date">
                          {formatDate(activity.createdAt)}
                        </div>
                      </td>

                      <td>
                        <div className="actor-cell">
                          <span className={actorClass(activity.actorType)}>
                            {activity.actorType}
                          </span>
                          <small>{activity.actorId}</small>
                        </div>
                      </td>

                      <td>
                        <strong>{activity.action}</strong>
                      </td>

                      <td>
                        <div className="target-cell">
                          <span>
                            {activity.targetType || "—"}
                          </span>
                          <small>
                            {activity.targetId || "—"}
                          </small>
                        </div>
                      </td>

                      <td>
                        {activity.manager ? (
                          <div className="manager-cell">
                            <strong>{activity.manager.name}</strong>
                            <small>
                              {activity.manager.referralCode}
                            </small>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>{money(activity.amount)}</td>

                      <td>
                        <button
                          className="details-btn"
                          onClick={() => setSelected(activity)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {nextCursor && <div style={{ padding: 16, textAlign: "center" }}><button onClick={() => loadActivity(nextCursor, true)} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more activity"}</button></div>}
        </div>

        {selected && (
          <div
            className="activity-overlay"
            onClick={() => setSelected(null)}
          >
            <div
              className="activity-drawer"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="drawer-header">
                <div>
                  <span>Audit Event</span>
                  <h2>{selected.action}</h2>
                </div>

                <button
                  onClick={() => setSelected(null)}
                  className="drawer-close"
                >
                  ×
                </button>
              </div>

              <div className="drawer-section">
                <h3>Event</h3>

                <div className="detail-grid">
                  <div>
                    <label>Event ID</label>
                    <strong>{selected.id}</strong>
                  </div>
                  <div>
                    <label>Date / Time</label>
                    <strong>
                      {formatDate(selected.createdAt)}
                    </strong>
                  </div>
                  <div>
                    <label>Actor Type</label>
                    <strong>{selected.actorType}</strong>
                  </div>
                  <div>
                    <label>Actor ID</label>
                    <strong>{selected.actorId}</strong>
                  </div>
                  <div>
                    <label>Target Type</label>
                    <strong>{selected.targetType || "—"}</strong>
                  </div>
                  <div>
                    <label>Target ID</label>
                    <strong>{selected.targetId || "—"}</strong>
                  </div>
                  <div>
                    <label>Amount</label>
                    <strong>{money(selected.amount)}</strong>
                  </div>
                </div>
              </div>

              <div className="drawer-section">
                <h3>Manager Ownership</h3>

                {selected.manager ? (
                  <div className="ownership-box">
                    <strong>{selected.manager.name}</strong>
                    <span>{selected.manager.email}</span>
                    <span>
                      Referral: {selected.manager.referralCode}
                    </span>
                    <span>
                      Manager ID: {selected.manager.id}
                    </span>
                  </div>
                ) : (
                  <div className="muted-box">
                    This event is not associated with a manager.
                  </div>
                )}
              </div>

              <div className="drawer-section">
                <h3>Metadata</h3>

                <pre className="metadata-box">
                  {selected.metadata
                    ? JSON.stringify(selected.metadata, null, 2)
                    : "No metadata recorded."}
                </pre>
              </div>

              <div className="security-note">
                <strong>Audit protection</strong>
                <span>
                  Audit records are read-only from this administrative
                  interface. Financial and ownership changes remain
                  controlled through their dedicated secured workflows.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .activity-page {
          max-width: 1600px;
          margin: 0 auto;
        }

        .activity-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .activity-eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          color: #667085;
          margin-bottom: 7px;
        }

        .activity-header h1 {
          margin: 0;
          font-size: 32px;
          letter-spacing: -0.03em;
          color: #101828;
        }

        .activity-header p {
          margin: 8px 0 0;
          color: #667085;
          font-size: 14px;
        }

        .activity-refresh,
        .activity-search,
        .details-btn {
          border: 0;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
        }

        .activity-refresh {
          padding: 12px 17px;
          background: #111827;
          color: white;
        }

        .activity-refresh:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .activity-stats {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .activity-stat {
          background: white;
          border: 1px solid #eaecf0;
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.04);
        }

        .activity-stat span {
          display: block;
          color: #667085;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 9px;
        }

        .activity-stat strong {
          font-size: 25px;
          color: #101828;
        }

        .activity-card {
          background: white;
          border: 1px solid #eaecf0;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 3px 12px rgba(16, 24, 40, 0.04);
        }

        .activity-toolbar {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 180px 200px auto;
          gap: 10px;
          padding: 16px;
          border-bottom: 1px solid #eaecf0;
          background: #fcfcfd;
        }

        .activity-toolbar input,
        .activity-toolbar select {
          min-height: 42px;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          padding: 0 12px;
          background: white;
          color: #101828;
          outline: none;
        }

        .activity-toolbar input:focus,
        .activity-toolbar select:focus {
          border-color: #98a2b3;
        }

        .activity-search {
          padding: 0 18px;
          background: #111827;
          color: white;
        }

        .activity-error {
          margin: 16px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #fef3f2;
          color: #b42318;
          font-size: 13px;
          font-weight: 700;
        }

        .activity-state {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          color: #667085;
          font-size: 14px;
        }

        .activity-state strong {
          color: #101828;
        }

        .activity-table-wrap {
          overflow-x: auto;
        }

        .activity-table {
          width: 100%;
          min-width: 1100px;
          border-collapse: collapse;
        }

        .activity-table th {
          text-align: left;
          background: #f9fafb;
          color: #667085;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 13px 15px;
          border-bottom: 1px solid #eaecf0;
          white-space: nowrap;
        }

        .activity-table td {
          padding: 14px 15px;
          border-bottom: 1px solid #f2f4f7;
          color: #344054;
          font-size: 13px;
          vertical-align: middle;
        }

        .activity-table tbody tr:hover {
          background: #fcfcfd;
        }

        .activity-date {
          white-space: nowrap;
          color: #667085;
        }

        .actor-cell,
        .target-cell,
        .manager-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .actor-cell small,
        .target-cell small,
        .manager-cell small {
          color: #98a2b3;
          font-size: 11px;
          max-width: 190px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .activity-badge {
          width: fit-content;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.03em;
        }

        .activity-badge.admin {
          background: #eef2ff;
          color: #3730a3;
        }

        .activity-badge.manager {
          background: #ecfdf3;
          color: #027a48;
        }

        .activity-badge.user {
          background: #eff8ff;
          color: #175cd3;
        }

        .details-btn {
          padding: 8px 11px;
          background: #f2f4f7;
          color: #344054;
        }

        .details-btn:hover {
          background: #e4e7ec;
        }

        .activity-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(16, 24, 40, 0.42);
          display: flex;
          justify-content: flex-end;
        }

        .activity-drawer {
          width: min(620px, 100%);
          height: 100%;
          overflow-y: auto;
          background: white;
          padding: 26px;
          box-shadow: -12px 0 35px rgba(16, 24, 40, 0.16);
        }

        .drawer-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #eaecf0;
        }

        .drawer-header span {
          color: #667085;
          font-size: 12px;
          font-weight: 700;
        }

        .drawer-header h2 {
          margin: 5px 0 0;
          color: #101828;
          font-size: 22px;
        }

        .drawer-close {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 10px;
          background: #f2f4f7;
          font-size: 24px;
          cursor: pointer;
        }

        .drawer-section {
          padding: 22px 0;
          border-bottom: 1px solid #eaecf0;
        }

        .drawer-section h3 {
          margin: 0 0 14px;
          font-size: 13px;
          color: #344054;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .detail-grid label {
          display: block;
          color: #98a2b3;
          font-size: 11px;
          margin-bottom: 5px;
        }

        .detail-grid strong {
          display: block;
          color: #101828;
          font-size: 12px;
          word-break: break-word;
        }

        .ownership-box,
        .muted-box {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 14px;
          border-radius: 12px;
          background: #f9fafb;
          color: #667085;
          font-size: 12px;
        }

        .ownership-box strong {
          color: #101828;
          font-size: 14px;
        }

        .metadata-box {
          margin: 0;
          padding: 14px;
          border-radius: 12px;
          background: #101828;
          color: #d0d5dd;
          overflow-x: auto;
          font-size: 11px;
          line-height: 1.6;
        }

        .security-note {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 22px;
          padding: 14px;
          border-radius: 12px;
          background: #f0f9ff;
          color: #344054;
          font-size: 12px;
          line-height: 1.5;
        }

        .security-note strong {
          color: #175cd3;
        }

        @media (max-width: 1100px) {
          .activity-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .activity-toolbar {
            grid-template-columns: 1fr 1fr;
          }

          .activity-search {
            min-height: 42px;
          }
        }

        @media (max-width: 700px) {
          .activity-header {
            flex-direction: column;
          }

          .activity-header h1 {
            font-size: 26px;
          }

          .activity-stats {
            grid-template-columns: 1fr 1fr;
          }

          .activity-toolbar {
            grid-template-columns: 1fr;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .activity-drawer {
            padding: 20px;
          }
        }
      `}</style>
    </AdminShell>
  );
}
