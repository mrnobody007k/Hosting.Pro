"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ManagerShell from "../ManagerShell";
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
  clientDay?: number | null;
  wallet?: { balance?: number | string | null } | null;
};

type Overview = {
  manager?: { name?: string };
  stats?: { totalClients?: number; activeClients?: number; officialMembers?: number };
  clients?: Client[];
  pendingSignups?: unknown[];
};

function money(v: unknown) {
  let amount: Decimal;
  try { amount = new Decimal(String(v ?? 0)); } catch { amount = new Decimal(0); }
  if (!amount.isFinite()) amount = new Decimal(0);
  const [integer, fraction] = amount.abs().toFixed(2).split(".");
  const grouped = integer.length <= 3 ? integer : `${integer.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${integer.slice(-3)}`;
  return `${amount.isNegative() ? "-" : ""}₹${grouped}.${fraction}`;
}

function date(v?: string | null) {
  return v
    ? new Date(v).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
}

function badge(v?: string) {
  const s = String(v || "").toUpperCase();
  if (["ACTIVE", "APPROVED", "OFFICIAL_MEMBER"].includes(s))
    return "mc-badge mc-green";
  if (["PENDING", "DAY_1", "DAY_2"].includes(s))
    return "mc-badge mc-yellow";
  if (["DISABLED", "SUSPENDED", "REJECTED"].includes(s))
    return "mc-badge mc-red";
  return "mc-badge";
}

export default function ManagerClientsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/manager/overview", { cache: "no-store" });
    if (res.status === 401) {
      window.location.href="/manager-login";
      return;
    }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const clients = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (data?.clients || []).filter((c) =>
      !q
        ? true
        : [c.name, c.email, c.phone, c.membershipStatus, c.signupStatus]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
    );
  }, [data, search]);

  return (
    <ManagerShell
      managerName={data?.manager?.name || "Manager"}
      notificationCount={(data?.pendingSignups || []).length}
    >
      <div className="mc-head">
        <div>
          <span>CLIENT MANAGEMENT</span>
          <h1>My Clients</h1>
          <p>Clients registered through your Housing.pro referral are shown here.</p>
        </div>
        <button className="mc-btn" onClick={load}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="mc-stats">
        <div><small>Total Clients</small><strong>{data?.stats?.totalClients ?? clients.length}</strong></div>
        <div><small>Active</small><strong>{data?.stats?.activeClients ?? 0}</strong></div>
        <div><small>Official Members</small><strong>{data?.stats?.officialMembers ?? 0}</strong></div>
      </div>

      <section className="mc-panel">
        <div className="mc-toolbar">
          <div>
            <h2>Client Directory</h2>
            <p>Search and review your assigned clients.</p>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone..."
          />
        </div>

        <div className="mc-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Client Day</th>
                <th>Membership</th>
                <th>Wallet</th>
                <th>Joined</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <small>{c.email}</small>
                    {c.phone && <small>{c.phone}</small>}
                  </td>
                  <td>{c.clientDay ?? "—"}</td>
                  <td><span className={badge(c.membershipStatus)}>{c.membershipStatus || "PENDING"}</span></td>
                  <td>{money(c.wallet?.balance)}</td>
                  <td>{date(c.createdAt)}</td>
                  <td><span className={badge(c.status)}>{c.status || "ACTIVE"}</span></td>
                  <td><Link href={`/manager/clients/${c.id}`}>View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!clients.length && <div className="mc-empty">No clients found.</div>}
        </div>
      </section>

      <style jsx global>{`
        .mc-head{display:flex;justify-content:space-between;gap:20px;margin-bottom:20px}
        .mc-head span{font-size:11px;font-weight:800;letter-spacing:.12em;color:#64748b}
        .mc-head h1{margin:5px 0;font-size:30px;color:#0f172a}
        .mc-head p{margin:0;color:#64748b;font-size:13px}
        .mc-btn{border:0;border-radius:9px;background:#0f172a;color:white;padding:10px 15px;font-weight:800;cursor:pointer;height:38px}
        .mc-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px}
        .mc-stats div,.mc-panel{background:white;border:1px solid #e5e7eb;border-radius:15px;box-shadow:0 5px 20px rgba(15,23,42,.04)}
        .mc-stats div{padding:18px}
        .mc-stats small,.mc-stats strong{display:block}
        .mc-stats small{color:#64748b;font-size:11px}
        .mc-stats strong{margin-top:7px;font-size:25px;color:#0f172a}
        .mc-panel{padding:20px}
        .mc-toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;margin-bottom:17px}
        .mc-toolbar h2{margin:0 0 5px;font-size:18px}
        .mc-toolbar p{margin:0;color:#64748b;font-size:12px}
        .mc-toolbar input{height:38px;width:270px;border:1px solid #dbe1ea;border-radius:9px;padding:0 12px;outline:0}
        .mc-table-wrap{overflow:auto;border:1px solid #eef2f7;border-radius:11px}
        .mc-table-wrap table{width:100%;min-width:850px;border-collapse:collapse}
        .mc-table-wrap th{background:#f8fafc;padding:11px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase}
        .mc-table-wrap td{padding:13px 11px;border-top:1px solid #eef2f7;font-size:12px;color:#334155}
        .mc-table-wrap td strong,.mc-table-wrap td small{display:block}
        .mc-table-wrap td small{color:#64748b;margin-top:3px;font-size:10px}
        .mc-table-wrap a{color:#2563eb;text-decoration:none;font-weight:800}
        .mc-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:9px;font-weight:800}
        .mc-green{background:#dcfce7;color:#166534}.mc-yellow{background:#fef3c7;color:#92400e}.mc-red{background:#fee2e2;color:#991b1b}
        .mc-empty{text-align:center;padding:35px;color:#64748b;font-size:13px}
        @media(max-width:700px){.mc-head,.mc-toolbar{flex-direction:column}.mc-stats{grid-template-columns:1fr}.mc-toolbar input{width:100%}}
      `}</style>
    </ManagerShell>
  );
}

