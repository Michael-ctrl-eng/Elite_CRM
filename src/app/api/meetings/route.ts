import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const meetingSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  notes: z.string().optional(),
  location: z.string().optional(),
  meetingLink: z.string().optional(),
  status: z.enum(["Scheduled", "Confirmed", "Cancelled"]).default("Scheduled"),
  startDate: z.string(),
  endDate: z.string().optional(),
  recurrence: z.enum(["Daily", "Weekly", "Monthly", "Yearly"]).optional(),
  tags: z.string().optional(),
  linkedTo: z.string().optional(),
  assignedToId: z.string().optional(),
  participantIds: z.array(z.string()).optional(),
  spaceId: z.string(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = (session.user as any).id
    const globalRole = (session.user as any).globalRole
    const { searchParams } = new URL(req.url)
    const spaceId = searchParams.get("spaceId")

    // Build where clause
    const where: any = {}
    if (spaceId) {
      where.spaceId = spaceId
    } else if (globalRole !== "superadmin") {
      const memberships = await db.spaceMember.findMany({ where: { userId }, select: { spaceId: true } })
      where.spaceId = { in: memberships.map(m => m.spaceId) }
    }
    const status = searchParams.get("status")
    if (status) where.status = status

    const meetings = await db.meeting.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
        assignedTo: { select: { id: true, name: true, email: true, image: true } },
        participants: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } }
        }
      },
      orderBy: { startDate: "asc" }
    })
    return NextResponse.json(meetings)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = (session.user as any).id
    let body = await req.json()

    // If no spaceId, use user's first space
    if (!body.spaceId) {
      const membership = await db.spaceMember.findFirst({ where: { userId }, orderBy: { joinedAt: "asc" } })
      if (!membership) return NextResponse.json({ error: "No space available" }, { status: 422 })
      body.spaceId = membership.spaceId
    }

    const data = meetingSchema.parse(body)
    const { participantIds, ...meetingData } = data

    const meeting = await db.meeting.create({
      data: {
        ...meetingData,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        ownerId: userId,
      },
      include: {
        owner: { select: { id: true, name: true } },
        participants: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } }
        }
      }
    })

    // Create MeetingParticipant records
    if (participantIds && participantIds.length > 0) {
      await db.meetingParticipant.createMany({
        data: participantIds.map(pId => ({
          meetingId: meeting.id,
          userId: pId,
        })),
        skipDuplicates: true,
      })

      // Re-fetch to include participants
      const updated = await db.meeting.findUnique({
        where: { id: meeting.id },
        include: {
          owner: { select: { id: true, name: true } },
          participants: {
            include: { user: { select: { id: true, name: true, email: true, image: true } } }
          }
        }
      })
      if (updated) {
        await db.activityLog.create({ data: { action: "Create", entity: "Meeting", entityId: meeting.id, details: `Created meeting "${meeting.title}"`, spaceId: data.spaceId, userId } })
        return NextResponse.json(updated, { status: 201 })
      }
    }

    await db.activityLog.create({ data: { action: "Create", entity: "Meeting", entityId: meeting.id, details: `Created meeting "${meeting.title}"`, spaceId: data.spaceId, userId } })
    return NextResponse.json(meeting, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
