"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import UserShell from "../../UserShell"
import { CustomerPageState, customerStatus, money } from "../../CustomerUI"

type Property = { id: string; title: string; location?: string | null; description?: string | null; price: number | string; imageUrl?: string | null }

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [name, setName] = useState("Client")
  const [membership, setMembership] = useState("Member")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [propertyResponse, accountResponse] = await Promise.all([
        fetch("/api/user/properties/" + encodeURIComponent(params.id), { cache: "no-store" }),
        fetch("/api/user/overview", { cache: "no-store" }),
      ])
      if (propertyResponse.status === 401 || accountResponse.status === 401) { window.location.href = "/login"; return }
      const [propertyData, accountData] = await Promise.all([propertyResponse.json(), accountResponse.json()])
      if (!propertyResponse.ok) throw new Error(propertyData.error || "Unable to load this property.")
      if (!accountResponse.ok) throw new Error(accountData.error || "Unable to load your account.")
      setProperty(propertyData.property || null)
      setName(accountData.user?.name || "Client")
      setMembership(customerStatus(accountData.user?.membershipStatus))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load this property.")
    } finally { setLoading(false) }
  }, [params.id])
  useEffect(() => { void load() }, [load])

  async function book() {
    if (!property) return
    setBusy(true); setError("")
    try {
      const response = await fetch("/api/user/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: params.id, amount: String(property.price) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to create your booking.")
      const orderId = result.order?.id || result.id
      if (!orderId) throw new Error("Your booking was created but its details could not be opened.")
      router.push("/user/orders/" + orderId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create your booking.")
    } finally { setBusy(false) }
  }

  return <UserShell userName={name} membership={membership}>
    <Link href="/user/properties" className="property-back-link">← All properties</Link>
    <CustomerPageState loading={loading} error={error} retry={() => void load()} />
    {!loading && !error && !property && <CustomerPageState emptyTitle="This property is no longer available" emptyText="Browse the marketplace to explore current listings." />}
    {!loading && !error && property && <>
      <div className="property-detail-layout">
        <div className="property-detail-image">{property.imageUrl ? <img src={property.imageUrl} alt={property.title} /> : <div>Housing.pro</div>}</div>
        <section className="property-detail-copy">
          <span className="property-detail-location">{property.location || "Featured property"}</span>
          <h1>{property.title}</h1>
          <div className="property-detail-price">{money(property.price)}</div>
          <p>{property.description || "Review the booking details and payment instructions before continuing."}</p>
          <button className="customer-primary-button" onClick={book} disabled={busy}>{busy ? "Preparing your rental request…" : "Request this rental"}</button>
          <div className="property-payment-note"><strong>How payment works</strong><span>Housing.pro does not process payment through a gateway in this flow. After your request is created, follow the payment instructions in your booking and submit the reference or proof. Your booking stays pending until the manager verifies it.</span></div>
        </section>
      </div>
    </>}
  </UserShell>
}
