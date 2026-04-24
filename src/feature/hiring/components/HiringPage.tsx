"use client"

import { useState, useEffect } from "react"
import { useCurrentSpace } from "@/app/page"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus, Search, Trash2, User, Mail, Phone, MapPin, Briefcase,
  Linkedin, Globe, GraduationCap, FileText, Video, Mic, Clock,
  ChevronDown, ChevronUp, ExternalLink, X
} from "lucide-react"

const STATUSES = ["New", "Screening", "Interview", "Offer", "Hired", "Rejected"]
const statusColors: Record<string, string> = {
  New: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Screening: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  Interview: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Offer: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Hired: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

interface Applicant {
  id: string
  fullName: string
  email?: string | null
  phone?: string | null
  position?: string | null
  location?: string | null
  linkedin?: string | null
  portfolio?: string | null
  experience?: string | null
  education?: string | null
  skills?: string | null
  coverLetter?: string | null
  resumeUrl?: string | null
  voiceMessageUrl?: string | null
  videoUrl?: string | null
  status: string
  source?: string | null
  notes?: string | null
  tags?: string | null
  spaceId: string
  ownerId?: string | null
  createdAt: string
  updatedAt: string
  owner?: { id: string; name?: string; email: string; image?: string } | null
}

export default function HiringPage() {
  const spaceId = useCurrentSpace()
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [stats, setStats] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCreate, setShowCreate] = useState(false)
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", position: "", location: "",
    linkedin: "", portfolio: "", experience: "", education: "", skills: "",
    coverLetter: "", source: "manual", notes: "",
  })

  const fetchData = () => {
    if (!spaceId) return
    fetch(`/api/hiring?spaceId=${spaceId}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}${search ? `&search=${search}` : ""}`)
      .then(r => r.json())
      .then(data => {
        if (data.applicants) setApplicants(data.applicants)
        if (data.stats) setStats(data.stats)
      })
      .catch(() => {})
  }

  useEffect(() => { fetchData() }, [spaceId, statusFilter, search])

  const handleCreate = async () => {
    if (!form.fullName.trim()) return
    await fetch("/api/hiring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, spaceId }),
    })
    setShowCreate(false)
    setForm({ fullName: "", email: "", phone: "", position: "", location: "", linkedin: "", portfolio: "", experience: "", education: "", skills: "", coverLetter: "", source: "manual", notes: "" })
    fetchData()
  }

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/hiring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    fetchData()
    if (selectedApplicant?.id === id) {
      setSelectedApplicant({ ...selectedApplicant, status })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this applicant?")) return
    setDeleting(id)
    try {
      await fetch(`/api/hiring/${id}`, { method: "DELETE" })
      if (selectedApplicant?.id === id) setSelectedApplicant(null)
      fetchData()
    } finally {
      setDeleting(null)
    }
  }

  const handleUpdateNotes = async (id: string, notes: string) => {
    await fetch(`/api/hiring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    })
  }

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateStr)
  }

  // Compute total count from stats
  const totalCount = stats.reduce((sum: number, s: any) => sum + (s._count?.id || 0), 0)

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search applicants..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-full sm:w-64" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({totalCount})</SelectItem>
              {STATUSES.map(s => {
                const statItem = stats.find((st: any) => st.status === s)
                const count = statItem?._count?.id || 0
                return <SelectItem key={s} value={s}>{s} ({count})</SelectItem>
              })}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus size={14} /> Add Applicant</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Applicant</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Full Name *" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Position Applied For" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
                <Input placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="LinkedIn URL" value={form.linkedin} onChange={e => setForm({ ...form, linkedin: e.target.value })} />
                <Input placeholder="Portfolio URL" value={form.portfolio} onChange={e => setForm({ ...form, portfolio: e.target.value })} />
              </div>
              <Textarea placeholder="Experience" value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })} rows={3} />
              <Textarea placeholder="Education" value={form.education} onChange={e => setForm({ ...form, education: e.target.value })} rows={2} />
              <Textarea placeholder="Skills" value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} rows={2} />
              <Textarea placeholder="Cover Letter" value={form.coverLetter} onChange={e => setForm({ ...form, coverLetter: e.target.value })} rows={3} />
              <Button onClick={handleCreate} className="w-full" disabled={!form.fullName.trim()}>Add Applicant</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Bar */}
      {stats.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {STATUSES.map(status => {
            const statItem = stats.find((s: any) => s.status === status)
            const count = statItem?._count?.id || 0
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
                className={`px-3 py-2 rounded-lg text-center transition-colors ${statusFilter === status ? "ring-2 ring-primary" : "bg-muted/50 hover:bg-muted"}`}
              >
                <p className="text-xs text-muted-foreground">{status}</p>
                <p className="text-lg font-bold">{count}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Applicant Cards */}
      {applicants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Briefcase className="text-muted-foreground" size={32} />
          </div>
          <p className="text-muted-foreground text-center">No applicants yet</p>
          <p className="text-sm text-muted-foreground/70 text-center mt-1">
            Add applicants manually or they&apos;ll appear here from the careers form on your website.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {applicants.map(applicant => (
            <Card
              key={applicant.id}
              className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
              onClick={() => { setSelectedApplicant(applicant); setEditMode(false) }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
                        <span className="text-background text-xs font-bold">
                          {applicant.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{applicant.fullName}</p>
                        {applicant.position && (
                          <p className="text-xs text-muted-foreground truncate">{applicant.position}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${statusColors[applicant.status] || "bg-muted text-muted-foreground"}`}>
                    {applicant.status}
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  {applicant.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail size={12} /> <span className="truncate">{applicant.email}</span>
                    </div>
                  )}
                  {applicant.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone size={12} /> <span>{applicant.phone}</span>
                    </div>
                  )}
                  {applicant.location && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin size={12} /> <span className="truncate">{applicant.location}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock size={10} /> {formatRelativeTime(applicant.createdAt)}
                  </span>
                  {applicant.source && (
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">{applicant.source}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Applicant Detail Modal ─── */}
      <Dialog open={!!selectedApplicant} onOpenChange={(open) => { if (!open) setSelectedApplicant(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center shrink-0">
                <span className="text-background text-sm font-bold">
                  {selectedApplicant?.fullName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <span className="truncate block">{selectedApplicant?.fullName}</span>
                {selectedApplicant?.position && (
                  <span className="text-sm font-normal text-muted-foreground">{selectedApplicant.position}</span>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedApplicant && (
            <div className="space-y-4">
              {/* Status Bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={selectedApplicant.status} onValueChange={v => handleStatusChange(selectedApplicant.id, v)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[selectedApplicant.status] || ""}`}>
                  {selectedApplicant.status}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  Applied {formatDate(selectedApplicant.createdAt)}
                </span>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedApplicant.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail size={14} className="text-muted-foreground shrink-0" />
                    <a href={`mailto:${selectedApplicant.email}`} className="text-primary hover:underline truncate">{selectedApplicant.email}</a>
                  </div>
                )}
                {selectedApplicant.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={14} className="text-muted-foreground shrink-0" />
                    <a href={`tel:${selectedApplicant.phone}`} className="text-primary hover:underline">{selectedApplicant.phone}</a>
                  </div>
                )}
                {selectedApplicant.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin size={14} className="text-muted-foreground shrink-0" />
                    <span>{selectedApplicant.location}</span>
                  </div>
                )}
                {selectedApplicant.source && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase size={14} className="text-muted-foreground shrink-0" />
                    <span>Source: {selectedApplicant.source}</span>
                  </div>
                )}
              </div>

              {/* Links */}
              {(selectedApplicant.linkedin || selectedApplicant.portfolio) && (
                <div className="flex items-center gap-3 flex-wrap">
                  {selectedApplicant.linkedin && (
                    <a href={selectedApplicant.linkedin} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                      <Linkedin size={14} /> LinkedIn <ExternalLink size={10} />
                    </a>
                  )}
                  {selectedApplicant.portfolio && (
                    <a href={selectedApplicant.portfolio} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                      <Globe size={14} /> Portfolio <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}

              {/* Media - Resume, Voice, Video */}
              {(selectedApplicant.resumeUrl || selectedApplicant.voiceMessageUrl || selectedApplicant.videoUrl) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedApplicant.resumeUrl && (
                    <a href={selectedApplicant.resumeUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-accent text-sm">
                      <FileText size={14} /> Resume <ExternalLink size={10} />
                    </a>
                  )}
                  {selectedApplicant.voiceMessageUrl && (
                    <a href={selectedApplicant.voiceMessageUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-accent text-sm">
                      <Mic size={14} /> Voice Message <ExternalLink size={10} />
                    </a>
                  )}
                  {selectedApplicant.videoUrl && (
                    <a href={selectedApplicant.videoUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-accent text-sm">
                      <Video size={14} /> Video <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}

              {/* Skills */}
              {selectedApplicant.skills && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
                    <GraduationCap size={14} /> Skills
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedApplicant.skills.split(",").map((skill, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{skill.trim()}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience */}
              {selectedApplicant.experience && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Experience</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedApplicant.experience}</p>
                </div>
              )}

              {/* Education */}
              {selectedApplicant.education && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Education</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedApplicant.education}</p>
                </div>
              )}

              {/* Cover Letter */}
              {selectedApplicant.coverLetter && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Cover Letter</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedApplicant.coverLetter}</p>
                </div>
              )}

              {/* Internal Notes */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Internal Notes</h4>
                <Textarea
                  placeholder="Add internal notes about this applicant..."
                  defaultValue={selectedApplicant.notes || ""}
                  onBlur={(e) => handleUpdateNotes(selectedApplicant.id, e.target.value)}
                  rows={3}
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">
                  Created: {formatDate(selectedApplicant.createdAt)} · Updated: {formatDate(selectedApplicant.updatedAt)}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(selectedApplicant.id)}
                  disabled={deleting === selectedApplicant.id}
                >
                  <Trash2 size={14} className="mr-1" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
