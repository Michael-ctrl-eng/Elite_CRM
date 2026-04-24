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
    // Find meetings starting within the next 15 minutes OR currently happening (started within last 30 min)
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000)
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)

    const upcomingMeetings = await db.meeting.findMany({
      where: {
        spaceId: { in: spaceIds },
        startDate: {
          gte: thirtyMinutesAgo,
          lte: fifteenMinutesFromNow,
        },
        status: "Scheduled",
        OR: [
          { ownerId: userId },
          { assignedToId: userId },
        ],
      },
    })

    // Duplicate check window: last 2 hours
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

    for (const meeting of upcomingMeetings) {
      const existing = await db.notification.findFirst({
        where: {
          type: "meeting_reminder",
          entityId: meeting.id,
          entityType: "meeting",
          userId,
          createdAt: { gte: twoHoursAgo },
        },
      })

      if (!existing) {
        const isCurrentlyHappening = meeting.startDate <= now
        await db.notification.create({
          data: {
            type: "meeting_reminder",
            title: isCurrentlyHappening
              ? `Meeting Now: "${meeting.title}"`
              : `Meeting Reminder: "${meeting.title}"`,
            message: isCurrentlyHappening
              ? `Your meeting "${meeting.title}" has started.${meeting.location ? ` Location: ${meeting.location}` : ""}`
              : `Your meeting "${meeting.title}" starts at ${meeting.startDate.toLocaleTimeString()}.${meeting.location ? ` Location: ${meeting.location}` : ""}`,
            entityId: meeting.id,
            entityType: "meeting",
            spaceId: meeting.spaceId,
            userId,
          },
        })
        newCount++
      }
    }

    // ── Task Reminders (with reminderMinutes set) ──
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
        const existing = await db.notification.findFirst({
          where: {
            type: "task_reminder",
            entityId: task.id,
            entityType: "todo",
            userId,
            createdAt: { gte: twoHoursAgo },
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

    // ── Tasks Due Today (no reminderMinutes needed) ──
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const tasksDueToday = await db.todo.findMany({
      where: {
        spaceId: { in: spaceIds },
        dueDate: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: { notIn: ["Done"] },
        OR: [
          { ownerId: userId },
          { assignedToId: userId },
        ],
      },
    })

    for (const task of tasksDueToday) {
      // Skip tasks that already have a task_reminder notification (from the previous section)
      const existingReminder = await db.notification.findFirst({
        where: {
          type: { in: ["task_reminder", "task_due_today"] },
          entityId: task.id,
          entityType: "todo",
          userId,
          createdAt: { gte: twoHoursAgo },
        },
      })

      if (!existingReminder) {
        await db.notification.create({
          data: {
            type: "task_due_today",
            title: `Task Due Today: "${task.title}"`,
            message: `Your task "${task.title}" is due today.${task.dueDate ? ` Due at ${task.dueDate.toLocaleTimeString()}.` : ""}`,
            entityId: task.id,
            entityType: "todo",
            spaceId: task.spaceId,
            userId,
          },
        })
        newCount++
      }
    }

    return NextResponse.json({ newNotifications: newCount })
  } catch (error) {
    console.error("Notifications Check:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
