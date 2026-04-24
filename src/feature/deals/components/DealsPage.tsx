"use client"

import { useState, useEffect } from "react"
import { useCurrentSpace } from "@/app/page"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react"
import dynamic from "next/dynamic"
import { Deal } from "../types"

const DealDetail = dynamic(() => import("./DealDetail"), { ssr: false })

const STAGES = ["New", "Contacted", "Proposal", "Negotiation", "Won", "Lost"]
const CURRENCIES = ["USD", "EUR", "GBP"]
const stageColors: Record<string, string> = {
  New: "bg-blue-500", Contacted: "bg-cyan-500", Proposal: "bg-amber-500",
  Negotiation: "bg-purple-500", Won: "bg-green-500", Lost: "bg-red-500"
}
const stageBadgeColors: Record<string, string> = {
  New: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Contacted: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  Proposal: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Negotiation: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Won: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Lost: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

export default function DealsPage() {
  const spaceId = useCurrentSpace()
  const [deals, setDeals] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [showCreate, setShowCreate] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<any>(null)
  const [editDeal, setEditDeal] = useState<any>(null)
  const [deletingDeal, setDeletingDeal] = useState<string | null>(null)
  const [form, setForm] = useState({ title: "", value: "", currency: "USD", stage: "New", description: "", source: "", probability: "", closeDate: "" })
  const [viewMode, setViewMode] = useState<"pipeline" | "list">("pipeline")
  const [mobileStageIndex, setMobileStageIndex] = useState(0)

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
    setDeletingDeal(id)
    try {
      await fetch(`/api/deals/${id}`, { method: "DELETE" })
      setSelectedDeal(null)
      fetchData()
    } finally {
      setDeletingDeal(null)
    }
  }

  const handleDealClick = async (deal: any) => {
    // Fetch full deal details with relations
    try {
      const res = await fetch(`/api/deals/${deal.id}`)
      if (res.ok) {
        const fullDeal = await res.json()
        setSelectedDeal(fullDeal)
      } else {
        setSelectedDeal(deal)
      }
    } catch {
      setSelectedDeal(deal)
    }
  }

  const getCurrencySymbol = (currency?: string) => {
    switch (currency?.toUpperCase()) {
      case 'EUR': return '€'
      case 'GBP': return '£'
      default: return '$'
    }
  }

  const filtered = deals.filter(d => {
    if (stageFilter !== "all" && d.stage !== stageFilter) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group deals by stage
  const dealsByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = filtered.filter(d => d.stage === stage)
    return acc
  }, {} as Record<string, any[]>)

  const currentMobileStage = STAGES[mobileStageIndex]

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-full sm:w-64" />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle - hidden on mobile */}
          <div className="hidden md:flex items-center border border-border rounded-lg p-0.5">
            <button onClick={() => setViewMode("pipeline")} className={`p-1.5 rounded-md transition-colors ${viewMode === "pipeline" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutGrid size={16} />
            </button>
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <List size={16} />
            </button>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto"><Plus size={14} /> Add Deal</Button>
            </DialogTrigger>
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
                <Textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                <Input placeholder="Source" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
                <Input placeholder="Close Date" type="date" value={form.closeDate} onChange={e => setForm({ ...form, closeDate: e.target.value })} />
                <Button onClick={handleCreate} className="w-full" disabled={!form.title}>Create Deal</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="px-3 py-2 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Total Deals</p>
            <p className="text-lg font-bold">{stats.total || 0}</p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className="text-lg font-bold">{stats.winRate || 0}%</p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-lg font-bold">${(stats.totalValue || 0).toLocaleString()}</p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-lg font-bold">{stats.active || 0}</p>
          </div>
        </div>
      )}

      {/* ─── MOBILE: Single Stage Swipe View ─── */}
      <div className="md:hidden">
        {/* Stage tabs - scrollable */}
        <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
          {STAGES.map((stage, idx) => {
            const count = dealsByStage[stage]?.length || 0
            return (
              <button
                key={stage}
                onClick={() => setMobileStageIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-w-fit
                  ${mobileStageIndex === idx ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
              >
                <div className={`w-2 h-2 rounded-full ${stageColors[stage]}`} />
                {stage}
                <span className="text-xs opacity-70">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setMobileStageIndex(Math.max(0, mobileStageIndex - 1))} disabled={mobileStageIndex === 0}
            className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${stageColors[currentMobileStage]}`} />
            <span className="text-sm font-semibold">{currentMobileStage}</span>
            <span className="text-xs text-muted-foreground">
              ${dealsByStage[currentMobileStage]?.reduce((sum: number, d: any) => sum + (d.value || 0), 0).toLocaleString() || 0}
            </span>
          </div>
          <button onClick={() => setMobileStageIndex(Math.min(STAGES.length - 1, mobileStageIndex + 1))} disabled={mobileStageIndex === STAGES.length - 1}
            className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Deal cards for current stage */}
        <div className="space-y-2">
          {dealsByStage[currentMobileStage]?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No deals in {currentMobileStage}</p>
            </div>
          )}
          {dealsByStage[currentMobileStage]?.map((deal: any) => (
            <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => handleDealClick(deal)}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{deal.title}</p>
                    <p className="text-lg font-bold mt-0.5">{getCurrencySymbol(deal.currency)}{(deal.value || 0).toLocaleString()}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${stageBadgeColors[deal.stage] || "bg-muted text-muted-foreground"}`}>
                    {deal.stage}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>{deal.owner?.name || "Unassigned"}</span>
                  {deal.probability != null && <span>{deal.probability}%</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ─── DESKTOP: Pipeline View ─── */}
      {viewMode === "pipeline" && (
        <div className="hidden md:grid grid-cols-6 gap-3 overflow-x-auto">
          {STAGES.map(stage => {
            const stageDeals = dealsByStage[stage] || []
            const totalValue = stageDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0)
            return (
              <div key={stage} className="min-w-[180px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${stageColors[stage]}`}></div>
                  <span className="text-sm font-medium">{stage}</span>
                  <Badge variant="secondary" className="text-xs ml-auto">{stageDeals.length}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-2">${totalValue.toLocaleString()}</div>
                <div className="space-y-2">
                  {stageDeals.map((deal: any) => (
                    <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDealClick(deal)}>
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">{deal.title}</p>
                        <p className="text-lg font-bold mt-1">{getCurrencySymbol(deal.currency)}{(deal.value || 0).toLocaleString()}</p>
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
      )}

      {/* ─── DESKTOP: List View ─── */}
      {viewMode === "list" && (
        <div className="hidden md:block">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Deal</th>
                  <th className="text-left p-3 font-medium">Stage</th>
                  <th className="text-left p-3 font-medium">Value</th>
                  <th className="text-left p-3 font-medium">Probability</th>
                  <th className="text-left p-3 font-medium">Owner</th>
                  <th className="text-left p-3 font-medium">Close Date</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((deal: any) => (
                  <tr key={deal.id} className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => handleDealClick(deal)}>
                    <td className="p-3">
                      <p className="font-medium">{deal.title}</p>
                      {deal.company?.name && <p className="text-xs text-muted-foreground">{deal.company.name}</p>}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${stageBadgeColors[deal.stage] || ""}`}>{deal.stage}</span>
                    </td>
                    <td className="p-3 font-medium">{getCurrencySymbol(deal.currency)}{(deal.value || 0).toLocaleString()}</td>
                    <td className="p-3 text-muted-foreground">{deal.probability ? `${deal.probability}%` : "—"}</td>
                    <td className="p-3 text-muted-foreground">{deal.owner?.name || "—"}</td>
                    <td className="p-3 text-muted-foreground">{deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : "—"}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditDeal(deal); setSelectedDeal(null) }} className="p-1.5 rounded hover:bg-accent transition-colors"><Edit2 size={14} className="text-muted-foreground" /></button>
                        <button onClick={() => handleDelete(deal.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors"><Trash2 size={14} className="text-destructive" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No deals found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Deal Detail Panel ─── */}
      <DealDetail
        isOpen={!!selectedDeal}
        deal={selectedDeal}
        onClose={() => setSelectedDeal(null)}
        onDelete={handleDelete}
        onEdit={(deal) => { setEditDeal(deal); setSelectedDeal(null) }}
        onAddNotes={(id) => {}}
        onExport={(id) => {}}
        isDeleting={!!deletingDeal}
      />

      {/* ─── Edit Deal Dialog ─── */}
      <Dialog open={!!editDeal} onOpenChange={() => setEditDeal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Deal</DialogTitle></DialogHeader>
          {editDeal && (
            <div className="space-y-3">
              <Input value={editDeal.title} onChange={e => setEditDeal({ ...editDeal, title: e.target.value })} placeholder="Deal Title" />
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" value={editDeal.value || ""} onChange={e => setEditDeal({ ...editDeal, value: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Value" />
                <Select value={editDeal.currency || "USD"} onValueChange={v => setEditDeal({ ...editDeal, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={editDeal.stage} onValueChange={v => setEditDeal({ ...editDeal, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={editDeal.probability ?? ""} onChange={e => setEditDeal({ ...editDeal, probability: e.target.value ? parseInt(e.target.value) : null })} placeholder="Probability %" />
              </div>
              <Textarea value={editDeal.description || ""} onChange={e => setEditDeal({ ...editDeal, description: e.target.value })} placeholder="Description" />
              <Input value={editDeal.source || ""} onChange={e => setEditDeal({ ...editDeal, source: e.target.value })} placeholder="Source" />
              <Input type="date" value={editDeal.closeDate ? new Date(editDeal.closeDate).toISOString().split("T")[0] : ""} onChange={e => setEditDeal({ ...editDeal, closeDate: e.target.value || null })} placeholder="Close Date" />
              <div className="flex gap-2">
                <Button onClick={() => handleUpdate(editDeal.id, editDeal)} className="flex-1">Save</Button>
                <Button variant="outline" onClick={() => setEditDeal(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => { handleDelete(editDeal.id); setEditDeal(null) }}><Trash2 size={14} /></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
