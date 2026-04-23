"use client"

import { useState, useEffect } from "react"
import { useCurrentSpace } from "@/app/page"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Edit2, Trash2 } from "lucide-react"

const STAGES = ["New", "Contacted", "Proposal", "Negotiation", "Won", "Lost"]
const CURRENCIES = ["USD", "EUR", "GBP"]
const stageColors: Record<string, string> = { New: "bg-blue-500", Contacted: "bg-cyan-500", Proposal: "bg-amber-500", Negotiation: "bg-purple-500", Won: "bg-green-500", Lost: "bg-red-500" }

export default function DealsPage() {
  const spaceId = useCurrentSpace()
  const [deals, setDeals] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [showCreate, setShowCreate] = useState(false)
  const [editDeal, setEditDeal] = useState<any>(null)
  const [form, setForm] = useState({ title: "", value: "", currency: "USD", stage: "New", description: "", source: "", probability: "", closeDate: "" })

  const fetchData = () => {
    if (!spaceId) return
    fetch(`/api/deals?spaceId=${spaceId}`).then(r => r.json()).then(setDeals).catch(() => {})
    fetch(`/api/deals/stats?spaceId=${spaceId}`).then(r => r.json()).then(setStats).catch(() => {})
  }

  useEffect(() => { fetchData() }, [spaceId])

  const handleCreate = async () => {
    await fetch("/api/deals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, value: form.value ? parseFloat(form.value) : undefined, probability: form.probability ? parseInt(form.probability) : undefined, spaceId }),
    })
    setShowCreate(false)
    setForm({ title: "", value: "", currency: "USD", stage: "New", description: "", source: "", probability: "", closeDate: "" })
    fetchData()
  }

  const handleUpdate = async (id: string, data: any) => {
    await fetch(`/api/deals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
    setEditDeal(null)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this deal?")) return
    await fetch(`/api/deals/${id}`, { method: "DELETE" })
    fetchData()
  }

  const filtered = deals.filter(d => {
    if (stageFilter !== "all" && d.stage !== stageFilter) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-64" />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button><Plus size={14} /> Add Deal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Deal</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Deal Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Value" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Probability %" type="number" value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} />
              </div>
              <Input placeholder="Source" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
              <Button onClick={handleCreate} className="w-full" disabled={!form.title}>Create Deal</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipeline View */}
      <div className="grid grid-cols-6 gap-3 overflow-x-auto">
        {STAGES.map(stage => {
          const stageDeals = filtered.filter(d => d.stage === stage)
          const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0)
          return (
            <div key={stage} className="min-w-[180px]">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${stageColors[stage]}`}></div>
                <span className="text-sm font-medium">{stage}</span>
                <Badge variant="secondary" className="text-xs ml-auto">{stageDeals.length}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mb-2">${totalValue.toLocaleString()}</div>
              <div className="space-y-2">
                {stageDeals.map(deal => (
                  <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setEditDeal(deal)}>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate">{deal.title}</p>
                      <p className="text-lg font-bold mt-1">${(deal.value || 0).toLocaleString()}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline" className="text-xs">{deal.currency}</Badge>
                        {deal.probability != null && <span className="text-xs text-muted-foreground">{deal.probability}%</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{deal.owner?.name}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editDeal} onOpenChange={() => setEditDeal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Deal</DialogTitle></DialogHeader>
          {editDeal && (
            <div className="space-y-3">
              <Input value={editDeal.title} onChange={e => setEditDeal({ ...editDeal, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" value={editDeal.value || ""} onChange={e => setEditDeal({ ...editDeal, value: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Value" />
                <Select value={editDeal.stage} onValueChange={v => setEditDeal({ ...editDeal, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input value={editDeal.probability ?? ""} onChange={e => setEditDeal({ ...editDeal, probability: e.target.value ? parseInt(e.target.value) : null })} placeholder="Probability %" />
              <div className="flex gap-2">
                <Button onClick={() => handleUpdate(editDeal.id, editDeal)} className="flex-1">Save</Button>
                <Button variant="destructive" onClick={() => { handleDelete(editDeal.id); setEditDeal(null) }}><Trash2 size={14} /></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
