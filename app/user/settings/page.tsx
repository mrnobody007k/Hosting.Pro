"use client"

import { useState } from "react"
import Link from "next/link"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, useCustomerOverview } from "../CustomerUI"
import { FormEvent } from "react"

export default function SettingsPage() {
  const { data, loading, error, reload } = useCustomerOverview()
  const [signingOut, setSigningOut] = useState(false)
  const [actionError, setActionError] = useState("")
  const [paymentPassword, setPaymentPassword] = useState("")
  const [confirmPaymentPassword, setConfirmPaymentPassword] = useState("")
  const [currentPaymentPassword, setCurrentPaymentPassword] = useState("")
  const [currentAccountPassword, setCurrentAccountPassword] = useState("")
  const [savingPaymentPassword, setSavingPaymentPassword] = useState(false)
  const [paymentPasswordMessage, setPaymentPasswordMessage] = useState("")
  const user = data?.user

  async function updatePaymentPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingPaymentPassword(true)
    setActionError("")
    setPaymentPasswordMessage("")
    try {
      const response = await fetch("/api/user/security/payment-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentAccountPassword, currentPaymentPassword, paymentPassword, confirmPaymentPassword }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to update your payment password.")
      setPaymentPasswordMessage("Your payment password has been updated.")
      setCurrentAccountPassword(""); setCurrentPaymentPassword(""); setPaymentPassword(""); setConfirmPaymentPassword("")
      await reload()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to update your payment password.")
    } finally { setSavingPaymentPassword(false) }
  }
  async function signOut() {
    setSigningOut(true)
    setActionError("")
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (!response.ok) throw new Error("Unable to sign out. Please try again.")
      window.location.href = "/login"
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to sign out.")
      setSigningOut(false)
    }
  }
  return <UserShell userName={user?.name || "Client"} membership={customerStatus(user?.membershipStatus)}>
    <CustomerPageHeader eyebrow="YOUR ACCOUNT" title="Settings" description="Manage your account access and personal details." />
    <CustomerPageState loading={loading} error={error} retry={() => void reload()} />
    {!loading && !error && <section className="settings-surface customer-surface">
      <div><span>Account access</span><strong className="customer-status-pill">{customerStatus(user?.status)}</strong></div>
      <div><span>Membership</span><strong>{customerStatus(user?.membershipStatus)}</strong></div>
      <div className="settings-links"><Link href="/user/profile">Review profile details →</Link><Link href="/user/support">Visit help center →</Link></div>
      <form className="settings-payment-form" onSubmit={updatePaymentPassword}>
        <strong>{user?.hasPaymentPassword ? "Change payment password" : "Set a payment password"}</strong>
        <p>Confirm changes with your account password. Payment passwords are required to request a payout.</p>
        {user?.hasPaymentPassword && <label>Current payment password<input type="password" value={currentPaymentPassword} onChange={(event) => setCurrentPaymentPassword(event.target.value)} autoComplete="current-password" minLength={6} maxLength={200} required /></label>}
        <label>Current account password<input type="password" value={currentAccountPassword} onChange={(event) => setCurrentAccountPassword(event.target.value)} autoComplete="current-password" maxLength={200} required /></label>
        <label>New payment password<input type="password" value={paymentPassword} onChange={(event) => setPaymentPassword(event.target.value)} autoComplete="new-password" minLength={6} maxLength={200} required /></label>
        <label>Confirm new payment password<input type="password" value={confirmPaymentPassword} onChange={(event) => setConfirmPaymentPassword(event.target.value)} autoComplete="new-password" minLength={6} maxLength={200} required /></label>
        {paymentPasswordMessage && <span className="customer-inline-success" role="status">{paymentPasswordMessage}</span>}
        <button className="customer-primary-button" disabled={savingPaymentPassword}>{savingPaymentPassword ? "Saving…" : "Save payment password"}</button>
      </form>
      <div className="settings-security"><strong>Keep your account secure</strong><p>Use a unique password and sign out when you finish on a shared device.</p></div>
      {actionError && <div className="customer-inline-error" role="alert">{actionError}</div>}
      <button className="customer-primary-button" onClick={signOut} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
    </section>}
    <style jsx global>{`.settings-surface{max-width:740px;padding:22px}.settings-surface>div:not(.settings-links):not(.settings-security){display:flex;align-items:center;justify-content:space-between;gap:15px;padding:14px 0;border-bottom:1px solid #eef1eb}.settings-surface span{color:#68766e;font-size:12px}.settings-surface strong{color:#20382f;font-size:13px}.settings-links{display:flex;gap:18px;flex-wrap:wrap;padding:18px 0}.settings-links a{color:#456b54;font-size:12px;font-weight:700}.settings-payment-form{display:grid;gap:12px;border-top:1px solid #eef1eb;padding:20px 0}.settings-payment-form p{margin:-6px 0 2px;color:#68766e;font-size:12px;line-height:1.55}.settings-payment-form label{display:grid;gap:6px;color:#35443a;font-size:12px;font-weight:650}.settings-payment-form input{min-height:42px;border:1px solid #dce4dc;border-radius:8px;padding:9px 11px;font:inherit}.settings-payment-form button{justify-self:start;min-width:180px}.settings-security{margin:2px 0 16px;padding:15px;border-radius:10px;background:#f6f8f4}.settings-security strong{font-size:12px}.settings-security p{margin:5px 0 0;color:#68766e;font-size:11px;line-height:1.55}.settings-surface>.customer-primary-button{min-width:120px}@media(max-width:620px){.settings-surface{padding:16px}.settings-links{flex-direction:column;gap:12px}.settings-payment-form button{width:100%}}`}</style>
  </UserShell>
}
