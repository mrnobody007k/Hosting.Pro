"use client"

import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, useCustomerOverview } from "../CustomerUI"

export default function ProgressPage() {
  const { data, loading, error, reload } = useCustomerOverview()
  const user = data?.user
  const steps = [
    { title: "Account created", date: user?.createdAt, text: "Your Housing.pro account is ready." },
    { title: "Account setup", date: user?.approvedAt, text: "Your account setup is being completed." },
    { title: "Membership", date: user?.officialMemberAt, text: "Your membership milestone is complete." },
  ]
  return <UserShell userName={user?.name || "Client"} membership={customerStatus(user?.membershipStatus)}>
    <CustomerPageHeader eyebrow="YOUR JOURNEY" title="Progress" description="Follow your account and membership milestones." />
    <CustomerPageState loading={loading} error={error} retry={() => void reload()} />
    {!loading && !error && <section className="progress-surface customer-surface">
      {steps.map((step, index) => <div className={"progress-step " + (step.date ? "complete" : "")} key={step.title}>
        <span className="progress-number">{step.date ? "✓" : String(index + 1).padStart(2, "0")}</span>
        <div><strong>{step.title}</strong><p>{step.date ? step.text : index === 1 ? "In progress" : index === 2 ? "Complete your available activities to reach this milestone." : "Not started"}</p></div>
        <time>{step.date ? new Date(step.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "In progress"}</time>
      </div>)}
    </section>}
  </UserShell>
}
