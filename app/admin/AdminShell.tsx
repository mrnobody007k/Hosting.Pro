"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminPermission } from "@/lib/admin-permissions";

interface AdminShellProps {
  children: React.ReactNode;
}

const allItems = [
  { label: "Dashboard", href: "/admin", permission: AdminPermission.VIEW_DASHBOARD },
  { label: "Managers", href: "/admin/managers", permission: AdminPermission.MANAGE_MANAGERS },
  { label: "Clients", href: "/admin/clients", permission: AdminPermission.MANAGE_USERS },
  { label: "Tasks", href: "/admin/tasks", permission: AdminPermission.MANAGE_TASKS },
  { label: "Properties", href: "/admin/properties", permission: AdminPermission.MANAGE_PROPERTIES },
  { label: "Orders", href: "/admin/orders", permission: AdminPermission.MANAGE_ORDERS },
  { label: "Deposits", href: "/admin/deposits", permission: AdminPermission.MANAGE_DEPOSITS },
  { label: "Withdrawals", href: "/admin/withdrawals", permission: AdminPermission.MANAGE_WITHDRAWALS },
  { label: "Activity", href: "/admin/activity", permission: AdminPermission.VIEW_ACTIVITY },
  { label: "Settings", href: "/admin/settings", permission: AdminPermission.MANAGE_PLATFORM_SETTINGS },
  { label: "Admin Access", href: "/admin/access", permission: AdminPermission.MANAGE_LOGIN_ACCESS },
];

const superAdminOnlyItems = [
  { label: "Admin Accounts", href: "/admin/accounts", permission: AdminPermission.MANAGE_ADMIN_ACCOUNTS },
];

function navGlyph(label: string) {
  const glyphs: Record<string, string> = {
    Dashboard: "⌂", Managers: "M", Clients: "C", Tasks: "✓", Properties: "⌂", Orders: "▣",
    Deposits: "↓", Withdrawals: "↑", Activity: "◴", Settings: "⚙", "Admin Access": "A", "Admin Accounts": "U"
  }
  return glyphs[label] || "•"
}

function hasPermission(permissions: string[], adminType: string, required: AdminPermission): boolean {
  if (!permissions) return false;
  if (adminType === "SUPER_ADMIN") return true;
  return permissions.includes(required);
}

type AdminInfo = {
  name: string;
  email: string;
  adminType: string;
  permissions: string[];
  status: string;
  createdAt: string;
} | null;

