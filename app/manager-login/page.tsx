import LoginForm from '../login/LoginForm'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function ManagerLoginPage() {
  const setting = await prisma.platformSetting.findFirst({ orderBy: { updatedAt: 'desc' }, select: { managerLoginAccessToken: true } })
  if (setting?.managerLoginAccessToken) notFound()
  return <LoginForm role="MANAGER" />
}
