"use client"

import Link from "next/link"
import UserShell from "../UserShell"
import { CustomerPageHeader } from "../CustomerUI"

const topics = [
  { title: "Property Browsing", text: "Visit Properties to explore available listings. Use search and filters to find the right property for your rental needs." },
  { title: "Booking & Order Confirmation", text: "After booking a property, check My Rentals for order status. Your manager will confirm payment once you submit the reference." },
  { title: "Manager-Assisted Payment", text: "Housing.pro does not process payments online. Follow the payment details shared with your account, then submit your transaction reference for verification." },
  { title: "Re-Rent Tasks", text: "A Re-Rent activity appears in your Task Center only after your manager assigns it to an eligible booking. After you submit it, settlement runs after the configured processing delay." },
  { title: "Task Completion", text: "Daily tasks (Day 2 Morning, Day 2 Afternoon, Day 3 Official) unlock as you progress. Complete them to earn profit and advance your membership." },
  { title: "Earnings & Revenue", text: "Track your task profits and re-rent earnings in the Revenue section. Day 2 tasks earn 1.2%, Day 3 tasks earn 1.4%, Re-Rent earns 1.2%." },
  { title: "Account Support", text: "For account access, profile changes, or technical issues, contact Housing.pro support using the details shared with your account." },
]

export default function SupportPage() {
  return <UserShell>
    <CustomerPageHeader eyebrow="Housing.pro Support" title="How can we help?" description="Guidance for property browsing, bookings, tasks, earnings, and account questions." />
    <section className="support-topics">{topics.map((topic) => <article key={topic.title}><span>Housing.pro help</span><h2>{topic.title}</h2><p>{topic.text}</p></article>)}</section>
    <div className="support-contact"><div><strong>Still need a hand?</strong><p>No in-app support contact is configured yet. For a booking question, include its booking code when using the support details provided to you by Housing.pro.</p></div><Link href="/user/orders">View my bookings →</Link></div>
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
