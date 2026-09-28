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
      <div className="admin-shell" style={{ minHeight: "100vh", display: "flex" }}>
        <aside className="admin-sidebar" style={{ width: 250, minHeight: "100vh", background: "#111827", padding: "22px 14px" }}>
          <div className="admin-brand" style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 10px 26px", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
            <div className="admin-logo" style={{ width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", background: "#fff", color: "#111827", fontSize: 22, fontWeight: 900 }}>A</div>
            <div><strong>Housing.pro</strong><span style={{ display: "block", marginTop: 3, fontSize: 11, color: "#9ca3af" }}>Housing.pro · Admin Center</span></div>
          </div>
          <nav className="admin-nav" style={{ display: "grid", gap: 5, marginTop: 22 }}>
            <div style={{ padding: "12px 13px", color: "#94a3b8" }}>Loading...</div>
          </nav>
        </aside>
        <div className="admin-main" style={{ width: "calc(100% - 250px)", marginLeft: 250, minHeight: "100vh" }}>
          <header className="admin-header" style={{ height: 78, padding: "0 30px", background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div><span className="admin-header-kicker" style={{ display: "block", color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Administration</span><h1>Housing.pro Admin Center</h1></div>
          </header>
          <div className="admin-content" style={{ padding: 30, maxWidth: 1600 }}>{children}</div>
        </div>
      </div>
    );
  }

  const permissions = adminInfo?.permissions || [];
  const adminType = adminInfo?.adminType || "STAFF_ADMIN";

  const visibleItems = allItems.filter(item => hasPermission(permissions, adminType, item.permission));
  const visibleSuperItems = superAdminOnlyItems.filter(item => hasPermission(permissions, adminType, item.permission));

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-logo">A</div>
          <div>
            <strong>Housing.pro</strong>
            <span>Housing.pro · Admin Center</span>
          </div>
        </div>

        <nav className="admin-nav">
          {visibleItems.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "admin-nav-item active" : "admin-nav-item"}
              >
                <span className="admin-nav-icon">{navGlyph(item.label)}</span>{item.label}
              </Link>
            );
          })}

          {visibleSuperItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "admin-nav-item active" : "admin-nav-item"}
              >
                <span className="admin-nav-icon">{navGlyph(item.label)}</span>{item.label}
              </Link>
            );
          })}
        </nav>

        <div className="admin-tier-card">
          <div className="admin-tier-heading">3-Tier Platform</div>
          <div className="admin-tier-item active"><b>01</b><span>Admin Control</span></div>
          <div className="admin-tier-item"><b>02</b><span>Manager Workspace</span></div>
          <div className="admin-tier-item"><b>03</b><span>User Marketplace</span></div>
        </div>

        <div className="admin-sidebar-footer">
          <span>System Status</span>
          <strong>Operational</strong>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <div>
            <span className="admin-header-kicker">Administration</span>
            <h1>Housing.pro Admin Center</h1>
          </div>

          <Link href="/admin" className="admin-home-button">
            Dashboard
          </Link>
        </header>

        <div className="admin-content">
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
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
        }

        .admin-shell {
          min-height: 100vh;
          display: flex;
          background: #f5f7fb;
        }

        .admin-sidebar {
          width: 250px;
          min-height: 100vh;
          background: #111827;
          color: #fff;
          padding: 22px 14px;
          display: flex;
          flex-direction: column;
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
        }

        .admin-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px 10px 26px;
          border-bottom: 1px solid rgba(255,255,255,.1);
        }

        .admin-logo {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: #fff;
          color: #111827;
          font-size: 22px;
          font-weight: 900;
        }

        .admin-brand strong {
          display: block;
          font-size: 18px;
        }

        .admin-brand span {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          color: #9ca3af;
        }

        .admin-nav {
          display: grid;
          gap: 5px;
          margin-top: 22px;
        }

        .admin-nav-item {
          display: block;
          padding: 12px 13px;
          border-radius: 9px;
          color: #cbd5e1;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          transition: .15s ease;
        }

        .admin-nav-item:hover {
          background: rgba(255,255,255,.08);
          color: #fff;
        }

        .admin-nav-item.active {
          background: #fff;
          color: #111827;
        }


        .admin-nav-icon {
          width: 26px; height: 26px; flex: 0 0 26px; display: grid; place-items: center;
          border-radius: 8px; background: #182234; color: #9fb0c8; font-size: 12px; font-weight: 800;
        }
        .admin-nav-item.active .admin-nav-icon { background: #eef4ff; color: #1d4ed8; }
        .admin-tier-card { margin: 14px 4px 12px; padding: 11px; border: 1px solid #263246; border-radius: 12px; background: #141e2e; }
        .admin-tier-heading { margin: 0 5px 8px; color: #718096; font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
        .admin-tier-item { display: flex; align-items: center; gap: 8px; padding: 7px 5px; border-radius: 8px; color: #8f9db1; font-size: 10px; font-weight: 700; }
        .admin-tier-item b { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px; background: #1c2739; color: #9fb0c8; font-size: 9px; }
        .admin-tier-item.active { background: rgba(37,99,235,.15); color: #eef4ff; }
        .admin-tier-item.active b { background: #2563eb; color: #fff; }

        .admin-sidebar-footer {
          margin-top: auto;
          padding: 15px 12px;
          border-top: 1px solid rgba(255,255,255,.1);
          font-size: 11px;
          color: #9ca3af;
        }

        .admin-sidebar-footer strong {
          display: block;
          color: #86efac;
          margin-top: 4px;
        }

        .admin-main {
          width: calc(100% - 250px);
          margin-left: 250px;
          min-height: 100vh;
        }

        .admin-header {
          height: 78px;
          padding: 0 30px;
          background: #fff;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .admin-header-kicker {
          display: block;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 4px;
        }

        .admin-header h1 {
          margin: 0;
          font-size: 19px;
        }

        .admin-home-button {
          text-decoration: none;
          background: #111827;
          color: #fff;
          padding: 10px 15px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
        }

        .admin-content {
          padding: 30px;
          max-width: 1600px;
        }

        .admin-page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
        }

        .admin-page-subtitle {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .admin-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 22px;
          box-shadow: 0 5px 20px rgba(15,23,42,.04);
        }

        @media (max-width: 900px) {
          .admin-sidebar {
            width: 205px;
          }

          .admin-main {
            width: calc(100% - 205px);
            margin-left: 205px;
          }

          .admin-content {
            padding: 20px;
          }
        }

        @media (max-width: 680px) {
          .admin-sidebar {
            position: static;
            width: 100%;
            min-height: auto;
          }

          .admin-shell {
            display: block;
          }

          .admin-main {
            width: 100%;
            margin-left: 0;
          }

          .admin-nav {
            grid-template-columns: repeat(2, 1fr);
          }

          .admin-header {
            padding: 15px 18px;
            height: auto;
          }

          .admin-content {
            padding: 18px;
          }
        }
      `}</style>
    </div>
  );
}