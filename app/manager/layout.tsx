import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/manager-login')
  if (session.role !== 'MANAGER') redirect(session.role === 'ADMIN' ? '/admin' : '/user')
  return children
}
