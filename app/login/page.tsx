import LoginForm from './LoginForm'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const setting = await prisma.platformSetting.findFirst({ orderBy: { updatedAt: 'desc' }, select: { customerLoginAccessToken: true } })
  if (setting?.customerLoginAccessToken) notFound()
  return <LoginForm role="USER" />
}
