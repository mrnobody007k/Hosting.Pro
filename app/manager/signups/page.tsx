"use client";

import { useEffect, useState } from "react";
import ManagerShell from "../ManagerShell";

type Signup = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  createdAt?: string;
  clientDay?: number | null;
};

type Data = {
  manager?: { name?: string };
  stats?: { pendingSignups?: number };
  pendingSignups?: Signup[];
};

function date(v?: string) {
  return v ? new Date(v).toLocaleString("en-GB") : "—";
}

export default function SignupsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(cursor?: string) {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ status: "PENDING" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/manager/clients?${params}`, { cache: "no-store" });
      if (res.status === 401) { window.location.href="/manager-login"; return; }
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load pending signups.");
      setData((current) => ({ manager: result.manager, stats: result.stats, pendingSignups: cursor ? [...(current?.pendingSignups || []), ...(result.clients || [])] : result.clients }));
      setNextCursor(result.nextCursor || null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load pending signups."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
  }, []);

  async function action(userId: string, action: "APPROVE" | "REJECT") {
    setError(""); setNotice("");
    setBusy(userId);
    try {
      const res = await fetch("/api/manager/signups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Signup action failed.");
      setNotice(action === "APPROVE" ? "Signup approved; the INR 120 welcome credit was recorded." : "Signup rejected.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Signup action failed."); }
    finally { setBusy(""); }
  }

  const signups = data?.pendingSignups || [];

  return (
    <ManagerShell
      managerName={data?.manager?.name || "Manager"}
      notificationCount={data?.stats?.pendingSignups ?? signups.length}
    >
      <div className="sg-head">
        <div><span>SIGNUP REVIEW</span><h1>New Signups</h1><p>Review registrations assigned to your referral.</p></div>
        <button onClick={() => void load()} disabled={loading}>Refresh</button>
      </div>

      {error && <div className="sg-feedback error" role="alert">{error}</div>}{notice && <div className="sg-feedback success" role="status">{notice}</div>}

      <section className="sg-panel">
        {loading && signups.length === 0 ? <div className="sg-empty">Loading pending signups…</div> : signups.length === 0 ? (
          <div className="sg-empty"><strong>No pending signups</strong><p>New registrations will appear here.</p></div>
        ) : signups.map((s) => (
          <div className="sg-row" key={s.id}>
            <div className="sg-avatar">{s.name.charAt(0).toUpperCase()}</div>
            <div className="sg-main">
              <strong>{s.name}</strong>
              <span>{s.email}</span>
              <small>{s.phone || "No phone"} · Registered {date(s.createdAt)}</small>
            </div>
            <div className="sg-day">Client Day <strong>{s.clientDay ?? 1}</strong></div>
            <div className="sg-actions">
              <button className="approve" disabled={busy === s.id} onClick={() => action(s.id,"APPROVE")}>Approve</button>
              <button className="reject" disabled={busy === s.id} onClick={() => action(s.id,"REJECT")}>Reject</button>
            </div>
          </div>
        ))}
        {nextCursor && <div className="sg-more"><button disabled={loading} onClick={() => void load(nextCursor)}>Load more signups</button></div>}
      </section>

      <style jsx global>{`
        .sg-head{display:flex;justify-content:space-between;gap:20px;margin-bottom:20px}.sg-head span{font-size:11px;font-weight:800;letter-spacing:.12em;color:#64748b}.sg-head h1{margin:5px 0;font-size:30px}.sg-head p{margin:0;color:#64748b;font-size:13px}.sg-head button{height:38px;border:0;border-radius:9px;background:#0f172a;color:white;padding:0 15px;font-weight:800}.sg-feedback{margin-bottom:12px;padding:12px;border-radius:9px;font-size:12px}.sg-feedback.error{background:#fef2f2;color:#991b1b}.sg-feedback.success{background:#f0fdf4;color:#166534}.sg-more{text-align:center;padding:14px}.sg-more button{padding:9px 13px;border:1px solid #dbe1ea;border-radius:8px;background:#fff}
        .sg-panel{background:white;border:1px solid #e5e7eb;border-radius:15px;padding:8px 20px;box-shadow:0 5px 20px rgba(15,23,42,.04)}
        .sg-row{display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid #eef2f7}.sg-row:last-child{border-bottom:0}.sg-avatar{width:42px;height:42px;border-radius:12px;background:#e2e8f0;display:grid;place-items:center;font-weight:850}.sg-main{flex:1;min-width:0}.sg-main strong,.sg-main span,.sg-main small{display:block}.sg-main span{font-size:12px;color:#64748b;margin-top:2px}.sg-main small{font-size:10px;color:#94a3b8;margin-top:4px}.sg-day{font-size:10px;color:#64748b;text-align:center}.sg-day strong{display:block;color:#0f172a;font-size:17px;margin-top:3px}.sg-actions{display:flex;gap:7px}.sg-actions button{border:0;border-radius:8px;padding:9px 12px;font-size:11px;font-weight:800;cursor:pointer}.approve{background:#dcfce7;color:#166534}.reject{background:#fee2e2;color:#991b1b}.sg-empty{text-align:center;padding:55px;color:#64748b}.sg-empty strong{display:block;color:#334155}.sg-empty p{font-size:12px}@media(max-width:700px){.sg-head{flex-direction:column}.sg-row{align-items:flex-start;flex-wrap:wrap}.sg-actions{width:100%}}
      `}</style>
    </ManagerShell>
  );
}
