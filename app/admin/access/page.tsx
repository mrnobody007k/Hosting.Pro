"use client";

import { FormEvent, useEffect, useState } from "react";
import AdminShell from "../AdminShell";

type AdminInfo = {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
};

type SecurityInfo = {
  sessionDuration: string;
  cookieHttpOnly: boolean;
  sameSite: string;
  productionCookie: string;
  roleProtected: boolean;
  databaseStatusChecked: boolean;
};

type LoginAccessInfo = {
  customer: {
    active: boolean;
    lastRotatedAt: string | null;
  };
  manager: {
    active: boolean;
    lastRotatedAt: string | null;
  };
};

export default function Page() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [security, setSecurity] = useState<SecurityInfo | null>(null);
  const [loginAccess, setLoginAccess] = useState<LoginAccessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [rotatingCustomer, setRotatingCustomer] = useState(false);
  const [rotatingManager, setRotatingManager] = useState(false);
  const [revokingTarget, setRevokingTarget] = useState<"customer" | "manager" | null>(null);
  const [newCustomerUrl, setNewCustomerUrl] = useState("");
  const [newManagerUrl, setNewManagerUrl] = useState("");

  async function loadAccess() {
    try {
      setLoading(true);
      setError("");

      const [accessRes, loginAccessRes] = await Promise.all([
        fetch("/api/admin/access", { cache: "no-store" }),
        fetch("/api/admin/login-access", { cache: "no-store" }),
      ]);

      const accessData = await accessRes.json();
      const loginAccessData = await loginAccessRes.json();

      if (!accessRes.ok) {
        throw new Error(accessData.error || "Unable to load admin access.");
      }
      if (!loginAccessRes.ok) {
        throw new Error(loginAccessData.error || "Unable to load login access settings.");
      }

      setAdmin(accessData.admin);
      setSecurity(accessData.security);
      setLoginAccess(loginAccessData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load admin access.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccess();
  }, []);

  async function changePassword(event: FormEvent) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/access", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to change password.",
        );
      }

      setMessage(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to change password.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rotateLoginAccess(target: "customer" | "manager") {
    if (target === "customer") setRotatingCustomer(true);
    else setRotatingManager(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/login-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to rotate login access.");
      }

      if (target === "customer") {
        setNewCustomerUrl(data.loginUrl);
      } else {
        setNewManagerUrl(data.loginUrl);
      }

      setMessage(data.warning);
      await loadAccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to rotate login access.",
      );
    } finally {
      setRotatingCustomer(false);
      setRotatingManager(false);
    }
  }

  async function revokeLoginAccess(target: "customer" | "manager") {
    const label = target === "customer" ? "customer" : "manager";
    if (!window.confirm(`Revoke the active ${label} access link? Anyone using it will lose access immediately.`)) return;
    setRevokingTarget(target);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/login-access", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to revoke access link.");
      if (target === "customer") setNewCustomerUrl("");
      else setNewManagerUrl("");
      setMessage(data.revoked ? `The ${label} access link was revoked.` : `No active ${label} link was configured.`);
      await loadAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke access link.");
    } finally {
      setRevokingTarget(null);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("URL copied to clipboard.");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setError("Failed to copy to clipboard.");
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/admin-login";
    }
  }

  return (
    <AdminShell>
      <div className="access-page">
        <div className="access-header">
          <div>
            <div className="access-eyebrow">
              SECURITY & ACCESS
            </div>
            <h1 className="admin-page-title">
              Admin Access
            </h1>
            <p className="admin-page-subtitle">
              Manage your administrator account, login access URLs, and review
              active authentication security controls.
            </p>
          </div>

          <button
            className="access-refresh"
            onClick={loadAccess}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        {message && (
          <div className="access-alert success">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="access-alert error">
            ⚠ {error}
          </div>
        )}

        {/* ADMIN ACCOUNT & SESSION SECURITY */}
        <div className="access-grid">
          <section className="admin-card access-card">
            <div className="access-card-header">
              <div className="access-title-wrap">
                <div className="access-icon">👤</div>
                <div>
                  <h2>Administrator Account</h2>
                  <p>Current signed-in administrator</p>
                </div>
              </div>

              <span className="access-status">
                ACTIVE
              </span>
            </div>

            {loading ? (
              <div className="access-loading">
                Loading account information...
              </div>
            ) : admin ? (
              <div className="account-details">
                <div className="detail-row">
                  <span>Name</span>
                  <strong>{admin.name}</strong>
                </div>

                <div className="detail-row">
                  <span>Email</span>
                  <strong>{admin.email}</strong>
                </div>

                <div className="detail-row">
                  <span>Account status</span>
                  <strong>{admin.status}</strong>
                </div>

                <div className="detail-row">
                  <span>Admin ID</span>
                  <strong className="mono">
                    {admin.id}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Created</span>
                  <strong>
                    {new Date(
                      admin.createdAt,
                    ).toLocaleString()}
                  </strong>
                </div>
              </div>
            ) : null}
          </section>

          <section className="admin-card access-card">
            <div className="access-card-header">
              <div className="access-title-wrap">
                <div className="access-icon">🔐</div>
                <div>
                  <h2>Session Security</h2>
                  <p>Current authentication protections</p>
                </div>
              </div>
            </div>

            {security && (
              <div className="security-list">
                <div className="security-item">
                  <span>Session lifetime</span>
                  <strong>{security.sessionDuration}</strong>
                </div>

                <div className="security-item">
                  <span>HttpOnly cookie</span>
                  <strong className="secure-value">
                    ✓ Enabled
                  </strong>
                </div>

                <div className="security-item">
                  <span>SameSite protection</span>
                  <strong>{security.sameSite}</strong>
                </div>

                <div className="security-item">
                  <span>Production cookie</span>
                  <strong className="mono">
                    {security.productionCookie}
                  </strong>
                </div>

                <div className="security-item">
                  <span>Role protection</span>
                  <strong className="secure-value">
                    ✓ Enabled
                  </strong>
                </div>

                <div className="security-item">
                  <span>Database status check</span>
                  <strong className="secure-value">
                    ✓ Enabled
                  </strong>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* LOGIN ACCESS ROTATION */}
        <div className="access-section">
          <div className="access-section-header">
            <div>
              <div className="access-icon">🔗</div>
              <div>
                <h2>Login Access URL Rotation</h2>
                <p>
                  Generate secure, single-use access URLs for Customer and Manager login portals.
                  Rotating a URL immediately invalidates the previous one.
                </p>
              </div>
            </div>
          </div>

          <div className="access-grid">
            {/* CUSTOMER LOGIN ACCESS */}
            <section className="admin-card access-card login-access-card">
              <div className="access-card-header">
                <div className="access-title-wrap">
                  <div className="access-icon">👥</div>
                  <div>
                    <h2>Customer Login Access</h2>
                    <p>Secure entry point for Housing.pro customers</p>
                  </div>
                </div>
                <span className={`access-status ${loginAccess?.customer?.active ? "" : "inactive"}`}>
                  {loginAccess?.customer?.active ? "ACTIVE" : "NOT CONFIGURED"}
                </span>
              </div>

              {loginAccess?.customer?.active ? (
                <div className="login-access-details">
                  <p>Active path: <code>/login/[access-token]</code>. The token is never shown again after creation.</p>
                  <div className="detail-row">
                    <span>Last Rotated</span>
                    <strong>{loginAccess.customer.lastRotatedAt ? new Date(loginAccess.customer.lastRotatedAt).toLocaleString() : "Not recorded"}</strong>
                  </div>

                  <div className="warning-box">
                    <strong>⚠ Warning:</strong> Generating a new URL will immediately invalidate the current one.
                    All users with the old URL will be unable to access the login page.
                  </div>

                  <button
                    className="rotate-btn"
                    onClick={() => rotateLoginAccess("customer")}
                    disabled={rotatingCustomer}
                  >
                    {rotatingCustomer ? "Generating..." : "Generate New Customer Login URL"}
                  </button>
                  <button className="revoke-access-btn" onClick={() => revokeLoginAccess("customer")} disabled={revokingTarget !== null}>
                    {revokingTarget === "customer" ? "Revoking..." : "Revoke Customer Access Link"}
                  </button>

                  {newCustomerUrl && (
                    <div className="new-url-box">
                      <strong>New URL Generated:</strong>
                      <div className="url-display">
                        <code className="mono">{newCustomerUrl}</code>
                        <button
                          className="copy-btn"
                          onClick={() => copyToClipboard(newCustomerUrl)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="login-access-empty">
                  <p>No active Customer login URL. Generate one to enable customer access.</p>
                  <button
                    className="rotate-btn primary"
                    onClick={() => rotateLoginAccess("customer")}
                    disabled={rotatingCustomer}
                  >
                    {rotatingCustomer ? "Generating..." : "Generate Customer Login URL"}
                  </button>
                </div>
              )}
            </section>

            {/* MANAGER LOGIN ACCESS */}
            <section className="admin-card access-card login-access-card">
              <div className="access-card-header">
                <div className="access-title-wrap">
                  <div className="access-icon">🏢</div>
                  <div>
                    <h2>Manager Login Access</h2>
                    <p>Secure entry point for Housing.pro managers</p>
                  </div>
                </div>
                <span className={`access-status ${loginAccess?.manager?.active ? "" : "inactive"}`}>
                  {loginAccess?.manager?.active ? "ACTIVE" : "NOT CONFIGURED"}
                </span>
              </div>

              {loginAccess?.manager?.active ? (
                <div className="login-access-details">
                  <p>Active path: <code>/manager-login/[access-token]</code>. The token is never shown again after creation.</p>
                  <div className="detail-row">
                    <span>Last Rotated</span>
                    <strong>{loginAccess.manager.lastRotatedAt ? new Date(loginAccess.manager.lastRotatedAt).toLocaleString() : "Not recorded"}</strong>
                  </div>

                  <div className="warning-box">
                    <strong>⚠ Warning:</strong> Generating a new URL will immediately invalidate the current one.
                    All managers with the old URL will be unable to access the login page.
                  </div>

                  <button
                    className="rotate-btn"
                    onClick={() => rotateLoginAccess("manager")}
                    disabled={rotatingManager}
                  >
                    {rotatingManager ? "Generating..." : "Generate New Manager Login URL"}
                  </button>
                  <button className="revoke-access-btn" onClick={() => revokeLoginAccess("manager")} disabled={revokingTarget !== null}>
                    {revokingTarget === "manager" ? "Revoking..." : "Revoke Manager Access Link"}
                  </button>

                  {newManagerUrl && (
                    <div className="new-url-box">
                      <strong>New URL Generated:</strong>
                      <div className="url-display">
                        <code className="mono">{newManagerUrl}</code>
                        <button
                          className="copy-btn"
                          onClick={() => copyToClipboard(newManagerUrl)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="login-access-empty">
                  <p>No active Manager login URL. Generate one to enable manager access.</p>
                  <button
                    className="rotate-btn primary"
                    onClick={() => rotateLoginAccess("manager")}
                    disabled={rotatingManager}
                  >
                    {rotatingManager ? "Generating..." : "Generate Manager Login URL"}
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* CHANGE ADMIN PASSWORD */}
        <section className="admin-card password-card">
          <div className="password-heading">
            <div className="access-icon">🔑</div>
            <div>
              <h2>Change Admin Password</h2>
              <p>
                Verify the current password before changing
                the administrator password.
              </p>
            </div>
          </div>

          <form
            className="password-form"
            onSubmit={changePassword}
          >
            <label>
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(e) =>
                  setCurrentPassword(e.target.value)
                }
                autoComplete="current-password"
                required
              />
            </label>

            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(e) =>
                  setNewPassword(e.target.value)
                }
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>

            <label>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>

            <div className="password-rules">
              <strong>Password requirements</strong>
              <span>• Minimum 10 characters</span>
              <span>• Uppercase letter</span>
              <span>• Lowercase letter</span>
              <span>• Number</span>
            </div>

            <button
              type="submit"
              className="password-button"
              disabled={saving}
            >
              {saving
                ? "Updating..."
                : "Change Admin Password"}
            </button>
          </form>
        </section>

        {/* END CURRENT SESSION */}
        <section className="admin-card danger-card">
          <div>
            <h2>End Current Session</h2>
            <p>
              Sign out of this administrator session.
              Authentication will be required again.
            </p>
          </div>

          <button
            className="logout-button"
            onClick={logout}
          >
            Sign Out
          </button>
        </section>

        <div className="access-footer-note">
          <strong>Security audit:</strong> Password changes and login access rotations
          are recorded in the platform audit log. The
          administrator account status is checked against
          the database when the session is validated.
        </div>
      </div>

      <style jsx>{`
        .access-page {
          max-width: 1400px;
        }

        .access-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .access-eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: #64748b;
          margin-bottom: 7px;
        }

        .access-refresh {
          border: 1px solid #dbe3ef;
          background: #fff;
          color: #334155;
          border-radius: 10px;
          padding: 10px 15px;
          font-weight: 700;
          cursor: pointer;
        }

        .access-refresh:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .access-alert {
          padding: 13px 16px;
          border-radius: 11px;
          margin-bottom: 18px;
          font-size: 14px;
          font-weight: 700;
        }

        .access-alert.success {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #047857;
        }

        .access-alert.error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .access-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
        }

        .access-card {
          padding: 24px;
        }

        .access-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 18px;
          border-bottom: 1px solid #eef2f7;
        }

        .access-title-wrap,
        .password-heading {
          display: flex;
          gap: 13px;
          align-items: flex-start;
        }

        .access-card h2,
        .password-card h2,
        .danger-card h2 {
          margin: 0;
          font-size: 17px;
          color: #172033;
        }

        .access-card p,
        .password-card p,
        .danger-card p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.55;
        }

        .access-icon {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          font-size: 19px;
          flex: 0 0 auto;
        }

        .access-status {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #bbf7d0;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.06em;
        }

        .access-status.inactive {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fcd34d;
        }

        .account-details,
        .security-list {
          padding-top: 8px;
        }

        .detail-row,
        .security-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 13px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .detail-row:last-child,
        .security-item:last-child {
          border-bottom: 0;
        }

        .detail-row span,
        .security-item span {
          color: #64748b;
          font-size: 13px;
        }

        .detail-row strong,
        .security-item strong {
          color: #172033;
          font-size: 13px;
          text-align: right;
        }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo,
            Monaco, Consolas, monospace;
          font-size: 11px !important;
          word-break: break-all;
        }

        .secure-value {
          color: #047857 !important;
        }

        .access-loading {
          padding: 30px 0 10px;
          color: #64748b;
          font-size: 13px;
        }

        .password-card {
          margin-top: 20px;
          padding: 24px;
        }

        .password-heading {
          margin-bottom: 22px;
        }

        .password-form {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .password-form label {
          display: flex;
          flex-direction: column;
          gap: 7px;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }

        .password-form input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe3ef;
          border-radius: 10px;
          padding: 12px 13px;
          outline: none;
          font-size: 14px;
          color: #172033;
          background: #fff;
        }

        .password-form input:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.15);
        }

        .password-rules {
          grid-column: 1 / -1;
          display: flex;
          flex-wrap: wrap;
          gap: 7px 16px;
          padding: 13px;
          border-radius: 10px;
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
        }

        .password-rules strong {
          color: #334155;
          width: 100%;
        }

        .password-button {
          grid-column: 1 / -1;
          justify-self: start;
          border: 0;
          border-radius: 10px;
          padding: 12px 18px;
          background: #111827;
          color: #fff;
          font-weight: 800;
          cursor: pointer;
        }

        .password-button:disabled {
          opacity: 0.6;
          cursor: not-allowed.
        }

        .danger-card {
          margin-top: 20px;
          padding: 22px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-color: #fee2e2;
        }

        .logout-button {
          border: 1px solid #fecaca;
          background: #fff;
          color: #b91c1c;
          border-radius: 10px;
          padding: 11px 17px;
          font-weight: 800;
          cursor: pointer;
        }

        /* LOGIN ACCESS ROTATION STYLES */
        .access-section {
          margin-top: 32px;
        }

        .access-section-header {
          display: flex;
          gap: 13px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .access-section-header h2 {
          margin: 0 0 5px;
          font-size: 20px;
          color: #172033;
        }

        .access-section-header p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.55;
        }

        .login-access-card {
          min-height: 320px;
        }

        .login-access-details {
          padding-top: 8px;
        }

        .url-display {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .url-display code {
          flex: 1;
          min-width: 200px;
          background: #f1f5f9;
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 11px;
          overflow-x: auto;
        }

        .token-display {
          background: #f1f5f9;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 11px;
        }

        .copy-btn {
          border: 1px solid #dbe3ef;
          background: #fff;
          color: #334155;
          border-radius: 8px;
          padding: 8px 12px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }

        .copy-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .warning-box {
          margin: 16px 0;
          padding: 12px 14px;
          border: 1px solid #fcd34d;
          border-radius: 10px;
          background: #fffbeb;
          color: #92400e;
          font-size: 12px;
          line-height: 1.5;
        }

        .warning-box strong {
          color: #b45309;
        }

        .rotate-btn {
          width: 100%;
          border: 0;
          border-radius: 10px;
          padding: 12px 16px;
          background: #fef3c7;
          color: #92400e;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .rotate-btn:hover:not(:disabled) {
          background: #fde68a;
        }

        .rotate-btn.primary {
          background: #111827;
          color: #fff;
        }

        .rotate-btn.primary:hover:not(:disabled) {
          background: #1f2937;
        }

        .rotate-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .revoke-access-btn {
          width: 100%;
          margin-top: 9px;
          padding: 11px 16px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fff;
          color: #b91c1c;
          font-weight: 800;
          cursor: pointer;
        }

        .revoke-access-btn:disabled { opacity: .55; cursor: wait; }

        .new-url-box {
          margin-top: 16px;
          padding: 14px;
          border: 1px solid #a7f3d0;
          border-radius: 10px;
          background: #f0fdf4;
        }

        .new-url-box strong {
          display: block;
          margin-bottom: 8px;
          color: #047857;
          font-size: 13px;
        }

        .login-access-empty {
          text-align: center;
          padding: 32px 20px;
          color: #64748b;
        }

        .login-access-empty p {
          margin: 0 0 16px;
          font-size: 13px;
        }

        .access-footer-note {
          margin-top: 16px;
          padding: 14px 16px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.6;
        }

        @media (max-width: 900px) {
          .access-grid {
            grid-template-columns: 1fr;
          }

          .password-form {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .access-header {
            align-items: stretch;
            flex-direction: column;
          }

          .access-refresh {
            width: 100%;
          }

          .detail-row,
          .security-item,
          .danger-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .detail-row strong,
          .security-item strong {
            text-align: left;
          }

          .logout-button {
            width: 100%;
          }

          .password-form {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AdminShell>
  );
}
