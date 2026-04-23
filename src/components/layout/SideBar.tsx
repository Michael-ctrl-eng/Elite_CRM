"use client";
import React from "react";
import SidebarItem from "../ui/SideBarItems";
import { Home, Settings } from "lucide-react";
import { sidebarItems } from "@/libs/sideBarLinks";
import { useSession } from "next-auth/react";

export default function SideBar() {
  const { data: session } = useSession();

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "user@example.com";
  const userImage = session?.user?.image || "/icons/ProfileIcon.svg";

  return (
    <div className="w-[256px] h-[100dvh] flex flex-col border-r border-[var(--border-gray)]">
      {/* Top Logo */}
      <div className="h-[68px] p-2">
        <div className="flex w-[239px] h-[52px] p-2 items-center gap-2">
          <div className="w-10 h-8">
            <img src="/icons/Logo.svg" alt="Elite" className="h-8 w-8" />
          </div>
          <div className="w-full">
            <h1 className="text-sm font-semibold leading-[20px] text-[var(--foreground)]">
              Elite
            </h1>
            <p className="text-xs leading-[16px] text-[var(--foreground)]">
              Elite.com
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar links */}
      <div className="w-full flex-1 p-2 overflow-auto scrollbar-hide">
        <div className="space-y-1">
          {sidebarItems.map((item) => {
            const lucideIconMap = {
              home: Home,
              settings: Settings,
            } as const;

            const IconComponent = item.lucideIcon
              ? lucideIconMap[item.lucideIcon]
              : null;

            const iconNode = IconComponent ? (
              <IconComponent size={16} />
            ) : item.icon ? (
              <img src={item.icon} alt={item.label} className="w-4 h-4" />
            ) : undefined;

            return (
              <SidebarItem
                key={item.label}
                icon={iconNode}
                label={item.label}
                route={item.route}
              >
                {item.children?.map((child) => (
                  <SidebarItem
                    key={child.label}
                    label={child.label}
                    route={child.route}
                  />
                ))}
              </SidebarItem>
            );
          })}
        </div>
      </div>

      {/* ✅ Bottom profile card (dynamic user) */}
      <div className="p-2 border-t border-[var(--border-gray)]">
        <div className="w-full h-[52px] p-2 flex items-center space-x-2">
          <img
            src={userImage}
            alt="User avatar"
            className="w-8 h-8 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--foreground)] leading-[20px] truncate">
              {userName}
            </p>
            <p className="text-xs font-normal text-[var(--foreground)] truncate leading-[16px]">
              {userEmail}
            </p>
          </div>
          <button className="p-1 rounded hover:bg-gray-100">
            <Settings size={16} className="text-[var(--foreground)]" />
          </button>
        </div>
      </div>
    </div>
  );
}
