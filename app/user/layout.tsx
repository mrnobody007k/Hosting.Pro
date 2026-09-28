import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'USER') redirect(session.role === 'ADMIN' ? '/admin' : '/manager')
  return children
}
