import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const meeting = await db.meeting.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
        assignedTo: { select: { id: true, name: true, email: true, image: true } },
        participants: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } }
        }
      }
    })
    if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(meeting)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const userId = (session.user as any).id

    const { participantIds, ...meetingData } = body

    const meeting = await db.meeting.update({
      where: { id },
      data: {
        ...meetingData,
        startDate: meetingData.startDate ? new Date(meetingData.startDate) : undefined,
        endDate: meetingData.endDate ? new Date(meetingData.endDate) : undefined,
      },
      include: {
        owner: { select: { id: true, name: true } },
        participants: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } }
        }
      }
    })

    // Update participants if provided
    if (participantIds !== undefined) {
      // Delete old participants
      await db.meetingParticipant.deleteMany({ where: { meetingId: id } })

      // Create new participants
      if (participantIds.length > 0) {
        await db.meetingParticipant.createMany({
          data: participantIds.map((pId: string) => ({
            meetingId: id,
            userId: pId,
          })),
          skipDuplicates: true,
        })
      }

      // Re-fetch to include updated participants
      const updated = await db.meeting.findUnique({
        where: { id },
        include: {
          owner: { select: { id: true, name: true } },
          participants: {
            include: { user: { select: { id: true, name: true, email: true, image: true } } }
          }
        }
      })
      if (updated) {
        await db.activityLog.create({ data: { action: "Update", entity: "Meeting", entityId: id, details: `Updated meeting "${updated.title}"`, spaceId: updated.spaceId, userId } })
        return NextResponse.json(updated)
      }
    }

    await db.activityLog.create({ data: { action: "Update", entity: "Meeting", entityId: id, details: `Updated meeting "${meeting.title}"`, spaceId: meeting.spaceId, userId } })
    return NextResponse.json(meeting)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const userId = (session.user as any).id
    const meeting = await db.meeting.findUnique({ where: { id } })
    if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await db.meeting.delete({ where: { id } })
    await db.activityLog.create({ data: { action: "Delete", entity: "Meeting", entityId: id, details: `Deleted meeting "${meeting.title}"`, spaceId: meeting.spaceId, userId } })
    return NextResponse.json({ message: "Deleted" })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}
