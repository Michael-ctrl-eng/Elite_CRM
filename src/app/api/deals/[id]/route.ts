import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params

    const deal = await db.deal.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
        contact: true,
        company: true,
        mainParticipant: { select: { id: true, name: true, email: true, image: true } },
        participants: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } }
        },
        dealNotes: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, email: true, image: true } },
            creator: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        attachments: {
          include: {
            uploader: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json(deal)
  } catch (error) {
    console.error("Deal GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const userId = (session.user as any).id

    // Fetch current deal to detect stage changes
    const existingDeal = await db.deal.findUnique({ where: { id } })
    if (!existingDeal) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Separate participant data from deal data
    const { participantIds, ...dealData } = body

    const deal = await db.deal.update({
      where: { id },
      data: {
        ...dealData,
        closeDate: dealData.closeDate ? new Date(dealData.closeDate) : undefined,
      },
    })

    // Update participants if provided
    if (participantIds !== undefined) {
      // Delete existing participants (except main)
      await db.dealParticipant.deleteMany({
        where: { dealId: id, role: "member" }
      })

      // Re-add participants (excluding main participant)
      const mainId = dealData.mainParticipantId || existingDeal.mainParticipantId
      const membersToAdd = participantIds.filter((pid: string) => pid !== mainId)

      if (membersToAdd.length > 0) {
        await db.dealParticipant.createMany({
          data: membersToAdd.map((pid: string) => ({
            dealId: id,
            userId: pid,
            role: "member",
          })),
          skipDuplicates: true,
        })
      }

      // Update main participant
      if (dealData.mainParticipantId) {
        await db.dealParticipant.deleteMany({
          where: { dealId: id, role: "main" }
        })
        await db.dealParticipant.create({
          data: { dealId: id, userId: dealData.mainParticipantId, role: "main" }
        }).catch(() => {})
      }
    }

    // Sync todos for existing deal tasks when participants change
    if (participantIds !== undefined) {
      try {
        const existingTasks = await db.dealTask.findMany({
          where: { dealId: id },
          select: { id: true, title: true, description: true, dueDate: true, completed: true },
        })
        
        const updatedDeal = await db.deal.findUnique({ where: { id } })
        const updatedParticipants = await db.dealParticipant.findMany({
          where: { dealId: id },
          select: { userId: true, role: true },
        })
        
        // Build current participant set
        const currentParticipantIds = new Set(updatedParticipants.map(p => p.userId))
        if (updatedDeal?.mainParticipantId) currentParticipantIds.add(updatedDeal.mainParticipantId)
        if (updatedDeal?.ownerId) currentParticipantIds.add(updatedDeal.ownerId)
        
        const allParticipantRoles = new Map<string, string>()
        updatedParticipants.forEach(p => allParticipantRoles.set(p.userId, p.role))
        if (updatedDeal?.mainParticipantId) allParticipantRoles.set(updatedDeal.mainParticipantId, 'main')
        if (updatedDeal?.ownerId) allParticipantRoles.set(updatedDeal.ownerId, 'member')

        for (const dt of existingTasks) {
          // Delete todos for removed participants
          await db.todo.deleteMany({
            where: {
              dealTaskId: dt.id,
              assignedToId: { notIn: Array.from(currentParticipantIds) },
            },
          })

          // Find which participants already have todos for this task
          const existingTodos = await db.todo.findMany({
            where: { dealTaskId: dt.id },
            select: { assignedToId: true },
          })
          const existingTodoUserIds = new Set(existingTodos.map(t => t.assignedToId))

          // Create todos for new participants who don't have one yet
          const newParticipants = Array.from(currentParticipantIds).filter(pid => !existingTodoUserIds.has(pid))
          
          if (newParticipants.length > 0) {
            const currencySymbol = updatedDeal?.currency === 'EUR' ? '€' : updatedDeal?.currency === 'GBP' ? '£' : '$'
            const dealContext = `Deal: ${updatedDeal?.title} | Stage: ${updatedDeal?.stage}${updatedDeal?.value ? ` | Value: ${currencySymbol}${updatedDeal.value.toLocaleString()}` : ''}`
            
            await db.todo.createMany({
              data: newParticipants.map(pid => ({
                title: dt.title,
                description: dt.description ? `${dt.description}\n\n${dealContext}` : dealContext,
                status: dt.completed ? "Done" : "Todo",
                priority: "Medium",
                dueDate: dt.dueDate,
                linkedTo: `deal:${id}`,
                assignedToId: pid,
                spaceId: updatedDeal!.spaceId,
                ownerId: pid,
                dealTaskId: dt.id,
                dealParticipantRole: allParticipantRoles.get(pid) || 'member',
              })),
              skipDuplicates: true,
            })
          }
        }
      } catch (syncError) {
        console.error("Failed to sync participant todos:", syncError)
      }
    }

    await db.activityLog.create({
      data: { action: "Update", entity: "Deal", entityId: id, details: `Updated deal "${deal.title}"`, spaceId: deal.spaceId, userId }
    })

    // If stage changed, notify deal owner and space admins/managers
    if (body.stage !== undefined && body.stage !== existingDeal.stage) {
      const notificationMessage = `Deal '${deal.title}' moved to stage '${deal.stage}'`

      const adminsAndManagers = await db.spaceMember.findMany({
        where: {
          spaceId: deal.spaceId,
          role: { in: ["admin", "manager"] },
          userId: { notIn: [userId, deal.ownerId] },
        },
        select: { userId: true },
      })

      if (deal.ownerId !== userId) {
        await db.notification.create({
          data: {
            type: "deal_update",
            title: `Deal stage changed: "${deal.title}"`,
            message: notificationMessage,
            entityId: deal.id,
            entityType: "deal",
            spaceId: deal.spaceId,
            userId: deal.ownerId,
            createdById: userId,
          },
        })
      }

      if (adminsAndManagers.length > 0) {
        await db.notification.createMany({
          data: adminsAndManagers.map((member) => ({
            type: "deal_update",
            title: `Deal stage changed: "${deal.title}"`,
            message: notificationMessage,
            entityId: deal.id,
            entityType: "deal",
            spaceId: deal.spaceId,
            userId: member.userId,
            createdById: userId,
          })),
        })
      }
    }

    return NextResponse.json(deal)
  } catch (error) {
    console.error("Deal PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const userId = (session.user as any).id

    const deal = await db.deal.findUnique({ where: { id } })
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await db.deal.delete({ where: { id } })
    await db.activityLog.create({
      data: { action: "Delete", entity: "Deal", entityId: id, details: `Deleted deal "${deal.title}"`, spaceId: deal.spaceId, userId }
    })

    return NextResponse.json({ message: "Deleted" })
  } catch (error) {
    console.error("Deal DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
