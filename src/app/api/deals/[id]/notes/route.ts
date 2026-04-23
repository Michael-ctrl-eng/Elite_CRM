import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const createNoteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
})

// GET /api/deals/[id]/notes — List all notes for a deal
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: dealId } = await params

    // Verify deal exists
    const deal = await db.deal.findUnique({ where: { id: dealId } })
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    const notes = await db.dealNote.findMany({
      where: { dealId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error("Deal Notes GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/deals/[id]/notes — Add a new note to a deal
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { id: dealId } = await params

    // Verify deal exists
    const deal = await db.deal.findUnique({ where: { id: dealId } })
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    const body = await req.json()
    const parsed = createNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 422 }
      )
    }

    const { content } = parsed.data

    const note = await db.dealNote.create({
      data: {
        content,
        dealId,
        userId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })

    // Create activity log entry
    await db.activityLog.create({
      data: {
        action: "Note Added",
        entity: "Deal",
        entityId: dealId,
        details: `Added a note to deal "${deal.title}"`,
        spaceId: deal.spaceId,
        userId,
      },
    })

    // Create notification for deal owner if different from note author
    if (deal.ownerId !== userId) {
      await db.notification.create({
        data: {
          type: "deal_note",
          title: `New note on "${deal.title}"`,
          message: content.length > 100 ? content.substring(0, 100) + "..." : content,
          entityId: dealId,
          entityType: "deal",
          spaceId: deal.spaceId,
          userId: deal.ownerId,
          createdById: userId,
        },
      })
    }

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error("Deal Notes POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
