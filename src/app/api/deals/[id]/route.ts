import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params

    const deal = await db.deal.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
        contact: true,
        company: true,
        dealNotes: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json(deal)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const userId = (session.user as any).id

    const deal = await db.deal.update({
      where: { id },
      data: { ...body, closeDate: body.closeDate ? new Date(body.closeDate) : undefined },
    })

    await db.activityLog.create({
      data: { action: "Update", entity: "Deal", entityId: id, details: `Updated deal "${deal.title}"`, spaceId: deal.spaceId, userId }
    })

    return NextResponse.json(deal)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const userId = (session.user as any).id

    const deal = await db.deal.findUnique({ where: { id } })
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await db.deal.delete({ where: { id } })
    await db.activityLog.create({
      data: { action: "Delete", entity: "Deal", entityId: id, details: `Deleted deal "${deal.title}"`, spaceId: deal.spaceId, userId }
    })

    return NextResponse.json({ message: "Deleted" })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}
