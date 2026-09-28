"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

const managerGroups = [
  {
    title: "Workspace",
    items: [
      { label: "Dashboard", href: "/manager" },
      { label: "My Clients", href: "/manager/clients" },
      { label: "New Signups", href: "/manager/signups" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Orders", href: "/manager/orders" },
      { label: "Tasks", href: "/manager/tasks" },
      { label: "Properties", href: "/manager/properties" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Deposits", href: "/manager/deposits" },
      { label: "Withdrawals", href: "/manager/withdrawals" },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Referrals", href: "/manager/referrals" },
      { label: "Statistics", href: "/manager/statistics" },
      { label: "Activity", href: "/manager/activity" },
    ],
  },
]

function navGlyph(label: string) {
  const glyphs: Record<string, string> = {
    Dashboard: "⌂",
    "My Clients": "C",
    "New Signups": "+",
    Orders: "▣",
    Tasks: "✓",
    Properties: "⌂",
    Deposits: "↓",
    Withdrawals: "↑",
    Referrals: "↗",
    Statistics: "◷",
    Activity: "◴",
    Wallet: "₹",
    "My Orders": "▣",
    Progress: "◍",
    Notifications: "•",
    Profile: "◉",
    Referral: "↗",
    Support: "○",
    Settings: "⚙",
  }
  return glyphs[label] || "•"
}

export default function ManagerShell({
  children,
  managerName = "Manager",
  notificationCount = 0,
}: {
  children: React.ReactNode
  managerName?: string
  notificationCount?: number
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const initial = managerName.charAt(0).toUpperCase()

  function isActive(href: string) {
    if (href === "/manager") return pathname === "/manager"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      window.location.href="/manager-login"
    }
  }

  return (
    <div className="hp-manager-shell">
      {mobileOpen && (
        <button
          className="hp-shell-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`hp-manager-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="hp-shell-brand">
          <div className="hp-shell-logo">H</div>
          <div>
            <strong>Housing.pro</strong>
            <span>Housing.pro · Manager Center</span>
          </div>
        </div>

        <div className="hp-manager-account">
          <div className="hp-shell-avatar">{initial}</div>
          <div className="hp-manager-account-copy">
            <strong>{managerName}</strong>
            <span>Manager Account</span>
          </div>
        </div>

        <nav className="hp-shell-nav">
          {managerGroups.map((group) => (
            <div className="hp-shell-nav-group" key={group.title}>
              <div className="hp-shell-nav-title">{group.title}</div>

              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`hp-shell-nav-item ${
                    isActive(item.href) ? "active" : ""
                  }`}
                >
                  <span className="hp-shell-nav-icon">{navGlyph(item.label)}</span>
                  <span>{item.label}</span>
                  {item.label === "New Signups" && notificationCount > 0 && (
                    <b className="hp-shell-nav-count">{notificationCount}</b>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="hp-tier-card">
          <div className="hp-tier-heading">3-Tier Platform</div>
          <div className="hp-tier-item"><b>01</b><span>Admin Control</span></div>
          <div className="hp-tier-item active"><b>02</b><span>Manager Workspace</span></div>
          <div className="hp-tier-item"><b>03</b><span>User Marketplace</span></div>
        </div>

        <div className="hp-shell-sidebar-bottom">
          <Link href="/manager/settings" className="hp-shell-help">
            <strong>Manager Settings</strong>
            <span>Account and workspace preferences</span>
          </Link>

          <button className="hp-shell-signout" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="hp-manager-main">
        <header className="hp-shell-header">
          <div className="hp-shell-header-left">
            <button
              className="hp-shell-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              ☰
            </button>

            <div className="hp-shell-breadcrumb">
              <span>Housing.pro</span>
              <b>/</b>
              <strong>
                {pathname === "/manager"
                  ? "Dashboard"
                  : pathname.split("/").filter(Boolean).slice(-1)[0]
                    ?.replaceAll("-", " ") || "Manager"}
              </strong>
            </div>
          </div>

          <div className="hp-shell-header-actions">
            <Link href="/" className="hp-shell-website">
              Visit Website
            </Link>

            <button className="hp-shell-notification" aria-label="Notifications">
              <span>●</span>
              {notificationCount > 0 && (
                <b>{notificationCount > 9 ? "9+" : notificationCount}</b>
              )}
            </button>

            <div className="hp-shell-profile">
              <div className="hp-shell-avatar small">{initial}</div>
              <div>
                <strong>{managerName}</strong>
                <span>Manager</span>
              </div>
            </div>
          </div>
        </header>

        <main className="hp-shell-content">{children}</main>
      </div>

      <style jsx global>{`
        .hp-manager-shell {
          min-height: 100vh;
          background: #f6f8fb;
          color: #172033;
        }

        .hp-manager-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: 272px;
          z-index: 100;
          display: flex;
          flex-direction: column;
          background: #101828;
          color: #fff;
          border-right: 1px solid rgba(255,255,255,.06);
        }

        .hp-shell-brand {
          min-height: 82px;
          padding: 18px 22px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }

        .hp-shell-logo {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #fff;
          color: #101828;
          font-size: 20px;
          font-weight: 900;
        }

        .hp-shell-brand strong {
          display: block;
          font-size: 18px;
          line-height: 1.1;
          letter-spacing: -.02em;
        }

        .hp-shell-brand span {
          display: block;
          margin-top: 5px;
          color: #98a2b3;
          font-size: 11px;
        }

        .hp-manager-account {
          margin: 18px 16px 8px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 12px;
          background: rgba(255,255,255,.04);
        }

        .hp-shell-avatar {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #fff;
          color: #101828;
          font-weight: 800;
          font-size: 14px;
        }

        .hp-shell-avatar.small {
          width: 34px;
          height: 34px;
          flex-basis: 34px;
          font-size: 13px;
        }

        .hp-manager-account-copy,
        .hp-shell-profile > div:last-child {
          min-width: 0;
        }

        .hp-manager-account-copy strong,
        .hp-shell-profile strong {
          display: block;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hp-manager-account-copy span,
        .hp-shell-profile span {
          display: block;
          margin-top: 3px;
          color: #98a2b3;
          font-size: 11px;
        }

        .hp-shell-nav {
          flex: 1;
          overflow-y: auto;
          padding: 12px 12px 18px;
        }

        .hp-shell-nav-group {
          margin-bottom: 20px;
        }

        .hp-shell-nav-title {
          padding: 0 10px 7px;
          color: #667085;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .1em;
        }

        .hp-shell-nav-item {
          min-height: 42px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #b8c1d1;
          text-decoration: none;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          transition: background .15s ease, color .15s ease;
        }

        .hp-shell-nav-item:hover {
          background: rgba(255,255,255,.06);
          color: #fff;
        }

        .hp-shell-nav-item.active {
          background: #fff;
          color: #101828;
          box-shadow: 0 4px 14px rgba(0,0,0,.14);
        }

        .hp-shell-nav-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          opacity: .7;
        }

        .hp-shell-nav-count {
          margin-left: auto;
          min-width: 21px;
          height: 21px;
          display: grid;
          place-items: center;
          padding: 0 5px;
          border-radius: 999px;
          background: #f04438;
          color: #fff;
          font-size: 10px;
        }

        .hp-shell-sidebar-bottom {
          padding: 12px 16px 18px;
          border-top: 1px solid rgba(255,255,255,.08);
        }

        .hp-shell-help {
          display: block;
          padding: 12px;
          border-radius: 10px;
          text-decoration: none;
          background: rgba(255,255,255,.04);
          color: #fff;
        }

        .hp-shell-help strong {
          display: block;
          font-size: 12px;
        }

        .hp-shell-help span {
          display: block;
          margin-top: 4px;
          color: #98a2b3;
          font-size: 10px;
          line-height: 1.4;
        }

        .hp-shell-signout {
          width: 100%;
          margin-top: 9px;
          padding: 10px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 9px;
          background: transparent;
          color: #c8d0dc;
          cursor: pointer;
          font-weight: 700;
          font-size: 12px;
        }

        .hp-shell-signout:hover {
          background: rgba(255,255,255,.06);
          color: #fff;
        }

        .hp-manager-main {
          min-height: 100vh;
          margin-left: 272px;
        }

        .hp-shell-header {
          height: 76px;
          padding: 0 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          background: #fff;
          border-bottom: 1px solid #e7ebf2;
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .hp-shell-header-left,
        .hp-shell-header-actions,
        .hp-shell-profile,
        .hp-shell-breadcrumb {
          display: flex;
          align-items: center;
        }

        .hp-shell-header-left {
          gap: 15px;
          min-width: 0;
        }

        .hp-shell-breadcrumb {
          gap: 9px;
          font-size: 13px;
        }

        .hp-shell-breadcrumb span {
          color: #98a2b3;
        }

        .hp-shell-breadcrumb b {
          color: #d0d5dd;
        }

        .hp-shell-breadcrumb strong {
          text-transform: capitalize;
          color: #344054;
        }

        .hp-shell-header-actions {
          gap: 14px;
        }

        .hp-shell-website {
          padding: 9px 13px;
          border: 1px solid #e4e7ec;
          border-radius: 8px;
          color: #344054;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
          background: #fff;
        }

        .hp-shell-notification {
          position: relative;
          width: 36px;
          height: 36px;
          border: 1px solid #e4e7ec;
          border-radius: 9px;
          background: #fff;
          color: #667085;
          cursor: pointer;
        }

        .hp-shell-notification > span {
          font-size: 13px;
        }

        .hp-shell-notification b {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 17px;
          height: 17px;
          display: grid;
          place-items: center;
          padding: 0 4px;
          border-radius: 999px;
          background: #f04438;
          color: #fff;
          font-size: 9px;
        }

        .hp-shell-profile {
          gap: 9px;
          padding-left: 4px;
        }

        .hp-shell-menu {
          display: none;
          width: 38px;
          height: 38px;
          border: 1px solid #e4e7ec;
          border-radius: 9px;
          background: #fff;
          cursor: pointer;
          font-size: 18px;
        }

        .hp-shell-content {
          width: 100%;
          max-width: 1700px;
          margin: 0 auto;
          padding: 30px;
        }

        .hp-shell-overlay {
          display: none;
        }

        @media (max-width: 1000px) {
          .hp-manager-sidebar {
            width: 240px;
          }

          .hp-manager-main {
            margin-left: 240px;
          }

          .hp-shell-content {
            padding: 22px;
          }

          .hp-shell-website {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .hp-manager-sidebar {
            transform: translateX(-100%);
            transition: transform .2s ease;
            box-shadow: 15px 0 40px rgba(16,24,40,.2);
          }

          .hp-manager-sidebar.open {
            transform: translateX(0);
          }

          .hp-manager-main {
            margin-left: 0;
          }

          .hp-shell-menu {
            display: grid;
            place-items: center;
          }

          .hp-shell-overlay {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 90;
            border: 0;
            background: rgba(16,24,40,.45);
          }

          .hp-shell-header {
            padding: 0 16px;
          }

          .hp-shell-profile > div:last-child {
            display: none;
          }

          .hp-shell-content {
            padding: 18px 14px;
          }
        }
      `}</style>
    </div>
  )
}

