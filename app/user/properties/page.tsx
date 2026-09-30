"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, money, useCustomerOverview } from "../CustomerUI"

type Property = { id: string; title: string; location?: string | null; description?: string | null; price: string; imageUrl?: string | null; createdAt: string }

export default function PropertiesPage() {
  const { data: account } = useCustomerOverview()
  const [properties, setProperties] = useState<Property[]>([])
  const [search, setSearch] = useState("")
  const [location, setLocation] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [sort, setSort] = useState("newest")
  const [cursor, setCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async (append = false, signal?: AbortSignal) => {
    if (append) setLoadingMore(true); else setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ q: search.trim(), location: location.trim(), minPrice, maxPrice, sort })
      if (append && cursor) params.set("cursor", cursor)
      const response = await fetch(`/api/user/properties?${params}`, { cache: "no-store", signal })
      if (response.status === 401) { window.location.href = "/login"; return }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load properties.")
      const page = Array.isArray(result.properties) ? result.properties : []
      setProperties((current) => append ? [...current, ...page] : page)
      setCursor(page.at(-1)?.id || null)
      setNextCursor(result.nextCursor || null)
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return
      setError(cause instanceof Error ? cause.message : "Unable to load properties.")
    } finally { setLoading(false); setLoadingMore(false) }
  }, [search, location, minPrice, maxPrice, sort, cursor])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => { setCursor(null); void load(false, controller.signal) }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [search, location, minPrice, maxPrice, sort])

  const invalidRange = Boolean(minPrice && maxPrice && Number(minPrice) > Number(maxPrice))
  const reset = () => { setSearch(""); setLocation(""); setMinPrice(""); setMaxPrice(""); setSort("newest") }

  return <UserShell userName={account?.user?.name || "Client"} membership={customerStatus(account?.user?.membershipStatus)}>
    <CustomerPageHeader eyebrow="THE MARKETPLACE" title="Explore properties" description="Browse listings available to your Housing.pro account and review details before requesting a rental." />
    <section className="market-property-filters" aria-label="Refine property listings">
      <label>Search listings<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Property name or details" /></label>
      <label>Location<input type="search" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City or area" /></label>
      <label>Minimum price (INR)<input type="number" min="0" step="0.01" inputMode="decimal" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="₹ Min" /></label>
      <label>Maximum price (INR)<input type="number" min="0" step="0.01" inputMode="decimal" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="₹ Max" /></label>
      <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Recently added</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
      <button type="button" onClick={reset} disabled={!search && !location && !minPrice && !maxPrice && sort === "newest"}>Reset filters</button>
    </section>
    {invalidRange && <p className="market-filter-error" role="alert">Minimum price must be lower than or equal to the maximum price.</p>}
    <CustomerPageState loading={loading} error={error} retry={() => void load()} />
    {!loading && !error && properties.length === 0 && <CustomerPageState emptyTitle="No properties found" emptyText="Adjust your filters or check back as new listings become available." />}
    {!loading && !error && properties.length > 0 && <>
      <section className="market-property-grid" aria-label="Available properties">
        {properties.map((property) => <article className="market-property-card" key={property.id}>
          <Link href={`/user/properties/${property.id}`} className="market-property-image" aria-label={`View ${property.title}`}>
            {property.imageUrl ? <img src={property.imageUrl} alt={property.title} loading="lazy" /> : <div className="market-property-placeholder">Housing.pro</div>}
            <span>Available</span>
          </Link>
          <div className="market-property-copy"><small>{property.location || "India"}</small><h2>{property.title}</h2><p>{property.description || "See the property details and booking instructions."}</p>
            <div className="market-property-footer"><strong>{money(property.price)}</strong><Link href={`/user/properties/${property.id}`}>View details <span aria-hidden="true">→</span></Link></div>
          </div>
        </article>)}
      </section>
      {nextCursor && <div className="customer-load-more"><button className="customer-primary-button" onClick={() => void load(true)} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more properties"}</button></div>}
    </>}
  </UserShell>
}
