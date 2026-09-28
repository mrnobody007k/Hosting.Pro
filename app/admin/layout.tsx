import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/admin-login')
  if (session.role !== 'ADMIN') redirect(session.role === 'MANAGER' ? '/manager' : '/user')
  return children
}
