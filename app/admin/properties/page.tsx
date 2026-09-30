"use client";

import { useEffect, useMemo, useState } from "react";
import { Decimal } from "decimal.js";
import AdminShell from "../AdminShell";

type Property = {
  id: string;
  title: string;
  location: string | null;
  description: string | null;
  price: number | string;
  imageUrl: string | null;
  propertyUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  manager: {
    id: string;
    name: string;
    referralCode: string;
  } | null;
  _count: {
    orders: number;
  };
};
type PropertyStats = { total: number; active: number; inactive: number; soldOut: number; totalOrders: number };

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", location: "", description: "", price: "", imageUrl: "", propertyUrl: "", status: "ACTIVE" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [propertyStats, setPropertyStats] = useState<PropertyStats>({ total: 0, active: 0, inactive: 0, soldOut: 0, totalOrders: 0 });

  async function loadProperties(cursor?: string, append = false) {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      setError("");

      const params = new URLSearchParams({ limit: "100", search: search.trim(), status });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/admin/properties?${params}`, { cache: "no-store" });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load properties");
      }

      setProperties((current) => append ? [...current, ...(json.properties || [])] : (json.properties || []));
      setPropertyStats(json.stats || { total: 0, active: 0, inactive: 0, soldOut: 0, totalOrders: 0 });
      setNextCursor(json.nextCursor || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load properties"
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProperties(); }, search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [search, status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return properties.filter((property) => {
      const matchesSearch =
        !q ||
        property.title.toLowerCase().includes(q) ||
        (property.location || "").toLowerCase().includes(q) ||
        (property.manager?.name || "").toLowerCase().includes(q) ||
        (property.manager?.referralCode || "").toLowerCase().includes(q);

      const matchesStatus =
        status === "ALL" || property.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [properties, search, status]);

  async function createProperty() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/properties", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingId ? { ...form, id: editingId } : form) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Unable to create property");
      setForm({ title: "", location: "", description: "", price: "", imageUrl: "", propertyUrl: "", status: "ACTIVE" });
      setEditingId(null);
      setShowCreate(false);
      setSuccess(editingId ? "Property updated." : "Property created.");
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create property");
    } finally { setSaving(false); }
  }

  function editProperty(property: Property) {
    setEditingId(property.id);
    setForm({ title: property.title, location: property.location || "", description: property.description || "", price: String(property.price), imageUrl: property.imageUrl || "", propertyUrl: property.propertyUrl || "", status: property.status });
    setShowCreate(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleStatus(property: Property) {
    const next = property.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (!window.confirm(`Set ${property.title} to ${next.toLowerCase()}?`)) return;
    try {
      const res = await fetch("/api/admin/properties", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: property.id, status: next }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Unable to update property");
      setSuccess(`Property ${next.toLowerCase()}.`);
      await loadProperties();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update property"); }
  }

  return (
    <AdminShell>
      <div>
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
            <h2 className="admin-page-title">Properties</h2>
            <p className="admin-page-subtitle">
              Property inventory, pricing, ownership and order activity.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setEditingId(null); setForm({ title: "", location: "", description: "", price: "", imageUrl: "", propertyUrl: "", status: "ACTIVE" }); setShowCreate((v) => !v); }} style={{ border: 0, borderRadius: 9, padding: "10px 16px", background: "#2563eb", color: "#fff", fontWeight: 800, cursor: "pointer" }}>{showCreate ? "Close" : "+ Add Property"}</button>
            <button onClick={() => loadProperties()} disabled={loading} style={{ border: 0, borderRadius: 9, padding: "10px 16px", background: "#111827", color: "#fff", fontWeight: 700, cursor: loading ? "wait" : "pointer" }}>{loading ? "Loading..." : "Refresh"}</button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 16,
            marginTop: 24,
          }}
        >
          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Total Properties
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {propertyStats.total}
            </div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Active
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                marginTop: 8,
                color: "#166534",
              }}
            >
              {propertyStats.active}
            </div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Sold Out
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {propertyStats.soldOut}
            </div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Inactive
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {propertyStats.inactive}
            </div>
          </div>

          <div className="admin-card">
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Total Orders
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
              {propertyStats.totalOrders}
            </div>
          </div>
        </div>

        <div
          className="admin-card"
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "minmax(250px,1fr) 180px",
            gap: 12,
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search property, location or manager..."
            style={{
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              outline: "none",
            }}
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              padding: "11px 13px",
              border: "1px solid #dbe1e8",
              borderRadius: 9,
              background: "#fff",
            }}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SOLD_OUT">Sold Out</option>
          </select>
        </div>

        {showCreate && (
          <div className="admin-card" style={{ marginTop: 20 }}>
            <strong style={{ fontSize: 16 }}>{editingId ? "Edit Property" : "Create Property"}</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12, marginTop: 14 }}>
              {([["title","Property title"],["location","Location"],["price","Price"],["imageUrl","Image URL"],["propertyUrl","Property URL"]] as const).map(([key,label]) => (
                <input key={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={label} style={{ padding: "11px 13px", border: "1px solid #dbe1e8", borderRadius: 9 }} />
              ))}
              <textarea aria-label="Property description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Property description" rows={3} maxLength={4000} style={{ gridColumn: "1 / -1", padding: "11px 13px", border: "1px solid #dbe1e8", borderRadius: 9, resize: "vertical" }} />
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ padding: "11px 13px", border: "1px solid #dbe1e8", borderRadius: 9, background: "#fff" }}>
                <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SOLD_OUT">Sold Out</option>
              </select>
            </div>
            <button onClick={createProperty} disabled={saving} style={{ marginTop: 14, border: 0, borderRadius: 9, padding: "10px 16px", background: "#111827", color: "#fff", fontWeight: 800 }}>{saving ? "Saving..." : editingId ? "Save Property" : "Create Property"}</button>
          </div>
        )}

        {success && <div role="status" className="admin-card" style={{ marginTop: 16, color: "#047857" }}>{success}</div>}
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
            {error}
          </div>
        )}

        <div className="admin-card" style={{ marginTop: 24, padding: 0 }}>
          <div
            style={{
              padding: "20px 22px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <strong>Property Inventory</strong>
            <span style={{ color: "#64748b", fontSize: 13 }}>
              Showing {filtered.length} of {properties.length}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 1100,
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    "Property",
                    "Location",
                    "Manager",
                    "Price",
                    "Orders",
                    "Status",
                    "Created",
                    "Action",
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
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: 45,
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      No properties match the current filters.
                    </td>
                  </tr>
                )}

                {filtered.map((property) => (
                  <tr
                    key={property.id}
                    style={{ borderTop: "1px solid #eef2f7" }}
                  >
                    <td style={{ padding: "15px 16px" }}>
                      <strong>{property.title}</strong>
                      {property.description && (
                        <div
                          style={{
                            color: "#64748b",
                            fontSize: 12,
                            marginTop: 4,
                            maxWidth: 300,
                          }}
                        >
                          {property.description.slice(0, 80)}
                          {property.description.length > 80 ? "..." : ""}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: "15px 16px", color: "#475569" }}>
                      {property.location || "—"}
                    </td>

                    <td style={{ padding: "15px 16px" }}>
                      {property.manager ? (
                        <>
                          <strong>{property.manager.name}</strong>
                          <div
                            style={{
                              color: "#64748b",
                              fontSize: 11,
                              marginTop: 4,
                            }}
                          >
                            {property.manager.referralCode}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: "#64748b" }}>
                          Global Property
                        </span>
                      )}
                    </td>

                    <td
                      style={{
                        padding: "15px 16px",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      ₹{new Decimal(String(property.price)).toFixed(2)}
                    </td>

                    <td style={{ padding: "15px 16px" }}>
                      {property._count.orders}
                    </td>

                    <td style={{ padding: "15px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "5px 9px",
                          borderRadius: 999,
                          background:
                            property.status === "ACTIVE"
                              ? "#dcfce7"
                              : property.status === "SOLD_OUT"
                                ? "#fef3c7"
                                : "#f1f5f9",
                          color:
                            property.status === "ACTIVE"
                              ? "#166534"
                              : property.status === "SOLD_OUT"
                                ? "#92400e"
                                : "#475569",
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {property.status.replaceAll("_", " ")}
                      </span>
                    </td>

                    <td style={{ padding: "15px 16px", color: "#64748b", whiteSpace: "nowrap" }}>
                      {new Date(property.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "15px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => editProperty(property)} style={{ border: "1px solid #dbe1e8", background: "#fff", borderRadius: 8, padding: "7px 10px", fontWeight: 700, cursor: "pointer" }}>Edit</button>
                        <button onClick={() => toggleStatus(property)} style={{ border: "1px solid #dbe1e8", background: "#fff", borderRadius: 8, padding: "7px 10px", fontWeight: 700, cursor: "pointer" }}>
                          {property.status === "ACTIVE" ? "Disable" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor && <div style={{ padding: 16, textAlign: "center" }}><button onClick={() => loadProperties(nextCursor, true)} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more properties"}</button></div>}
        </div>
      </div>
    </AdminShell>
  );
}
