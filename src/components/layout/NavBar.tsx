"use client"

import { useState, useEffect, useRef } from "react"
import { signOut, useSession } from "next-auth/react"
import { useCurrentPage } from "@/app/page"
import { Bell, Phone, Search, LogOut, User, Briefcase, MoreVertical, PanelLeft } from "lucide-react"
import { navigateTo } from "@/app/page"
import NotificationPanel, { useNotificationCount } from "@/components/NotificationPanel"

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
  hiring: { title: "Hiring", description: "Manage your recruitment pipeline and applicants." },
}

export default function NavBar({ onToggleVoIP, onlineCount, setMobileMenuOpen }: { onToggleVoIP?: () => void; onlineCount?: number; setMobileMenuOpen?: (open: boolean) => void }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isOverflowOpen, setIsOverflowOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  const page = useCurrentPage()
  const { data: session } = useSession()
  const unreadCount = useNotificationCount()

  const pageInfo = pageDescriptions[page] || pageDescriptions.dashboard

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) {
        setIsOverflowOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <header className="flex items-center h-[68px] w-full justify-between px-4 sm:px-6 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Sidebar toggle - always visible */}
        {setMobileMenuOpen && (
          <button onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-accent transition-colors flex-shrink-0"
            aria-label="Open menu">
            <PanelLeft size={20} className="text-foreground" />
          </button>
        )}
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">{pageInfo.title}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">{pageInfo.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* VoIP Button - hidden on very small screens */}
        {onToggleVoIP && (
          <button onClick={onToggleVoIP}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors min-h-[36px]">
            <Phone size={14} />
            <span>VoIP</span>
          </button>
        )}

        {/* Online indicator - hidden on small screens */}
        {onlineCount !== undefined && onlineCount > 0 && (
          <span className="text-xs text-muted-foreground hidden md:inline">{onlineCount} online</span>
        )}

        {/* Hiring button - desktop */}
        <button
          onClick={() => navigateTo("hiring")}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-sm text-foreground min-h-[36px]"
        >
          <Briefcase size={14} className="text-muted-foreground" />
          <span>Hiring</span>
        </button>

        {/* Mobile overflow menu for VoIP & Hiring */}
        <div className="relative md:hidden" ref={overflowRef}>
          <button
            onClick={() => setIsOverflowOpen(!isOverflowOpen)}
            className="p-2 rounded-lg hover:bg-accent transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="More options"
          >
            <MoreVertical size={18} className="text-muted-foreground" />
          </button>
          {isOverflowOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg z-50">
              <div className="py-1">
                {onToggleVoIP && (
                  <button onClick={() => { onToggleVoIP(); setIsOverflowOpen(false) }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent flex items-center gap-2 text-foreground min-h-[44px]">
                    <Phone size={14} /> VoIP
                  </button>
                )}
                <button onClick={() => { navigateTo("hiring"); setIsOverflowOpen(false) }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent flex items-center gap-2 text-foreground min-h-[44px]">
                  <Briefcase size={14} className="text-muted-foreground" /> Hiring
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-border"></div>

        {/* Notification */}
        <div className="relative">
          <button
            ref={bellRef}
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg hover:bg-accent transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center relative"
          >
            <Bell size={18} className="text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          <NotificationPanel
            open={showNotifications}
            onClose={() => setShowNotifications(false)}
            anchorRef={bellRef}
          />
        </div>

        {/* Profile dropdown */}
        <div className="flex items-center gap-2 relative" ref={dropdownRef}>
          <button onClick={() => navigateTo("profile")}
            className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center flex-shrink-0 min-h-[36px] min-w-[36px]">
            <span className="text-background text-xs font-bold">{session?.user?.name?.charAt(0)?.toUpperCase() || "U"}</span>
          </button>
          <button onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-0.5 rounded hover:bg-accent transition-colors hidden sm:block">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg z-50">
              <div className="py-1">
                <button onClick={() => { navigateTo("profile"); setIsDropdownOpen(false) }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent flex items-center gap-2 text-foreground min-h-[44px]">
                  <User size={14} /> Profile
                </button>
                <button onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent flex items-center gap-2 text-destructive min-h-[44px]">
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
