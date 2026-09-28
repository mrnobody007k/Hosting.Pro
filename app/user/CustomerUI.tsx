"use client"

import { ReactNode, useCallback, useEffect, useState } from "react"
import { Decimal } from "decimal.js"

export type CustomerOverview = {
  user?: { id: string; name: string; email: string; age?: number | null; profession?: string | null; phone?: string | null; status?: string; membershipStatus?: string; approvedAt?: string | null; officialMemberAt?: string | null; createdAt?: string; hasPaymentPassword?: boolean }
  wallet?: { balance?: string | number; reservedBalance?: string | number }
  availableBalance?: string | number
  transactions?: Array<{ id: string; type: string; amount: string | number; balanceBefore: string | number; balanceAfter: string | number; createdAt: string; note?: string | null }>
  deposits?: Array<{ id: string; amount: string | number; reference?: string | null; status: string; createdAt: string; processedAt?: string | null }>
  withdrawals?: Array<{ id: string; amount: string | number; method?: string | null; status: string; createdAt: string; processedAt?: string | null }>
  setting?: { depositInstructions?: string }
}

export function useCustomerOverview() {
  const [data, setData] = useState<CustomerOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const reload = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/user/overview", { cache: "no-store" })
      if (response.status === 401) { window.location.href = "/login"; return }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load your account.")
      setData(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your account.")
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void reload() }, [reload])
  return { data, loading, error, reload }
}

export function CustomerPageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="customer-page-heading"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

export function CustomerPageState({ loading, error, retry, emptyTitle, emptyText }: { loading?: boolean; error?: string; retry?: () => void; emptyTitle?: string; emptyText?: string }) {
  if (loading) return <div className="customer-data-state" role="status"><span className="customer-spinner" />Loading your information…</div>
  if (error) return <div className="customer-data-state customer-data-error" role="alert"><strong>We couldn’t load this page.</strong><span>{error}</span>{retry && <button onClick={retry}>Try again</button>}</div>
  if (emptyTitle) return <div className="customer-data-state"><strong>{emptyTitle}</strong><span>{emptyText}</span></div>
  return null
}

export function money(value: unknown) {
  let amount: Decimal
  try { amount = new Decimal(String(value ?? "0")) } catch { amount = new Decimal(0) }
  if (!amount.isFinite()) amount = new Decimal(0)
  const fixed = amount.abs().toFixed(2)
  const [integer, fraction] = fixed.split(".")
  const grouped = integer.length <= 3 ? integer : `${integer.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${integer.slice(-3)}`
  return `${amount.isNegative() ? "-" : ""}₹${grouped}.${fraction}`
}

export function customerStatus(value: unknown) {
  const status = String(value || "").toUpperCase()
  const labels: Record<string, string> = {
    PAYMENT_PENDING: "Payment needed", PAYMENT_SUBMITTED: "Payment submitted", PAYMENT_VERIFIED: "Payment confirmed",
    RE_RENT_PENDING: "Re-rental in progress", RE_RENTED: "Your order has been re-rented successfully", OFFICIAL_MEMBER: "Member",
    DAY_1: "Getting started", DAY_2: "In progress", PENDING_APPROVAL: "Setup in progress",
    APPROVED: "Confirmed", PENDING: "In progress", PAID: "Paid", ACTIVE: "Active",
    COMPLETED: "Completed", REJECTED: "Not completed", CANCELLED: "Cancelled", DISABLED: "Unavailable",
  }
  return labels[status] || status.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) || "—"
}