export default function AdminShell({
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const [adminInfo, setAdminInfo] = useState<AdminInfo>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminInfo() {
      try {
        const res = await fetch("/api/admin/me", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          setAdminInfo(json.admin);
        } else {
          setAdminInfo(null);
        }
      } catch {
        setAdminInfo(null);
      } finally {
        setLoading(false);
      }
    }
    loadAdminInfo();
  }, []);

  if (loading) {
    return (
      <div className="hp-admin" style={{ minHeight: "100vh", display: "flex" }}>
        <aside className="hp-sidebar" style={{ width: 258, minHeight: "100vh", background: "#101827", padding: "22px 14px" }}>
          <div className="hp-brand" style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 10px 24px" }}>
            <div className="hp-logo-mark" style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "white", fontSize: 19, fontWeight: 800 }}>H</div>
            <div><div className="hp-brand-name" style={{ color: "white", fontSize: 17, fontWeight: 800 }}>Housing.pro</div><div className="hp-brand-sub" style={{ color: "#718096", fontSize: 9, fontWeight: 700, letterSpacing: "1.2px", marginTop: 2 }}>Housing.pro · Admin Center</div></div>
          </div>
          <nav className="hp-shell-nav" style={{ display: "grid", gap: 5, marginTop: 22 }}>
            <div style={{ padding: "12px 13px", color: "#94a3b8" }}>Loading...</div>
          </nav>
        </aside>
        <div className="hp-main" style={{ width: "calc(100% - 258px)", marginLeft: 258, minHeight: "100vh" }}>
          <header className="hp-header" style={{ height: 76, padding: "0 32px", background: "#fff", borderBottom: "1px solid #e7ebf2", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div><span className="hp-breadcrumb" style={{ display: "block", color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Administration</span><h1>Housing.pro Admin Center</h1></div>
          </header>
          <div className="hp-content" style={{ padding: 30, maxWidth: 1600 }}>{children}</div>
        </div>
      </div>
    );
  }

  const permissions = adminInfo?.permissions || [];
  const adminType = adminInfo?.adminType || "STAFF_ADMIN";

  const visibleItems = allItems.filter(item => hasPermission(permissions, adminType, item.permission));
  const visibleSuperItems = superAdminOnlyItems.filter(item => hasPermission(permissions, adminType, item.permission));

  return (
    <div className="hp-admin">
      <aside className="hp-sidebar">
        <div className="hp-brand">
          <div className="hp-logo-mark">H</div>
          <div>
            <div className="hp-brand-name">Housing.pro</div>
            <div className="hp-brand-sub">Housing.pro · Admin Center</div>
          </div>
        </div>

        <div className="hp-nav-label">MAIN MENU</div>

        <nav className="hp-shell-nav">
          {visibleItems.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`hp-shell-nav-item ${active ? "active" : ""}`}
              >
                <span className="hp-shell-nav-icon">{navGlyph(item.label)}</span>{item.label}
              </Link>
            );
          })}

          {visibleSuperItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`hp-shell-nav-item ${active ? "active" : ""}`}
              >
                <span className="hp-shell-nav-icon">{navGlyph(item.label)}</span>{item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hp-tier-card">
          <div className="hp-tier-heading">3-Tier Platform</div>
          <div className="hp-tier-item active"><b>01</b><span>Admin Control</span></div>
          <div className="hp-tier-item"><b>02</b><span>Manager Workspace</span></div>
          <div className="hp-tier-item"><b>03</b><span>User Marketplace</span></div>
        </div>

        <div className="hp-sidebar-bottom">
          <div className="hp-secure-box">
            <div className="hp-secure-icon">✓</div>
            <div>
              <strong>{adminInfo?.name || "Administrator"}</strong>
              <span>{adminType === "SUPER_ADMIN" ? "Super Admin" : "Staff Admin"} · {adminInfo?.status || "ACTIVE"}</span>
            </div>
          </div>

          <form action="/api/auth/logout" method="post">
            <button className="hp-logout">
              <span>↪</span>
              Logout
            </button>
          </form>
        </div>
      </aside>

      <div className="hp-main">
        <header className="hp-header">
          <div>
            <div className="hp-breadcrumb">
              Admin <span>/</span> {pathname === "/admin" ? "Dashboard" : pathname.split("/").filter(Boolean).slice(-1)[0]?.replaceAll("-", " ") || "Admin"}
            </div>
            <h1>Housing.pro Admin Center</h1>
          </div>

          <Link href="/admin" className="hp-header-btn">
            Dashboard
          </Link>
        </header>

        <div className="hp-content">
          {children}
        </div>
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f5f7fb;
          color: #172033;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .hp-admin {
          min-height: 100vh;
          display: flex;
          background: #f5f7fb;
          color: #172033;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .hp-sidebar {
          width: 258px;
          min-height: 100vh;
          background: #101827;
          color: #cbd5e1;
          padding: 22px 14px;
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          z-index: 20;
        }

        .hp-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 4px 10px 24px;
        }

        .hp-logo-mark {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: white;
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 19px;
          box-shadow: 0 8px 22px rgba(37, 99, 235, .28);
        }

        .hp-brand-name {
          color: white;
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -.3px;
        }

        .hp-brand-sub {
          color: #718096;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.2px;
          margin-top: 2px;
        }

        .hp-sidebar-search {
          height: 40px;
          background: #182234;
          border: 1px solid #263246;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
          margin: 0 4px 22px;
        }

        .hp-sidebar-search span {
          color: #718096;
          font-size: 18px;
        }

        .hp-sidebar-search input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: white;
          font-size: 12px;
        }

        .hp-nav-label {
          font-size: 9px;
          color: #5f6c80;
          font-weight: 800;
          letter-spacing: 1.2px;
          padding: 0 12px 8px;
        }

        .hp-nav-space {
          margin-top: 19px;
        }

        .hp-shell-nav {
          display: grid;
          gap: 5px;
          margin-top: 22px;
        }

        .hp-shell-nav-item {
          display: block;
          padding: 12px 13px;
          border-radius: 9px;
          color: #9eabc0;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          transition: .15s ease;
        }

        .hp-shell-nav-item:hover {
          background: #182234;
          color: white;
        }

        .hp-shell-nav-item.active {
          background: linear-gradient(90deg, #1d4ed8, #2563eb);
          color: white;
          box-shadow: 0 7px 18px rgba(37, 99, 235, .18);
        }

        .hp-shell-nav-icon {
          width: 19px;
          text-align: center;
          font-size: 16px;
          opacity: .95;
        }

        .hp-tier-card {
          margin: 12px 4px 10px;
          padding: 11px;
          border: 1px solid #263246;
          border-radius: 13px;
          background: linear-gradient(180deg,#141e2e,#111a29);
        }
        .hp-tier-heading { margin: 0 5px 8px; color: #718096; font-size: 9px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; }
        .hp-tier-item { display:flex; align-items:center; gap:8px; padding:7px 5px; border-radius:8px; color:#8996aa; font-size:10px; font-weight:700; }
        .hp-tier-item b { width:22px; height:22px; display:grid; place-items:center; border-radius:6px; background:#1c2739; color:#aebbd0; font-size:9px; }
        .hp-tier-item.active { background:rgba(37,99,235,.15); color:#eef4ff; }
        .hp-tier-item.active b { background:#2563eb; color:#fff; }

        .hp-sidebar-bottom {
          margin-top: auto;
        }

        .hp-secure-box {
          margin: 8px 4px 14px;
          padding: 11px;
          border: 1px solid #263246;
          border-radius: 10px;
          background: #141e2e;
          display: flex;
          gap: 9px;
          align-items: center;
        }

        .hp-secure-icon {
          width: 27px;
          height: 27px;
          border-radius: 50%;
          background: #123c2d;
          color: #4ade80;
          display: grid;
          place-items: center;
          font-size: 13px;
        }

        .hp-secure-box strong,
        .hp-secure-box span {
          display: block;
        }

        .hp-secure-box strong {
          color: #dbe5f3;
          font-size: 11px;
        }

        .hp-secure-box span {
          color: #65748a;
          font-size: 9px;
          margin-top: 2px;
        }

        .hp-logout {
          width: 100%;
          height: 40px;
          border: 0;
          border-radius: 9px;
          background: #182234;
          color: #aab5c5;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 13px;
        }

        .hp-logout:hover {
          background: #202c40;
          color: white;
        }

        .hp-main {
          margin-left: 258px;
          width: calc(100% - 258px);
          min-width: 0;
          min-height: 100vh;
        }

        .hp-header {
          height: 76px;
          background: white;
          border-bottom: 1px solid #e7ebf2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .hp-breadcrumb {
          color: #8a96a8;
          font-size: 11px;
          margin-bottom: 4px;
        }

        .hp-breadcrumb span {
          margin: 0 7px;
          color: #c0c7d2;
        }

        .hp-header h1 {
          margin: 0;
          font-size: 17px;
          letter-spacing: -.3px;
        }

        .hp-header-btn {
          text-decoration: none;
          background: #111827;
          color: #fff;
          padding: 10px 15px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
        }

        .hp-content {
          padding: 30px 32px 20px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .hp-page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
        }

        .hp-page-subtitle {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .hp-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 22px;
          box-shadow: 0 5px 20px rgba(15,23,42,.04);
        }

        .hp-admin .admin-page-title, .hp-admin h2.admin-page-title {
          margin: 0; color: #172033; font-size: clamp(23px, 3vw, 30px); line-height: 1.2; letter-spacing: -.035em;
        }
        .hp-admin .admin-page-subtitle { margin: 7px 0 0; color: #64748b; font-size: 14px; line-height: 1.55; }
        .hp-admin .admin-card {
          min-width: 0; background: #fff; border: 1px solid #e4e9f1; border-radius: 14px;
          padding: 20px; box-shadow: 0 6px 22px rgba(16,24,40,.045);
        }
        .hp-admin input, .hp-admin select, .hp-admin textarea {
          max-width: 100%; color: #172033; font: inherit;
        }
        .hp-admin button { font: inherit; }
        .hp-admin table { width: 100%; border-collapse: collapse; }
        .hp-admin th { background: #f8fafc; color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .045em; text-align: left; }
        .hp-admin th, .hp-admin td { padding: 12px 14px; border-bottom: 1px solid #edf0f5; vertical-align: top; }
        .hp-admin td { color: #334155; font-size: 13px; }
        .hp-admin tr:last-child td { border-bottom: 0; }
        .hp-admin .hp-admin-table { min-width: 680px; }
        .hp-admin .hp-table-wrap { max-width: 100%; overflow-x: auto; }
        .hp-admin .hp-admin-table small { display: block; margin-top: 3px; color: #64748b; font-size: 11px; }
        .hp-admin-detail { max-width: 1500px; margin: 0 auto; min-width: 0; }
        .hp-admin-detail > a { color: #1d4ed8; font-size: 13px; font-weight: 750; text-decoration: none; }
        .admin-detail-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; margin:20px 0; }
        .admin-detail-heading p { margin:0 0 5px; color:#64748b; font-size:11px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; }
        .admin-detail-heading h1 { margin:0; color:#172033; font-size:clamp(24px,4vw,34px); letter-spacing:-.04em; }
        .admin-detail-heading span { color:#64748b; font-size:13px; }
        .hp-admin-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
        .hp-admin-kpis .admin-card { display:flex; flex-direction:column; gap:8px; }
        .hp-admin-kpis span { color:#64748b; font-size:12px; }
        .hp-admin-kpis strong { color:#172033; font-size:22px; overflow-wrap:anywhere; }
        .hp-badge { display:inline-flex; align-items:center; border-radius:999px; padding:6px 10px; font-size:11px!important; font-weight:800; }
        .hp-badge.success { color:#047857!important; background:#ecfdf5; }
        .hp-badge.warning { color:#a16207!important; background:#fffbeb; }
        .hp-form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:14px; }
        .hp-form-grid label { display:grid; gap:7px; color:#475569; font-size:12px; font-weight:750; }
        .hp-form-grid input, .hp-form-grid textarea { border:1px solid #d9e1ec; border-radius:9px; padding:10px 12px; }
        .hp-admin-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
        .hp-admin-actions button { border:0; border-radius:9px; padding:10px 14px; background:#1d4ed8; color:white; font-weight:750; cursor:pointer; }
        .hp-admin-actions button.danger { background:#fff; border:1px solid #fecaca; color:#b91c1c; }
        .hp-detail-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:16px; margin:0; }
        .hp-detail-grid div { min-width:0; }
        .hp-detail-grid dt { color:#64748b; font-size:12px; }
        .hp-detail-grid dd { margin:5px 0 0; color:#172033; font-size:14px; overflow-wrap:anywhere; }

        @media (max-width: 900px) {
          .hp-sidebar {
            width: 205px;
          }

          .hp-main {
            width: calc(100% - 205px);
            margin-left: 205px;
          }

          .hp-content {
            padding: 20px;
          }
        }

        @media (max-width: 680px) {
          .hp-sidebar {
            position: sticky;
            top: 0;
            width: 100%;
            min-height: auto;
            max-height: 44vh;
            overflow-y: auto;
            z-index: 30;
          }

          .hp-admin {
            display: block;
          }

          .hp-main {
            width: 100%;
            margin-left: 0;
          }

          .hp-shell-nav {
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          }

          .hp-header {
            padding: 15px 18px;
            height: auto;
            gap: 10px;
            align-items: flex-start;
          }

          .hp-content {
            padding: 18px;
          }
          .hp-admin .admin-card { padding: 16px; }
          .admin-detail-heading { flex-direction: column; }
          .hp-admin-actions button { flex: 1 1 auto; }
        }
      `}</style>
    </div>
  );
}
