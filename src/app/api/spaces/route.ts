import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const spaceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  description: z.string().optional(),
  industry: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = (session.user as any).id
    const globalRole = (session.user as any).globalRole

    let spaces
    if (globalRole === "superadmin") {
      spaces = await db.space.findMany({
        include: { 
          members: { include: { user: { select: { id: true, name: true, email: true, image: true, globalRole: true } } } },
          _count: { select: { deals: true, customers: true, companies: true, prospects: true, todos: true, meetings: true } }
        },
        orderBy: { createdAt: "desc" }
      })
    } else {
      const memberships = await db.spaceMember.findMany({
        where: { userId },
        select: { spaceId: true }
      })
      const spaceIds = memberships.map(m => m.spaceId)
      spaces = await db.space.findMany({
        where: { id: { in: spaceIds }, isActive: true },
        include: { 
          members: { include: { user: { select: { id: true, name: true, email: true, image: true, globalRole: true } } } },
          _count: { select: { deals: true, customers: true, companies: true, prospects: true, todos: true, meetings: true } }
        },
        orderBy: { createdAt: "desc" }
      })
    }

    return NextResponse.json(spaces)
  } catch (error) {
    console.error("Spaces GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = (session.user as any).id
    const globalRole = (session.user as any).globalRole

    if (globalRole !== "superadmin" && globalRole !== "admin") {
      return NextResponse.json({ error: "Forbidden - admin only" }, { status: 403 })
    }

    const body = await req.json()
    const data = spaceSchema.parse(body)

    const existing = await db.space.findUnique({ where: { slug: data.slug } })
    if (existing) {
      return NextResponse.json({ error: "Space slug already exists" }, { status: 422 })
    }

    const space = await db.space.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        industry: data.industry,
        members: {
          create: { userId, role: "admin" }
        }
      },
      include: { members: true }
    })

    // Log activity
    await db.activityLog.create({
      data: {
        action: "Create",
        entity: "Space",
        entityId: space.id,
        details: `Created space "${space.name}"`,
        spaceId: space.id,
        userId,
      }
    })

    return NextResponse.json(space, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    }
    console.error("Spaces POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
