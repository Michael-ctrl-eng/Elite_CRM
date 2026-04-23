import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/notifications/check — Check for upcoming meetings and task reminders, create notifications
// This is a CRON-like endpoint that the frontend polls every minute
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = (session.user as any).id

    let newCount = 0
    const now = new Date()

    // Get user's spaces
    const memberships = await db.spaceMember.findMany({
      where: { userId },
      select: { spaceId: true },
    })
    const spaceIds = memberships.map((m) => m.spaceId)

    if (spaceIds.length === 0) {
      return NextResponse.json({ newNotifications: 0 })
    }

    // ── Meeting Reminders ──
    // Find meetings starting within the next 15 minutes for this user
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000)

    const upcomingMeetings = await db.meeting.findMany({
      where: {
        spaceId: { in: spaceIds },
        startDate: {
          gte: now,
          lte: fifteenMinutesFromNow,
        },
        status: "Scheduled",
        OR: [
          { ownerId: userId },
          { assignedToId: userId },
        ],
      },
    })

    for (const meeting of upcomingMeetings) {
      // Check if we already created a notification for this meeting today
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)

      const existing = await db.notification.findFirst({
        where: {
          type: "meeting_reminder",
          entityId: meeting.id,
          entityType: "meeting",
          userId,
          createdAt: { gte: todayStart },
        },
      })

      if (!existing) {
        await db.notification.create({
          data: {
            type: "meeting_reminder",
            title: `Meeting Reminder: "${meeting.title}"`,
            message: `Your meeting "${meeting.title}" starts at ${meeting.startDate.toLocaleTimeString()}.${meeting.location ? ` Location: ${meeting.location}` : ""}`,
            entityId: meeting.id,
            entityType: "meeting",
            spaceId: meeting.spaceId,
            userId,
          },
        })
        newCount++
      }
    }

    // ── Task Reminders ──
    // Find tasks with dueDate within their reminderMinutes window
    const tasksWithReminder = await db.todo.findMany({
      where: {
        spaceId: { in: spaceIds },
        reminderMinutes: { not: null },
        dueDate: { not: null },
        status: { notIn: ["Done"] },
        OR: [
          { ownerId: userId },
          { assignedToId: userId },
        ],
      },
    })

    for (const task of tasksWithReminder) {
      if (!task.dueDate || !task.reminderMinutes) continue

      const reminderTime = new Date(task.dueDate.getTime() - task.reminderMinutes * 60 * 1000)

      // If the reminder time has passed (we're in the reminder window) and the due date hasn't passed yet
      if (reminderTime <= now && task.dueDate >= now) {
        // Check if we already created a notification for this task today
        const todayStart = new Date(now)
        todayStart.setHours(0, 0, 0, 0)

        const existing = await db.notification.findFirst({
          where: {
            type: "task_reminder",
            entityId: task.id,
            entityType: "todo",
            userId,
            createdAt: { gte: todayStart },
          },
        })

        if (!existing) {
          await db.notification.create({
            data: {
              type: "task_reminder",
              title: `Task Reminder: "${task.title}"`,
              message: `Your task "${task.title}" is due at ${task.dueDate.toLocaleTimeString()}.`,
              entityId: task.id,
              entityType: "todo",
              spaceId: task.spaceId,
              userId,
            },
          })
          newCount++
        }
      }
    }

    return NextResponse.json({ newNotifications: newCount })
  } catch (error) {
    console.error("Notifications Check:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
