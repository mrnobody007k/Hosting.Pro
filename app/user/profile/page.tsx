"use client"

import UserShell from "../UserShell"
import Link from "next/link"
import { CustomerPageHeader, CustomerPageState, customerStatus, useCustomerOverview } from "../CustomerUI"

export default function ProfilePage() {
  const { data, loading, error, reload } = useCustomerOverview()
  const user = data?.user
  return <UserShell userName={user?.name || "Client"} membership={customerStatus(user?.membershipStatus)}>
    <CustomerPageHeader eyebrow="YOUR ACCOUNT" title="Profile" description="Review the personal details connected to your Housing.pro account." />
    <CustomerPageState loading={loading} error={error} retry={() => void reload()} />
    {!loading && !error && <nav className="customer-profile-menu" aria-label="Account shortcuts">
      {[["Wallet", "/user/wallet", "Check available balance and earnings"], ["My bookings", "/user/orders", "Track rental and payment status"], ["Tier", "/user/tier", "View your assigned display tier"], ["Add funds", "/user/deposits", "Follow instructions and submit a deposit"], ["Withdrawals", "/user/withdrawals", "Review or request a payout"], ["Activity", "/user/activity", "See account and wallet updates"], ["Notifications", "/user/notifications", "Read important account messages"], ["Account access", "/user/referral", "Review how your account is linked"], ["Settings", "/user/settings", "Update payment password and security"]].map(([title, href, detail]) => <Link key={href} href={href}><strong>{title}</strong><span>{detail}</span><b aria-hidden="true">→</b></Link>)}
    </nav>}
    {!loading && !error && <section className="profile-surface customer-surface">
      {[
        ["Full name", user?.name], ["Email address", user?.email], ["Phone number", user?.phone],
        ["Age", user?.age], ["Profession", user?.profession], ["Account", customerStatus(user?.status)],
        ["Display tier", user?.displayTier ? user.displayTier.charAt(0) + user.displayTier.slice(1).toLowerCase() : "Not assigned"],
      ].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value || "Not provided"}</strong></div>)}
      <p>Your profile details are read-only here. Contact Housing.pro support if a correction is needed.</p>
    </section>}
    <style jsx global>{`.customer-profile-menu{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.customer-profile-menu a{position:relative;min-height:78px;display:flex;flex-direction:column;justify-content:center;gap:6px;padding:14px 32px 14px 15px;border:1px solid #e7ebe4;border-radius:12px;background:#fff;text-decoration:none}.customer-profile-menu strong{color:#315c45;font-size:12px}.customer-profile-menu span{color:#758178;font-size:10px;line-height:1.45}.customer-profile-menu b{position:absolute;right:13px;color:#78917e}.profile-surface{display:grid;grid-template-columns:1fr 1fr;gap:1px;padding:1px;overflow:hidden;background:#e7ebe4}.profile-surface>div{padding:18px;background:white}.profile-surface span,.profile-surface strong{display:block}.profile-surface span{color:#7b887f;font-size:10px}.profile-surface strong{margin-top:7px;color:#20382f;font-size:13px}.profile-surface>p{grid-column:1/-1;margin:0;padding:14px 18px;background:#f7faf6;color:#68766e;font-size:11px;line-height:1.5}@media(max-width:900px){.customer-profile-menu{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.profile-surface{grid-template-columns:1fr}.customer-profile-menu a{min-height:72px;padding:12px 29px 12px 12px}}`}</style>
  </UserShell>
}
