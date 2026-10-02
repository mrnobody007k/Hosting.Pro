"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import UserShell from '../UserShell'
import { CustomerPageHeader, CustomerPageState, customerStatus, money, useCustomerOverview } from '../CustomerUI'

type ActivityEvent = { id: string; kind: string; title: string; detail: string; status: string; amount: string | null; createdAt: string }

export default function ActivityPage() {
  const { data: account, loading: accountLoading, error: accountError, reload: reloadAccount } = useCustomerOverview()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/user/activity', { cache: 'no-store' })
      if (response.status === 401) { window.location.href = '/login'; return }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load your activity.')
      setEvents(Array.isArray(result.events) ? result.events : [])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load your activity.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const visible = useMemo(() => filter === 'ALL' ? events : events.filter((event) => event.kind === filter), [events, filter])

  return <UserShell userName={account?.user?.name || 'Client'} membership={customerStatus(account?.user?.membershipStatus)}>
    <CustomerPageHeader eyebrow="YOUR ACCOUNT" title="Activity" description="A recent timeline of Rent / Re-Rent bookings, tasks, wallet revenue and account updates." />
    <div className="customer-activity-filters" aria-label="Filter activity">
      {['ALL', 'ORDER', 'TASK', 'DEPOSIT', 'WITHDRAWAL', 'WALLET', 'NOTIFICATION'].map((kind) => <button key={kind} type="button" className={filter === kind ? 'active' : ''} onClick={() => setFilter(kind)}>{kind === 'ALL' ? 'All activity' : kind === 'WALLET' ? 'Wallet' : `${kind.charAt(0)}${kind.slice(1).toLowerCase()}s`}</button>)}
    </div>
    <CustomerPageState loading={loading || accountLoading} error={error || accountError} retry={() => { void load(); void reloadAccount() }} />
    {!loading && !accountLoading && !error && !accountError && visible.length === 0 && <CustomerPageState emptyTitle="No activity to show" emptyText="Updates to your bookings, tasks, wallet, and notifications will appear here." />}
    {!loading && !accountLoading && !error && !accountError && visible.length > 0 && <section className="customer-surface customer-activity-list">{visible.map((event) => <article key={event.id}>
      <span className="customer-activity-icon" aria-hidden="true">{event.kind === 'ORDER' ? '⌂' : event.kind === 'TASK' ? '✓' : event.kind === 'WALLET' ? '₹' : event.kind === 'NOTIFICATION' ? '•' : '↔'}</span>
      <div className="customer-activity-copy"><strong>{event.title}</strong><span>{event.detail}</span><small>{new Date(event.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>
      <div className="customer-activity-meta"><b className="customer-status-pill">{customerStatus(event.status)}</b>{event.amount !== null && <strong>{money(event.amount)}</strong>}</div>
    </article>)}</section>}
    <style jsx global>{`.customer-activity-filters{display:flex;gap:8px;overflow-x:auto;padding:2px 0 14px;margin-bottom:4px}.customer-activity-filters button{flex:none;min-height:36px;padding:0 13px;border:1px solid #dce4dc;border-radius:999px;background:white;color:#596a60;font:inherit;font-size:11px;font-weight:700;cursor:pointer}.customer-activity-filters button.active{border-color:#315c45;background:#315c45;color:#fff}.customer-activity-list{padding:4px 20px}.customer-activity-list article{display:flex;align-items:center;gap:13px;padding:15px 0;border-bottom:1px solid #edf0eb}.customer-activity-list article:last-child{border-bottom:0}.customer-activity-icon{width:38px;height:38px;flex:none;display:grid;place-items:center;border-radius:12px;background:#f0f6f0;color:#315c45;font-weight:800}.customer-activity-copy{flex:1;min-width:0}.customer-activity-copy>*{display:block}.customer-activity-copy strong{color:#20382f;font-size:13px}.customer-activity-copy span{margin-top:4px;overflow-wrap:anywhere;color:#68766e;font-size:11px}.customer-activity-copy small{margin-top:5px;color:#87948b;font-size:10px}.customer-activity-meta{display:grid;justify-items:end;gap:7px}.customer-activity-meta>strong{color:#20382f;font-size:12px}@media(max-width:560px){.customer-activity-list{padding:4px 13px}.customer-activity-list article{align-items:flex-start}.customer-activity-meta{justify-items:start}.customer-activity-list article{flex-wrap:wrap}.customer-activity-meta{margin-left:51px;display:flex;align-items:center}.customer-activity-copy{width:calc(100% - 51px)}}`}</style>
  </UserShell>
}
