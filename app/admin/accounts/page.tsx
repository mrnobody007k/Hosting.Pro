"use client";

import { useEffect, useState } from "react";
import { Decimal } from "decimal.js";
import AdminShell from "../AdminShell";
import { useAdminInfo } from "../_components/AdminInfoProvider";
import { PERMISSION_GROUPS, canAccessAdminAccountManagement } from "@/lib/admin-permissions";

type AdminAccount = {
  id: string;
  name: string;
  email: string;
  status: string;
  adminType: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
};

type AdminInfo = {
  id: string;
  name: string;
  email: string;
  adminType: string;
  permissions: string[];
};

export default function AdminAccountsPage() {
  const { adminInfo, loading: adminInfoLoading } = useAdminInfo();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentAdmin, setCurrentAdmin] = useState<AdminInfo | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    adminType: "STAFF_ADMIN",
    permissions: [] as string[],
    status: "ACTIVE",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/accounts", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      setAdmins(json.admins || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (adminInfo) {
      setCurrentAdmin({
        id: adminInfo.id,
        name: adminInfo.name,
        email: adminInfo.email,
        adminType: adminInfo.adminType,
        permissions: adminInfo.permissions,
      });
    }
  }, [adminInfo]);

  function handleChange(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
    setFormError("");
  }

  function togglePermission(perm: string) {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/accounts/${editingId}` : "/api/admin/accounts";
      const method = editingId ? "PATCH" : "POST";
      const body = editingId
        ? { name: form.name, status: form.status, permissions: form.permissions, password: form.password || undefined }
        : { name: form.name, email: form.email, password: form.password, adminType: form.adminType, permissions: form.permissions };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Save failed");
      setMessage(editingId ? "Admin updated" : "Admin created");
      setShowCreate(false);
      setEditingId(null);
      setForm({ name: "", email: "", password: "", adminType: "STAFF_ADMIN", permissions: [], status: "ACTIVE" });
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this admin account? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Delete failed");
      setMessage("Admin deleted");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function startEdit(admin: AdminAccount) {
    setEditingId(admin.id);
    setForm({
      name: admin.name,
      email: admin.email,
      password: "",
      adminType: admin.adminType,
      permissions: [...admin.permissions],
      status: admin.status,
    });
    setShowCreate(false);
  }

  function startCreate() {
    setEditingId(null);
    setForm({ name: "", email: "", password: "", adminType: "STAFF_ADMIN", permissions: [], status: "ACTIVE" });
    setShowCreate(true);
  }

  if (loading || adminInfoLoading) return <AdminShell><div style={{padding:40,textAlign:"center",color:"#64748b"}}>Loading...</div></AdminShell>;

  const isSuper = canAccessAdminAccountManagement(currentAdmin?.adminType || "");

  return (
    <AdminShell>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Admin Management
            </div>
            <h2 className="admin-page-title">Admin Accounts</h2>
            <p className="admin-page-subtitle">
              {isSuper ? "Full admin management access" : "Limited view - contact Super Admin for changes"}
            </p>
          </div>
          {isSuper && (
            <button onClick={startCreate} style={{ border: 0, borderRadius: 9, padding: "11px 18px", background: "#111827", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
              + Create Staff Admin
            </button>
          )}
        </div>

        {message && <div className="admin-card" style={{ marginBottom: 16, background: "#f0fdf4", borderColor: "#a7f3d0", color: "#047857" }}><strong>✓ {message}</strong></div>}
        {error && <div className="admin-card" style={{ marginBottom: 16, borderColor: "#fecaca", background: "#fff7f7", color: "#b91c1c" }}>{error}</div>}

        {showCreate || editingId ? (
          <section className="admin-card" style={{ marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3>{editingId ? "Edit Admin" : "Create Staff Admin"}</h3>
              <button onClick={() => { setShowCreate(false); setEditingId(null); setForm({ name: "", email: "", password: "", adminType: "STAFF_ADMIN", permissions: [], status: "ACTIVE" }); }} style={{ border: 0, background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            {formError && <div className="admin-card" style={{ marginBottom: 16, borderColor: "#fecaca", background: "#fff7f7", color: "#b91c1c" }}>{formError}</div>}
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, maxWidth: 600 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#344054" }}>Name</span>
                  <input value={form.name} onChange={e => handleChange("name", e.target.value)} style={{ padding: "11px 13px", border: "1px solid #dbe1e8", borderRadius: 9, fontSize: 14 }} required />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#344054" }}>Email</span>
                  <input value={form.email} onChange={e => handleChange("email", e.target.value)} type="email" disabled={!!editingId} style={{ padding: "11px 13px", border: "1px solid #dbe1e8", borderRadius: 9, fontSize: 14 }} required />
                </label>
              </div>
              {!editingId && (
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#344054" }}>Password (min 12 chars)</span>
                  <input value={form.password} onChange={e => handleChange("password", e.target.value)} type="password" style={{ padding: "11px 13px", border: "1px solid #dbe1e8", borderRadius: 9, fontSize: 14 }} required />
                </label>
              )}
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#344054" }}>Status</span>
                <select value={form.status} onChange={e => handleChange("status", e.target.value)} style={{ padding: "11px 13px", border: "1px solid #dbe1e8", borderRadius: 9, fontSize: 14 }}>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </label>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#344054" }}>Permissions</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Select individual permissions for this Staff Admin</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                    <div key={group} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>{group}</div>
                      {perms.map((perm) => (
                        <label key={perm} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#344054" }}>
                          <input type="checkbox" checked={form.permissions.includes(perm)} onChange={() => togglePermission(perm)} style={{ width: 16, height: 16, accentColor: "#2563eb" }} />
                          <span>{perm.replace(/_/g, " ")}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => { setShowCreate(false); setEditingId(null); }} style={{ border: "1px solid #dbe1e8", background: "#fff", color: "#344054", padding: "11px 18px", borderRadius: 9, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ border: 0, borderRadius: 9, padding: "11px 18px", background: "#111827", color: "#fff", fontWeight: 800, cursor: saving ? "wait" : "pointer" }}>
                  {saving ? "Saving..." : (editingId ? "Update Admin" : "Create Admin")}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <div className="admin-card" style={{ marginTop: 24, padding: 0 }}>
            <div style={{ padding: "20px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", gap: 12 }}>
              <strong>Admin Accounts</strong>
              <span style={{ color: "#64748b", fontSize: 13 }}>Total: {admins.length}</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Admin", "Email", "Type", "Status", "Permissions", "Created", "Actions"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "13px 16px", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {admins.map(admin => (
                    <tr key={admin.id} style={{ borderTop: "1px solid #eef2f7" }}>
                      <td style={{ padding: "15px 16px" }}>
                        <strong>{admin.name}</strong>
                        <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{admin.id}</div>
                      </td>
                      <td style={{ padding: "15px 16px", color: "#344054" }}>{admin.email}</td>
                      <td style={{ padding: "15px 16px" }}>
                        <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: admin.adminType === "SUPER_ADMIN" ? "#111827" : "#eef2ff", color: admin.adminType === "SUPER_ADMIN" ? "#fff" : "#3730a3" }}>
                          {admin.adminType}
                        </span>
                      </td>
                      <td style={{ padding: "15px 16px" }}>
                        <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: admin.status === "ACTIVE" ? "#dcfce7" : admin.status === "SUSPENDED" ? "#fef3c7" : "#fee2e2", color: admin.status === "ACTIVE" ? "#166534" : admin.status === "SUSPENDED" ? "#92400e" : "#991b1b" }}>
                          {admin.status}
                        </span>
                      </td>
                      <td style={{ padding: "15px 16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {admin.permissions.length === 0 ? (
                            <span style={{ color: "#94a3b8", fontSize: 11 }}>No permissions</span>
                          ) : (
                            admin.permissions.slice(0, 4).map(p => (
                              <span key={p} style={{ background: "#eef2ff", color: "#3730a3", padding: "2px 8px", borderRadius: 999, fontSize: 9, fontWeight: 800 }}>
                                {p.replace(/_/g, " ")}
                              </span>
                            ))
                          )}
                          {admin.permissions.length > 4 && <span style={{ color: "#94a3b8", fontSize: 11, alignSelf: "center" }}>+{admin.permissions.length - 4} more</span>}
                        </div>
                      </td>
                      <td style={{ padding: "15px 16px", color: "#64748b", fontSize: 12 }}>{new Date(admin.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: "15px 16px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => startEdit(admin)} disabled={!isSuper || admin.adminType === "SUPER_ADMIN"} style={{ border: 0, borderRadius: 8, padding: "8px 12px", background: isSuper && admin.adminType !== "SUPER_ADMIN" ? "#2563eb" : "#94a3b8", color: "#fff", fontWeight: 700, fontSize: 12, cursor: isSuper && admin.adminType !== "SUPER_ADMIN" ? "pointer" : "not-allowed" }}>
                            Edit
                          </button>
                          {isSuper && admin.adminType !== "SUPER_ADMIN" && admin.id !== currentAdmin?.id && (
                            <button onClick={() => handleDelete(admin.id)} style={{ border: 0, borderRadius: 8, padding: "8px 12px", background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <style jsx>{`
          .admin-page-title { margin: 5px 0 0; font-size: 28px; font-weight: 800; }
          .admin-page-subtitle { margin: 7px 0 0; color: #64748b; font-size: 14px; }
          .admin-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 22px; box-shadow: 0 5px 20px rgba(15,23,42,.04); }
          @media (max-width: 900px) {
            .admin-card { padding: 18px; }
            form { grid-template-columns: 1fr; }
          }
        `}</style>
      </div>
    </AdminShell>
  );
}
