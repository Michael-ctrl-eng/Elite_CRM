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
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    const where: any = {}
    if (spaceId) where.spaceId = spaceId

    const activities = await db.activityLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    })

    const total = await db.activityLog.count({ where })

    return NextResponse.json({ activities, total, page, limit })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}
