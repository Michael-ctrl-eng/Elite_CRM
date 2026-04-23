import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const globalRole = (session.user as any).globalRole
    if (globalRole !== "superadmin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const allSpaces = await db.space.findMany({
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, image: true, globalRole: true, lastSeen: true } } } },
        _count: { select: { deals: true, customers: true, companies: true, todos: true, meetings: true, prospects: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    const allUsers = await db.user.findMany({
      where: { status: { not: "Deleted" } },
      select: { id: true, name: true, email: true, globalRole: true, isDemo: true, lastSeen: true, image: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" }
    })

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const onlineUsers = allUsers.filter(u => u.lastSeen > fiveMinAgo)

    const recentActivities = await db.activityLog.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true, image: true } }, space: { select: { id: true, name: true, slug: true } } }
    })

    const totalDeals = await db.deal.count()
    const totalCustomers = await db.customer.count()
    const totalCompanies = await db.company.count()

    return NextResponse.json({
      spaces: allSpaces,
      users: allUsers,
      onlineUsers,
      onlineCount: onlineUsers.length,
      recentActivities,
      stats: {
        totalSpaces: allSpaces.length,
        totalUsers: allUsers.length,
        onlineUsers: onlineUsers.length,
        totalDeals,
        totalCustomers,
        totalCompanies,
      }
    })
  } catch (error) {
    console.error("Superadmin error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
