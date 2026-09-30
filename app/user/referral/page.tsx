"use client"

import Link from "next/link"
import UserShell from "../UserShell"
import { CustomerPageHeader, customerStatus, useCustomerOverview } from "../CustomerUI"

export default function ReferralPage() {
  const { data, loading, error } = useCustomerOverview()
  return <UserShell userName={data?.user?.name || "Client"} membership={customerStatus(data?.user?.membershipStatus)}>
    <CustomerPageHeader eyebrow="YOUR ACCOUNT" title="Account access" description="Understand how your Housing.pro account is connected." />
    <section className="customer-surface customer-access-card">
      <span className="customer-access-icon" aria-hidden="true">✓</span>
      <div><h2>Your account is linked</h2><p>{loading ? "Loading account status…" : error ? "Account status could not be loaded." : `Your account is connected to Housing.pro under ${customerStatus(data?.user?.membershipStatus)} membership.`}</p></div>
      <div className="customer-access-note"><strong>Invitation codes</strong><span>The access code used during registration links an account to its manager. User accounts do not issue referral codes or reward credits.</span></div>
      <div className="customer-access-actions"><Link href="/user/profile">View profile</Link><Link href="/user/support">Get account help</Link></div>
    </section>
    <style jsx global>{`.customer-access-card{max-width:720px;padding:24px}.customer-access-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#eaf4eb;color:#315c45;font-weight:900}.customer-access-card h2{margin:15px 0 6px;color:#20382f;font-size:20px}.customer-access-card p{color:#68766e;font-size:13px;line-height:1.6}.customer-access-note{display:grid;gap:5px;margin:18px 0;padding:15px;border-radius:10px;background:#f6f8f4}.customer-access-note strong{font-size:12px;color:#315c45}.customer-access-note span{color:#68766e;font-size:12px;line-height:1.6}.customer-access-actions{display:flex;flex-wrap:wrap;gap:12px}.customer-access-actions a{color:#315c45;font-size:12px;font-weight:750}`}</style>
  </UserShell>
}
