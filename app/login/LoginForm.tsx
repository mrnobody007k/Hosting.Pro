'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type LoginRole = 'USER' | 'MANAGER' | 'ADMIN'

export default function LoginForm({ role, accessToken }: { role: LoginRole; accessToken?: string }) {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const customer = role === 'USER'
  const portalTitle = customer ? 'Sign in' : role === 'MANAGER' ? 'Manager sign in' : 'Admin sign in'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier, password, expectedRole: role, ...(accessToken ? { accessToken } : {}) }),
      })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'We could not sign you in. Check your details and try again.'); return }
      router.replace(customer ? '/user' : role === 'MANAGER' ? '/manager' : '/admin')
    } catch {
      setError('We could not reach Housing.pro. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  return <main className="customer-auth-page">
    <section className="customer-auth-story">
      <Link className="customer-auth-brand" href="/"><span>H</span>Housing.pro</Link>
      <div className="customer-auth-story-copy">
        <span className="customer-auth-kicker">Online Property Rental &amp; Re-Rental Marketplace</span>
        <h1>Discover. Rent. Re-Rent.</h1>
        <p>{customer ? 'Pick up where you left off and keep your property bookings, account and wallet close at hand.' : 'Sign in to continue to your secure Housing.pro workspace.'}</p>
      </div>
      <div className="customer-auth-story-foot">Housing.pro — property journeys, made clear.</div>
    </section>
    <section className="customer-auth-main">
      <form className="customer-auth-card" onSubmit={submit}>
        <span className="customer-auth-kicker">HOUSING.PRO {customer ? 'ACCOUNT' : 'SECURE PORTAL'}</span>
        <h2>{portalTitle}</h2>
        <p className="customer-auth-subtitle">{customer ? 'Sign in with your email address or phone number.' : 'Use the email address registered to your account.'}</p>
        <label className="customer-field">{customer ? 'Email address or phone number' : 'Email address'}
          <input type={customer ? 'text' : 'email'} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={customer ? 'you@example.com or phone number' : 'you@example.com'} autoComplete="username" maxLength={254} required />
        </label>
        <label className="customer-field">Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" minLength={6} maxLength={200} required />
          <small>Password must be at least 6 characters.</small>
        </label>
        {error && <div className="customer-form-alert" role="alert">{error}</div>}
        <button className="customer-submit" disabled={busy}>{busy ? 'Signing in…' : 'Continue'}</button>
        {customer && <p className="customer-auth-switch">New to Housing.pro? <Link href="/register">Create an account</Link></p>}
        <Link className="customer-back-link" href="/">← Back to Housing.pro</Link>
      </form>
    </section>
  </main>
}
