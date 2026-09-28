"use client";

import { useEffect, useMemo, useState } from "react";
import { Decimal } from "decimal.js";
import AdminShell from "../AdminShell";

type Setting = {
  id: string | null;
  managerSeatLimit: number;
  welcomeBalance: number | string;
  day2ProfitRate: number | string;
  day3ProfitRate: number | string;
  rerentProfitRate: number | string;
  rerentDelaySeconds: number;
  depositInstructions: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type Overview = {
  managers?: Array<{
    id: string;
    status: string;
  }>;
};

export default function AdminSettingsPage() {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [seatLimit, setSeatLimit] = useState("");
  const [depositInstructions, setDepositInstructions] = useState("");
  const [activeManagers, setActiveManagers] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const seatNumber = Number(seatLimit);

  const seatValid = useMemo(() => {
    return (
      Number.isInteger(seatNumber) &&
      seatNumber >= Math.max(1, activeManagers) &&
      seatNumber <= 100000
    );
  }, [seatNumber, activeManagers]);

  async function loadSettings(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setSuccess("");

      const [settingsResponse, overviewResponse] =
        await Promise.all([
          fetch("/api/admin/settings", {
            cache: "no-store",
          }),
          fetch("/api/admin/overview", {
            cache: "no-store",
          }),
        ]);

      const settingsData = await settingsResponse.json();
      const overviewData = await overviewResponse.json();

      if (!settingsResponse.ok) {
        throw new Error(
          settingsData.error || "Unable to load settings."
        );
      }

      if (!overviewResponse.ok) {
        throw new Error(
          overviewData.error || "Unable to load manager information."
        );
      }

      const current: Setting = settingsData.setting;
      setSetting(current);
      setSeatLimit(String(current.managerSeatLimit));
      setDepositInstructions(current.depositInstructions || "");

      const managers = overviewData.managers || [];
      setActiveManagers(
        managers.filter(
          (manager: { status: string }) =>
            manager.status === "ACTIVE"
        ).length
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load settings."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function saveSettings() {
    setError("");
    setSuccess("");

    if (!seatValid) {
      setError(
        `Seat limit must be a whole number between ${Math.max(
          1,
          activeManagers
        )} and 100000.`
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          managerSeatLimit: seatNumber,
          depositInstructions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save platform settings."
        );
      }

      const updated: Setting = data.setting;

      setSetting(updated);
      setSeatLimit(String(updated.managerSeatLimit));
      setDepositInstructions(updated.depositInstructions || "");
      setSuccess("Platform settings saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save platform settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <div className="settings-page">
        <div className="settings-header">
          <div>
            <div className="settings-eyebrow">
              PLATFORM CONTROL
            </div>
            <h1>Settings</h1>
            <p>
              Manage core platform configuration and operational
              instructions from one secured administration area.
            </p>
          </div>

          <button
            className="settings-refresh"
            onClick={() => loadSettings(true)}
            disabled={loading || refreshing || saving}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="settings-alert settings-error">
            <strong>Unable to continue</strong>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="settings-alert settings-success">
            <strong>Saved</strong>
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="settings-loading">
            Loading platform settings...
          </div>
        ) : (
          <>
            <div className="settings-grid">
              <section className="settings-card">
                <div className="card-heading">
                  <div>
                    <span className="card-kicker">
                      MANAGEMENT CAPACITY
                    </span>
                    <h2>Manager Seats</h2>
                    <p>
                      Control the maximum number of active manager
                      accounts allowed on the platform.
                    </p>
                  </div>

                  <div className="heading-icon">M</div>
                </div>

                <div className="capacity-panel">
                  <div>
                    <span>Active Managers</span>
                    <strong>{activeManagers}</strong>
                  </div>

                  <div className="capacity-divider" />

                  <div>
                    <span>Configured Limit</span>
                    <strong>
                      {setting?.managerSeatLimit ?? "—"}
                    </strong>
                  </div>

                  <div className="capacity-divider" />

                  <div>
                    <span>Available Seats</span>
                    <strong>
                      {Math.max(
                        0,
                        (setting?.managerSeatLimit || 0) -
                          activeManagers
                      )}
                    </strong>
                  </div>
                </div>

                <div className="field-block">
                  <label htmlFor="seatLimit">
                    Manager Seat Limit
                  </label>

                  <input
                    id="seatLimit"
                    type="number"
                    min={Math.max(1, activeManagers)}
                    max={100000}
                    step={1}
                    value={seatLimit}
                    onChange={(event) =>
                      setSeatLimit(event.target.value)
                    }
                  />

                  <small>
                    The limit cannot be lower than the current
                    active-manager count.
                  </small>
                </div>
              </section>

              <section className="settings-card">
                <div className="card-heading">
                  <div>
                    <span className="card-kicker">
                      CURRENT SYSTEM VALUES
                    </span>
                    <h2>Operational Rules</h2>
                    <p>
                      These values are currently controlled by the
                      secured platform configuration.
                    </p>
                  </div>

                  <div className="heading-icon">R</div>
                </div>

                <div className="readonly-list">
                  <div className="readonly-row">
                    <span>Welcome Balance</span>
                    <strong>
                      ₹{new Decimal(String(setting?.welcomeBalance || 0)).toFixed(2)}
                    </strong>
                  </div>

                  <div className="readonly-row">
                    <span>Day 2 Profit Rate</span>
                    <strong>
                      {new Decimal(String(setting?.day2ProfitRate || 0)).toFixed(2)}%
                    </strong>
                  </div>

                  <div className="readonly-row">
                    <span>Day 3 Profit Rate</span>
                    <strong>
                      {new Decimal(String(setting?.day3ProfitRate || 0)).toFixed(2)}%
                    </strong>
                  </div>

                  <div className="readonly-row">
                    <span>Re-Rent Profit Rate</span>
                    <strong>
                      {new Decimal(String(setting?.rerentProfitRate || 0)).toFixed(2)}%
                    </strong>
                  </div>

                  <div className="readonly-row">
                    <span>Re-Rent Delay</span>
                    <strong>
                      {setting?.rerentDelaySeconds ?? 0} seconds
                    </strong>
                  </div>
                </div>

                <div className="readonly-note">
                  These operational values are displayed from the
                  database but are not editable because the current
                  secured Settings API does not expose mutation for
                  them.
                </div>
              </section>
            </div>

            <section className="settings-card instructions-card">
              <div className="card-heading">
                <div>
                  <span className="card-kicker">
                    MANUAL PAYMENT WORKFLOW
                  </span>
                  <h2>Deposit Instructions</h2>
                  <p>
                    This message is used to explain how clients should
                    arrange payments through their assigned manager.
                  </p>
                </div>

                <div className="heading-icon">D</div>
              </div>

              <div className="field-block">
                <label htmlFor="depositInstructions">
                  Client-facing instructions
                </label>

                <textarea
                  id="depositInstructions"
                  rows={7}
                  maxLength={4000}
                  value={depositInstructions}
                  onChange={(event) =>
                    setDepositInstructions(event.target.value)
                  }
                  placeholder="Enter the payment instructions shown to clients..."
                />

                <div className="character-count">
                  {depositInstructions.length} / 4000
                </div>
              </div>
            </section>

            <section className="settings-card security-card">
              <div className="security-icon">✓</div>

              <div>
                <h2>Administration & Audit Protection</h2>
                <p>
                  Settings changes are restricted to authenticated
                  administrators. Updates are processed through the
                  secured server-side endpoint and recorded in the
                  platform audit log.
                </p>

                {setting?.updatedAt && (
                  <small>
                    Last configuration update:{" "}
                    {new Date(setting.updatedAt).toLocaleString()}
                  </small>
                )}
              </div>
            </section>

            <div className="settings-actions">
              <button
                className="save-button"
                onClick={saveSettings}
                disabled={saving || !seatValid}
              >
                {saving ? "Saving Changes..." : "Save Platform Settings"}
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        .settings-page {
          max-width: 1450px;
          margin: 0 auto;
          padding-bottom: 40px;
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .settings-eyebrow {
          color: #667085;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          margin-bottom: 7px;
        }

        .settings-header h1 {
          margin: 0;
          color: #101828;
          font-size: 32px;
          letter-spacing: -0.03em;
        }

        .settings-header p {
          margin: 8px 0 0;
          color: #667085;
          font-size: 14px;
          max-width: 720px;
          line-height: 1.55;
        }

        .settings-refresh {
          border: 0;
          border-radius: 10px;
          background: #111827;
          color: white;
          padding: 12px 18px;
          font-weight: 700;
          cursor: pointer;
        }

        .settings-refresh:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .settings-alert {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 13px 15px;
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 13px;
        }

        .settings-error {
          background: #fef3f2;
          border: 1px solid #fecdca;
          color: #b42318;
        }

        .settings-success {
          background: #ecfdf3;
          border: 1px solid #abefc6;
          color: #027a48;
        }

        .settings-loading {
          min-height: 300px;
          border: 1px solid #eaecf0;
          border-radius: 18px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #667085;
          font-size: 14px;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 18px;
        }

        .settings-card {
          background: white;
          border: 1px solid #eaecf0;
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 3px 12px rgba(16, 24, 40, 0.04);
          margin-bottom: 18px;
        }

        .card-heading {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 20px;
        }

        .card-kicker {
          color: #667085;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .card-heading h2 {
          margin: 5px 0 5px;
          color: #101828;
          font-size: 19px;
        }

        .card-heading p {
          margin: 0;
          color: #667085;
          font-size: 12px;
          line-height: 1.5;
        }

        .heading-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: #f2f4f7;
          color: #344054;
          font-weight: 900;
        }

        .capacity-panel {
          display: grid;
          grid-template-columns: 1fr auto 1fr auto 1fr;
          align-items: center;
          gap: 14px;
          padding: 16px;
          background: #f9fafb;
          border: 1px solid #eaecf0;
          border-radius: 14px;
          margin-bottom: 22px;
        }

        .capacity-panel div:not(.capacity-divider) {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .capacity-panel span {
          color: #667085;
          font-size: 11px;
          font-weight: 700;
        }

        .capacity-panel strong {
          color: #101828;
          font-size: 20px;
        }

        .capacity-divider {
          width: 1px;
          height: 38px;
          background: #d0d5dd;
        }

        .field-block {
          position: relative;
        }

        .field-block label {
          display: block;
          margin-bottom: 7px;
          color: #344054;
          font-size: 12px;
          font-weight: 800;
        }

        .field-block input,
        .field-block textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          background: white;
          color: #101828;
          outline: none;
          font: inherit;
          padding: 11px 12px;
        }

        .field-block input:focus,
        .field-block textarea:focus {
          border-color: #98a2b3;
          box-shadow: 0 0 0 3px rgba(152, 162, 179, 0.12);
        }

        .field-block small {
          display: block;
          margin-top: 7px;
          color: #98a2b3;
          font-size: 11px;
        }

        .readonly-list {
          border: 1px solid #eaecf0;
          border-radius: 13px;
          overflow: hidden;
        }

        .readonly-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 13px 14px;
          border-bottom: 1px solid #f2f4f7;
        }

        .readonly-row:last-child {
          border-bottom: 0;
        }

        .readonly-row span {
          color: #667085;
          font-size: 12px;
        }

        .readonly-row strong {
          color: #101828;
          font-size: 13px;
        }

        .readonly-note {
          margin-top: 12px;
          padding: 11px 12px;
          border-radius: 10px;
          background: #fffaeb;
          color: #7a2e0e;
          font-size: 11px;
          line-height: 1.5;
        }

        .instructions-card {
          margin-top: 0;
        }

        .instructions-card textarea {
          min-height: 150px;
          resize: vertical;
        }

        .character-count {
          text-align: right;
          color: #98a2b3;
          font-size: 10px;
          margin-top: 5px;
        }

        .security-card {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          background: #f8fafc;
        }

        .security-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #ecfdf3;
          color: #027a48;
          font-weight: 900;
        }

        .security-card h2 {
          margin: 0 0 5px;
          color: #101828;
          font-size: 15px;
        }

        .security-card p {
          margin: 0;
          color: #667085;
          font-size: 12px;
          line-height: 1.55;
        }

        .security-card small {
          display: block;
          margin-top: 8px;
          color: #98a2b3;
          font-size: 10px;
        }

        .settings-actions {
          display: flex;
          justify-content: flex-end;
        }

        .save-button {
          border: 0;
          border-radius: 11px;
          background: #111827;
          color: white;
          padding: 13px 22px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 3px 8px rgba(16, 24, 40, 0.14);
        }

        .save-button:hover {
          background: #1f2937;
        }

        .save-button:disabled {
          opacity: 0.5;
          cursor: default;
        }

        @media (max-width: 1000px) {
          .settings-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .settings-header {
            flex-direction: column;
          }

          .settings-header h1 {
            font-size: 27px;
          }

          .capacity-panel {
            grid-template-columns: 1fr;
          }

          .capacity-divider {
            width: 100%;
            height: 1px;
          }

          .settings-card {
            padding: 17px;
          }

          .settings-actions {
            justify-content: stretch;
          }

          .save-button {
            width: 100%;
          }
        }
      `}</style>
    </AdminShell>
  );
}
