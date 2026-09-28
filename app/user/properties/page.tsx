"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Decimal } from "decimal.js"
import Link from "next/link"
import UserShell from "../UserShell"
import { CustomerPageHeader, CustomerPageState, customerStatus, money } from "../CustomerUI"

type Property = { id: string; title: string; location?: string | null; description?: string | null; price: string; imageUrl?: string | null; createdAt: string }

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [name, setName] = useState("Client")
  const [membership, setMembership] = useState("Member")
  const [search, setSearch] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [sort, setSort] = useState("newest")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [propertyResponse, accountResponse] = await Promise.all([
        fetch("/api/user/properties", { cache: "no-store" }),
        fetch("/api/user/overview", { cache: "no-store" }),
      ])
      if (propertyResponse.status === 401 || accountResponse.status === 401) { window.location.href = "/login"; return }
      const [propertyData, accountData] = await Promise.all([propertyResponse.json(), accountResponse.json()])
      if (!propertyResponse.ok) throw new Error(propertyData.error || "Unable to load properties.")
      if (!accountResponse.ok) throw new Error(accountData.error || "Unable to load your account.")
      setProperties(propertyData.properties || [])
      setName(accountData.user?.name || "Client")
      setMembership(customerStatus(accountData.user?.membershipStatus))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load properties.")
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    let minimum: Decimal | null = null
    let maximum: Decimal | null = null
    try { if (minPrice) minimum = new Decimal(minPrice) } catch { minimum = null }
    try { if (maxPrice) maximum = new Decimal(maxPrice) } catch { maximum = null }
    const results = properties.filter((property) => {
      const matchesText = !query || [property.title, property.location, property.description].filter(Boolean).join(" ").toLowerCase().includes(query)
      let price: Decimal
      try { price = new Decimal(property.price) } catch { return false }
      return matchesText && price.isFinite() && (!minimum || price.gte(minimum)) && (!maximum || price.lte(maximum))
    })
    if (sort === "price-low") results.sort((a, b) => new Decimal(a.price).comparedTo(new Decimal(b.price)) || 0)
    if (sort === "price-high") results.sort((a, b) => new Decimal(b.price).comparedTo(new Decimal(a.price)) || 0)
    return results
  }, [properties, search, minPrice, maxPrice, sort])

  const invalidRange = Boolean(minPrice && maxPrice && (() => {
    try { return new Decimal(minPrice).gt(new Decimal(maxPrice)) } catch { return false }
  })())
  const resetFilters = () => { setSearch(""); setMinPrice(""); setMaxPrice(""); setSort("newest") }

  return <UserShell userName={name} membership={membership}>
    <CustomerPageHeader eyebrow="THE MARKETPLACE" title="Explore properties" description="Browse available listings and view the details before you book." />
    <section className="market-property-filters" aria-label="Refine property listings">
      <label>Search listings<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Property name or location" /></label>
      <label>Minimum price<input type="number" min="0" step="0.01" inputMode="decimal" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="₹ Min" /></label>
      <label>Maximum price<input type="number" min="0" step="0.01" inputMode="decimal" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="₹ Max" /></label>
      <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Recently added</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
      <button type="button" onClick={resetFilters} disabled={!search && !minPrice && !maxPrice && sort === "newest"}>Reset</button>
    </section>
    {invalidRange && <p className="market-filter-error" role="alert">Minimum price must be lower than or equal to the maximum price.</p>}
    <CustomerPageState loading={loading} error={error} retry={() => void load()} />
    {!loading && !error && filtered.length === 0 && <CustomerPageState emptyTitle={properties.length ? "No matching properties" : "No properties available yet"} emptyText={properties.length ? "Adjust or reset your search and price filters." : "New property listings will appear here as they become available."} />}
    {!loading && !error && filtered.length > 0 && <section className="market-property-grid" aria-label="Available properties">
      {filtered.map((property) => <article className="market-property-card" key={property.id}>
        <Link href={"/user/properties/" + property.id} className="market-property-image" aria-label={"View " + property.title}>
          {property.imageUrl ? <img src={property.imageUrl} alt={property.title} loading="lazy" /> : <div className="market-property-placeholder">Housing.pro</div>}
          <span>Available</span>
        </Link>
        <div className="market-property-copy"><small>{property.location || "Featured property"}</small><h2>{property.title}</h2><p>{property.description || "Explore the property details and booking information."}</p>
          <div className="market-property-footer"><strong>{money(property.price)}</strong><Link href={"/user/properties/" + property.id}>View details <span aria-hidden="true">→</span></Link></div>
        </div>
      </article>)}
    </section>}
  </UserShell>
}
