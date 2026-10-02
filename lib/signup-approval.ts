import { Prisma, type PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'

const WELCOME_BALANCE = new Decimal('120.00')

export type SignupApprovalActor =
  | { type: 'MANAGER'; id: string; managerId: string }
  | { type: 'ADMIN'; id: string }

type TransactionClient = Prisma.TransactionClient
const MAX_SERIALIZATION_ATTEMPTS = 3

function isSerializationConflict(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')
}

export async function approveSignup(
  tx: TransactionClient,
  userId: string,
  actor: SignupApprovalActor,
  processedAt = new Date(),
) {
  const scope = actor.type === 'MANAGER' ? { managerId: actor.managerId } : {}
  const user = await tx.user.findFirst({
    where: { id: userId, ...scope },
    select: { id: true, name: true, managerId: true, signupStatus: true },
  })
  if (!user) throw new Error('USER_NOT_FOUND')
  if (user.signupStatus !== 'PENDING') throw new Error('SIGNUP_ALREADY_PROCESSED')

  const claimed = await tx.user.updateMany({
    where: { id: user.id, signupStatus: 'PENDING', ...scope },
    data: { signupStatus: 'APPROVED', membershipStatus: 'DAY_1', status: 'ACTIVE', approvedAt: processedAt },
  })
  if (claimed.count !== 1) throw new Error('SIGNUP_ALREADY_PROCESSED')

  const wallet = await tx.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } })
  if (!wallet) throw new Error('USER_WALLET_NOT_FOUND')
  const balanceBefore = new Decimal(wallet.balance.toString())
  const balanceAfter = balanceBefore.add(WELCOME_BALANCE)
  const reference = `day1-welcome:${user.id}`
  const existingWelcome = await tx.transaction.findFirst({
    where: { userId: user.id, type: 'WELCOME_BONUS', reference },
    select: { id: true },
  })
  if (existingWelcome) throw new Error('WELCOME_CREDIT_ALREADY_EXISTS')

  await tx.wallet.update({ where: { userId: user.id }, data: { balance: { increment: WELCOME_BALANCE } } })
  await tx.transaction.create({
    data: {
      userId: user.id,
      managerId: user.managerId,
      type: 'WELCOME_BONUS',
      amount: WELCOME_BALANCE,
      balanceBefore,
      balanceAfter,
      reference,
      note: 'Signup approval welcome balance.',
    },
  })
  await tx.auditLog.create({
    data: {
      actorType: actor.type,
      actorId: actor.id,
      managerId: user.managerId,
      action: actor.type === 'ADMIN' ? 'ADMIN_USER_SIGNUP_APPROVED' : 'USER_SIGNUP_APPROVED',
      targetType: 'USER',
      targetId: user.id,
      amount: WELCOME_BALANCE,
      metadata: { userName: user.name, membershipStatus: 'DAY_1', welcomeCreditReference: reference },
    },
  })
  await tx.notification.create({
    data: {
      userId: user.id,
      type: 'SUCCESS',
      title: 'Your account is ready',
      message: `Your account setup is complete. INR ${WELCOME_BALANCE.toFixed(2)} has been added to your wallet. You are now on Day 1.`,
    },
  })

  return { balanceAfter }
}

export async function approveSignupTransaction(
  prisma: PrismaClient,
  userId: string,
  actor: SignupApprovalActor,
  processedAt = new Date(),
) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(
        (tx) => approveSignup(tx, userId, actor, processedAt),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (error) {
      if (isSerializationConflict(error) && attempt < MAX_SERIALIZATION_ATTEMPTS) continue
      if (isSerializationConflict(error)) throw new Error('SIGNUP_APPROVAL_CONFLICT')
      throw error
    }
  }
}

export const SIGNUP_WELCOME_BALANCE = WELCOME_BALANCE.toFixed(2)
