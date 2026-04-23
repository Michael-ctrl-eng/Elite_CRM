"use client"
import { useState, useEffect } from "react"
import { useCurrentSpace } from "@/app/page"
import { useIsMobile } from "@/hooks/use-mobile"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Trash2, TrendingUp } from "lucide-react"

const STATUSES = ["New", "Cold", "Qualified", "WarmLead", "Converted", "NotInterested"]
const statusLabels: Record<string, string> = { New: "New", Cold: "Cold", Qualified: "Qualified", WarmLead: "Warm Lead", Converted: "Converted", NotInterested: "Not Interested" }
const statusColors: Record<string, string> = { New: "bg-blue-500", Cold: "bg-cyan-500", Qualified: "bg-green-500", WarmLead: "bg-amber-500", Converted: "bg-emerald-500", NotInterested: "bg-red-500" }

export default function ProspectsPage() {
  const spaceId = useCurrentSpace()
  const isMobile = useIsMobile()
  const [items, setItems] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", position: "", source: "", status: "New", value: "" })

  const fetchData = () => { if (!spaceId) return; fetch(`/api/prospects?spaceId=${spaceId}`).then(r => r.json()).then(setItems).catch(() => {}) }
  useEffect(() => { fetchData() }, [spaceId])

  const handleCreate = async () => {
    await fetch("/api/prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, value: form.value ? parseFloat(form.value) : undefined, spaceId }) })
    setShowCreate(false); setForm({ name: "", email: "", phone: "", company: "", position: "", source: "", status: "New", value: "" }); fetchData()
  }
  const handleUpdate = async (id: string, data: any) => { await fetch(`/api/prospects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); setEditItem(null); fetchData() }
  const handleDelete = async (id: string) => { if (!confirm("Delete?")) return; await fetch(`/api/prospects/${id}`, { method: "DELETE" }); fetchData() }

  const filtered = items.filter(p => (statusFilter === "all" || p.status === statusFilter) && (!search || p.name.toLowerCase().includes(search.toLowerCase())))

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search prospects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-full sm:w-64 min-h-[44px]" /></div>
          {!isMobile && (
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40 min-h-[36px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent></Select>
          )}
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}><DialogTrigger asChild><Button className="min-h-[44px] w-full sm:w-auto"><Plus size={14} /> Add Prospect</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Add Prospect</DialogTitle></DialogHeader><div className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="min-h-[44px]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="min-h-[44px]" /><Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="min-h-[44px]" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="min-h-[44px]" /><Input placeholder="Position" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className="min-h-[44px]" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent></Select><Input placeholder="Value" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="min-h-[44px]" /></div>
            <Button onClick={handleCreate} className="w-full min-h-[44px]" disabled={!form.name}>Add Prospect</Button>
          </div></DialogContent>
        </Dialog>
      </div>

      {/* Mobile: Swipeable status filter tabs */}
      {isMobile && (
        <div className="-mx-4 px-4">
          <div
            className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <button
              onClick={() => setStatusFilter("all")}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium min-h-[44px] transition-colors ${
                statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All
            </button>
            {STATUSES.map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium min-h-[44px] transition-colors flex items-center gap-1.5 ${
                  statusFilter === status ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
                {statusLabels[status]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filtered.map(p => (
          <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => setEditItem(p)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center flex-shrink-0"><span className="text-background text-sm font-bold">{p.name.charAt(0)}</span></div>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{p.name}</p><p className="text-sm text-muted-foreground truncate">{p.email || p.company || "No details"}</p></div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <Badge variant={p.status === "Qualified" || p.status === "WarmLead" ? "default" : p.status === "NotInterested" ? "destructive" : "secondary"}>{statusLabels[p.status]}</Badge>
                {p.value > 0 && <span className="text-sm font-medium">${p.value.toLocaleString()}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-muted-foreground text-center py-12 col-span-full">No prospects found</p>}
      </div>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}><DialogContent><DialogHeader><DialogTitle>Edit Prospect</DialogTitle></DialogHeader>
        {editItem && <div className="space-y-3">
          <Input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} className="min-h-[44px]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input value={editItem.email || ""} onChange={e => setEditItem({ ...editItem, email: e.target.value })} placeholder="Email" className="min-h-[44px]" /><Input value={editItem.phone || ""} onChange={e => setEditItem({ ...editItem, phone: e.target.value })} placeholder="Phone" className="min-h-[44px]" /></div>
          <Select value={editItem.status} onValueChange={v => setEditItem({ ...editItem, status: v })}><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent></Select>
          <div className="flex gap-2"><Button onClick={() => handleUpdate(editItem.id, editItem)} className="flex-1 min-h-[44px]">Save</Button><Button variant="destructive" onClick={() => { handleDelete(editItem.id); setEditItem(null) }} className="min-h-[44px] min-w-[44px]"><Trash2 size={14} /></Button></div>
        </div>}
      </DialogContent></Dialog>
    </div>
  )
}
