"use client"

import { Briefcase } from "lucide-react"

export default function ComingSoonPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Briefcase className="text-primary" size={36} />
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-3">Coming Soon</h1>
      <p className="text-lg text-muted-foreground text-center max-w-md">
        We&apos;re working hard to bring you this feature. Stay tuned for updates!
      </p>
      <div className="mt-6 px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm">
        This module is under active development
      </div>
    </div>
  )
}
