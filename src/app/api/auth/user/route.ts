import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { hash } from "bcryptjs"
import { z } from "zod"

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "manager", "viewer"]).default("viewer"),
  spaceId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = (session.user as any).id
    const globalRole = (session.user as any).globalRole

    let users
    if (globalRole === "superadmin") {
      users = await db.user.findMany({
        where: { status: { not: "Deleted" } },
        select: { id: true, name: true, email: true, status: true, globalRole: true, isDemo: true, lastSeen: true, image: true, createdAt: true },
        orderBy: { createdAt: "desc" }
      })
    } else {
      const memberships = await db.spaceMember.findMany({
        where: { userId },
        select: { spaceId: true }
      })
      const spaceIds = memberships.map(m => m.spaceId)
      const members = await db.spaceMember.findMany({
        where: { spaceId: { in: spaceIds } },
        select: { userId: true }
      })
      const userIds = [...new Set(members.map(m => m.userId))]
      users = await db.user.findMany({
        where: { id: { in: userIds }, status: { not: "Deleted" } },
        select: { id: true, name: true, email: true, status: true, globalRole: true, isDemo: true, lastSeen: true, image: true, createdAt: true },
        orderBy: { createdAt: "desc" }
      })
    }

    return NextResponse.json(users)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const globalRole = (session.user as any).globalRole
    if (globalRole !== "superadmin" && globalRole !== "admin") {
      return NextResponse.json({ error: "Forbidden - admin only" }, { status: 403 })
    }

    const body = await req.json()
    const data = inviteSchema.parse(body)

    const existing = await db.user.findUnique({ where: { email: data.email } })
    if (existing) {
      // If user exists and spaceId provided, add to space
      if (data.spaceId) {
        const existingMember = await db.spaceMember.findUnique({
          where: { userId_spaceId: { userId: existing.id, spaceId: data.spaceId } }
        })
        if (!existingMember) {
          await db.spaceMember.create({
            data: { userId: existing.id, spaceId: data.spaceId, role: data.role }
          })
        }
      }
      return NextResponse.json({ message: "User added to space", userId: existing.id })
    }

    // Create user with random password (Invite status)
    const tempPassword = Math.random().toString(36).slice(-12)
    const hashedPassword = await hash(tempPassword, 12)

    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        status: "Active",
        globalRole: data.role,
      }
    })

    if (data.spaceId) {
      await db.spaceMember.create({
        data: { userId: user.id, spaceId: data.spaceId, role: data.role }
      })
    }

    return NextResponse.json({ message: "User invited successfully", userId: user.id }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const globalRole = (session.user as any).globalRole
    if (globalRole !== "superadmin") {
      return NextResponse.json({ error: "Forbidden - superadmin only" }, { status: 403 })
    }

    const { userIds } = await req.json()
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "User IDs required" }, { status: 422 })
    }

    await db.user.updateMany({
      where: { id: { in: userIds } },
      data: { status: "Deleted" }
    })

    return NextResponse.json({ message: "Users deleted" })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
