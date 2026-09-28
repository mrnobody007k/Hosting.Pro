import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const isProduction = process.env.NODE_ENV === 'production'

async function main() {
  const seedPassword = process.env.SEED_PASSWORD
  if (!seedPassword || seedPassword.length < 12) {
    throw new Error('Set SEED_PASSWORD to a strong password (12+ characters) before running the seed script.')
  }

  const hash = await bcrypt.hash(seedPassword, 12)

  let setting = await prisma.platformSetting.findFirst()
  if (!setting) {
    setting = await prisma.platformSetting.create({
      data: {
        managerSeatLimit: 10,
        depositInstructions: 'Please make your payment to the account provided by your assigned manager. After payment, submit your payment reference/proof. Your balance will be updated after manual verification.',
      },
    })
  }

  const manager = await prisma.manager.upsert({
    where: { email: 'manager@example.com' },
    update: { paymentAccountLabel: 'Demo payment account', paymentAccountDetails: 'Replace this with the payment details you actually want clients to use.' },
    create: { name: 'Demo Manager', email: 'manager@example.com', passwordHash: hash, referralCode: 'DEMO001', paymentAccountLabel: 'Demo payment account', paymentAccountDetails: 'Replace this with the payment details you actually want clients to use.' },
  })

  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: { managerId: manager.id, status: 'ACTIVE', signupStatus: 'APPROVED', membershipStatus: 'DAY_1', approvedAt: new Date(), paymentPasswordHash: hash },
    create: { name: 'Demo User', email: 'user@example.com', passwordHash: hash, paymentPasswordHash: hash, managerId: manager.id, status: 'ACTIVE', signupStatus: 'APPROVED', membershipStatus: 'DAY_1', approvedAt: new Date() },
  })

  await prisma.$transaction(async (tx) => {
    const existingWallet = await tx.wallet.findUnique({ where: { userId: user.id }, select: { id: true } })
    if (!existingWallet) {
      const wallet = await tx.wallet.create({ data: { userId: user.id, balance: '120.00', reservedBalance: '0.00' } })
      const reference = `seed-welcome:${user.id}`
      const existingEntry = await tx.transaction.findFirst({ where: { userId: user.id, type: 'WELCOME_BONUS', reference }, select: { id: true } })
      if (!existingEntry) {
        await tx.transaction.create({ data: { userId: user.id, managerId: manager.id, type: 'WELCOME_BONUS', amount: '120.00', balanceBefore: '0.00', balanceAfter: wallet.balance, reference, note: 'Demo Day 1 welcome balance.' } })
      }
    }
  })

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
  const superAdminName = process.env.SUPER_ADMIN_NAME
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD

  const hasSuperAdminEnvVars = superAdminEmail && superAdminName && superAdminPassword

  const existingSuperAdmin = await prisma.adminUser.findFirst({
    where: { adminType: 'SUPER_ADMIN' },
    select: { id: true, email: true, name: true },
  })

  if (existingSuperAdmin) {
    console.log(`Super Admin already exists: ${existingSuperAdmin.email}. Skipping Super Admin provisioning. No changes made.`)
    return
  }

  if (!hasSuperAdminEnvVars) {
    if (isProduction) {
      throw new Error('NODE_ENV=production requires SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME, and SUPER_ADMIN_PASSWORD to be set. No Super Admin created. No demo accounts created.')
    }

    console.warn('Super Admin environment variables not provided. Creating development-only default admin (STAFF_ADMIN).')
    const devAdminEmail = superAdminEmail || 'dev-admin@localhost.invalid'
    await prisma.adminUser.upsert({
      where: { email: devAdminEmail },
      update: {},
      create: { name: 'Main Admin', email: devAdminEmail, passwordHash: hash },
    })
    console.log(`Created development-only default admin (STAFF_ADMIN): ${devAdminEmail}`)
    return
  }

  if (superAdminPassword.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters.')
  }

  const superAdminHash = await bcrypt.hash(superAdminPassword, 12)

  await prisma.adminUser.create({
    data: {
      name: superAdminName,
      email: superAdminEmail,
      passwordHash: superAdminHash,
      adminType: 'SUPER_ADMIN',
      permissions: [],
    },
  })
  console.log(`Created initial Super Admin: ${superAdminEmail}`)
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())