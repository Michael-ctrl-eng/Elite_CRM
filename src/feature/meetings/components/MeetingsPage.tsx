"use client"
import { useState, useEffect } from "react"
import { useCurrentSpace } from "@/app/page"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Trash2, Calendar } from "lucide-react"

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
  const today = new Date().toISOString().split("T")[0]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{upcoming.length} Meetings</h2>
        <Dialog open={showCreate} onOpenChange={setShowCreate}><DialogTrigger asChild><Button><Plus size={14} /> Add Meeting</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Create Meeting</DialogTitle></DialogHeader><div className="space-y-3">
            <Input placeholder="Meeting Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Start</label><Input type="datetime-local" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">End</label><Input type="datetime-local" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={!form.title || !form.startDate}>Create Meeting</Button>
          </div></DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {meetings.map(m => (
          <Card key={m.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setEditMeeting(m)}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><Calendar className="text-primary" size={20} /></div>
              <div className="flex-1">
                <p className="font-medium">{m.title}</p>
                <p className="text-sm text-muted-foreground">{new Date(m.startDate).toLocaleString()} {m.location && `· ${m.location}`}</p>
              </div>
              <Badge variant={m.status === "Confirmed" ? "default" : m.status === "Cancelled" ? "destructive" : "secondary"}>{m.status}</Badge>
            </CardContent>
          </Card>
        ))}
        {meetings.length === 0 && <p className="text-center text-muted-foreground py-12">No meetings scheduled</p>}
      </div>

      <Dialog open={!!editMeeting} onOpenChange={() => setEditMeeting(null)}><DialogContent><DialogHeader><DialogTitle>Edit Meeting</DialogTitle></DialogHeader>
        {editMeeting && <div className="space-y-3">
          <Input value={editMeeting.title} onChange={e => setEditMeeting({ ...editMeeting, title: e.target.value })} />
          <Input value={editMeeting.location || ""} onChange={e => setEditMeeting({ ...editMeeting, location: e.target.value })} placeholder="Location" />
          <Select value={editMeeting.status} onValueChange={v => setEditMeeting({ ...editMeeting, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          <div className="flex gap-2"><Button onClick={() => handleUpdate(editMeeting.id, editMeeting)} className="flex-1">Save</Button><Button variant="destructive" onClick={() => { handleDelete(editMeeting.id); setEditMeeting(null) }}><Trash2 size={14} /></Button></div>
        </div>}
      </DialogContent></Dialog>
    </div>
  )
}
