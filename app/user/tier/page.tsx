"use client"

import UserShell from "../UserShell"
import TierBadge from "../TierBadge"
import { CustomerPageHeader, CustomerPageState, customerStatus, useCustomerOverview } from "../CustomerUI"
import { isDisplayTier, type DisplayTier } from "@/lib/display-tier"

const tiers: Array<{ value: DisplayTier; detail: string }> = [
  { value: "GOLD", detail: "Gold display tier" },
  { value: "DIAMOND", detail: "Diamond display tier" },
  { value: "MERCHANT", detail: "Merchant display tier" },
]

export default function UserTierPage() {
  const { data, loading, error, reload } = useCustomerOverview()
  const user = data?.user
  const displayTier = isDisplayTier(user?.displayTier) ? user.displayTier : null

  return <UserShell userName={user?.name || "Client"} membership={customerStatus(user?.membershipStatus)}>
    <CustomerPageHeader eyebrow="YOUR ACCOUNT" title="Your Tier" description="View the display tier assigned to your Housing.pro account." action={<TierBadge tier={displayTier} />} />
    <CustomerPageState loading={loading} error={error} retry={() => void reload()} />
    {!loading && !error && <section className="tier-overview customer-surface">
      <div className="tier-current"><span>Current assignment</span><strong>{displayTier ? <TierBadge tier={displayTier} /> : "Not assigned"}</strong></div>
      <p>Your tier is informational only. It does not change your tasks, earnings, payouts, or account access.</p>
      <div className="tier-options" aria-label="Available display tiers">
        {tiers.map((tier) => <article key={tier.value} className={displayTier === tier.value ? "selected" : ""}>
          <TierBadge tier={tier.value} />
          <span>{tier.detail}</span>
          {displayTier === tier.value && <small>Assigned to your account</small>}
        </article>)}
      </div>
    </section>}
    <style jsx global>{`.tier-overview{padding:22px}.tier-current{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px;border:1px solid #e7ebe4;border-radius:12px;background:#fff}.tier-current>span{color:#68766e;font-size:12px}.tier-current>strong{color:#20382f;font-size:14px}.tier-current .hp-display-tier{display:inline-flex}.tier-overview>p{margin:16px 0;color:#68766e;font-size:12px;line-height:1.6}.tier-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:20px}.tier-options article{display:flex;min-height:130px;flex-direction:column;align-items:flex-start;gap:12px;padding:17px;border:1px solid #e7ebe4;border-radius:12px;background:#fff}.tier-options article.selected{border-color:#88a98e;background:#f7fbf5;box-shadow:0 0 0 2px #e8f1e7}.tier-options article>span:not(.hp-display-tier){color:#68766e;font-size:12px}.tier-options small{color:#315c45;font-size:10px;font-weight:750}@media(max-width:700px){.tier-options{grid-template-columns:1fr}.tier-current{align-items:flex-start;flex-direction:column}}`}</style>
  </UserShell>
}
