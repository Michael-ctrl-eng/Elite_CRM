import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const meetingSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(["Scheduled", "Confirmed", "Cancelled"]).default("Scheduled"),
  startDate: z.string(),
  endDate: z.string().optional(),
  recurrence: z.enum(["Daily", "Weekly", "Monthly", "Yearly"]).optional(),
  tags: z.string().optional(),
  linkedTo: z.string().optional(),
  assignedToId: z.string().optional(),
  spaceId: z.string(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const spaceId = searchParams.get("spaceId")
    if (!spaceId) return NextResponse.json({ error: "spaceId required" }, { status: 422 })

    const where: any = { spaceId }
    const status = searchParams.get("status")
    if (status) where.status = status

    const meetings = await db.meeting.findMany({
      where, include: { owner: { select: { id: true, name: true, email: true, image: true } }, assignedTo: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { startDate: "asc" }
    })
    return NextResponse.json(meetings)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await req.json()
    const data = meetingSchema.parse(body)
    const userId = (session.user as any).id

    const meeting = await db.meeting.create({
      data: { ...data, startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : undefined, ownerId: userId },
      include: { owner: { select: { id: true, name: true } } }
    })
    await db.activityLog.create({ data: { action: "Create", entity: "Meeting", entityId: meeting.id, details: `Created meeting "${meeting.title}"`, spaceId: data.spaceId, userId } })
    return NextResponse.json(meeting, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
