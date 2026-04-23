import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/activity — List activity logs with optional filters
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const spaceId = searchParams.get("spaceId")
    const entityId = searchParams.get("entityId")
    const entity = searchParams.get("entity")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200)

    const where: any = {}
    if (spaceId) where.spaceId = spaceId
    if (entityId) where.entityId = entityId
    if (entity) where.entity = entity

    const logs = await db.activityLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error("Activity GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
