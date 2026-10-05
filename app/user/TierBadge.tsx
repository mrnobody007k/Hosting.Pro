import { displayTierLabel, isDisplayTier, type DisplayTier } from '@/lib/display-tier'

export default function TierBadge({ tier }: { tier: DisplayTier | null }) {
  const assigned = isDisplayTier(tier)
  return <span className={`hp-display-tier${assigned ? '' : ' unassigned'}`}>
    {displayTierLabel(tier)}
  </span>
}
