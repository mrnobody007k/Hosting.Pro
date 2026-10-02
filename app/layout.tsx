import './globals.css'
import './experience.css'

export const metadata = {
  title: 'Housing.pro — Online Property Rental & Re-Rental Marketplace',
  description: 'Online Property Rental & Re-Rental Marketplace',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
