"use client"
import { useState, useEffect } from "react"
import { useCurrentSpace } from "@/app/page"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Trash2, Calendar, MapPin, Clock } from "lucide-react"

const STATUSES = ["Scheduled", "Confirmed", "Cancelled"]

export default function MeetingsPage() {
  const spaceId = useCurrentSpace()
  const [meetings, setMeetings] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editMeeting, setEditMeeting] = useState<any>(null)
  const [form, setForm] = useState({ title: "", description: "", location: "", status: "Scheduled", startDate: "", endDate: "" })

  const fetchData = () => { if (!spaceId) return; fetch(`/api/meetings?spaceId=${spaceId}`).then(r => r.json()).then(setMeetings).catch(() => {}) }
  useEffect(() => { fetchData() }, [spaceId])

  const handleCreate = async () => {
    await fetch("/api/meetings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, spaceId }) })
    setShowCreate(false); setForm({ title: "", description: "", location: "", status: "Scheduled", startDate: "", endDate: "" }); fetchData()
  }
  const handleUpdate = async (id: string, data: any) => { await fetch(`/api/meetings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); setEditMeeting(null); fetchData() }
  const handleDelete = async (id: string) => { if (!confirm("Delete?")) return; await fetch(`/api/meetings/${id}`, { method: "DELETE" }); fetchData() }

  const upcoming = meetings.filter(m => m.status !== "Cancelled")

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{upcoming.length} Meetings</h2>
        <Dialog open={showCreate} onOpenChange={setShowCreate}><DialogTrigger asChild><Button className="min-h-[44px] w-full sm:w-auto"><Plus size={14} /> Add Meeting</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Create Meeting</DialogTitle></DialogHeader><div className="space-y-3">
            <Input placeholder="Meeting Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="min-h-[44px]" />
            <Input placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="min-h-[44px]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Start</label><Input type="datetime-local" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="min-h-[44px]" /></div>
              <div><label className="text-xs text-muted-foreground">End</label><Input type="datetime-local" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="min-h-[44px]" /></div>
            </div>
            <Button onClick={handleCreate} className="w-full min-h-[44px]" disabled={!form.title || !form.startDate}>Create Meeting</Button>
          </div></DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {meetings.map(m => (
          <Card key={m.id} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => setEditMeeting(m)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="text-primary" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium truncate">{m.title}</p>
                    <Badge variant={m.status === "Confirmed" ? "default" : m.status === "Cancelled" ? "destructive" : "secondary"} className="flex-shrink-0">{m.status}</Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock size={12} className="flex-shrink-0" />
                      {new Date(m.startDate).toLocaleString()}
                    </span>
                    {m.location && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin size={12} className="flex-shrink-0" />
                        {m.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {meetings.length === 0 && <p className="text-center text-muted-foreground py-12">No meetings scheduled</p>}
      </div>

      <Dialog open={!!editMeeting} onOpenChange={() => setEditMeeting(null)}><DialogContent><DialogHeader><DialogTitle>Edit Meeting</DialogTitle></DialogHeader>
        {editMeeting && <div className="space-y-3">
          <Input value={editMeeting.title} onChange={e => setEditMeeting({ ...editMeeting, title: e.target.value })} className="min-h-[44px]" />
          <Input value={editMeeting.location || ""} onChange={e => setEditMeeting({ ...editMeeting, location: e.target.value })} placeholder="Location" className="min-h-[44px]" />
          <Select value={editMeeting.status} onValueChange={v => setEditMeeting({ ...editMeeting, status: v })}><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          <div className="flex gap-2"><Button onClick={() => handleUpdate(editMeeting.id, editMeeting)} className="flex-1 min-h-[44px]">Save</Button><Button variant="destructive" onClick={() => { handleDelete(editMeeting.id); setEditMeeting(null) }} className="min-h-[44px] min-w-[44px]"><Trash2 size={14} /></Button></div>
        </div>}
      </DialogContent></Dialog>
    </div>
  )
}
