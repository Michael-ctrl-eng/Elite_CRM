import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const { searchParams } = new URL(req.url)
    const spaceId = searchParams.get("spaceId")

    let onlineUsers
    if (spaceId) {
      const members = await db.spaceMember.findMany({
        where: { spaceId },
        include: { user: { select: { id: true, name: true, email: true, image: true, lastSeen: true } } }
      })
      onlineUsers = members.filter(m => m.user.lastSeen > fiveMinAgo).map(m => m.user)
    } else {
      onlineUsers = await db.user.findMany({
        where: { lastSeen: { gte: fiveMinAgo }, status: "Active" },
        select: { id: true, name: true, email: true, image: true, lastSeen: true }
      })
    }

    return NextResponse.json(onlineUsers)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = (session.user as any).id

    await db.user.update({ where: { id: userId }, data: { lastSeen: new Date() } })
    return NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}
