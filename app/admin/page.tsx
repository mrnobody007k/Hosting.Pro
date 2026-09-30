'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminShell from './AdminShell'

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
      <AdminShell>
        <div className="hp-loading">
          <div className="hp-loading-card">
            <div className="hp-logo-mark">H</div>
            <strong>Housing.pro</strong>
            <span>Loading Admin Panel...</span>
          </div>
        </div>
      </AdminShell>
    )
  }

  if (!data) {
    return (
      <AdminShell>
        <div className="hp-loading">
          <div className="hp-loading-card">
            <strong>Housing.pro</strong>
            <span>{msg || 'Admin data unavailable.'}</span>
            <button className="hp-primary-btn" onClick={load}>Retry</button>
          </div>
        </div>
      </AdminShell>
    )
  }

  const managers: Manager[] = data.managers || []
  const activeManagers = data.stats.activeManagers

  const stats = [
    {
      label: 'Active Managers',
      value: activeManagers,
      icon: 'M',
      tone: 'blue',
    },
    {
      label: 'Pending Signups',
      value: data.stats.pendingSignups,
      icon: 'S',
      tone: 'purple',
    },
    {
      label: 'Active Clients',
      value: data.stats.activeClients,
      icon: 'C',
      tone: 'green',
    },
    { label: 'Active Properties', value: data.stats.activeProperties, icon: 'P', tone: 'blue' },
    { label: 'Active Orders', value: data.stats.activeOrders, icon: 'O', tone: 'purple' },
    { label: 'Pending Tasks', value: data.stats.pendingTasks, icon: 'T', tone: 'orange' },
    { label: 'Completed Tasks', value: data.stats.completedTasks, icon: '✓', tone: 'green' },
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
    <AdminShell>
      <div>
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

        {data.capabilities?.viewRevenue && <section className="hp-card" style={{ marginTop: 18 }}>
          <div className="hp-card-head">
            <div>
              <h3>Recorded platform task profit</h3>
              <p>Sum of PROFIT ledger entries. Deposits, withdrawals and welcome bonuses are excluded.</p>
            </div>
            <strong>{data.stats.taskProfit}</strong>
          </div>
          <span>{data.stats.profitTransactionCount} ledger entries</span>
        </section>}

        <section className="hp-card" style={{ marginTop: 18 }}>
          <div className="hp-card-head"><div><h3>Attention queue</h3><p>Current records and work waiting for review or action.</p></div></div>
          <div className="hp-stats-grid">
            {[
              { label: "Pending signups", value: data.stats.pendingSignups, href: "/admin/clients", allowed: data.capabilities?.viewClients },
              { label: "Pending deposits", value: data.stats.pendingD, href: "/admin/deposits", allowed: data.capabilities?.viewDeposits },
              { label: "Pending withdrawals", value: data.stats.pendingW, href: "/admin/withdrawals", allowed: data.capabilities?.viewWithdrawals },
              { label: "Payment verification", value: data.stats.pendingPaymentOrders, href: "/admin/orders", allowed: data.capabilities?.viewOrders },
              { label: "Pending tasks", value: data.stats.pendingTasks, href: "/admin/tasks", allowed: data.capabilities?.viewTasks },
            ].map((item) => <div className="hp-stat-card" key={item.label}><div className="hp-stat-info"><span>{item.label}</span><strong>{item.value ?? 0}</strong></div>{item.allowed ? <Link href={item.href} className="hp-header-btn">Review</Link> : <span>Restricted</span>}</div>)}
          </div>
        </section>

        {data.capabilities?.viewOrders && <section className="hp-card hp-table-card" style={{ marginTop: 18 }}>
          <div className="hp-card-head"><div><h3>Recent orders</h3><p>Latest orders across the platform.</p></div><Link href="/admin/orders">View all</Link></div>
          <div className="hp-table-wrap"><table className="hp-admin-table"><thead><tr><th>Order</th><th>Property</th><th>Client</th><th>Manager</th><th>Amount</th><th>Payment</th><th>Status</th><th>Created</th></tr></thead><tbody>
            {data.recentOrders?.length ? data.recentOrders.map((order: any) => <tr key={order.id}><td>{order.orderCode}</td><td>{order.property?.title || "—"}</td><td>{order.user.name}<small>{order.user.email}</small></td><td>{order.manager.name}</td><td>₹{order.amount}</td><td>{order.paymentStatus}</td><td>{order.status}</td><td>{new Date(order.createdAt).toLocaleString()}</td></tr>) : <tr><td colSpan={8}>No recent orders.</td></tr>}
          </tbody></table></div>
        </section>}

        {data.capabilities?.viewActivity && <section className="hp-card hp-table-card" style={{ marginTop: 18 }}>
          <div className="hp-card-head"><div><h3>Recent activity</h3><p>Recent recorded actions. Sensitive audit metadata is excluded.</p></div><Link href="/admin/activity">View activity</Link></div>
          <div className="hp-table-wrap"><table className="hp-admin-table"><thead><tr><th>Actor</th><th>Action</th><th>Target</th><th>Amount</th><th>Time</th></tr></thead><tbody>
            {data.recentAudit?.length ? data.recentAudit.map((entry: any) => <tr key={entry.id}><td>{entry.actorType} · {entry.actorId.slice(0, 8)}</td><td>{entry.action}</td><td>{entry.targetType || "—"}{entry.targetId ? ` · ${entry.targetId}` : ""}</td><td>{entry.amount == null ? "—" : `₹${entry.amount}`}</td><td>{new Date(entry.createdAt).toLocaleString()}</td></tr>) : <tr><td colSpan={5}>No recent activity.</td></tr>}
          </tbody></table></div>
        </section>}

        {data.capabilities?.managePlatformSettings && <section className="hp-two-col">
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
                <strong>{Math.max(0, seats - activeManagers)}</strong>
                <span>Seats available · {seats} total</span>
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
        </section>}

        {data.capabilities?.manageManagers && <section className="hp-card hp-create-card">
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
        </section>}

        {data.capabilities?.manageManagers ? <section className="hp-card hp-table-card">
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
        </section> : managers.length === 0 ? null : <section className="hp-card"><p>Manager records require manager-management permission.</p></section>}

        <footer className="hp-footer">
          <span>© 2026 Housing.pro</span>
          <span>Admin Control Center</span>
          <span>Operations overview</span>
        </footer>
      </div>
    </AdminShell>
  )
}
