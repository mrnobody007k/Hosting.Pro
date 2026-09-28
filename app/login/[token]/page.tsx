import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import LoginForm from '../../login/LoginForm'

export async function generateMetadata() {
  return { robots: 'noindex, nofollow' }
}

export default async function CustomerLoginTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const setting = await prisma.platformSetting.findFirst({
    select: { customerLoginAccessToken: true },
  })

  const activeToken = setting?.customerLoginAccessToken

  if (!activeToken || activeToken !== token) {
    notFound()
  }

  return <LoginForm role="USER" />
}