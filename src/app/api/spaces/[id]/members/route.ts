import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const memberSchema = z.object({
  userId: z.string(),
  role: z.enum(["admin", "manager", "viewer"]).default("viewer"),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params

    const members = await db.spaceMember.findMany({
      where: { spaceId: id },
      include: { user: { select: { id: true, name: true, email: true, image: true, globalRole: true, lastSeen: true } } },
      orderBy: { joinedAt: "asc" }
    })

    return NextResponse.json(members)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params

    const body = await req.json()
    const data = memberSchema.parse(body)

    const existing = await db.spaceMember.findUnique({
      where: { userId_spaceId: { userId: data.userId, spaceId: id } }
    })
    if (existing) {
      return NextResponse.json({ error: "User already in space" }, { status: 422 })
    }

    const member = await db.spaceMember.create({
      data: { userId: data.userId, spaceId: id, role: data.role },
      include: { user: { select: { id: true, name: true, email: true, image: true } } }
    })

    return NextResponse.json(member, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params

    const body = await req.json()
    const { userId, role } = body

    const member = await db.spaceMember.update({
      where: { userId_spaceId: { userId, spaceId: id } },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } }
    })

    return NextResponse.json(member)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params

    const { userId } = await req.json()
    
    await db.spaceMember.delete({
      where: { userId_spaceId: { userId, spaceId: id } }
    })

    return NextResponse.json({ message: "Member removed" })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
