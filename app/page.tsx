import Image from 'next/image'
import Link from 'next/link'

const steps = [
  {
    number: '01',
    title: 'Explore a property',
    text: 'Browse active rental opportunities and review each property’s details and requirements.',
  },
  {
    number: '02',
    title: 'Submit a request',
    text: 'Follow the listed steps and send the required booking information through your account.',
  },
  {
    number: '03',
    title: 'Manager reviews',
    text: 'Your Manager reviews requests that need approval and guides applicable re-rental activity.',
  },
  {
    number: '04',
    title: 'Track your status',
    text: 'Follow your request, tasks, notifications, and eligible earnings from your account.',
  },
]

export default function Home() {
  return (
    <main className="hp-home">
      <header className="hp-home-header">
        <Link href="/" className="hp-home-brand" aria-label="Housing.pro home">
          <span className="hp-home-brand-mark" aria-hidden="true">H</span>
          <span>Housing<span className="hp-home-brand-dot">.</span>pro</span>
        </Link>
        <nav className="hp-home-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <Link href="/login" className="hp-home-login">Sign in</Link>
          <Link href="/register" className="hp-home-register">Create an account</Link>
        </nav>
      </header>

      <section className="hp-home-hero" aria-labelledby="home-title">
        <div className="hp-home-hero-copy">
          <p className="hp-home-eyebrow"><span aria-hidden="true" /> Online Property Rental &amp; Re-Rental Marketplace</p>
          <h1 id="home-title">Discover. Rent. <span>Re-Rent.</span></h1>
          <h2>Explore property opportunities with clear steps.</h2>
          <p className="hp-home-intro">
            Explore property details, submit a rental request, and follow booking and re-rental updates in your Housing.pro account.
          </p>
          <div className="hp-home-actions">
            <Link href="/register" className="hp-home-primary">
              Explore rental opportunities <span aria-hidden="true">→</span>
            </Link>
            <Link href="/login" className="hp-home-secondary">Already have an account? Sign in</Link>
          </div>
          <p className="hp-home-disclaimer">
            Re-rental activity and eligible earnings depend on the applicable process and approval. Earnings are not guaranteed.
          </p>
        </div>

        <div className="hp-home-visual">
          <div className="hp-home-photo-frame">
            <Image
              src="/homepage-rental-interior.webp"
              alt="Bright, furnished living room with large windows"
              fill
              priority
              sizes="(max-width: 850px) 100vw, 52vw"
              className="hp-home-photo"
            />
            <div className="hp-home-photo-shade" />
            <div className="hp-home-photo-label">
              <span>YOUR NEXT STEP</span>
              <strong>Explore rental opportunities</strong>
            </div>
          </div>
          <div className="hp-home-visual-note">
            <span className="hp-home-visual-icon" aria-hidden="true">↗</span>
            <span>Explore rentals.<br />Follow the process. Track your progress.</span>
          </div>
          <span className="hp-home-visual-index" aria-hidden="true">HOUSING.PRO&nbsp; / &nbsp;01</span>
        </div>
      </section>

      <section className="hp-home-process" id="how-it-works" aria-labelledby="process-title">
        <div className="hp-home-section-heading">
          <p className="hp-home-eyebrow">A CLEARER WAY FORWARD</p>
          <h2 id="process-title">How it works</h2>
          <p>Take each step in your account, with your Manager guiding requests that need review.</p>
        </div>
        <ol className="hp-home-steps">
          {steps.map((step) => (
            <li key={step.number}>
              <span className="hp-home-step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="hp-home-process-note">
          Each opportunity follows its applicable requirements and review. A request or potential earning is not a guarantee of approval or income.
        </p>
      </section>

      <section className="hp-home-bottom-cta" aria-label="Explore rental opportunities">
        <div>
          <p className="hp-home-eyebrow">START WITH A PROPERTY</p>
          <h2>Explore what’s available to you.</h2>
          <p>Sign in to browse active opportunities and follow your requests in one place.</p>
        </div>
        <Link href="/login" className="hp-home-bottom-link">Sign in to explore <span aria-hidden="true">→</span></Link>
      </section>

      <footer className="hp-home-footer">
        <Link href="/" className="hp-home-brand" aria-label="Housing.pro home">
          <span className="hp-home-brand-mark" aria-hidden="true">H</span>
          <span>Housing<span className="hp-home-brand-dot">.</span>pro</span>
        </Link>
        <p>Rental and re-rental opportunities, with clear steps and status updates.</p>
        <div><Link href="/login">Sign in</Link><Link href="/user/support">Need help?</Link></div>
      </footer>
    </main>
  )
}
