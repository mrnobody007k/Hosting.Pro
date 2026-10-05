"use client"

import { useState } from "react"
import Link from "next/link"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, useCustomerOverview } from "../CustomerUI"

export default function SettingsPage() {
  const { data, loading, error, reload } = useCustomerOverview()
  const [signingOut, setSigningOut] = useState(false)
  const [actionError, setActionError] = useState("")
  const user = data?.user

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
      <div className="settings-security"><strong>Keep your account secure</strong><p>Your payment password is created during signup and is used only to confirm withdrawal requests. Use a unique account password and sign out when you finish on a shared device.</p></div>
      {actionError && <div className="customer-inline-error" role="alert">{actionError}</div>}
      <button className="customer-primary-button" onClick={signOut} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
    </section>}
    <style jsx global>{`.settings-surface{max-width:740px;padding:22px}.settings-surface>div:not(.settings-links):not(.settings-security){display:flex;align-items:center;justify-content:space-between;gap:15px;padding:14px 0;border-bottom:1px solid #eef1eb}.settings-surface span{color:#68766e;font-size:12px}.settings-surface strong{color:#20382f;font-size:13px}.settings-links{display:flex;gap:18px;flex-wrap:wrap;padding:18px 0}.settings-links a{color:#456b54;font-size:12px;font-weight:700}.settings-security{margin:2px 0 16px;padding:15px;border-radius:10px;background:#f6f8f4}.settings-security strong{font-size:12px}.settings-security p{margin:5px 0 0;color:#68766e;font-size:11px;line-height:1.55}.settings-surface>.customer-primary-button{min-width:120px}@media(max-width:620px){.settings-surface{padding:16px}.settings-links{flex-direction:column;gap:12px}}`}</style>
  </UserShell>
}
