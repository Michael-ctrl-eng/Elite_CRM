import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hash } from "bcryptjs"
import { z } from "zod"

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = signupSchema.parse(body)

    // Check if user already exists
    const existing = await db.user.findUnique({ where: { email: data.email } })
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    // Hash the password
    const hashedPassword = await hash(data.password, 12)

    // Create the user
    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        status: "Active",
        globalRole: "viewer",
      },
    })

    return NextResponse.json(
      {
        message: "Account created successfully",
        userId: user.id,
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 422 }
      )
    }
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
