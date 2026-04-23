"use client"

import { useSession, signOut } from "next-auth/react"
import { navigateTo, useCurrentPage, useCurrentSpace, setCurrentSpaceId } from "@/app/page"
import { Settings, LogOut, Phone, Shield, ChevronDown, Building2, User } from "lucide-react"
import { useState, useEffect } from "react"

const sidebarItems = [
  { label: "Dashboard", icon: "home", route: "dashboard" },
  { label: "Deals", icon: "deal", route: "deals" },
  { label: "To-Do", icon: "todo", route: "todo" },
  { label: "Meetings", icon: "meeting", route: "meetings" },
  { label: "Prospects", icon: "prospect", route: "prospects" },
  {
    label: "Contact", icon: "contact", children: [
      { label: "Customers", route: "customers" },
      { label: "Companies", route: "companies" },
    ]
  },
  {
    label: "Settings", icon: "settings", children: [
      { label: "Users", route: "settings/users" },
      { label: "Email", route: "settings/email" },
    ]
  },
]

export default function SideBar({ onToggleVoIP }: { onToggleVoIP?: () => void }) {
  const { data: session } = useSession()
  const page = useCurrentPage()
  const spaceId = useCurrentSpace()
  const [spaces, setSpaces] = useState<any[]>([])
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(["Contact", "Settings"]))
  const [showSpaceDropdown, setShowSpaceDropdown] = useState(false)

  const userName = session?.user?.name || "User"
  const userEmail = session?.user?.email || ""
  const userImage = session?.user?.image
  const globalRole = (session?.user as any)?.globalRole || "viewer"

  useEffect(() => {
    if (session?.user) {
      fetch("/api/spaces").then(r => r.json()).then(data => {
        if (Array.isArray(data)) {
          setSpaces(data)
          if (!spaceId && data.length > 0) {
            setCurrentSpaceId(data[0].id)
          }
        }
      }).catch(() => {})
    }
  }, [session])

  const toggleExpand = (label: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const getIconSrc = (icon: string) => {
    const map: Record<string, string> = {
      home: null, deal: "/sideBarIcons/handshake.svg", todo: "/sideBarIcons/layout-list.svg",
      meeting: "/sideBarIcons/presentation.svg", prospect: "/sideBarIcons/trending-up.svg",
      contact: "/sideBarIcons/mail.svg", settings: null,
    }
    return map[icon]
  }

  return (
    <div className="w-[256px] h-[100dvh] flex flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="h-[68px] p-2">
        <div className="flex w-[239px] h-[52px] p-2 items-center gap-2">
          <div className="w-10 h-10 bg-foreground rounded-lg flex items-center justify-center">
            <span className="text-background text-xl font-bold">E</span>
          </div>
          <div className="w-full">
            <h1 className="text-sm font-semibold leading-[20px] text-foreground">Elite CRM</h1>
            <p className="text-xs leading-[16px] text-muted-foreground">elite-crm.app</p>
          </div>
        </div>
      </div>

      {/* Space Selector */}
      <div className="px-2 pb-2">
        <div className="relative">
          <button onClick={() => setShowSpaceDropdown(!showSpaceDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors text-sm">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-muted-foreground" />
              <span className="truncate">{spaces.find(s => s.id === spaceId)?.name || "Select Space"}</span>
            </div>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
          {showSpaceDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              {spaces.map(s => (
                <button key={s.id} onClick={() => { setCurrentSpaceId(s.id); setShowSpaceDropdown(false) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${s.id === spaceId ? "bg-accent font-medium" : ""}`}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar links */}
      <div className="w-full flex-1 p-2 overflow-auto">
        <div className="space-y-0.5">
          {sidebarItems.map((item) => {
            const isExpanded = expandedItems.has(item.label)
            const isActive = page === item.route || item.children?.some(c => c.route === page)
            const iconSrc = getIconSrc(item.icon || "")

            return (
              <div key={item.label}>
                <button
                  onClick={() => item.children ? toggleExpand(item.label) : item.route && navigateTo(item.route)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                    ${isActive && !item.children ? "bg-accent text-accent-foreground font-medium" : "text-foreground hover:bg-accent/50"}`}
                >
                  {item.icon === "home" ? <Shield size={16} /> :
                   item.icon === "settings" ? <Settings size={16} /> :
                   iconSrc ? <img src={iconSrc} alt={item.label} className="w-4 h-4" /> :
                   <div className="w-4 h-4" />}
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.children && <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />}
                </button>
                {item.children && isExpanded && (
                  <div className="ml-6 space-y-0.5 mt-0.5">
                    {item.children.map(child => (
                      <button key={child.label} onClick={() => child.route && navigateTo(child.route)}
                        className={`w-full flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors
                          ${page === child.route ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}>
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* SuperAdmin link */}
          {globalRole === "superadmin" && (
            <button onClick={() => navigateTo("superadmin")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                ${page === "superadmin" ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-accent/50"}`}>
              <Shield size={16} />
              <span>SuperAdmin</span>
            </button>
          )}

          {/* VoIP Button */}
          <button onClick={onToggleVoIP}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent/50 transition-colors">
            <Phone size={16} />
            <span>VoIP Calls</span>
          </button>
        </div>
      </div>

      {/* Bottom profile card */}
      <div className="p-2 border-t border-border">
        <div className="w-full p-2 flex items-center space-x-2">
          {userImage ? (
            <img src={userImage} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
              <span className="text-background text-xs font-bold">{userName?.charAt(0)?.toUpperCase() || "U"}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground leading-[20px] truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => navigateTo("profile")} className="p-1.5 rounded hover:bg-accent transition-colors">
              <User size={14} className="text-muted-foreground" />
            </button>
            <button onClick={() => signOut({ callbackUrl: "/" })} className="p-1.5 rounded hover:bg-accent transition-colors">
              <LogOut size={14} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
