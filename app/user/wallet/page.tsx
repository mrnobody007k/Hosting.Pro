"use client"

import Link from "next/link"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, money, useCustomerOverview } from "../CustomerUI"

export default function WalletPage() {
  const { data, loading, error, reload } = useCustomerOverview({ includeFinancials: true })
  const user = data?.user
  const transactions = data?.transactions || []
  return <UserShell userName={user?.name || "Client"} membership={customerStatus(user?.membershipStatus)}>
    <CustomerPageHeader eyebrow="YOUR ACCOUNT" title="Wallet" description="Review your balance and recent wallet activity." />
    <CustomerPageState loading={loading} error={error} retry={() => void reload()} />
    {!loading && !error && <>
      <section className="wallet-summary">
        <article className="wallet-summary-primary"><span>Available balance</span><strong>{money(data?.availableBalance)}</strong><small>Ready to use</small></article>
        <article><span>Total balance</span><strong>{money(data?.wallet?.balance ?? data?.user?.wallet?.balance)}</strong><small>All wallet funds</small></article>
        <article><span>Reserved</span><strong>{money(data?.wallet?.reservedBalance ?? data?.user?.wallet?.reservedBalance)}</strong><small>Held for a pending request</small></article>
      </section>
      <section className="wallet-earnings-summary" aria-label="Wallet totals"><article><span>Task earnings</span><strong>{money(data?.earnings?.taskProfit)}</strong></article><article><span>Re-Rent earnings</span><strong>{money(data?.earnings?.rerentProfit)}</strong></article><article><span>Welcome balance</span><strong>{money(data?.walletSummary?.welcomeBonus)}</strong><small>Shown separately from task earnings</small></article><article><span>Approved deposits</span><strong>{money(data?.walletSummary?.approvedDeposits)}</strong></article><article><span>Approved withdrawals</span><strong>{money(data?.walletSummary?.approvedWithdrawals)}</strong></article></section>
      <div className="wallet-actions"><Link href="/user/deposits">Add funds →</Link><Link href="/user/withdrawals">Request a withdrawal →</Link></div>
      <section className="customer-surface customer-history wallet-transactions">
        <h2>Recent activity</h2>
        {transactions.length === 0 ? <CustomerPageState emptyTitle="No wallet activity yet" emptyText="Deposits, withdrawals and completed earnings will appear here." /> : transactions.map((item) => <div className="customer-history-row" key={item.id}><span>{customerStatus(item.type)}</span><strong>{money(item.amount)}</strong><small>{new Date(item.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></div>)}
      </section>
    </>}
  </UserShell>
}
