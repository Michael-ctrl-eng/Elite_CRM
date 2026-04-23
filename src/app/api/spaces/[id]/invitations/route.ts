import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import crypto from "crypto"

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "manager", "viewer"]).default("viewer"),
})

// GET /api/spaces/[id]/invitations — List invitations for a space
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id: spaceId } = await params

    const invitations = await db.invitation.findMany({
      where: { spaceId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(invitations)
  } catch (error) {
    console.error("Invitations GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/spaces/[id]/invitations — Create an invitation
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = (session.user as any).id
    const { id: spaceId } = await params

    // Check if user is admin
    const membership = await db.spaceMember.findFirst({ where: { userId, spaceId } })
    if (!membership || (membership.role !== "admin" && (session.user as any).globalRole !== "superadmin")) {
      return NextResponse.json({ error: "Forbidden - admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { email, role } = inviteSchema.parse(body)

    // Check if user already exists in this space
    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      const existingMembership = await db.spaceMember.findFirst({ where: { userId: existingUser.id, spaceId } })
      if (existingMembership) {
        return NextResponse.json({ error: "User is already a member of this space" }, { status: 422 })
      }
    }

    // Check for pending invitation
    const existingInvitation = await db.invitation.findFirst({
      where: { email, spaceId, status: "pending" }
    })
    if (existingInvitation) {
      return NextResponse.json({ error: "An invitation is already pending for this email" }, { status: 422 })
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invitation = await db.invitation.create({
      data: {
        email,
        token,
        role,
        expiresAt,
        invitedBy: userId,
        spaceId,
      },
    })

    // Create activity log
    await db.activityLog.create({
      data: {
        action: "Invite",
        entity: "Invitation",
        entityId: invitation.id,
        details: `Invited ${email} as ${role}`,
        spaceId,
        userId,
      },
    })

    // TODO: Send invitation email via SMTP if configured
    // For now, we return the invitation with the token

    return NextResponse.json(invitation, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    console.error("Invitation POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/spaces/[id]/invitations — Cancel an invitation
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id: spaceId } = await params
    const { searchParams } = new URL(req.url)
    const invitationId = searchParams.get("invitationId")

    if (!invitationId) return NextResponse.json({ error: "invitationId required" }, { status: 422 })

    await db.invitation.delete({ where: { id: invitationId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Invitation DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
