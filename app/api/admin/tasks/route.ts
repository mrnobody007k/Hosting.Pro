import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/admin-auth'
import { AdminPermission } from '@/lib/admin-permissions'

export async function GET(req: Request) {
  try {
    const auth = await requireAdminAuth(AdminPermission.MANAGE_TASKS)
    if (!auth.ok) return auth.response
    const session = auth.session

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim().toLowerCase() || ''
    const status = searchParams.get('status') || 'ALL'
    const type = searchParams.get('type') || 'ALL'
    const managerId = searchParams.get('managerId') || 'ALL'
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const cursor = searchParams.get('cursor') || undefined

    const where: Record<string, unknown> = {}

    if (status !== 'ALL') {
      where.status = status
    }

    if (type !== 'ALL') {
      where.type = type
    }

    if (managerId !== 'ALL') {
      where.managerId = managerId
    }

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { order: { orderCode: { contains: search, mode: 'insensitive' } } },
        { title: { contains: search, mode: 'insensitive' } },
      ]
    }

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        dayNumber: true,
        profitRate: true,
        profitAmount: true,
        status: true,
        assignedAt: true,
        startedAt: true,
        submittedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            membershipStatus: true,
            manager: {
              select: {
                id: true,
                name: true,
                referralCode: true,
              },
            },
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            referralCode: true,
          },
        },
        order: {
          select: {
            id: true,
            orderCode: true,
            amount: true,
            profit: true,
            profitRate: true,
            status: true,
            paymentStatus: true,
            property: {
              select: {
                id: true,
                title: true,
                location: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
    })

    let nextCursor: string | null = null
    if (tasks.length > limit) {
      const nextTask = tasks.pop()
      nextCursor = nextTask!.id
    }

    return NextResponse.json({
      tasks: tasks.map((task) => ({
        ...task,
        profitRate: task.profitRate.toString(),
        profitAmount: task.profitAmount.toString(),
        order: task.order ? {
          ...task.order,
          amount: task.order.amount.toString(),
          profit: task.order.profit.toString(),
          profitRate: task.order.profitRate.toString(),
        } : null,
      })),
      nextCursor,
    })
  } catch (error) {
    console.error('ADMIN_TASKS_GET_ERROR', error)
    return NextResponse.json({ error: 'Unable to load tasks.' }, { status: 500 })
  }
}