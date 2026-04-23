import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const updateSpaceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  logo: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params

    const space = await db.space.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, image: true, globalRole: true } } } },
        _count: { select: { deals: true, customers: true, companies: true, meetings: true, todos: true, prospects: true } }
      }
    })
    if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json(space)
  } catch (error) {
    console.error("Space settings GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = (session.user as any).id
    const { id } = await params

    // Check if user is admin of this space
    const membership = await db.spaceMember.findFirst({ where: { userId, spaceId: id } })
    if (!membership || (membership.role !== "admin" && (session.user as any).globalRole !== "superadmin")) {
      return NextResponse.json({ error: "Forbidden - admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const data = updateSpaceSchema.parse(body)

    const space = await db.space.update({ where: { id }, data })
    return NextResponse.json(space)
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    console.error("Space settings PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
