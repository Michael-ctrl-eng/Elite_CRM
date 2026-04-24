import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/hiring/[id] — Get single applicant
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params

    const applicant = await db.applicant.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
        space: { select: { id: true, name: true } },
      },
    })

    if (!applicant) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json(applicant)
  } catch (error) {
    console.error("Hiring GET [id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/hiring/[id] — Update applicant
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const userId = (session.user as any).id

    const existing = await db.applicant.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const applicant = await db.applicant.update({
      where: { id },
      data: body,
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    await db.activityLog.create({
      data: {
        action: "Update",
        entity: "Applicant",
        entityId: id,
        details: `Updated applicant "${applicant.fullName}"`,
        spaceId: applicant.spaceId,
        userId,
      },
    })

    return NextResponse.json(applicant)
  } catch (error) {
    console.error("Hiring PATCH [id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/hiring/[id] — Delete applicant
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const userId = (session.user as any).id

    const existing = await db.applicant.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await db.applicant.delete({ where: { id } })

    await db.activityLog.create({
      data: {
        action: "Delete",
        entity: "Applicant",
        entityId: id,
        details: `Deleted applicant "${existing.fullName}"`,
        spaceId: existing.spaceId,
        userId,
      },
    })

    return NextResponse.json({ message: "Deleted" })
  } catch (error) {
    console.error("Hiring DELETE [id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
