import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hash } from "bcryptjs"
import { z } from "zod"

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = signupSchema.parse(body)

    const existing = await db.user.findUnique({ where: { email: data.email } })
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 422 })
    }

    const hashedPassword = await hash(data.password, 12)

    // Find or create default space for new signups
    let defaultSpace = await db.space.findFirst({ where: { slug: "default" } })
    if (!defaultSpace) {
      defaultSpace = await db.space.create({
        data: { name: "Default Workspace", slug: "default", description: "Default workspace" }
      })
    }

    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        status: "Active",
        globalRole: "viewer",
      }
    })

    // Add user to default space as manager
    await db.spaceMember.create({
      data: { userId: user.id, spaceId: defaultSpace.id, role: "manager" }
    })

    return NextResponse.json({ message: "Account created successfully", userId: user.id }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
