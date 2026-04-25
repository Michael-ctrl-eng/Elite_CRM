import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const createTaskSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
})

// GET /api/deals/[id]/tasks - List tasks for a deal
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params

    const tasks = await db.dealTask.findMany({
      where: { dealId: id },
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Tasks GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/deals/[id]/tasks - Create a task for a deal
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const userId = (session.user as any).id
    const body = await req.json()
    const data = createTaskSchema.parse(body)

    // Verify deal exists
    const deal = await db.deal.findUnique({ where: { id } })
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 })

    const task = await db.dealTask.create({
      data: {
        dealId: id,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        assigneeId: data.assigneeId,
        createdBy: userId,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    console.error("Tasks POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
