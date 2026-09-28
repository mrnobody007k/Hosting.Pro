import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import LoginForm from '../../login/LoginForm'

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
    select: { managerLoginAccessToken: true },
  })

  const activeToken = setting?.managerLoginAccessToken

  if (!activeToken || activeToken !== token) {
    notFound()
  }

  return <LoginForm role="MANAGER" />
}