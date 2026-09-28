"use client"

import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, useCustomerOverview } from "../CustomerUI"

export default function ProfilePage() {
  const { data, loading, error, reload } = useCustomerOverview()
  const user = data?.user
  return <UserShell userName={user?.name || "Client"} membership={customerStatus(user?.membershipStatus)}>
    <CustomerPageHeader eyebrow="YOUR ACCOUNT" title="Profile" description="Review the personal details connected to your Housing.pro account." />
    <CustomerPageState loading={loading} error={error} retry={() => void reload()} />
    {!loading && !error && <section className="profile-surface customer-surface">
      {[
        ["Full name", user?.name], ["Email address", user?.email], ["Phone number", user?.phone],
        ["Age", user?.age], ["Profession", user?.profession], ["Account", customerStatus(user?.status)],
      ].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value || "Not provided"}</strong></div>)}
      <p>Your profile details are read-only here. Contact Housing.pro support if a correction is needed.</p>
    </section>}
    <style jsx global>{`.profile-surface{display:grid;grid-template-columns:1fr 1fr;gap:1px;padding:1px;overflow:hidden;background:#e7ebe4}.profile-surface>div{padding:18px;background:white}.profile-surface span,.profile-surface strong{display:block}.profile-surface span{color:#7b887f;font-size:10px}.profile-surface strong{margin-top:7px;color:#20382f;font-size:13px}.profile-surface>p{grid-column:1/-1;margin:0;padding:14px 18px;background:#f7faf6;color:#68766e;font-size:11px;line-height:1.5}@media(max-width:620px){.profile-surface{grid-template-columns:1fr}}`}</style>
  </UserShell>
}
