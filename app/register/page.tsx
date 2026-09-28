'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Registration = {
  name: string
  age: string
  profession: string
  phone: string
  email: string
  password: string
  confirmPassword: string
  paymentPassword: string
  confirmPaymentPassword: string
  referralCode: string
}

const emptyForm: Registration = { name: '', age: '', profession: '', phone: '', email: '', password: '', confirmPassword: '', paymentPassword: '', confirmPaymentPassword: '', referralCode: '' }

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  function update(field: keyof Registration, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (form.password.length < 6 || form.password.length > 200) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Your passwords do not match.')
      return
    }
    if (form.paymentPassword.length < 6 || form.paymentPassword.length > 200) {
      setError('Your payment password must be between 6 and 200 characters.')
      return
    }
    if (form.paymentPassword !== form.confirmPaymentPassword) {
      setError('Your payment passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'We could not create your account. Please try again.')
        return
      }
      setSuccess(true)
    } catch {
      setError('We could not reach Housing.pro. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="customer-auth-page customer-register-page">
      <section className="customer-auth-story">
        <Link className="customer-auth-brand" href="/"><span>H</span>Housing.pro</Link>
        <div className="customer-auth-story-copy">
          <span className="customer-auth-kicker">Online Property Rental &amp; Re-Rental Marketplace</span>
          <h1>Discover. Rent. Re-Rent.</h1>
          <p>Create one account to explore rental opportunities, book a property and follow your rental journey.</p>
        </div>
        <div className="customer-auth-story-foot">A considered marketplace, made clear.</div>
      </section>

      <section className="customer-auth-main customer-register-main">
        {success ? (
          <div className="customer-auth-card customer-success-card" role="status">
            <span className="customer-success-mark">✓</span>
            <span className="customer-auth-kicker">YOU’RE ALL SET</span>
            <h2>Your account is on its way.</h2>
            <p className="customer-auth-subtitle">Your Housing.pro account has been created. Sign in to continue to your account.</p>
            <button className="customer-submit" onClick={() => router.push('/login')}>Continue to sign in</button>
            <Link className="customer-back-link" href="/">Back to Housing.pro</Link>
          </div>
        ) : (
          <form className="customer-auth-card customer-register-card" onSubmit={submit}>
            <span className="customer-auth-kicker">CREATE YOUR ACCOUNT</span>
            <h2>Join Housing.pro</h2>
          <p className="customer-auth-subtitle">Create your Housing.pro account to discover properties and manage your rentals.</p>

            <div className="customer-form-grid">
              <label className="customer-field">Full name<input value={form.name} onChange={(event) => update('name', event.target.value)} autoComplete="name" maxLength={120} required /></label>
              <label className="customer-field">Age<input type="number" min="18" max="100" value={form.age} onChange={(event) => update('age', event.target.value)} required /></label>
              <label className="customer-field">Profession<input value={form.profession} onChange={(event) => update('profession', event.target.value)} maxLength={120} required /></label>
              <label className="customer-field">Phone number<input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} autoComplete="tel" maxLength={30} required /><small>You can also use this number to sign in.</small></label>
              <label className="customer-field customer-field-full">Email address<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} autoComplete="email" maxLength={254} required /></label>
              <label className="customer-field">Password<input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} autoComplete="new-password" minLength={6} maxLength={200} required /><small>Password must be at least 6 characters.</small></label>
              <label className="customer-field">Confirm password<input type="password" value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} autoComplete="new-password" minLength={6} maxLength={200} required /></label>
              <label className="customer-field">Payment password<input type="password" value={form.paymentPassword} onChange={(event) => update('paymentPassword', event.target.value)} autoComplete="new-password" minLength={6} maxLength={200} required /><small>Used to confirm payout requests.</small></label>
              <label className="customer-field">Confirm payment password<input type="password" value={form.confirmPaymentPassword} onChange={(event) => update('confirmPaymentPassword', event.target.value)} autoComplete="new-password" minLength={6} maxLength={200} required /></label>
              <label className="customer-field customer-field-full">Account access code<input value={form.referralCode} onChange={(event) => update('referralCode', event.target.value.toUpperCase())} autoCapitalize="characters" maxLength={100} placeholder="Enter your access code" required /><small>Use the access code provided to you to create your account.</small></label>
            </div>

            {error && <div className="customer-form-alert" role="alert">{error}</div>}
            <button className="customer-submit" disabled={busy}>{busy ? 'Creating your account…' : 'Create account'}</button>
            <p className="customer-auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
            <Link className="customer-back-link" href="/">← Back to Housing.pro</Link>
          </form>
        )}
      </section>
    </main>
  )
}
