"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

const userGroups = [
  {
    title: "Home",
    items: [
      { label: "Dashboard", href: "/user" },
      { label: "Properties", href: "/user/properties" },
      { label: "My Rentals", href: "/user/orders" },
      { label: "Re-Rent", href: "/user/rerent" },
    ],
  },
    {
      title: "My Activity",
      items: [
      { label: "Activity", href: "/user/activity" },
      { label: "Tasks", href: "/user/tasks" },
      { label: "Progress", href: "/user/progress" },
      { label: "Revenue", href: "/user/revenue" },
    ],
  },
  {
    title: "Wallet",
    items: [
      { label: "Balance", href: "/user/wallet" },
      { label: "Deposits", href: "/user/deposits" },
      { label: "Withdrawals", href: "/user/withdrawals" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Notifications", href: "/user/notifications" },
      { label: "Profile", href: "/user/profile" },
      { label: "Support", href: "/user/support" },
      { label: "Settings", href: "/user/settings" },
    ],
  },
]

function navGlyph(label: string) {
  const glyphs: Record<string, string> = {
    Dashboard: "⌂",
    Tasks: "✓",
    Properties: "⌂",
    Deposits: "↓",
    Withdrawals: "↑",
    Wallet: "₹",
    Balance: "₹",
    "My Rentals": "□",
    "Re-Rent": "↻",
    Progress: "◉",
    Revenue: "📈",
    Notifications: "•",
    Activity: "◷",
    Profile: "◉",
    Support: "?",
    Settings: "⚙",
  }
  return glyphs[label] || "•"
}

export default function UserShell({
  children,
  userName = "Client",
  membership = "Member",
  notificationCount = 0,
}: {
  children: React.ReactNode
  userName?: string
  membership?: string
  notificationCount?: number
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(notificationCount)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState("")

  const initial = userName.charAt(0).toUpperCase()

  useEffect(() => {
    let active = true
    fetch("/api/user/notifications", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active && data) setUnreadCount(Number(data.unreadCount || 0)) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    const refresh = (event: Event) => {
      const count = (event as CustomEvent<number>).detail
      if (Number.isFinite(count)) setUnreadCount(count)
    }
    window.addEventListener("housingpro:unread-count", refresh)
    return () => window.removeEventListener("housingpro:unread-count", refresh)
  }, [])

  function isActive(href: string) {
    if (href === "/user") return pathname === "/user"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  function pageTitle() {
    if (pathname.startsWith("/user/orders/") && pathname !== "/user/orders") return "Booking Details"
    if (pathname.startsWith("/user/properties/") && pathname !== "/user/properties") return "Property Details"
    const labels: Record<string, string> = {
      "/user": "Dashboard", "/user/properties": "Properties", "/user/orders": "My Bookings",
      "/user/activity": "Activity", "/user/tasks": "My Tasks", "/user/rerent": "Re-Rent",
      "/user/progress": "Progress", "/user/revenue": "Revenue", "/user/wallet": "Wallet",
      "/user/deposits": "Deposits", "/user/withdrawals": "Withdrawals", "/user/notifications": "Notifications",
      "/user/profile": "Profile", "/user/referral": "Account Access", "/user/support": "Support", "/user/settings": "Settings",
    }
    return labels[pathname] || "Your Account"
  }

  async function logout() {
    setLoggingOut(true)
    setLogoutError("")
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (!response.ok) throw new Error("Logout request failed")
      window.location.href = "/login"
    } catch {
      setLogoutError("We couldn't sign you out. Check your connection and try again.")
      setLoggingOut(false)
    }
  }

  return (
    <div className="hp-user-shell">
      {mobileOpen && (
        <button
          className="hp-shell-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`hp-user-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="hp-shell-brand">
          <div className="hp-shell-logo">H</div>
          <div>
            <strong>Housing.pro</strong>
            <span>Your marketplace</span>
          </div>
        </div>

        <div className="hp-user-account">
          <div className="hp-shell-avatar">{initial}</div>
          <div>
            <strong>{userName}</strong>
            <span>{membership.replaceAll("_", " ")}</span>
          </div>
        </div>

        <nav className="hp-shell-nav">
          {userGroups.map((group) => (
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

                  {item.label === "Notifications" && unreadCount > 0 && (
                    <b className="hp-shell-nav-count">{unreadCount}</b>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="hp-tier-card hp-account-card">
          <div className="hp-tier-heading">Housing.pro</div>
          <div className="hp-tier-item active"><b>✓</b><span>Your property account</span></div>
        </div>

        <div className="hp-shell-sidebar-bottom">
          <Link href="/user/support" className="hp-shell-help">
            <strong>Need help?</strong>
            <span>Help with a booking, payment or account question</span>
          </Link>

          {logoutError && <div className="hp-shell-logout-error" role="alert">{logoutError}</div>}
          <button className="hp-shell-signout" onClick={logout} disabled={loggingOut}>
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="hp-user-main">
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
                {pageTitle()}
              </strong>
            </div>
          </div>

          <div className="hp-shell-header-actions">
            <Link href="/" className="hp-shell-website">
              Visit Website
            </Link>

            <Link
              href="/user/notifications"
              className="hp-shell-notification"
              aria-label="Notifications"
            >
              <span>•</span>
              {unreadCount > 0 && (
                <b>{unreadCount > 9 ? "9+" : unreadCount}</b>
              )}
            </Link>

            <div className="hp-shell-profile">
              <div className="hp-shell-avatar small">{initial}</div>
              <div>
                <strong>{userName}</strong>
                <span>Housing.pro account</span>
              </div>
            </div>
          </div>
        </header>

        <main className="hp-shell-content">{children}</main>
      </div>

      <nav className={`hp-user-bottom-nav ${mobileOpen ? "menu-open" : ""}`} aria-label="Primary navigation">
        {[
          { label: "Home", href: "/user", icon: "⌂" },
          { label: "Orders", href: "/user/orders", icon: "▤" },
          { label: "Activity", href: "/user/activity", icon: "◷" },
          { label: "Rent", href: "/user/properties", icon: "⌕" },
          { label: "Me", href: "/user/profile", icon: "◉" },
        ].map((item) => {
          const active = item.label === "Me"
            ? pathname === "/user/profile" || ["/user/wallet", "/user/deposits", "/user/withdrawals", "/user/notifications", "/user/settings", "/user/support", "/user/referral"].some((path) => pathname === path || pathname.startsWith(`${path}/`))
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return <Link key={item.label} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
            {item.label === "Activity" && unreadCount > 0 && <b aria-label={`${unreadCount} unread notifications`}>{unreadCount > 9 ? "9+" : unreadCount}</b>}
          </Link>
        })}
      </nav>

      <style jsx global>{`
        .hp-user-shell {
          min-height: 100vh;
          background: #f6f8fb;
          color: #172033;
          overflow-x: clip;
        }

        .hp-user-sidebar {
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

        .hp-user-account {
          margin: 18px 16px 8px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 12px;
          background: rgba(255,255,255,.04);
        }

        .hp-user-account strong {
          display: block;
          font-size: 13px;
          max-width: 145px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .hp-user-account span {
          display: block;
          margin-top: 3px;
          color: #98a2b3;
          font-size: 10px;
          text-transform: capitalize;
        }

        .hp-user-sidebar .hp-shell-nav {
          flex: 1;
          overflow-y: auto;
        }

        .hp-user-main {
          min-height: 100vh;
          margin-left: 272px;
          min-width: 0;
        }

        .hp-shell-brand,
        .hp-shell-header,
        .hp-shell-header-left,
        .hp-shell-header-actions,
        .hp-shell-profile,
        .hp-shell-breadcrumb {
          display: flex;
          align-items: center;
        }

        .hp-shell-brand {
          min-height: 82px;
          padding: 18px 22px;
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

        .hp-shell-nav {
          padding: 12px;
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
          flex: 0 0 6px;
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
          background: rgba(255,255,255,.04);
          color: #fff;
          text-decoration: none;
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
        .hp-shell-signout:disabled { opacity:.6; cursor:wait; }
        .hp-shell-logout-error { margin:0 0 8px; padding:9px; border-radius:8px; background:rgba(255,220,216,.12); color:#ffd3cd; font-size:10px; line-height:1.45; }

        .hp-shell-header {
          height: 76px;
          padding: 0 28px;
          justify-content: space-between;
          gap: 20px;
          background: #fff;
          border-bottom: 1px solid #e7ebf2;
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .hp-shell-header-left {
          gap: 15px;
          min-width: 0;
        }

        .hp-shell-header-actions {
          gap: 14px;
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
          color: #344054;
          text-transform: capitalize;
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
          display: grid;
          place-items: center;
          border: 1px solid #e4e7ec;
          border-radius: 9px;
          background: #fff;
          color: #667085;
          text-decoration: none;
        }

        .hp-shell-notification b {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 17px;
          height: 17px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: #f04438;
          color: #fff;
          font-size: 9px;
        }

        .hp-shell-profile {
          gap: 9px;
        }

        .hp-shell-profile strong {
          display: block;
          font-size: 13px;
        }

        .hp-shell-profile span {
          display: block;
          margin-top: 3px;
          color: #98a2b3;
          font-size: 11px;
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
          min-width: 0;
        }

        .hp-shell-avatar {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          flex: 0 0 38px;
          border-radius: 50%;
          background: #fff;
          color: #101828;
          font-size: 14px;
          font-weight: 800;
        }

        .hp-shell-avatar.small {
          width: 34px;
          height: 34px;
          flex-basis: 34px;
          font-size: 13px;
        }

        .hp-shell-overlay {
          display: none;
        }

        .hp-user-bottom-nav { display: none; }

        .customer-page-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; margin:4px 0 22px; }
        .customer-page-heading>div>span { color:#63816e; font-size:10px; font-weight:800; letter-spacing:.13em; }
        .customer-page-heading h1 { margin:7px 0 5px; color:#20382f; font-family:Georgia,serif; font-size:32px; font-weight:500; letter-spacing:-.03em; }
        .customer-page-heading p { margin:0; color:#68766e; font-size:13px; line-height:1.6; }
        .customer-surface { min-width:0; border:1px solid #e7ebe4; border-radius:14px; background:#fff; box-shadow:0 8px 25px rgba(27,48,34,.035); }
        .customer-status-pill { display:inline-flex; align-items:center; border-radius:999px; padding:5px 9px; background:#eef4ed; color:#315c45; font-size:10px; font-weight:750; }
        .customer-inline-error,.customer-data-error { border:1px solid #f1d1cc; border-radius:10px; background:#fff5f3; color:#9e3029; }
        .customer-inline-success { border:1px solid #cfe4d1; border-radius:10px; background:#f2faf2; color:#396047; }
        .customer-inline-error,.customer-inline-success { margin:0 0 14px; padding:12px 14px; font-size:12px; line-height:1.55; }
        .customer-data-state { min-height:115px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:24px; border:1px solid #e7ebe4; border-radius:13px; background:#fff; color:#758178; text-align:center; font-size:12px; }
        .customer-data-state.customer-data-error { border-color:#f1d1cc; background:#fff5f3; color:#9e3029; }
        .customer-data-state>strong { color:#20382f; font-size:15px; }
        .customer-data-state button { min-height:36px; padding:0 12px; border:1px solid #dce4dc; border-radius:8px; background:#fff; color:#315c45; font-weight:700; cursor:pointer; }
        .customer-history h2,.wallet-transactions h2 { margin:0; padding:17px 18px 8px; color:#20382f; font-size:16px; }
        .wallet-earnings-summary { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:11px; margin:12px 0 17px; }
        .wallet-earnings-summary article { min-width:0; display:flex; flex-direction:column; justify-content:center; padding:14px; border:1px solid #e7ebe4; border-radius:12px; background:#fff; }
        .wallet-earnings-summary span { color:#77847b; font-size:10px; font-weight:700; }
        .wallet-earnings-summary strong { margin-top:7px; overflow-wrap:anywhere; color:#315c45; font-size:15px; }
        .wallet-earnings-summary small { margin-top:5px; color:#87948b; font-size:9px; line-height:1.4; }
        .hp-user-shell :focus-visible { outline:3px solid #91bb9c; outline-offset:2px; }
        .customer-history-row { display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:14px; padding:13px 18px; border-top:1px solid #edf0eb; }
        .customer-history-row>span { color:#526158; font-size:12px; }
        .customer-history-row>strong { color:#20382f; font-size:12px; }
        .customer-history-row>small { color:#87948b; font-size:10px; }
        .deposit-history-reference { display:block; margin-top:4px; overflow-wrap:anywhere; color:#87948b; font-size:10px; }
        .customer-load-more { display:flex; justify-content:center; padding:20px; }

        @media (max-width: 1000px) {
          .hp-user-sidebar {
            width: 240px;
          }

          .hp-user-main {
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
          .hp-user-sidebar {
            transform: translateX(-100%);
            transition: transform .2s ease;
            box-shadow: 15px 0 40px rgba(16,24,40,.2);
          }

          .hp-user-sidebar.open {
            transform: translateX(0);
          }

          .hp-user-main {
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
            padding: 18px 14px calc(92px + env(safe-area-inset-bottom));
          }

          .customer-page-heading { align-items:flex-start; flex-direction:column; }
          .customer-page-heading h1 { font-size:28px; }
          .wallet-earnings-summary { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .customer-history-row { grid-template-columns:minmax(0,1fr) auto; gap:8px 12px; }
          .customer-history-row>small { grid-column:1/-1; }

          .hp-user-bottom-nav {
            position: fixed;
            inset: auto 0 0;
            z-index: 80;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            padding: 8px 6px calc(8px + env(safe-area-inset-bottom));
            border-top: 1px solid #e7ebe4;
            background: rgba(255,255,255,.97);
            box-shadow: 0 -8px 26px rgba(20,40,28,.08);
            backdrop-filter: blur(12px);
          }
          .hp-user-bottom-nav.menu-open { display:none; }

          .hp-user-bottom-nav a {
            position: relative;
            min-width: 0;
            min-height: 52px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            color: #77847b;
            text-decoration: none;
            border-radius: 10px;
          }

          .hp-user-bottom-nav a > span { font-size: 20px; line-height: 1; }
          .hp-user-bottom-nav small { font-size: 10px; font-weight: 650; }
          .hp-user-bottom-nav a.active { color: #315c45; background: #f0f6f0; }
          .hp-user-bottom-nav b { position:absolute; top:2px; right:calc(50% - 22px); min-width:16px; height:16px; display:grid; place-items:center; padding:0 3px; border-radius:999px; background:#b54737; color:#fff; font-size:9px; }
        }
      `}</style>
    </div>
  )
}

