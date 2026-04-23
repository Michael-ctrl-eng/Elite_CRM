import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = (session.user as any).id
    const globalRole = (session.user as any).globalRole
    const { searchParams } = new URL(req.url)
    const spaceId = searchParams.get("spaceId")

    if (!spaceId) return NextResponse.json({ error: "spaceId required" }, { status: 422 })

    // Deal stats
    const totalDeals = await db.deal.count({ where: { spaceId } })
    const wonDeals = await db.deal.count({ where: { spaceId, stage: "Won" } })
    const totalValue = await db.deal.aggregate({ where: { spaceId }, _sum: { value: true } })
    const dealsByStage = await db.deal.groupBy({ by: ["stage"], where: { spaceId }, _count: true, _sum: { value: true } })

    // Recent activities
    const recentActivities = await db.activityLog.findMany({
      where: { spaceId },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true, image: true } } }
    })

    // Upcoming meetings
    const upcomingMeetings = await db.meeting.findMany({
      where: { spaceId, startDate: { gte: new Date() }, status: { not: "Cancelled" } },
      take: 5,
      orderBy: { startDate: "asc" },
      include: { owner: { select: { id: true, name: true } } }
    })

    // Pending todos
    const pendingTodos = await db.todo.findMany({
      where: { spaceId, status: { not: "Done" } },
      take: 5,
      orderBy: { dueDate: "asc" },
      include: { owner: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } }
    })

    // Customer/prospect counts
    const totalCustomers = await db.customer.count({ where: { spaceId } })
    const totalProspects = await db.prospect.count({ where: { spaceId } })
    const totalCompanies = await db.company.count({ where: { spaceId } })

    // Online users in this space
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const spaceMembers = await db.spaceMember.findMany({
      where: { spaceId },
      include: { user: { select: { id: true, name: true, lastSeen: true, image: true } } }
    })
    const onlineUsers = spaceMembers.filter(m => m.user.lastSeen > fiveMinAgo)

    return NextResponse.json({
      deals: { total: totalDeals, won: wonDeals, totalValue: totalValue._sum.value || 0, byStage: dealsByStage, winRate: totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0 },
      customers: totalCustomers,
      prospects: totalProspects,
      companies: totalCompanies,
      recentActivities,
      upcomingMeetings,
      pendingTodos,
      onlineUsers: onlineUsers.map(u => u.user),
      onlineCount: onlineUsers.length,
    })
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
