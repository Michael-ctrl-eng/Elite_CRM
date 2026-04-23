"use client"

import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect, useCallback } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { io, Socket } from "socket.io-client"
import dynamic from "next/dynamic"

// Lazy load all feature components
const AuthModal = dynamic(() => import("@/components/AuthModal").then(m => ({ default: m.AuthModal })), { ssr: false })
const SideBar = dynamic(() => import("@/components/layout/SideBar")), { ssr: false })
const NavBar = dynamic(() => import("@/components/layout/NavBar")), { ssr: false })

// Dashboard
const Dashboard = dynamic(() => import("@/feature/dashboard/components").then(m => ({ default: m.default })), { ssr: false })
// Deals
const Deals = dynamic(() => import("@/feature/deals/components").then(m => ({ default: m.default })), { ssr: false })
// Todos
const Todos = dynamic(() => import("@/feature/todo/components").then(m => ({ default: m.default })), { ssr: false })
// Meetings
const Meetings = dynamic(() => import("@/feature/meetings/components").then(m => ({ default: m.default })), { ssr: false })
// Prospects
const Prospects = dynamic(() => import("@/feature/prospects/components").then(m => ({ default: m.default })), { ssr: false })
// Customers
const Customers = dynamic(() => import("@/feature/customers/components").then(m => ({ default: m.default })), { ssr: false })
// Companies
const Companies = dynamic(() => import("@/feature/companies/components").then(m => ({ default: m.default })), { ssr: false })
// Settings Users
const UsersSettings = dynamic(() => import("@/feature/settings/users").then(m => ({ default: m.default })), { ssr: false })
// Settings Email
const EmailSettings = dynamic(() => import("@/feature/settings/email/components").then(m => ({ default: m.default })), { ssr: false })
// SuperAdmin
const SuperAdminDashboard = dynamic(() => import("@/components/SuperAdminDashboard"), { ssr: false })
// VoIP
const VoIPPanel = dynamic(() => import("@/components/VoIPPanel"), { ssr: false })
// Profile
const ProfileSettings = dynamic(() => import("@/components/ProfileSettings"), { ssr: false })

// Global navigation store
let currentPage = "dashboard"
let currentSpaceId = ""
const pageListeners = new Set<() => void>()
const spaceListeners = new Set<() => void>()

export function navigateTo(page: string) {
  currentPage = page
  pageListeners.forEach(l => l())
}

export function getCurrentPage() { return currentPage }
export function getCurrentSpaceId() { return currentSpaceId }
export function setCurrentSpaceId(id: string) { 
  currentSpaceId = id
  spaceListeners.forEach(l => l())
}

export function useCurrentPage() {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1)
    pageListeners.add(listener)
    return () => { pageListeners.delete(listener) }
  }, [])
  return currentPage
}

export function useCurrentSpace() {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1)
    spaceListeners.add(listener)
    return () => { spaceListeners.delete(listener) }
  }, [])
  return currentSpaceId
}

function AppContent() {
  const { data: session, status } = useSession()
  const page = useCurrentPage()
  const spaceId = useCurrentSpace()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [showVoIP, setShowVoIP] = useState(false)

  // Initialize WebSocket
  useEffect(() => {
    if (session?.user && !socket) {
      const newSocket = io("/?XTransformPort=3003", {
        transports: ["websocket"],
      })
      newSocket.on("connect", () => {
        newSocket.emit("auth", {
          userId: (session.user as any).id,
          name: session.user.name || "User",
          spaceId: currentSpaceId || undefined,
          role: (session.user as any).globalRole,
        })
      })
      newSocket.on("online-users", (users: any[]) => setOnlineUsers(users))
      newSocket.on("presence-update", (data: any) => {
        setOnlineUsers(prev => {
          const filtered = prev.filter(u => u.userId !== data.userId)
          if (data.status === "online") filtered.push(data)
          return filtered
        })
      })
      setSocket(newSocket)

      // Heartbeat
      const heartbeat = setInterval(() => newSocket.emit("heartbeat"), 30000)
      return () => { clearInterval(heartbeat); newSocket.close() }
    }
  }, [session])

  // Update socket space
  useEffect(() => {
    if (socket && spaceId) {
      socket.emit("set-space", { spaceId })
    }
  }, [socket, spaceId])

  // Presence API heartbeat
  useEffect(() => {
    if (session?.user) {
      const interval = setInterval(() => {
        fetch("/api/presence", { method: "POST" }).catch(() => {})
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [session])

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex space-x-1">
          <div className="w-3 h-3 bg-foreground rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
          <div className="w-3 h-3 bg-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
        </div>
      </div>
    )
  }

  // Not authenticated - show auth
  if (!session?.user) {
    return <AuthModal />
  }

  const isDemo = (session.user as any).isDemo

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard />
      case "deals": return <Deals />
      case "todo": return <Todos />
      case "meetings": return <Meetings />
      case "prospects": return <Prospects />
      case "customers": return <Customers />
      case "companies": return <Companies />
      case "settings/users": return <UsersSettings />
      case "settings/email": return <EmailSettings />
      case "superadmin": return <SuperAdminDashboard />
      case "profile": return <ProfileSettings />
      default: return <Dashboard />
    }
  }

  return (
    <div className="flex h-[100dvh]">
      {/* Demo Account Banner */}
      {isDemo && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 text-center py-1.5 text-sm font-medium">
          ⚠️ Demo Account — All data shown is sample data and not real. Changes may be reset at any time.
        </div>
      )}
      
      <div className={isDemo ? "mt-8" : ""}>
        <SideBar />
      </div>
      <div className="flex flex-col flex-1 overflow-x-hidden">
        <NavBar onToggleVoIP={() => setShowVoIP(!showVoIP)} onlineCount={onlineUsers.length} />
        <div className="overflow-y-auto overflow-x-hidden flex-1">
          {renderPage()}
        </div>
      </div>
      
      {/* VoIP Panel */}
      {showVoIP && <VoIPPanel socket={socket} onlineUsers={onlineUsers} onClose={() => setShowVoIP(false)} />}
    </div>
  )
}

export default function Home() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } }
  }))

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </SessionProvider>
  )
}
