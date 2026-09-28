import Link from 'next/link'

const highlights = [
  { number: '01', title: 'Discover', text: 'Explore property details and rental opportunities so you can choose with clarity.' },
  { number: '02', title: 'Rent', text: 'Request a property and keep payment instructions, booking references and updates together.' },
  { number: '03', title: 'Re-Rent', text: 'Follow your rental journey and any re-rental activity from your account.' },
]

export default function Home() {
  return (
    <main className="market-home">
      <header className="market-header">
        <Link href="/" className="market-brand" aria-label="Housing.pro home">
          <span className="market-brand-mark">H</span>
          <span>Housing.pro</span>
        </Link>
        <nav className="market-header-nav" aria-label="Main navigation">
          <Link href="/login">Sign in</Link>
          <Link href="/register" className="market-nav-cta">Create an account</Link>
        </nav>
      </header>

      <section className="market-hero">
        <div className="market-hero-copy">
          <span className="market-kicker">Housing.pro — Online Property Rental &amp; Re-Rental Marketplace</span>
          <h1>Discover. Rent. <em>Re-Rent.</em></h1>
          <p>Explore property details, request a rental and follow payment confirmation and re-rental updates in one clear place.</p>
          <div className="market-hero-actions">
            <Link href="/register" className="market-button market-button-dark">Explore rental opportunities <span aria-hidden="true">→</span></Link>
            <Link href="/login" className="market-text-link">Already have an account? Sign in</Link>
          </div>
          <div className="market-trust-line"><span className="market-trust-dot" /> Clear details · Personal support · Secure account</div>
        </div>
        <div className="market-hero-art" aria-label="Illustration of a modern home">
          <div className="market-art-sun" />
          <div className="market-art-hill market-art-hill-back" />
          <div className="market-art-hill market-art-hill-front" />
          <div className="market-art-house"><div className="market-art-roof" /><div className="market-art-walls"><span /><span /><i /></div></div>
          <div className="market-art-caption"><span>Discover · Rent · Re-Rent</span><b>Your property journey, made clear.</b></div>
        </div>
      </section>

      <section className="market-highlights" aria-label="Marketplace benefits">
        {highlights.map((item) => <article key={item.number}>
          <span>{item.number}</span><h2>{item.title}</h2><p>{item.text}</p>
        </article>)}
      </section>

      <section className="market-bottom-cta">
        <div><span className="market-kicker">Your next rental starts here</span><h2>Find your next place.</h2><p>Create your Housing.pro account to explore available properties, request a rental and follow your bookings.</p></div>
        <Link href="/register" className="market-button market-button-light">Get started <span aria-hidden="true">→</span></Link>
      </section>

      <footer className="market-footer"><Link href="/" className="market-brand"><span className="market-brand-mark">H</span><span>Housing.pro</span></Link><span>Property discovery, made clearer.</span><Link href="/user/support">Need help?</Link></footer>
    </main>
  )
}
