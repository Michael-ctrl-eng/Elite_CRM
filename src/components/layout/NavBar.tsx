"use client"

import { useState, useEffect, useRef } from "react"
import { signOut, useSession } from "next-auth/react"
import { useCurrentPage } from "@/app/page"
import { Bell, MessageSquare, Phone, Search, LogOut, User } from "lucide-react"
import { navigateTo } from "@/app/page"

const pageDescriptions: Record<string, { title: string; description: string }> = {
  dashboard: { title: "Dashboard", description: "Your leads. Your tasks. Your momentum — in one view." },
  deals: { title: "Deals", description: "Track and manage all your commercial opportunities." },
  todo: { title: "To-Do", description: "Organize and follow all your daily actions." },
  meetings: { title: "Meetings", description: "Organize and follow all your meetings." },
  customers: { title: "Customers", description: "Keep track of every customer interaction." },
  companies: { title: "Companies", description: "Keep track of every company interaction." },
  prospects: { title: "Prospects", description: "Manage and track all your prospect interactions." },
  "settings/users": { title: "User Settings", description: "Manage all users of the platform." },
  "settings/email": { title: "Email Settings", description: "Configure email sending and receiving." },
  superadmin: { title: "SuperAdmin Dashboard", description: "Manage all spaces, users, and system activity." },
  profile: { title: "Profile Settings", description: "Update your name and profile picture." },
}

export default function NavBar({ onToggleVoIP, onlineCount }: { onToggleVoIP?: () => void; onlineCount?: number }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const page = useCurrentPage()
  const { data: session } = useSession()

  const pageInfo = pageDescriptions[page] || pageDescriptions.dashboard

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <header className="flex items-center h-[68px] w-full justify-between px-6 py-3 border-b border-border bg-card">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold text-foreground">{pageInfo.title}</h1>
        <p className="text-sm text-muted-foreground">{pageInfo.description}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* VoIP Button */}
        {onToggleVoIP && (
          <button onClick={onToggleVoIP}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Phone size={14} />
            <span>VoIP</span>
          </button>
        )}

        {/* Online indicator */}
        {onlineCount !== undefined && onlineCount > 0 && (
          <span className="text-xs text-muted-foreground">{onlineCount} online</span>
        )}

        <div className="h-6 w-px bg-border"></div>

        {/* Notification */}
        <button className="p-2 rounded-lg hover:bg-accent transition-colors">
          <Bell size={18} className="text-muted-foreground" />
        </button>

        {/* Profile dropdown */}
        <div className="flex items-center gap-2 relative" ref={dropdownRef}>
          <button onClick={() => navigateTo("profile")}
            className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
            <span className="text-background text-xs font-bold">{session?.user?.name?.charAt(0)?.toUpperCase() || "U"}</span>
          </button>
          <button onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-0.5 rounded hover:bg-accent transition-colors">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg z-50">
              <div className="py-1">
                <button onClick={() => { navigateTo("profile"); setIsDropdownOpen(false) }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 text-foreground">
                  <User size={14} /> Profile
                </button>
                <button onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 text-destructive">
                  <LogOut size={14} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
