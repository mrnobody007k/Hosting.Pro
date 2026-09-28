'use client'

import { useEffect, useState } from 'react'

type Manager = {
  id: string
  name: string
  email: string
  referralCode: string
  status: string
  paymentAccountLabel?: string | null
  paymentAccountDetails?: string | null
  _count: { users: number }
}

export default function Admin() {
  const [data, setData] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeNav, setActiveNav] = useState('Dashboard')

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    referralCode: '',
  })

  const [seats, setSeats] = useState(10)
  const [instructions, setInstructions] = useState('')

  const [payment, setPayment] = useState<
    Record<string, { label: string; details: string }>
  >({})

  async function load() {
    try {
      setLoading(true)
      const r = await fetch('/api/admin/overview')
      const j = await r.json()

      if (r.ok) {
        setData(j)
        setSeats(j.setting.managerSeatLimit)
        setInstructions(j.setting.depositInstructions || '')
      } else {
        setMsg(j.error || 'Unable to load admin data.')
      }
    } catch {
      setMsg('Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function createManager() {
    setMsg('')
    setSaving(true)

    try {
      const r = await fetch('/api/admin/managers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const j = await r.json()
      setMsg(j.error || 'Manager created successfully.')

      if (r.ok) {
        setForm({
          name: '',
          email: '',
          password: '',
          referralCode: '',
        })
        await load()
      }
    } catch {
      setMsg('Unable to create manager.')
    } finally {
      setSaving(false)
    }
  }

  async function saveSettings() {
    setMsg('')
    setSaving(true)

    try {
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerSeatLimit: seats,
          depositInstructions: instructions,
        }),
      })

      const j = await r.json()
      setMsg(j.error || 'Settings saved successfully.')

      if (r.ok) {
        await load()
      }
    } catch {
      setMsg('Unable to save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function managerStatus(id: string, status: string) {
    setMsg('')

    try {
      const r = await fetch('/api/admin/managers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })

      const j = await r.json()
      setMsg(j.error || 'Manager status updated.')
      await load()
    } catch {
      setMsg('Unable to update manager status.')
    }
  }

  async function savePaymentDetails(manager: Manager) {
    const current = payment[manager.id] || {
      label: manager.paymentAccountLabel || '',
      details: manager.paymentAccountDetails || '',
    }

    try {
      const r = await fetch('/api/admin/managers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: manager.id,
          paymentAccountLabel: current.label,
          paymentAccountDetails: current.details,
        }),
      })

      const j = await r.json()
      setMsg(j.error || 'Payment details saved.')
      await load()
    } catch {
      setMsg('Unable to save payment details.')
    }
  }

  if (loading) {
    return (
      <div className="hp-loading">
        <div className="hp-loading-card">
          <div className="hp-logo-mark">H</div>
          <strong>Housing.pro</strong>
          <span>Loading Admin Panel...</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="hp-loading">
        <div className="hp-loading-card">
          <strong>Housing.pro</strong>
          <span>{msg || 'Admin data unavailable.'}</span>
          <button className="hp-primary-btn" onClick={load}>Retry</button>
        </div>
      </div>
    )
  }

  const managers: Manager[] = data.managers || []
  const activeManagers = managers.filter((m) => m.status === 'ACTIVE').length
  const totalClients = managers.reduce(
    (sum, manager) => sum + (manager._count?.users || 0),
    0
  )

  const stats = [
    {
      label: 'Active Managers',
      value: activeManagers,
      icon: 'M',
      tone: 'blue',
    },
    {
      label: 'Manager Seats',
      value: data.setting.managerSeatLimit,
      icon: 'S',
      tone: 'purple',
    },
    {
      label: 'Total Clients',
      value: totalClients,
      icon: 'C',
      tone: 'green',
    },
    {
      label: 'Pending Deposits',
      value: data.stats.pendingD,
      icon: 'D',
      tone: 'orange',
    },
    {
      label: 'Pending Withdrawals',
      value: data.stats.pendingW,
      icon: 'W',
      tone: 'red',
    },
  ]

  return (
    <div className="hp-admin">
      <aside className="hp-sidebar">
        <div className="hp-brand">
          <div className="hp-logo-mark">H</div>
          <div>
            <div className="hp-brand-name">Housing.pro</div>
            <div className="hp-brand-sub">Housing.pro · Admin</div>
          </div>
        </div>

        <div className="hp-sidebar-search">
          <span>☰</span>
          <input placeholder="Search..." />
        </div>

        <div className="hp-nav-label">MAIN MENU</div>

        {[
          ['Dashboard', '|'],
          ['Managers', 'M'],
          ['Clients', 'C'],
          ['Orders', 'O'],
          ['Deposits', 'D'],
          ['Withdrawals', 'W'],
          ['Activity', 'A'],
        ].map(([label, icon]) => (
          <button
            key={label}
            className={`hp-nav-item ${activeNav === label ? 'active' : ''}`}
            onClick={() => { setActiveNav(label); window.location.href = ({ Dashboard: '/admin', Managers: '/admin/managers', Clients: '/admin/clients', Orders: '/admin/orders', Deposits: '/admin/deposits', Withdrawals: '/admin/withdrawals', Activity: '/admin/activity' } as Record<string, string>)[label] || '/admin' }}
          >
            <span className="hp-nav-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}

        <div className="hp-nav-label hp-nav-space">SYSTEM</div>

        <button
          className={`hp-nav-item ${activeNav === 'Settings' ? 'active' : ''}`}
          onClick={() => { setActiveNav('Settings'); window.location.href = '/admin/settings' }}
        >
          <span className="hp-nav-icon">⚙</span>
          <span>Settings</span>
        </button>

        <button
          className={`hp-nav-item ${activeNav === 'Admin Access' ? 'active' : ''}`}
          onClick={() => { setActiveNav('Admin Access'); window.location.href = '/admin/access' }}
        >
          <span className="hp-nav-icon">⚙</span>
          <span>Admin Access</span>
        </button>

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
              <strong>System Secure</strong>
              <span>All systems operational</span>
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

      <main className="hp-main">
        <header className="hp-header">
          <div>
            <div className="hp-breadcrumb">
              Admin <span>/</span> {activeNav}
            </div>
            <h1>Housing.pro Admin Center</h1>
          </div>

          <div className="hp-header-actions">
            <button className="hp-header-btn" title="Print" onClick={() => window.print()}>
              ◉
            </button>
            <button className="hp-header-btn" title="Notifications">
              ◍
              <i />
            </button>

            <div className="hp-admin-profile">
              <div className="hp-avatar">A</div>
              <div>
                <strong>Main Admin</strong>
                <span>Administrator</span>
              </div>
              <span className="hp-chevron">›</span>
            </div>
          </div>
        </header>

        <div className="hp-content">
          <div className="hp-page-title">
            <div>
              <h2>Dashboard Overview</h2>
              <p>Monitor and control your entire Housing.pro marketplace.</p>
            </div>
            <button className="hp-refresh-btn" onClick={load}>↻ Refresh</button>
          </div>

          {msg && (
            <div className="hp-notice">
              <span>!</span>
              {msg}
              <button onClick={() => setMsg('')}>×</button>
            </div>
          )}

          <section className="hp-stats-grid">
            {stats.map((stat) => (
              <div className="hp-stat-card" key={stat.label}>
                <div className={`hp-stat-icon ${stat.tone}`}>{stat.icon}</div>
                <div className="hp-stat-info">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
                <div className="hp-stat-arrow">›</div>
              </div>
            ))}
          </section>

          <section className="hp-two-col">
            <div className="hp-card">
              <div className="hp-card-head">
                <div>
                  <h3>Manager Capacity</h3>
                  <p>Control the number of manager accounts.</p>
                </div>
                <span className="hp-card-icon">✓</span>
              </div>

              <div className="hp-capacity">
                <div>
                  <strong>{activeManagers}</strong>
                  <span>Active</span>
                </div>
                <div className="hp-capacity-line">
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        (activeManagers / Math.max(1, seats)) * 100
                      )}%`,
                    }}
                  />
                </div>
                <div className="hp-capacity-total">
                  <strong>{seats}</strong>
                  <span>Total seats</span>
                </div>
              </div>

              <label className="hp-field">
                <span>Manager seat limit</span>
                <input
                  type="number"
                  min="1"
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value))}
                />
              </label>

              <button className="hp-primary-btn" onClick={saveSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save Capacity'}
              </button>
            </div>

            <div className="hp-card">
              <div className="hp-card-head">
                <div>
                  <h3>Deposit Instructions</h3>
                  <p>Instructions shown when clients arrange deposits.</p>
                </div>
                <span className="hp-card-icon">✓</span>
              </div>

              <label className="hp-field">
                <span>Payment instructions</span>
                <textarea
                  rows={6}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Enter the instructions clients should follow..."
                />
              </label>

              <button className="hp-primary-btn" onClick={saveSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save Instructions'}
              </button>
            </div>
          </section>

          <section className="hp-card hp-create-card">
            <div className="hp-card-head">
              <div>
                <h3>Create New Manager</h3>
                <p>Add a manager account and assign a unique referral code.</p>
              </div>
              <span className="hp-card-icon">+</span>
            </div>

            <div className="hp-manager-form">
              <label className="hp-field">
                <span>Manager name</span>
                <input
                  value={form.name}
                  placeholder="Full name"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>

              <label className="hp-field">
                <span>Email address</span>
                <input
                  type="email"
                  value={form.email}
                  placeholder="manager@example.com"
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>

              <label className="hp-field">
                <span>Password</span>
                <input
                  type="password"
                  value={form.password}
                  placeholder="Secure password"
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>

              <label className="hp-field">
                <span>Referral code</span>
                <input
                  value={form.referralCode}
                  placeholder="HP001"
                  onChange={(e) =>
                    setForm({ ...form, referralCode: e.target.value.toUpperCase() })
                  }
                />
              </label>
            </div>

            <div className="hp-form-actions">
              <button
                className="hp-primary-btn"
                onClick={createManager}
                disabled={saving}
              >
                {saving ? 'Creating...' : 'Create Manager'}
              </button>
            </div>
          </section>

          <section className="hp-card hp-table-card">
            <div className="hp-card-head hp-table-head">
              <div>
                <h3>All Managers</h3>
                <p>Manage manager accounts, referrals and payment details.</p>
              </div>
              <span className="hp-count-pill">{managers.length} managers</span>
            </div>

            <div className="hp-table-wrap">
              <table className="hp-table">
                <thead>
                  <tr>
                    <th>MANAGER</th>
                    <th>REFERRAL CODE</th>
                    <th>CLIENTS</th>
                    <th>STATUS</th>
                    <th>PAYMENT ACCOUNT</th>
                    <th>ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {managers.map((manager) => {
                    const currentPayment = payment[manager.id] || {
                      label: manager.paymentAccountLabel || '',
                      details: manager.paymentAccountDetails || '',
                    }

                    return (
                      <tr key={manager.id}>
                        <td>
                          <div className="hp-manager-cell">
                            <div className="hp-manager-avatar">
                              {manager.name?.charAt(0)?.toUpperCase() || 'M'}
                            </div>
                            <div>
                              <strong>{manager.name}</strong>
                              <span>{manager.email}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="hp-referral">
                            {manager.referralCode}
                          </span>
                        </td>

                        <td>
                          <strong>{manager._count?.users || 0}</strong>
                        </td>

                        <td>
                          <span
                            className={`hp-status ${
                              manager.status === 'ACTIVE' ? 'active' : 'inactive'
                            }`}
                          >
                            <i />
                            {manager.status}
                          </span>
                        </td>

                        <td>
                          <div className="hp-payment-fields">
                            <input
                              placeholder="Account label"
                              value={currentPayment.label}
                              onChange={(e) =>
                                setPayment({
                                  ...payment,
                                  [manager.id]: {
                                    label: e.target.value,
                                    details: currentPayment.details,
                                  },
                                })
                              }
                            />
                            <input
                              placeholder="Account details"
                              value={currentPayment.details}
                              onChange={(e) =>
                                setPayment({
                                  ...payment,
                                  [manager.id]: {
                                    label: currentPayment.label,
                                    details: e.target.value,
                                  },
                                })
                              }
                            />
                            <button
                              className="hp-mini-save"
                              onClick={() => savePaymentDetails(manager)}
                            >
                              Save
                            </button>
                          </div>
                        </td>

                        <td>
                          <button
                            className={`hp-action-btn ${
                              manager.status === 'ACTIVE' ? 'danger' : 'success'
                            }`}
                            onClick={() =>
                              managerStatus(
                                manager.id,
                                manager.status === 'ACTIVE'
                                  ? 'SUSPENDED'
                                  : 'ACTIVE'
                              )
                            }
                          >
                            {manager.status === 'ACTIVE'
                              ? 'Suspend'
                              : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {managers.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <div className="hp-empty">
                          <strong>No managers yet</strong>
                          <span>Create the first manager using the form above.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="hp-footer">
            <span>© 2026 Housing.pro</span>
            <span>Admin Control Center</span>
            <span>System Status: Operational</span>
          </footer>
        </div>
      </main>

      <style jsx>{`
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

        .hp-nav-item {
          width: 100%;
          border: 0;
          background: transparent;
          color: #9eabc0;
          min-height: 43px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          margin-bottom: 3px;
        }

        .hp-nav-item:hover {
          background: #182234;
          color: white;
        }

        .hp-nav-item.active {
          background: linear-gradient(90deg, #1d4ed8, #2563eb);
          color: white;
          box-shadow: 0 7px 18px rgba(37, 99, 235, .18);
        }

        .hp-nav-icon {
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
        .hp-page-title h2 { font-size:30px; letter-spacing:-1px; }
        .hp-stat-card { transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .hp-stat-card:hover { transform:translateY(-2px); border-color:#d7e2f4; box-shadow:0 14px 32px rgba(15,23,42,.08); }
        .hp-card { box-shadow:0 8px 28px rgba(15,23,42,.045); }
        .hp-header { box-shadow:0 1px 0 rgba(15,23,42,.02); }

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

        .hp-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .hp-header-btn {
          width: 38px;
          height: 38px;
          border: 1px solid #e5e9f0;
          background: white;
          border-radius: 9px;
          color: #5d6a7e;
          cursor: pointer;
          position: relative;
          font-size: 16px;
        }

        .hp-header-btn i {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 5px;
          height: 5px;
          background: #ef4444;
          border-radius: 50%;
        }

        .hp-admin-profile {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-left: 8px;
          padding-left: 14px;
          border-left: 1px solid #e6eaf0;
        }

        .hp-avatar {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          background: #e8efff;
          color: #2563eb;
          font-weight: 800;
          font-size: 13px;
        }

        .hp-admin-profile strong,
        .hp-admin-profile span {
          display: block;
        }

        .hp-admin-profile strong {
          font-size: 12px;
        }

        .hp-admin-profile span {
          font-size: 9px;
          color: #8b96a8;
          margin-top: 2px;
        }

        .hp-admin-profile .hp-chevron {
          margin-left: 5px;
          font-size: 14px;
        }

        .hp-content {
          padding: 30px 32px 20px;
          max-width: 1500px;
          margin: 0 auto;
        }

        .hp-page-title {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .hp-page-title h2 {
          margin: 0 0 5px;
          font-size: 22px;
          letter-spacing: -.6px;
        }

        .hp-page-title p {
          margin: 0;
          color: #7d899b;
          font-size: 12px;
        }

        .hp-refresh-btn {
          border: 1px solid #dfe5ee;
          background: white;
          color: #475569;
          height: 37px;
          border-radius: 8px;
          padding: 0 14px;
          cursor: pointer;
          font-weight: 600;
          font-size: 11px;
        }

        .hp-refresh-btn:hover {
          border-color: #b8c4d5;
          background: #fafbfd;
        }

        .hp-notice {
          margin-bottom: 18px;
          background: #eef6ff;
          border: 1px solid #cfe2ff;
          color: #2057a7;
          min-height: 43px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 7px 12px;
          font-size: 12px;
        }

        .hp-notice > span {
          font-weight: 800;
        }

        .hp-notice button {
          margin-left: auto;
          border: 0;
          background: transparent;
          cursor: pointer;
          color: inherit;
          font-size: 18px;
        }

        .hp-stats-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .hp-stat-card {
          background: white;
          border: 1px solid #e7ebf2;
          border-radius: 12px;
          min-height: 105px;
          padding: 17px;
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(16, 24, 40, .025);
        }

        .hp-stat-icon {
          width: 41px;
          height: 41px;
          flex: 0 0 41px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          font-size: 18px;
          font-weight: 700;
        }

        .hp-stat-icon.blue {
          background: #eaf2ff;
          color: #2563eb;
        }

        .hp-stat-icon.purple {
          background: #f1ebff;
          color: #7c3aed;
        }

        .hp-stat-icon.green {
          background: #e9f9f0;
          color: #16a34a;
        }

        .hp-stat-icon.orange {
          background: #fff3df;
          color: #ea8a00;
        }

        .hp-stat-icon.red {
          background: #ffebeb;
          color: #dc2626;
        }

        .hp-stat-info span,
        .hp-stat-info strong {
          display: block;
        }

        .hp-stat-info span {
          color: #7d899b;
          font-size: 10px;
          font-weight: 600;
        }

        .hp-stat-info strong {
          color: #172033;
          font-size: 22px;
          margin-top: 5px;
          letter-spacing: -.5px;
        }

        .hp-stat-arrow {
          position: absolute;
          right: 13px;
          top: 13px;
          color: #c0c7d2;
          font-size: 17px;
        }

        .hp-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 18px;
        }

        .hp-card {
          background: white;
          border: 1px solid #e7ebf2;
          border-radius: 13px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(16, 24, 40, .025);
        }

        .hp-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 19px;
        }

        .hp-card-head h3 {
          margin: 0 0 4px;
          font-size: 14px;
          letter-spacing: -.15px;
        }

        .hp-card-head p {
          margin: 0;
          color: #8a96a8;
          font-size: 10px;
        }

        .hp-card-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: #f0f4fa;
          color: #4d5b70;
          display: grid;
          place-items: center;
          font-size: 15px;
        }

        .hp-capacity {
          display: grid;
          grid-template-columns: 50px 1fr 70px;
          align-items: center;
          gap: 12px;
          margin: 10px 0 19px;
        }

        .hp-capacity strong,
        .hp-capacity span {
          display: block;
        }

        .hp-capacity strong {
          font-size: 19px;
        }

        .hp-capacity span {
          color: #8a96a8;
          font-size: 9px;
          margin-top: 2px;
        }

        .hp-capacity-line {
          height: 7px;
          background: #edf1f6;
          border-radius: 99px;
          overflow: hidden;
        }

        .hp-capacity-line div {
          height: 100%;
          background: linear-gradient(90deg, #2563eb, #7c3aed);
          border-radius: inherit;
        }

        .hp-capacity-total {
          text-align: right;
        }

        .hp-field {
          display: block;
          margin-bottom: 13px;
        }

        .hp-field > span {
          display: block;
          color: #596579;
          font-size: 10px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .hp-field input,
        .hp-field textarea,
        .hp-payment-fields input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dfe5ed;
          background: #fbfcfe;
          border-radius: 8px;
          outline: 0;
          padding: 10px 11px;
          color: #172033;
          font-size: 11px;
          font-family: inherit;
          transition: .15s;
        }

        .hp-field textarea {
          resize: vertical;
          min-height: 100px;
          line-height: 1.55;
        }

        .hp-field input:focus,
        .hp-field textarea:focus,
        .hp-payment-fields input:focus {
          border-color: #7ca6ff;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, .08);
          background: white;
        }

        .hp-primary-btn {
          height: 37px;
          border: 0;
          border-radius: 8px;
          padding: 0 15px;
          background: #2563eb;
          color: white;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 5px 13px rgba(37, 99, 235, .17);
        }

        .hp-primary-btn:hover {
          background: #1d4ed8;
        }

        .hp-primary-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .hp-create-card {
          margin-bottom: 18px;
        }

        .hp-manager-form {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 13px;
        }

        .hp-form-actions {
          margin-top: 2px;
        }

        .hp-table-card {
          padding-bottom: 0;
          overflow: hidden;
        }

        .hp-table-head {
          padding: 1px 1px 18px;
          margin-bottom: 0;
        }

        .hp-count-pill {
          padding: 6px 10px;
          background: #f0f4fa;
          color: #607087;
          border-radius: 99px;
          font-size: 9px;
          font-weight: 700;
        }

        .hp-table-wrap {
          margin: 0 -20px;
          overflow-x: auto;
          border-top: 1px solid #edf0f5;
        }

        .hp-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 980px;
        }

        .hp-table th {
          height: 43px;
          padding: 0 17px;
          background: #fafbfd;
          border-bottom: 1px solid #e9edf3;
          text-align: left;
          color: #8490a2;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .55px;
        }

        .hp-table td {
          padding: 13px 17px;
          border-bottom: 1px solid #edf0f4;
          font-size: 11px;
          vertical-align: middle;
        }

        .hp-table tbody tr:hover {
          background: #fbfcff;
        }

        .hp-manager-cell {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .hp-manager-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #eaf1ff;
          color: #2563eb;
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 11px;
        }

        .hp-manager-cell strong,
        .hp-manager-cell span {
          display: block;
        }

        .hp-manager-cell strong {
          font-size: 11px;
        }

        .hp-manager-cell span {
          color: #8b96a8;
          font-size: 9px;
          margin-top: 3px;
        }

        .hp-referral {
          display: inline-block;
          padding: 5px 8px;
          border-radius: 6px;
          background: #f0f4fa;
          color: #43536a;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
          font-weight: 700;
        }

        .hp-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 8px;
          border-radius: 99px;
          font-size: 9px;
          font-weight: 800;
        }

        .hp-status i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }

        .hp-status.active {
          color: #15803d;
          background: #eaf8ef;
        }

        .hp-status.active i {
          background: #22c55e;
        }

        .hp-status.inactive {
          color: #b45309;
          background: #fff5df;
        }

        .hp-status.inactive i {
          background: #f59e0b;
        }

        .hp-payment-fields {
          display: grid;
          grid-template-columns: 100px 155px auto;
          gap: 5px;
          align-items: center;
        }

        .hp-payment-fields input {
          padding: 7px 8px;
          font-size: 9px;
          min-width: 0;
        }

        .hp-mini-save {
          height: 29px;
          border: 1px solid #d8e0eb;
          background: white;
          color: #41648f;
          border-radius: 6px;
          padding: 0 8px;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        .hp-mini-save:hover {
          background: #f4f7fb;
        }

        .hp-action-btn {
          height: 29px;
          padding: 0 10px;
          border-radius: 6px;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid;
        }

        .hp-action-btn.danger {
          color: #b91c1c;
          background: #fff5f5;
          border-color: #fecaca;
        }

        .hp-action-btn.success {
          color: #15803d;
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .hp-empty {
          padding: 40px;
          text-align: center;
          color: #8792a4;
        }

        .hp-empty strong,
        .hp-empty span {
          display: block;
        }

        .hp-empty strong {
          color: #536176;
          font-size: 12px;
        }

        .hp-empty span {
          font-size: 10px;
          margin-top: 4px;
        }

        .hp-footer {
          display: flex;
          justify-content: space-between;
          padding: 22px 2px 8px;
          color: #9aa4b3;
          font-size: 9px;
        }

        .hp-loading {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: #f5f7fb;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        }

        .hp-loading-card {
          width: 250px;
          padding: 28px;
          border: 1px solid #e4e9f0;
          border-radius: 14px;
          background: white;
          box-shadow: 0 12px 35px rgba(16, 24, 40, .07);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 9px;
        }

        .hp-loading-card .hp-logo-mark {
          margin-bottom: 4px;
        }

        .hp-loading-card strong {
          font-size: 15px;
        }

        .hp-loading-card > span {
          color: #8994a6;
          font-size: 10px;
        }

        .hp-loading-card .hp-primary-btn {
          margin-top: 6px;
        }

        @media (max-width: 1200px) {
          .hp-stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .hp-manager-form {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 900px) {
          .hp-sidebar {
            width: 74px;
            padding: 18px 10px;
          }

          .hp-brand > div:not(.hp-logo-mark),
          .hp-sidebar-search,
          .hp-nav-label,
          .hp-nav-item > span:not(.hp-nav-icon),
          .hp-secure-box,
          .hp-logout > span:not(:first-child) {
            display: none;
          }

          .hp-brand {
            justify-content: center;
            padding-left: 0;
            padding-right: 0;
          }

          .hp-nav-item {
            justify-content: center;
            padding: 0;
          }

          .hp-main {
            margin-left: 74px;
            width: calc(100% - 74px);
          }

          .hp-two-col {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .hp-header {
            padding: 0 15px;
          }

          .hp-header-actions .hp-header-btn {
            display: none;
          }

          .hp-admin-profile {
            border-left: 0;
            padding-left: 0;
          }

          .hp-content {
            padding: 20px 15px;
          }

          .hp-stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .hp-manager-form {
            grid-template-columns: 1fr;
          }

          .hp-page-title {
            align-items: flex-start;
            flex-direction: column;
          }

          .hp-footer {
            flex-direction: column;
            gap: 5px;
          }
        }

        @media (max-width: 440px) {
          .hp-stats-grid {
            grid-template-columns: 1fr;
          }

          .hp-sidebar {
            width: 62px;
          }

          .hp-main {
            margin-left: 62px;
            width: calc(100% - 62px);
          }
        }
      `}</style>
    </div>
  )
}


