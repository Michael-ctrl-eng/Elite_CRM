"use client"
import { useState, useEffect } from "react"
import { useCurrentSpace } from "@/app/page"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Trash2, Users } from "lucide-react"

const STATUSES = ["Active", "FollowUp", "Inactive"]
const statusLabels: Record<string, string> = { Active: "Active", FollowUp: "Follow Up", Inactive: "Inactive" }

export default function CustomersPage() {
  const spaceId = useCurrentSpace()
  const [items, setItems] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", position: "", status: "Active", value: "", address: "" })

  const fetchData = () => { if (!spaceId) return; fetch(`/api/customers?spaceId=${spaceId}`).then(r => r.json()).then(setItems).catch(() => {}) }
  useEffect(() => { fetchData() }, [spaceId])

  const handleCreate = async () => {
    await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, value: form.value ? parseFloat(form.value) : undefined, spaceId }) })
    setShowCreate(false); setForm({ name: "", email: "", phone: "", company: "", position: "", status: "Active", value: "", address: "" }); fetchData()
  }
  const handleUpdate = async (id: string, data: any) => { await fetch(`/api/customers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); setEditItem(null); fetchData() }
  const handleDelete = async (id: string) => { if (!confirm("Delete?")) return; await fetch(`/api/customers/${id}`, { method: "DELETE" }); fetchData() }

  const filtered = items.filter(p => (statusFilter === "all" || p.status === statusFilter) && (!search || p.name.toLowerCase().includes(search.toLowerCase())))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-64" /></div>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent></Select>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}><DialogTrigger asChild><Button><Plus size={14} /> Add Customer</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader><div className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3"><Input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3"><Input placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /><Input placeholder="Position" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3"><Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent></Select><Input placeholder="Value" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></div>
            <Button onClick={handleCreate} className="w-full" disabled={!form.name}>Add Customer</Button>
          </div></DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
          <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setEditItem(c)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center"><span className="text-background text-sm font-bold">{c.name.charAt(0)}</span></div>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{c.name}</p><p className="text-sm text-muted-foreground truncate">{c.email || c.company || "No details"}</p></div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <Badge variant={c.status === "Active" ? "default" : c.status === "Inactive" ? "destructive" : "secondary"}>{statusLabels[c.status]}</Badge>
                {c.value > 0 && <span className="text-sm font-medium">${c.value.toLocaleString()}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-muted-foreground text-center py-12 col-span-full">No customers found</p>}
      </div>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}><DialogContent><DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
        {editItem && <div className="space-y-3">
          <Input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3"><Input value={editItem.email || ""} onChange={e => setEditItem({ ...editItem, email: e.target.value })} placeholder="Email" /><Input value={editItem.phone || ""} onChange={e => setEditItem({ ...editItem, phone: e.target.value })} placeholder="Phone" /></div>
          <Select value={editItem.status} onValueChange={v => setEditItem({ ...editItem, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent></Select>
          <div className="flex gap-2"><Button onClick={() => handleUpdate(editItem.id, editItem)} className="flex-1">Save</Button><Button variant="destructive" onClick={() => { handleDelete(editItem.id); setEditItem(null) }}><Trash2 size={14} /></Button></div>
        </div>}
      </DialogContent></Dialog>
    </div>
  )
}
