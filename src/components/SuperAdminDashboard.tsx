"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Building2, Users, Activity, Wifi, WifiOff, Trash2, Plus, Shield, UserPlus, RefreshCw } from "lucide-react"

export default function SuperAdminDashboard() {
  const { data: session } = useSession()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateSpace, setShowCreateSpace] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newSpace, setNewSpace] = useState({ name: "", slug: "", description: "", industry: "" })
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "viewer", spaceId: "", password: "" })
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/superadmin")
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch (e) {
      console.error("SuperAdmin fetch error:", e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 10 seconds for real-time
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleCreateSpace = async () => {
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSpace),
    })
    if (res.ok) {
      setShowCreateSpace(false)
      setNewSpace({ name: "", slug: "", description: "", industry: "" })
      fetchData()
    }
  }

  const handleAddUser = async () => {
    const res = await fetch("/api/auth/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    })
    if (res.ok) {
      setShowAddUser(false)
      setNewUser({ name: "", email: "", role: "viewer", spaceId: "", password: "" })
      fetchData()
    }
  }

  const handleDeleteSpace = async (spaceId: string) => {
    if (!confirm("Delete this space and ALL its data? This cannot be undone!")) return
    await fetch(`/api/spaces/${spaceId}`, { method: "DELETE" })
    fetchData()
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Delete this user?")) return
    await fetch("/api/auth/user", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [userId] }),
    })
    fetchData()
  }

  const handleUpdateRole = async (userId: string, role: string) => {
    await fetch("/api/auth/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, globalRole: role }),
    })
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex space-x-1">
          <div className="w-3 h-3 bg-foreground rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
          <div className="w-3 h-3 bg-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
        </div>
      </div>
    )
  }

  if (!data) return <div className="p-6 text-muted-foreground">Failed to load data</div>

  const roleColors: Record<string, string> = {
    superadmin: "bg-primary text-primary-foreground",
    admin: "bg-amber-500 text-white",
    manager: "bg-blue-500 text-white",
    viewer: "bg-muted text-muted-foreground",
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="text-primary" size={24} /> SuperAdmin Dashboard
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Real-time overview of all spaces, users, and activity</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); fetchData() }} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Building2 className="text-primary" size={20} /></div>
              <div>
                <p className="text-2xl font-bold">{data.stats.totalSpaces}</p>
                <p className="text-xs text-muted-foreground">Total Spaces</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10"><Users className="text-amber-500" size={20} /></div>
              <div>
                <p className="text-2xl font-bold">{data.stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><Wifi className="text-green-500" size={20} /></div>
              <div>
                <p className="text-2xl font-bold">{data.stats.onlineUsers}</p>
                <p className="text-xs text-muted-foreground">Online Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10"><Activity className="text-purple-500" size={20} /></div>
              <div>
                <p className="text-2xl font-bold">{data.stats.totalDeals}</p>
                <p className="text-xs text-muted-foreground">Total Deals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Dialog open={showCreateSpace} onOpenChange={setShowCreateSpace}>
          <DialogTrigger asChild>
            <Button><Plus size={14} /> Create Space</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New Space</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Space Name" value={newSpace.name} onChange={e => setNewSpace({ ...newSpace, name: e.target.value })} />
              <Input placeholder="Slug (e.g., my-company)" value={newSpace.slug} onChange={e => setNewSpace({ ...newSpace, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
              <Input placeholder="Description" value={newSpace.description} onChange={e => setNewSpace({ ...newSpace, description: e.target.value })} />
              <Input placeholder="Industry" value={newSpace.industry} onChange={e => setNewSpace({ ...newSpace, industry: e.target.value })} />
              <Button onClick={handleCreateSpace} className="w-full" disabled={!newSpace.name || !newSpace.slug}>Create Space</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogTrigger asChild>
            <Button variant="outline"><UserPlus size={14} /> Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Full Name" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
              <Input placeholder="Email" type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
              <Input placeholder="Password (min 6 chars)" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
              <Select value={newUser.role} onValueChange={v => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">SuperAdmin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newUser.spaceId} onValueChange={v => setNewUser({ ...newUser, spaceId: v })}>
                <SelectTrigger><SelectValue placeholder="Assign to Space" /></SelectTrigger>
                <SelectContent>
                  {data.spaces?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleAddUser} className="w-full" disabled={!newUser.name || !newUser.email}>Add User</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spaces Table */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 size={18} /> Spaces</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Members</th><th className="text-left p-3">Data</th><th className="p-3"></th></tr>
                </thead>
                <tbody>
                  {data.spaces?.map((space: any) => (
                    <tr key={space.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-medium">{space.name}</div>
                        <div className="text-xs text-muted-foreground">{space.slug}</div>
                      </td>
                      <td className="p-3"><Badge variant="secondary">{space.members?.length || 0}</Badge></td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {space._count?.deals || 0} deals, {space._count?.customers || 0} customers
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteSpace(space.id)} className="text-destructive hover:text-destructive">
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users size={18} /> Users</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr><th className="text-left p-3">User</th><th className="text-left p-3">Role</th><th className="text-left p-3">Status</th><th className="p-3"></th></tr>
                </thead>
                <tbody>
                  {data.users?.map((user: any) => {
                    const isOnline = data.onlineUsers?.some((ou: any) => ou.id === user.id)
                    return (
                      <tr key={user.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-3">
                          <div className="font-medium">{user.name || user.email}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </td>
                        <td className="p-3">
                          <Select value={user.globalRole} onValueChange={v => handleUpdateRole(user.id, v)}>
                            <SelectTrigger className="h-7 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="superadmin">SuperAdmin</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            {isOnline ? <Wifi size={12} className="text-green-500" /> : <WifiOff size={12} className="text-muted-foreground" />}
                            <span className={`text-xs ${isOnline ? "text-green-500" : "text-muted-foreground"}`}>
                              {isOnline ? "Online" : "Offline"}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          {(user.globalRole !== "superadmin" || data.users.filter((u: any) => u.globalRole === "superadmin").length > 1) && (
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user.id)} className="text-destructive hover:text-destructive">
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity size={18} /> Recent Activity (All Spaces)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr><th className="text-left p-3">Action</th><th className="text-left p-3">Entity</th><th className="text-left p-3">User</th><th className="text-left p-3">Space</th><th className="text-left p-3">Time</th></tr>
              </thead>
              <tbody>
                {data.recentActivities?.map((activity: any) => (
                  <tr key={activity.id} className="border-t border-border">
                    <td className="p-3">
                      <Badge variant={activity.action === "Delete" ? "destructive" : activity.action === "Create" ? "default" : "secondary"}>
                        {activity.action}
                      </Badge>
                    </td>
                    <td className="p-3">{activity.entity}: {activity.details}</td>
                    <td className="p-3 text-muted-foreground">{activity.user?.name || "Unknown"}</td>
                    <td className="p-3 text-muted-foreground">{activity.space?.name || "-"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(activity.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
