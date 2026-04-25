import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/voip/history — List call history for current user (paginated, last 100)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    const history = await db.voipCallHistory.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: limit,
      skip: offset,
    })

    const total = await db.voipCallHistory.count({
      where: { userId },
    })

    return NextResponse.json({ records: history, total })
  } catch (error) {
    console.error("VoIP History GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/voip/history — Create a call history record
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await req.json()

    const { direction, fromNumber, toNumber, fromName, toName, duration, status, startedAt, endedAt } = body

    if (!direction || !status) {
      return NextResponse.json({ error: "direction and status are required" }, { status: 400 })
    }

    const validDirections = ["inbound", "outbound"]
    const validStatuses = ["completed", "missed", "cancelled"]

    if (!validDirections.includes(direction)) {
      return NextResponse.json({ error: "Invalid direction" }, { status: 400 })
    }
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const record = await db.voipCallHistory.create({
      data: {
        userId,
        direction,
        fromNumber: fromNumber || null,
        toNumber: toNumber || null,
        fromName: fromName || null,
        toName: toName || null,
        duration: duration || null,
        status,
        startedAt: startedAt ? new Date(startedAt) : undefined,
        endedAt: endedAt ? new Date(endedAt) : null,
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error("VoIP History POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
