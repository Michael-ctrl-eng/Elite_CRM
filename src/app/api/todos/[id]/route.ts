import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

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
    const todo = await db.todo.update({ where: { id }, data: { ...body, dueDate: body.dueDate ? new Date(body.dueDate) : undefined } })
    await db.activityLog.create({ data: { action: "Update", entity: "Todo", entityId: id, details: `Updated todo "${todo.title}"`, spaceId: todo.spaceId, userId } })
    return NextResponse.json(todo)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
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
