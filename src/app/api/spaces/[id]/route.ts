import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params

    const space = await db.space.findUnique({
      where: { id },
      include: { 
        members: { include: { user: { select: { id: true, name: true, email: true, image: true, globalRole: true, lastSeen: true } } }, orderBy: { joinedAt: "asc" } },
        _count: { select: { deals: true, customers: true, companies: true, prospects: true, todos: true, meetings: true } }
      }
    })

    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 })

    return NextResponse.json(space)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const globalRole = (session.user as any).globalRole
    const { id } = await params

    if (globalRole !== "superadmin") {
      const membership = await db.spaceMember.findUnique({
        where: { userId_spaceId: { userId: (session.user as any).id, spaceId: id } }
      })
      if (!membership || membership.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const body = await req.json()
    const space = await db.space.update({
      where: { id },
      data: { name: body.name, description: body.description, industry: body.industry, logo: body.logo }
    })

    return NextResponse.json(space)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const globalRole = (session.user as any).globalRole
    const { id } = await params

    if (globalRole !== "superadmin") {
      return NextResponse.json({ error: "Forbidden - superadmin only" }, { status: 403 })
    }

    // Delete space and all related data (cascade)
    await db.space.delete({ where: { id } })

    return NextResponse.json({ message: "Space deleted with all data" })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
