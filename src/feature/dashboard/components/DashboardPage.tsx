"use client"

import { useState, useEffect } from "react"
import { useCurrentSpace } from "@/app/page"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Users, Building2, DollarSign, CheckCircle, Clock, Calendar, Activity } from "lucide-react"

export default function DashboardPage() {
  const spaceId = useCurrentSpace()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!spaceId) return
    setLoading(true)
    fetch(`/api/dashboard?spaceId=${spaceId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [spaceId])

  // Auto-refresh every 30s
  useEffect(() => {
    if (!spaceId) return
    const interval = setInterval(() => {
      fetch(`/api/dashboard?spaceId=${spaceId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d) })
        .catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [spaceId])

  if (loading || !data) {
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

  return (
    <div className="p-6 space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{data.deals?.total || 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><TrendingUp className="text-primary" size={20} /></div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{data.deals?.winRate || 0}% win rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <p className="text-2xl font-bold">${(data.deals?.totalValue || 0).toLocaleString()}</p>
              </div>
              <div className="p-2 rounded-lg bg-green-500/10"><DollarSign className="text-green-500" size={20} /></div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all stages</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Customers</p>
                <p className="text-2xl font-bold">{data.customers || 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10"><Users className="text-amber-500" size={20} /></div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{data.prospects || 0} prospects</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online Now</p>
                <p className="text-2xl font-bold">{data.onlineCount || 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10"><Activity className="text-purple-500" size={20} /></div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{data.companies || 0} companies</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline & Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deal Pipeline */}
        <Card>
          <CardHeader><CardTitle className="text-base">Deal Pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.deals?.byStage && Object.entries(data.deals.byStage).map(([stage, info]: [string, any]) => (
              <div key={stage} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Badge variant={stage === "Won" ? "default" : stage === "Lost" ? "destructive" : "secondary"}>{stage}</Badge>
                  <span className="text-sm">{info.count} deals</span>
                </div>
                <span className="text-sm font-medium">${(info.totalValue || 0).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {data.recentActivities?.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>}
              {data.recentActivities?.map((a: any) => (
                <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30">
                  <Badge variant={a.action === "Create" ? "default" : a.action === "Delete" ? "destructive" : "secondary"} className="text-xs">
                    {a.action}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{a.details}</p>
                    <p className="text-xs text-muted-foreground">{a.user?.name} · {new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming & Todos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar size={16} /> Upcoming Meetings</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.upcomingMeetings?.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No upcoming meetings</p>}
              {data.upcomingMeetings?.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(m.startDate).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline">{m.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle size={16} /> Pending Tasks</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.pendingTodos?.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All tasks completed!</p>}
              {data.pendingTodos?.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.dueDate ? `Due: ${new Date(t.dueDate).toLocaleDateString()}` : "No due date"}</p>
                  </div>
                  <Badge variant={t.priority === "Urgent" ? "destructive" : t.priority === "High" ? "default" : "secondary"}>{t.priority}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
