"use client"

import Link from "next/link"
import UserShell from "../UserShell"
import { CustomerPageHeader } from "../CustomerUI"

const topics = [
  { title: "Property Browsing", text: "Visit Properties to explore available listings. Use search and filters to find the right property for your rental needs." },
  { title: "Booking & Rent", text: "Create a rental request, follow the payment instructions shown for your account, then submit your payment reference or proof from the booking details page. A Manager reviews the payment before the booking is activated." },
  { title: "Add Funds", text: "Wallet deposits continue to use the existing manual payment and reference/proof workflow. A manager reviews each deposit before it is credited." },
  { title: "Re-Rent Tasks", text: "A Re-Rent activity appears in your Task Center after your manager assigns it. After you submit it and the configured delay passes, your manager enters and approves the final return." },
  { title: "Task Completion", text: "Daily tasks (Day 2 Morning, Day 2 Afternoon, Day 3 Official) unlock as you progress. Complete them to earn profit and advance your membership." },
  { title: "Earnings & Revenue", text: "Track completed task credits and completed Re-Rent activity in the Revenue section. Day 2 and Day 3 percentages describe their task tiers; they are not a Re-Rent return estimate. Pending Re-Rent activities do not show projected revenue." },
  { title: "Account Support", text: "For account access, profile changes, or technical issues, contact Housing.pro support using the details shared with your account." },
]

export default function SupportPage() {
  return <UserShell>
    <CustomerPageHeader eyebrow="Housing.pro Support" title="How can we help?" description="Guidance for property browsing, bookings, tasks, earnings, and account questions." />
    <section className="support-topics">{topics.map((topic) => <article key={topic.title}><span>Housing.pro help</span><h2>{topic.title}</h2><p>{topic.text}</p></article>)}</section>
    <div className="support-contact"><div><strong>Still need a hand?</strong><p>No in-app support contact is configured yet. If you have received Housing.pro support contact details, include your booking code when you reach out.</p></div><Link href="/user/orders">View my bookings →</Link></div>
    <style jsx>{`
      .support-topics {
        display: grid;
        gap: 12px;
      }
      .support-topics article {
        padding: 18px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: #fff;
      }
      .support-topics span {
        display: block;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .08em;
        color: #64748b;
        margin-bottom: 6px;
      }
      .support-topics h2 {
        margin: 0 0 6px;
        font-size: 15px;
        color: #0f172a;
      }
      .support-topics p {
        margin: 0;
        color: #64748b;
        font-size: 13px;
        line-height: 1.6;
      }
      .support-contact {
        margin-top: 24px;
        padding: 20px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: #f8fafc;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }
      .support-contact strong {
        display: block;
        font-size: 14px;
        color: #0f172a;
      }
      .support-contact p {
        margin: 4px 0 0;
        color: #64748b;
        font-size: 13px;
      }
      @media (max-width: 640px) {
        .support-contact {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `}</style>
  </UserShell>
}
