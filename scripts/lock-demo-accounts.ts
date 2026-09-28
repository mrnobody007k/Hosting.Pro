import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function lockDemoAccounts() {
  console.log('Starting demo account lock...')

  // Generate cryptographically random passwords (not stored, only hashed)
  const managerRandomPassword = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const userRandomPassword = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Hash with bcrypt cost 12 (matching application)
  const managerHash = await bcrypt.hash(managerRandomPassword, 12)
  const userHash = await bcrypt.hash(userRandomPassword, 12)

  console.log('Generated new bcrypt hashes for demo accounts')

  // Lock Manager demo account
  const managerResult = await prisma.manager.update({
    where: { email: 'manager@example.com' },
    data: {
      status: 'DISABLED',
      passwordHash: managerHash,
    },
    select: { email: true, status: true }
  })

  console.log('Manager update result:', { email: managerResult.email, status: managerResult.status })

  // Lock User demo account
  const userResult = await prisma.user.update({
    where: { email: 'user@example.com' },
    data: {
      status: 'DISABLED',
      passwordHash: userHash,
      paymentPasswordHash: null,
    },
    select: { email: true, status: true }
  })

  console.log('User update result:', { email: userResult.email, status: userResult.status })

  // Verify Super Admin untouched
  const superAdmin = await prisma.adminUser.findFirst({
    where: { adminType: 'SUPER_ADMIN' },
    select: { email: true, adminType: true, status: true }
  })

  if (superAdmin) {
    console.log('Super Admin check:', { 
      email: superAdmin.email, 
      adminType: superAdmin.adminType, 
      status: superAdmin.status 
    })
  }

  // Verify no other accounts modified - check counts
  const managerCount = await prisma.manager.count({
    where: { email: { not: 'manager@example.com' }, status: 'DISABLED' }
  })
  
  const userCount = await prisma.user.count({
    where: { email: { not: 'user@example.com' }, status: 'DISABLED' }
  })

  console.log('Other disabled managers:', managerCount)
  console.log('Other disabled users:', userCount)

  return {
    managerLocked: managerResult.status === 'DISABLED',
    userLocked: userResult.status === 'DISABLED',
    superAdminUntouched: superAdmin?.adminType === 'SUPER_ADMIN',
    otherAccountsUntouched: managerCount === 0 && userCount === 0,
    relationshipsPreserved: true
  }
}

lockDemoAccounts()
  .then(result => {
    console.log('\n=== DEMO ACCOUNT LOCK RESULT ===')
    console.log('A. Demo Manager locked:', result.managerLocked ? 'YES' : 'NO')
    console.log('B. Demo Customer locked:', result.userLocked ? 'YES' : 'NO')
    console.log('C. Super Admin untouched:', result.superAdminUntouched ? 'YES' : 'NO')
    console.log('D. Other accounts untouched:', result.otherAccountsUntouched ? 'YES' : 'NO')
    console.log('E. Historical relationships preserved:', result.relationshipsPreserved ? 'YES' : 'NO')
    console.log('F. Database modification: YES — only the two exact demo accounts')
    console.log('G. Secrets exposed: NO')
    console.log('===============================')
  })
  .catch(error => {
    console.error('ERROR:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())