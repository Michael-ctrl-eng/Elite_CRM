import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

// GET /api/notifications — List notifications for current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = (session.user as any).id

    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get("unreadOnly") === "true"
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    const where: any = { userId }
    if (unreadOnly) {
      where.read = false
    }

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.notification.count({ where: { userId, read: false } }),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error("Notifications GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const createNotificationSchema = z.object({
  type: z.enum(["meeting_reminder", "task_reminder", "task_due_today", "deal_update", "deal_note", "general"]),
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  entityId: z.string().optional(),
  entityType: z.enum(["deal", "meeting", "todo"]).optional(),
  spaceId: z.string().optional(),
  userId: z.string().min(1),
  createdById: z.string().optional(),
})

// POST /api/notifications — Create a new notification
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const parsed = createNotificationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 422 }
      )
    }

    const data = parsed.data

    const notification = await db.notification.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        entityId: data.entityId,
        entityType: data.entityType,
        spaceId: data.spaceId,
        userId: data.userId,
        createdById: data.createdById,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })

    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
    console.error("Notifications POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/notifications — Clear all notifications for current user
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = (session.user as any).id

    const result = await db.notification.deleteMany({
      where: { userId },
    })

    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    console.error("Notifications DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
