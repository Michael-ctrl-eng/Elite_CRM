import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const spaceId = searchParams.get("spaceId")
    if (!spaceId) return NextResponse.json({ error: "spaceId required" }, { status: 422 })

    const stages = ["New", "Contacted", "Proposal", "Negotiation", "Won", "Lost"]
    const stats: any = {}

    for (const stage of stages) {
      const count = await db.deal.count({ where: { spaceId, stage } })
      const total = await db.deal.aggregate({ where: { spaceId, stage }, _sum: { value: true } })
      stats[stage] = { count, totalValue: total._sum.value || 0 }
    }

    const totalDeals = await db.deal.count({ where: { spaceId } })
    const totalValue = await db.deal.aggregate({ where: { spaceId }, _sum: { value: true } })
    const wonDeals = await db.deal.count({ where: { spaceId, stage: "Won" } })

    return NextResponse.json({
      byStage: stats,
      total: totalDeals,
      totalValue: totalValue._sum.value || 0,
      wonRate: totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0,
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
