"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useCurrentSpace } from "@/app/page"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Icon } from "@iconify/react"
import dynamic from "next/dynamic"
import { Deal } from "../types"

const DealDetail = dynamic(() => import("./DealDetail"), { ssr: false })

const STAGES = ["New", "Contacted", "Proposal", "Negotiation", "Won", "Lost"]
const CURRENCIES = ["USD", "EUR", "GBP"]
const INDUSTRIES = ["SaaS", "E-commerce", "FinTech", "Healthcare", "Real Estate", "Education", "Marketing", "Consulting", "Manufacturing", "Logistics", "Legal", "Other"]
const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]

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

const defaultForm = {
  title: "", value: "", currency: "USD", stage: "New", description: "", source: "", probability: "", closeDate: "",
  websiteUrl: "", linkedInUrl: "", industry: "", companySize: "", dealEmail: "", dealPhone: "", mainParticipantId: "", participantIds: [] as string[],
}

/** Get initials for avatar */
function getInitials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
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
  const [form, setForm] = useState(defaultForm)
  const [viewMode, setViewMode] = useState<"grid" | "pipeline" | "list">("grid")
  const [mobileStageIndex, setMobileStageIndex] = useState(0)
  const [spaceMembers, setSpaceMembers] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const submitGuardRef = useRef(false)
  const createBtnRef = useRef<HTMLButtonElement>(null)

  const fetchData = useCallback(() => {
    if (!spaceId) return
    fetch(`/api/deals?spaceId=${spaceId}`).then(r => r.json()).then(setDeals).catch(() => {})
    fetch(`/api/deals/stats?spaceId=${spaceId}`).then(r => r.json()).then(setStats).catch(() => {})
  }, [spaceId])

  const fetchSpaceMembers = useCallback(() => {
    if (!spaceId) return
    fetch(`/api/spaces/${spaceId}/members`).then(r => r.json()).then(data => {
      const members = Array.isArray(data) ? data : data.members || []
      setSpaceMembers(members.map((m: any) => m.user || m))
    }).catch(() => {})
  }, [spaceId])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (showCreate) fetchSpaceMembers() }, [showCreate, fetchSpaceMembers])

  const handleCreate = async () => {
    // Guard against double submission using both state and ref
    if (submitting || submitGuardRef.current || !form.title) return
    submitGuardRef.current = true
    setSubmitting(true)
    try {
      const res = await fetch("/api/deals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          value: form.value ? parseFloat(form.value) : undefined,
          probability: form.probability ? parseInt(form.probability) : undefined,
          mainParticipantId: form.mainParticipantId || undefined,
          participantIds: form.participantIds,
          spaceId,
        }),
      })
      if (res.ok) {
        setShowCreate(false)
        setForm(defaultForm)
        fetchData()
      }
    } finally {
      setSubmitting(false)
      submitGuardRef.current = false
    }
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

  const dealsByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = filtered.filter(d => d.stage === stage)
    return acc
  }, {} as Record<string, any[]>)

  const currentMobileStage = STAGES[mobileStageIndex]

  const toggleParticipant = (uid: string) => {
    setForm(prev => ({
      ...prev,
      participantIds: prev.participantIds.includes(uid)
        ? prev.participantIds.filter(id => id !== uid)
        : [...prev.participantIds, uid]
    }))
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20">
          <Icon icon="mdi:handshake-outline" width={22} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Deals</h1>
          <p className="text-sm text-muted-foreground">Track and manage your sales pipeline</p>
        </div>
      </div>

      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="relative">
            <Icon icon="mdi:magnify" width={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
          <div className="hidden md:flex items-center border border-border rounded-lg p-0.5">
            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon icon="mdi:view-grid-outline" width={16} />
            </button>
            <button onClick={() => setViewMode("pipeline")} className={`p-1.5 rounded-md transition-colors ${viewMode === "pipeline" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon icon="mdi:view-column-outline" width={16} />
            </button>
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon icon="mdi:view-list-outline" width={16} />
            </button>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto gap-1.5"><Icon icon="mdi:plus" width={14} /> Add Deal</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Deal</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {/* Basic Info */}
                <Input placeholder="Deal Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
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
                <Input placeholder="Close Date" type="date" value={form.closeDate} onChange={e => setForm({ ...form, closeDate: e.target.value })} />
                <Textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                <Input placeholder="Source" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />

                {/* Divider */}
                <div className="border-t border-border pt-3">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Icon icon="mdi:web" width={14} /> Company Details
                  </h4>
                </div>
                <Input placeholder="Website URL" value={form.websiteUrl} onChange={e => setForm({ ...form, websiteUrl: e.target.value })} />
                <Input placeholder="Company LinkedIn URL" value={form.linkedInUrl} onChange={e => setForm({ ...form, linkedInUrl: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={form.industry} onValueChange={v => setForm({ ...form, industry: v === "_none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Industry" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={form.companySize} onValueChange={v => setForm({ ...form, companySize: v === "_none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Company Size" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {COMPANY_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contact Info */}
                <div className="border-t border-border pt-3">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Icon icon="mdi:email-outline" width={14} /> Contact Info
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Email" type="email" value={form.dealEmail} onChange={e => setForm({ ...form, dealEmail: e.target.value })} />
                  <Input placeholder="Phone" type="tel" value={form.dealPhone} onChange={e => setForm({ ...form, dealPhone: e.target.value })} />
                </div>

                {/* Participants */}
                <div className="border-t border-border pt-3">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Icon icon="mdi:account-group-outline" width={14} /> Participants
                  </h4>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Main Participant</label>
                  <Select value={form.mainParticipantId} onValueChange={v => setForm({ ...form, mainParticipantId: v === "_none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select main participant" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {spaceMembers.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Other Participants (optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {spaceMembers
                      .filter((m: any) => m.id !== form.mainParticipantId)
                      .map((m: any) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleParticipant(m.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                            form.participantIds.includes(m.id)
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-muted/50 text-muted-foreground border-border hover:border-accent/50"
                          }`}
                        >
                          {m.name || m.email}
                        </button>
                      ))}
                    {spaceMembers.filter((m: any) => m.id !== form.mainParticipantId).length === 0 && (
                      <span className="text-xs text-muted-foreground">No other members in this space</span>
                    )}
                  </div>
                </div>

                <Button ref={createBtnRef} onClick={handleCreate} className="w-full" disabled={!form.title || submitting}>
                  {submitting ? "Creating..." : "Create Deal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stage Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
        <button
          onClick={() => setStageFilter("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
            stageFilter === "all"
              ? "bg-foreground text-background border-foreground"
              : "bg-muted/50 text-muted-foreground border-border hover:border-foreground/20"
          }`}
        >
          All
          <span className="opacity-70">({filtered.length})</span>
        </button>
        {STAGES.map(stage => {
          const count = dealsByStage[stage]?.length || 0
          return (
            <button key={stage} onClick={() => setStageFilter(stage)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                stageFilter === stage
                  ? `${stageBadgeColors[stage]} border-current/20`
                  : "bg-muted/50 text-muted-foreground border-border hover:border-foreground/20"
              }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${stageColors[stage]}`} />
              {stage}
              <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="px-3 py-3 rounded-lg bg-muted/50 text-center border border-border/50 hover:border-border transition-colors">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Icon icon="mdi:handshake-outline" width={14} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Deals</p>
            </div>
            <p className="text-lg font-bold">{stats.total || 0}</p>
          </div>
          <div className="px-3 py-3 rounded-lg bg-muted/50 text-center border border-border/50 hover:border-border transition-colors">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Icon icon="mdi:trophy-outline" width={14} className="text-amber-500" />
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </div>
            <p className="text-lg font-bold">{stats.winRate || 0}%</p>
          </div>
          <div className="px-3 py-3 rounded-lg bg-muted/50 text-center border border-border/50 hover:border-border transition-colors">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Icon icon="mdi:chart-line" width={14} className="text-emerald-500" />
              <p className="text-xs text-muted-foreground">Total Value</p>
            </div>
            <p className="text-lg font-bold">${(stats.totalValue || 0).toLocaleString()}</p>
          </div>
          <div className="px-3 py-3 rounded-lg bg-muted/50 text-center border border-border/50 hover:border-border transition-colors">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Icon icon="mdi:chart-timeline-variant" width={14} className="text-blue-500" />
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <p className="text-lg font-bold">{stats.active || 0}</p>
          </div>
        </div>
      )}

      {/* ─── GRID VIEW (DEFAULT) ─── */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Icon icon="mdi:handshake-outline" width={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No deals found</p>
              <p className="text-xs mt-1">Create a deal to get started</p>
            </div>
          )}
          {filtered.map((deal: any) => {
            const ownerName = deal.owner?.name || deal.owner?.email || "Unassigned"
            const ownerImage = deal.owner?.image
            const participantName = deal.mainParticipant?.name || deal.mainParticipant?.email
            const participantImage = deal.mainParticipant?.image

            return (
              <Card
                key={deal.id}
                className="group relative cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border border-border/60 overflow-hidden"
                onClick={() => handleDealClick(deal)}
              >
                <CardContent className="p-0">
                  {/* Top: Title + Stage Badge */}
                  <div className="flex items-start justify-between gap-2 p-4 pb-2">
                    <h3 className="text-sm font-semibold text-foreground truncate flex-1 min-w-0">{deal.title}</h3>
                    <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold ${stageBadgeColors[deal.stage] || "bg-muted text-muted-foreground"}`}>
                      {deal.stage}
                    </span>
                  </div>

                  {/* Middle: Value + Probability */}
                  <div className="px-4 pb-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-foreground tracking-tight">
                        {getCurrencySymbol(deal.currency)}{(deal.value || 0).toLocaleString()}
                      </span>
                      {deal.probability != null && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Icon icon="mdi:percent-outline" width={12} />
                          {deal.probability}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Industry + Company Size */}
                  <div className="px-4 pb-2">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {deal.industry && (
                        <span className="flex items-center gap-1">
                          <Icon icon="mdi:office-building-outline" width={13} className="text-muted-foreground/70" />
                          {deal.industry}
                        </span>
                      )}
                      {deal.companySize && (
                        <span className="flex items-center gap-1">
                          <Icon icon="mdi:account-group-outline" width={13} className="text-muted-foreground/70" />
                          {deal.companySize}
                        </span>
                      )}
                      {!deal.industry && !deal.companySize && (
                        <span className="text-muted-foreground/50">No company details</span>
                      )}
                    </div>
                  </div>

                  {/* Links & Contact Row */}
                  <div className="px-4 pb-2 space-y-1">
                    {deal.websiteUrl && (
                      <a
                        href={deal.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 hover:underline transition-colors w-fit"
                      >
                        <Icon icon="mdi:web" width={12} />
                        <span className="truncate max-w-[200px]">{deal.websiteUrl.replace(/^https?:\/\//, '')}</span>
                        <Icon icon="mdi:open-in-new" width={10} className="opacity-60" />
                      </a>
                    )}
                    {deal.linkedInUrl && (
                      <a
                        href={deal.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 hover:underline transition-colors w-fit"
                      >
                        <Icon icon="mdi:linkedin" width={12} />
                        <span className="truncate max-w-[200px]">LinkedIn</span>
                        <Icon icon="mdi:open-in-new" width={10} className="opacity-60" />
                      </a>
                    )}
                    {deal.dealEmail && (
                      <a
                        href={`mailto:${deal.dealEmail}`}
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
                      >
                        <Icon icon="mdi:email-outline" width={12} />
                        <span className="truncate max-w-[200px]">{deal.dealEmail}</span>
                      </a>
                    )}
                    {deal.dealPhone && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Icon icon="mdi:phone-outline" width={12} />
                        {deal.dealPhone}
                      </span>
                    )}
                  </div>

                  {/* Bottom: Owner + Close Date + Participant */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t border-border/40">
                    <div className="flex items-center gap-2">
                      {/* Owner Avatar */}
                      {ownerImage ? (
                        <img src={ownerImage} alt={ownerName} className="w-6 h-6 rounded-full object-cover ring-1 ring-border" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center ring-1 ring-border">
                          <span className="text-[10px] font-semibold text-accent-foreground">{getInitials(ownerName)}</span>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">{ownerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Main Participant */}
                      {participantName && (
                        <div className="flex items-center gap-1">
                          {participantImage ? (
                            <img src={participantImage} alt={participantName} className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                              <span className="text-[8px] font-semibold text-muted-foreground">{getInitials(participantName)}</span>
                            </div>
                          )}
                          <span className="text-[10px] text-muted-foreground/70 hidden sm:inline truncate max-w-[60px]">{participantName}</span>
                        </div>
                      )}
                      {/* Close Date */}
                      {deal.closeDate && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Icon icon="mdi:calendar-outline" width={11} />
                          {new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Buttons (visible on hover) */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { setEditDeal(deal); setSelectedDeal(null) }}
                      className="p-1.5 rounded-md bg-background/90 backdrop-blur-sm border border-border/60 shadow-sm hover:bg-accent transition-colors"
                      title="Edit"
                    >
                      <Icon icon="mdi:pencil-outline" width={13} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDelete(deal.id)}
                      className="p-1.5 rounded-md bg-background/90 backdrop-blur-sm border border-border/60 shadow-sm hover:bg-destructive/10 transition-colors"
                      title="Delete"
                    >
                      <Icon icon="mdi:delete-outline" width={13} className="text-destructive" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── MOBILE: Single Stage Swipe View ─── */}
      <div className="md:hidden">
        <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
          {STAGES.map((stage, idx) => {
            const count = dealsByStage[stage]?.length || 0
            return (
              <button key={stage} onClick={() => setMobileStageIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-w-fit
                  ${mobileStageIndex === idx ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"}`}>
                <div className={`w-2 h-2 rounded-full ${stageColors[stage]}`} />
                {stage}<span className="text-xs opacity-70">({count})</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setMobileStageIndex(Math.max(0, mobileStageIndex - 1))} disabled={mobileStageIndex === 0} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 transition-colors">
            <Icon icon="mdi:chevron-left" width={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${stageColors[currentMobileStage]}`} />
            <span className="text-sm font-semibold">{currentMobileStage}</span>
            <span className="text-xs text-muted-foreground">${dealsByStage[currentMobileStage]?.reduce((sum: number, d: any) => sum + (d.value || 0), 0).toLocaleString() || 0}</span>
          </div>
          <button onClick={() => setMobileStageIndex(Math.min(STAGES.length - 1, mobileStageIndex + 1))} disabled={mobileStageIndex === STAGES.length - 1} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 transition-colors">
            <Icon icon="mdi:chevron-right" width={18} />
          </button>
        </div>
        <div className="space-y-2">
          {dealsByStage[currentMobileStage]?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground"><p className="text-sm">No deals in {currentMobileStage}</p></div>
          )}
          {dealsByStage[currentMobileStage]?.map((deal: any) => (
            <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => handleDealClick(deal)}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{deal.title}</p>
                    <p className="text-lg font-bold mt-0.5">{getCurrencySymbol(deal.currency)}{(deal.value || 0).toLocaleString()}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${stageBadgeColors[deal.stage] || "bg-muted text-muted-foreground"}`}>{deal.stage}</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>{deal.owner?.name || "Unassigned"}</span>
                  {deal.industry && <span className="truncate max-w-[100px]">{deal.industry}</span>}
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
                        {deal.industry && <p className="text-xs text-muted-foreground mt-0.5">{deal.industry} · {deal.companySize || ""}</p>}
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
                  <th className="text-left p-3 font-medium">Industry</th>
                  <th className="text-left p-3 font-medium">Size</th>
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
                      {deal.websiteUrl && (
                        <a href={deal.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                          <Icon icon="mdi:web" width={10} /> Website
                        </a>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${stageBadgeColors[deal.stage] || ""}`}>{deal.stage}</span>
                    </td>
                    <td className="p-3 font-medium">{getCurrencySymbol(deal.currency)}{(deal.value || 0).toLocaleString()}</td>
                    <td className="p-3 text-muted-foreground">{deal.industry || "—"}</td>
                    <td className="p-3 text-muted-foreground">{deal.companySize || "—"}</td>
                    <td className="p-3 text-muted-foreground">{deal.owner?.name || "—"}</td>
                    <td className="p-3 text-muted-foreground">{deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : "—"}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditDeal(deal); setSelectedDeal(null) }} className="p-1.5 rounded hover:bg-accent transition-colors"><Icon icon="mdi:pencil-outline" width={14} className="text-muted-foreground" /></button>
                        <button onClick={() => handleDelete(deal.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors"><Icon icon="mdi:delete-outline" width={14} className="text-destructive" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No deals found</td></tr>
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
        spaceMembers={spaceMembers}
      />

      {/* ─── Edit Deal Dialog ─── */}
      <Dialog open={!!editDeal} onOpenChange={() => setEditDeal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

              {/* Company Details */}
              <div className="border-t border-border pt-3">
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Company Details</h4>
              </div>
              <Input value={editDeal.websiteUrl || ""} onChange={e => setEditDeal({ ...editDeal, websiteUrl: e.target.value })} placeholder="Website URL" />
              <Input value={editDeal.linkedInUrl || ""} onChange={e => setEditDeal({ ...editDeal, linkedInUrl: e.target.value })} placeholder="Company LinkedIn URL" />
              <div className="grid grid-cols-2 gap-3">
                <Select value={editDeal.industry || "_none"} onValueChange={v => setEditDeal({ ...editDeal, industry: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Industry" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={editDeal.companySize || "_none"} onValueChange={v => setEditDeal({ ...editDeal, companySize: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Company Size" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {COMPANY_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input value={editDeal.dealEmail || ""} onChange={e => setEditDeal({ ...editDeal, dealEmail: e.target.value })} placeholder="Email" type="email" />
                <Input value={editDeal.dealPhone || ""} onChange={e => setEditDeal({ ...editDeal, dealPhone: e.target.value })} placeholder="Phone" type="tel" />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={() => handleUpdate(editDeal.id, editDeal)} className="flex-1">Save</Button>
                <Button variant="outline" onClick={() => setEditDeal(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => { handleDelete(editDeal.id); setEditDeal(null) }}><Icon icon="mdi:delete-outline" width={14} /></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
