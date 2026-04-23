import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  image: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = (session.user as any).id

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, globalRole: true, isDemo: true, status: true, lastSeen: true, createdAt: true }
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const memberships = await db.spaceMember.findMany({
      where: { userId },
      include: { space: { select: { id: true, name: true, slug: true } } }
    })

    return NextResponse.json({ ...user, spaces: memberships })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = (session.user as any).id
    const body = await req.json()
    const data = profileSchema.parse(body)

    // Only allow updating name and image - NOT email
    const user = await db.user.update({
      where: { id: userId },
      data: { name: data.name, image: data.image },
      select: { id: true, name: true, email: true, image: true, globalRole: true }
    })

    return NextResponse.json(user)
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
