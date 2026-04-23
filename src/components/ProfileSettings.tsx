"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, Upload, Save } from "lucide-react"

export default function ProfileSettings() {
  const { data: session } = useSession()
  const [name, setName] = useState("")
  const [image, setImage] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "")
      setImage((session.user as any).image || "")
    }
  }, [session])

  const handleSave = async () => {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image }),
      })
      if (res.ok) {
        setMessage("Profile updated successfully!")
      } else {
        const data = await res.json()
        setMessage(data.error || "Failed to update profile")
      }
    } catch (e) {
      setMessage("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (res.ok) {
        const data = await res.json()
        setImage(data.url)
      }
    } catch (e) {
      console.error("Upload failed:", e)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Profile Settings</h2>
      <p className="text-muted-foreground text-sm">Update your name and profile picture. Email cannot be changed.</p>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.includes("success") ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
          {message}
        </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Profile Picture */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {image ? (
                <img src={image} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center border-2 border-border">
                  <span className="text-background text-2xl font-bold">{name?.charAt(0)?.toUpperCase() || "?"}</span>
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
                <Camera size={14} />
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </label>
            </div>
            <div>
              <p className="font-medium text-foreground">{name || "Your Name"}</p>
              <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">🔒 Email cannot be changed</p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          </div>

          {/* Email (read only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={session?.user?.email || ""} disabled className="bg-muted cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">Email is managed by your administrator and cannot be changed.</p>
          </div>

          {/* Role (read only) */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input id="role" value={(session?.user as any)?.globalRole || ""} disabled className="bg-muted cursor-not-allowed capitalize" />
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save size={14} /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
