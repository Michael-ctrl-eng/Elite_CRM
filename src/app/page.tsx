"use client"

import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect, useCallback } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import dynamic from "next/dynamic"
import React from "react"

// ─── Global Navigation State ───
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

// ─── Lazy-loaded Feature Components ───
const AuthModal = dynamic(() => import("@/components/AuthModal").then(m => ({ default: m.AuthModal })), { ssr: false })
const SideBar = dynamic(() => import("@/components/layout/SideBar"), { ssr: false })
const NavBar = dynamic(() => import("@/components/layout/NavBar"), { ssr: false })
const SuperAdminDashboard = dynamic(() => import("@/components/SuperAdminDashboard"), { ssr: false })
const VoIPPanel = dynamic(() => import("@/components/VoIPPanel"), { ssr: false })
const ProfileSettings = dynamic(() => import("@/components/ProfileSettings"), { ssr: false })

// CRM Feature pages
const DashboardPage = dynamic(() => import("@/feature/dashboard/components/DashboardPage"), { ssr: false })
const DealsPage = dynamic(() => import("@/feature/deals/components/DealsPage"), { ssr: false })
const TodosPage = dynamic(() => import("@/feature/todo/components/TodosPage"), { ssr: false })
const MeetingsPage = dynamic(() => import("@/feature/meetings/components/MeetingsPage"), { ssr: false })
const ProspectsPage = dynamic(() => import("@/feature/prospects/components/ProspectsPage"), { ssr: false })
const CustomersPage = dynamic(() => import("@/feature/customers/components/CustomersPage"), { ssr: false })
const CompaniesPage = dynamic(() => import("@/feature/companies/components").then(m => ({ default: m.default })), { ssr: false })
const UsersSettings = dynamic(() => import("@/feature/settings/users").then(m => ({ default: m.default })), { ssr: false })
const EmailSettings = dynamic(() => import("@/feature/settings/email/components").then(m => ({ default: m.default })), { ssr: false })

function AppContent() {
  const { data: session, status } = useSession()
  const page = useCurrentPage()
  const spaceId = useCurrentSpace()
  const [showVoIP, setShowVoIP] = useState(false)

  // Presence heartbeat
  useEffect(() => {
    if (session?.user) {
      const interval = setInterval(() => {
        fetch("/api/presence", { method: "POST" }).catch(() => {})
      }, 30000)
      fetch("/api/presence", { method: "POST" }).catch(() => {})
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
      case "dashboard": return <DashboardPage />
      case "deals": return <DealsPage />
      case "todo": return <TodosPage />
      case "meetings": return <MeetingsPage />
      case "prospects": return <ProspectsPage />
      case "customers": return <CustomersPage />
      case "companies": return <CompaniesPage />
      case "settings/users": return <UsersSettings />
      case "settings/email": return <EmailSettings />
      case "superadmin": return <SuperAdminDashboard />
      case "profile": return <ProfileSettings />
      default: return <DashboardPage />
    }
  }

  return (
    <div className={isDemo ? "pt-8" : ""}>
      {/* Demo Account Banner */}
      {isDemo && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 text-center py-1.5 text-sm font-medium shadow-md">
          ⚠️ Demo Account — All data shown is sample data and not real. Changes may be reset at any time.
        </div>
      )}
      <div className="flex h-[100dvh]">
        <SideBar onToggleVoIP={() => setShowVoIP(!showVoIP)} />
        <div className="flex flex-col flex-1 overflow-x-hidden">
          <NavBar onToggleVoIP={() => setShowVoIP(!showVoIP)} />
          <div className="overflow-y-auto overflow-x-hidden flex-1">
            {renderPage()}
          </div>
        </div>
        {/* VoIP Panel */}
        {showVoIP && <VoIPPanel onClose={() => setShowVoIP(false)} />}
      </div>
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
