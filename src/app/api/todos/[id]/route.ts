import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["Todo", "InProgress", "OnHold", "Done"]).optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
  dueDate: z.string().optional(),
  reminderMinutes: z.number().int().min(1).nullable().optional(),
  tags: z.string().optional(),
  linkedTo: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
}).strict()

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const todo = await db.todo.findUnique({ where: { id }, include: { owner: { select: { id: true, name: true, email: true, image: true } }, assignedTo: { select: { id: true, name: true, email: true, image: true } } } })
    if (!todo) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(todo)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const userId = (session.user as any).id

    const data = patchSchema.parse(body)

    const updateData: any = { ...data }
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null
    }

    const todo = await db.todo.update({ where: { id }, data: updateData })
    await db.activityLog.create({ data: { action: "Update", entity: "Todo", entityId: id, details: `Updated todo "${todo.title}"`, spaceId: todo.spaceId, userId } })
    return NextResponse.json(todo)
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const userId = (session.user as any).id
    const todo = await db.todo.findUnique({ where: { id } })
    if (!todo) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await db.todo.delete({ where: { id } })
    await db.activityLog.create({ data: { action: "Delete", entity: "Todo", entityId: id, details: `Deleted todo "${todo.title}"`, spaceId: todo.spaceId, userId } })
    return NextResponse.json({ message: "Deleted" })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}
