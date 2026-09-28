import './globals.css'

export const metadata = {
  title: 'Housing.pro — Online Property Rental & Re-Rental Marketplace',
  description: 'Discover property opportunities, rent with clear payment instructions, and follow re-rental progress with Housing.pro.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
