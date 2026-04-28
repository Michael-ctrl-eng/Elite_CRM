import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// PATCH /api/deals/[id]/tasks/[taskId] - Update a task (toggle complete, edit)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id, taskId } = await params
    const body = await req.json()

    const task = await db.dealTask.findFirst({ where: { id: taskId, dealId: id } })
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const updatedTask = await db.dealTask.update({
      where: { id: taskId },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.completed !== undefined && { completed: body.completed }),
        ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
        ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId || null }),
      },
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    })

    // Sync todo status when task is toggled - use dealTaskId for reliable matching
    try {
      if (body.completed !== undefined) {
        await db.todo.updateMany({
          where: { dealTaskId: taskId },
          data: { status: updatedTask.completed ? "Done" : "Todo" }
        })
      }
      // Sync title changes
      if (body.title !== undefined) {
        await db.todo.updateMany({
          where: { dealTaskId: taskId },
          data: { title: body.title }
        })
      }
      // Sync due date changes
      if (body.dueDate !== undefined) {
        await db.todo.updateMany({
          where: { dealTaskId: taskId },
          data: { dueDate: body.dueDate ? new Date(body.dueDate) : null }
        })
      }
    } catch (todoError) {
      console.error("Failed to sync deal task update to todos:", todoError)
    }

    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error("Task PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/deals/[id]/tasks/[taskId] - Delete a task
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id, taskId } = await params

    const task = await db.dealTask.findFirst({ where: { id: taskId, dealId: id } })
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    // Delete corresponding todos using dealTaskId
    try {
      await db.todo.deleteMany({
        where: { dealTaskId: taskId }
      })
    } catch (todoError) {
      console.error("Failed to delete synced todos:", todoError)
    }

    await db.dealTask.delete({ where: { id: taskId } })
    return NextResponse.json({ message: "Task deleted" })
  } catch (error) {
    console.error("Task DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
