import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const todoSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["Todo", "InProgress", "OnHold", "Done"]).default("Todo"),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Medium"),
  dueDate: z.string().optional(),
  tags: z.string().optional(),
  linkedTo: z.string().optional(),
  assignedToId: z.string().optional(),
  spaceId: z.string(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const spaceId = searchParams.get("spaceId")
    if (!spaceId) return NextResponse.json({ error: "spaceId required" }, { status: 422 })

    const where: any = { spaceId }
    const status = searchParams.get("status")
    if (status) where.status = status
    const search = searchParams.get("search")
    if (search) where.title = { contains: search }

    const todos = await db.todo.findMany({
      where,
      include: { 
        owner: { select: { id: true, name: true, email: true, image: true } },
        assignedTo: { select: { id: true, name: true, email: true, image: true } }
      },
      orderBy: { createdAt: "desc" }
    })
    return NextResponse.json(todos)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await req.json()
    const data = todoSchema.parse(body)
    const userId = (session.user as any).id

    const todo = await db.todo.create({
      data: { ...data, dueDate: data.dueDate ? new Date(data.dueDate) : undefined, ownerId: userId },
      include: { owner: { select: { id: true, name: true } } }
    })
    await db.activityLog.create({
      data: { action: "Create", entity: "Todo", entityId: todo.id, details: `Created todo "${todo.title}"`, spaceId: data.spaceId, userId }
    })
    return NextResponse.json(todo, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
