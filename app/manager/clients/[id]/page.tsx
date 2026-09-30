"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ManagerShell from "../../ManagerShell";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  clientDay: number | null;
  membershipStatus: string;
  signupStatus: string;
  createdAt: string;
  status: string;
  wallet?: { balance: number | string; reservedBalance: number | string } | null;
};
type ClientDetail = { client: Client | null; manager: { name: string } | null; orders?: Array<{ id: string; orderCode: string; amount: string; status: string; paymentStatus: string; createdAt: string; property?: { title: string } }>; tasks?: Array<{ id: string; title: string; dayNumber: number; status: string; profitAmount: string }>; deposits?: Array<{ id: string; amount: string; status: string; createdAt: string }>; withdrawals?: Array<{ id: string; amount: string; status: string; createdAt: string }>; notifications?: Array<{ id: string; title: string; isRead: boolean; createdAt: string }> };

export default function ClientDetailPage() {
  const p = useParams<{ id: string }>();
  const [data, setData] = useState<ClientDetail>({ client: null, manager: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const r = await fetch(`/api/manager/clients/${encodeURIComponent(p.id)}`, { cache: "no-store" });
        if (r.status === 401) { window.location.href = "/manager-login"; return; }
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Unable to load this client.");
        setData(j);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load this client.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [p.id]);

  async function handleSync() {
    if (!data.client) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/manager/clients/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.client.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Sync failed");
      setSyncResult("Client synced successfully. Day: " + json.day + ", Membership: " + json.membershipStatus);
    } catch (e) {
      setSyncResult("Error: " + (e instanceof Error ? e.message : "Sync failed"));
    } finally {
      setSyncing(false);
    }
  }

  const c = data.client;

  if (loading) {
    return <ManagerShell managerName={data.manager?.name || "Manager"}><div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading client...</div></ManagerShell>;
  }

  if (!c) {
    return <ManagerShell managerName={data.manager?.name || "Manager"}><div className="cd-empty" role={error ? "alert" : undefined}>{error || "This client was not found under your manager account."}</div></ManagerShell>;
  }

  const syncAlertStyle: React.CSSProperties = {
    marginTop: 16,
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 13,
  } as const;

  return (
    <ManagerShell managerName={data.manager?.name || "Manager"}>
      <div className="cd-head">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <span>CLIENT PROFILE</span>
            <h1>{c.name}</h1>
            <p>Manager-scoped client record and platform-day overview.</p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              border: 0,
              borderRadius: 9,
              padding: "10px 16px",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 700,
              cursor: syncing ? "wait" : "pointer",
            }}
          >
            {syncing ? "Syncing..." : "Refresh / Sync"}
          </button>
        </div>
      </div>

      {syncResult && (
        <div
          style={{
            ...syncAlertStyle,
            background: syncResult.startsWith("Error") ? "#fef2f2" : "#f0fdf4",
            border: syncResult.startsWith("Error") ? "1px solid #fecaca" : "1px solid #bbf7d0",
            color: syncResult.startsWith("Error") ? "#b91c1c" : "#166534",
          }}
        >
          {syncResult}
        </div>
      )}

      <section className="cd-grid">
        {[
          ["Email", c.email],
          ["Phone", c.phone],
          ["Client Day", c.clientDay ?? "—"],
          ["Membership", c.membershipStatus || c.signupStatus],
          ["Joined", c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB") : "—"],
          ["Status", c.status],
          ["Balance", c.wallet ? c.wallet.balance.toString() : "—"],
        ].map(([a, b]) => (
          <div key={String(a)}><small>{a}</small><strong>{b ?? "—"}</strong></div>
        ))}
      </section>
      <div className="cd-sections">
        {[["Recent orders", data.orders?.map((row) => `${row.orderCode} · ${row.property?.title || "Property"} · ${row.status} · ₹${row.amount}`)], ["Recent tasks", data.tasks?.map((row) => `${row.title} · Day ${row.dayNumber} · ${row.status}`)], ["Deposits", data.deposits?.map((row) => `₹${row.amount} · ${row.status}`)], ["Withdrawals", data.withdrawals?.map((row) => `₹${row.amount} · ${row.status}`)], ["Notifications", data.notifications?.map((row) => `${row.title} · ${row.isRead ? "Read" : "Unread"}`)]].map(([title, rows]) => <section key={String(title)}><h2>{title}</h2>{Array.isArray(rows) && rows.length ? rows.map((row, index) => <p key={`${title}-${index}`}>{row}</p>) : <p>No records.</p>}</section>)}
      </div>

      <style jsx global>{`
        .cd-head {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 20px;
        }
        .cd-head > div {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }
        .cd-head span { font-size: 11px; font-weight: 800; letter-spacing: .12em; color: #64748b; }
        .cd-head h1 { margin: 5px 0; font-size: 30px; }
        .cd-head p { margin: 0 0 20px; color: #64748b; font-size: 13px; }
        .cd-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        .cd-grid > div { background: #fff; border: 1px solid #e5e7eb; border-radius: 15px; padding: 18px; }
        .cd-sections{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}.cd-sections section{min-width:0;background:#fff;border:1px solid #e5e7eb;border-radius:15px;padding:18px}.cd-sections h2{margin:0 0 10px;font-size:15px}.cd-sections p{padding:9px 0;margin:0;border-top:1px solid #eef2f7;color:#475467;font-size:11px;overflow-wrap:anywhere}.cd-sections p:first-of-type{border-top:0}@media(max-width:650px){.cd-sections{grid-template-columns:1fr}}
        .cd-grid small, .cd-grid strong { display: block; }
        .cd-grid small { font-size: 10px; color: #64748b; }
        .cd-grid strong { margin-top: 7px; font-size: 14px; }
        .cd-empty { margin-top: 18px; background: #fff; border: 1px solid #e5e7eb; border-radius: 15px; padding: 40px; text-align: center; color: #64748b; }
        @media (max-width: 650px) { .cd-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>
    </ManagerShell>
  );
}
