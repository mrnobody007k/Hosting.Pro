import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import LoginForm from '../../login/LoginForm'
import { matchesAccessToken } from '@/lib/access-token'

export async function generateMetadata() {
  return { robots: 'noindex, nofollow' }
}

export default async function ManagerLoginTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const setting = await prisma.platformSetting.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { managerLoginAccessToken: true },
  })

  const activeToken = setting?.managerLoginAccessToken

  if (!matchesAccessToken(token, activeToken)) {
    notFound()
  }

  return <LoginForm role="MANAGER" accessToken={token} />
}
