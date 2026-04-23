"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Bell,
  Calendar,
  CheckSquare,
  TrendingUp,
  MessageSquare,
  X,
  CheckCheck,
  Trash2,
  Volume2,
  VolumeX,
  ClipboardList,
} from "lucide-react"
import { navigateTo } from "@/app/page"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  entityId: string | null
  entityType: string | null
  spaceId: string | null
  userId: string
  createdById: string | null
  createdAt: string
  createdBy?: {
    id: string
    name: string | null
    email: string
    image: string | null
  } | null
}

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
  anchorRef?: React.RefObject<HTMLButtonElement>
}

// Play a short beep sound using Web Audio API
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 830
    oscillator.type = "sine"
    gainNode.gain.value = 0.3

    // Play a short two-tone beep
    oscillator.frequency.setValueAtTime(830, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1)

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.25)
  } catch (e) {
    // Web Audio API not available, silent fail
  }
}

export default function NotificationPanel({ open, onClose, anchorRef }: NotificationPanelProps) {
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)
  const previousOpenRef = useRef(false)
  const previousNotifIdsRef = useRef<Set<string>>(new Set())

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=30")
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (e) {
      console.error("Failed to fetch notifications:", e)
    }
  }, [])

  // Check for new reminders (meetings, tasks)
  const checkReminders = useCallback(async () => {
    try {
      await fetch("/api/notifications/check")
    } catch (e) {
      // silent
    }
  }, [])

  // Poll for notifications every 60 seconds
  useEffect(() => {
    if (!session?.user) return
    const load = async () => {
      await fetchNotifications()
      await checkReminders()
    }
    load()
    const interval = setInterval(() => {
      fetchNotifications()
      checkReminders()
    }, 60000)
    return () => clearInterval(interval)
  }, [session, fetchNotifications, checkReminders])

  // Show browser toasts for new unread notifications when panel opens
  useEffect(() => {
    if (open && !previousOpenRef.current) {
      const now = Date.now()
      const fiveMinutesAgo = now - 5 * 60 * 1000
      const previousIds = previousNotifIdsRef.current

      const newUnreadNotifications = notifications.filter(
        (n) =>
          !n.read &&
          new Date(n.createdAt).getTime() > fiveMinutesAgo &&
          !previousIds.has(n.id)
      )

      for (const notification of newUnreadNotifications) {
        toast(notification.title, {
          description: notification.message,
          duration: 4000,
        })
      }

      if (newUnreadNotifications.length > 0 && soundEnabled) {
        playNotificationSound()
      }
    }

    // Update refs
    previousOpenRef.current = open
    previousNotifIdsRef.current = new Set(notifications.map((n) => n.id))
  }, [open, notifications, soundEnabled])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open, onClose])

  // Mark as read
  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (e) { /* silent */ }
  }

  // Mark all as read
  const markAllRead = async () => {
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (e) { /* silent */ }
  }

  // Delete notification
  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" })
      setNotifications(prev => prev.filter(n => n.id !== id))
      // Recheck unread count
      fetchNotifications()
    } catch (e) { /* silent */ }
  }

  // Clear all notifications
  const clearAll = async () => {
    try {
      await fetch("/api/notifications", { method: "DELETE" })
      setNotifications([])
      setUnreadCount(0)
    } catch (e) { /* silent */ }
  }

  // Handle click on notification - navigate and mark as read
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) markAsRead(notification.id)
    // Navigate based on entity type
    if (notification.entityType === "deal") navigateTo("deals")
    else if (notification.entityType === "meeting") navigateTo("meetings")
    else if (notification.entityType === "todo") navigateTo("todo")
    onClose()
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "meeting_reminder": return <Calendar size={16} className="text-blue-500" />
      case "task_reminder": return <CheckSquare size={16} className="text-amber-500" />
      case "task_due_today": return <ClipboardList size={16} className="text-orange-500" />
      case "deal_update": return <TrendingUp size={16} className="text-green-500" />
      case "deal_note": return <MessageSquare size={16} className="text-purple-500" />
      default: return <Bell size={16} className="text-muted-foreground" />
    }
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-popover border border-border rounded-xl shadow-xl z-[60] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-foreground" />
          <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] flex items-center justify-center">
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(prev => !prev)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label={soundEnabled ? "Mute notification sound" : "Unmute notification sound"}
            title={soundEnabled ? "Mute sound" : "Unmute sound"}
          >
            {soundEnabled ? (
              <Volume2 size={14} className="text-muted-foreground" />
            ) : (
              <VolumeX size={14} className="text-muted-foreground/50" />
            )}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              aria-label="Mark all as read"
              title="Mark all as read"
            >
              <CheckCheck size={14} className="text-muted-foreground" />
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              aria-label="Clear all notifications"
              title="Clear all"
            >
              <Trash2 size={14} className="text-muted-foreground" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="Close"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Notification List */}
      <ScrollArea className="max-h-[400px]">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No notifications</p>
            <p className="text-xs text-muted-foreground/70 mt-1">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="py-1">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`group flex gap-3 p-3 hover:bg-accent/50 transition-colors cursor-pointer ${
                  !notification.read ? "bg-primary/5" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                {/* Icon */}
                <div className="shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                    {getNotificationIcon(notification.type)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <p className={`text-sm ${!notification.read ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground/70">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                    {notification.createdBy && notification.createdBy.name && (
                      <span className="text-[10px] text-muted-foreground/70">
                        by {notification.createdBy.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id) }}
                  className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-all"
                  aria-label="Delete notification"
                >
                  <Trash2 size={12} className="text-muted-foreground/50" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-2 border-t border-border bg-muted/20 text-center">
          <p className="text-[10px] text-muted-foreground/60">
            Notifications are checked every minute for upcoming meetings and tasks
          </p>
        </div>
      )}
    </div>
  )
}

// Also export a hook for the unread count
export function useNotificationCount() {
  const [count, setCount] = useState(0)
  const { data: session } = useSession()

  useEffect(() => {
    if (!session?.user) return
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/notifications?unreadOnly=true&limit=0")
        if (res.ok) {
          const data = await res.json()
          setCount(data.unreadCount || 0)
        }
      } catch (e) { /* silent */ }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
  }, [session])

  return count
}
