import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER' || !session.managerId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    const params = new URL(request.url).searchParams
    const status = (params.get('status') || 'ALL').toUpperCase()
    const cursor = params.get('cursor')
    const allowed = ['ALL', 'PENDING', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED', 'COMPLETED', 'REJECTED']
    if (!allowed.includes(status)) return NextResponse.json({ error: 'Invalid task filter.' }, { status: 400 })
    if (cursor && (cursor.length > 100 || !(await prisma.task.findFirst({ where: { id: cursor, managerId: session.managerId }, select: { id: true } })))) return NextResponse.json({ error: 'Invalid task page cursor.' }, { status: 400 })
    const [manager, setting, rows] = await Promise.all([
      prisma.manager.findUnique({ where: { id: session.managerId }, select: { name: true } }),
      prisma.platformSetting.findFirst({ select: { rerentDelaySeconds: true } }),
      prisma.task.findMany({
        where: { managerId: session.managerId, user: { managerId: session.managerId }, ...(status === 'ALL' ? {} : { status: status as 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'VERIFIED' | 'COMPLETED' | 'REJECTED' }) },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: 26,
        select: {
          id: true, title: true, description: true, type: true, dayNumber: true, profitRate: true, profitAmount: true,
          status: true, assignedAt: true, submittedAt: true, completedAt: true,
          user: { select: { id: true, name: true, email: true } },
          order: { select: { id: true, orderCode: true, amount: true, profit: true, finalReturnAmount: true, status: true, paymentStatus: true, paymentVerifiedAt: true, rerentRequestedAt: true, property: { select: { title: true } } } },
        },
      }),
    ])
    const hasMore = rows.length > 25
    const delaySeconds = Number(setting?.rerentDelaySeconds ?? 90)
    const tasks = rows.slice(0, 25).map((row) => ({
      ...row,
      profitRate: row.profitRate.toString(),
      profitAmount: row.profitAmount.toString(),
      settlementEligibleAt: row.type === 'RE_RENT' && row.submittedAt && Number.isInteger(delaySeconds) && delaySeconds >= 0 && delaySeconds <= 86_400
        ? new Date(row.submittedAt.getTime() + delaySeconds * 1000)
        : null,
      order: row.order ? {
        ...row.order,
        amount: row.order.amount.toString(),
        profit: row.order.profit.toString(),
        finalReturnAmount: row.order.finalReturnAmount?.toString() ?? null,
      } : null,
    }))
    return NextResponse.json({ manager, tasks, nextCursor: hasMore ? tasks.at(-1)?.id || null : null })
  } catch (error) {
    console.error('MANAGER_TASKS_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load manager tasks.' }, { status: 500 })
  }
}
