"use client"
import { useState, useEffect } from "react"
import { useCurrentSpace } from "@/app/page"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Icon } from "@iconify/react"

const STATUSES = ["Scheduled", "Confirmed", "Cancelled"]

const statusBadgeMap: Record<string, { variant: "default" | "secondary" | "destructive"; icon: string }> = {
  Scheduled: { variant: "secondary", icon: "mdi:clock-outline" },
  Confirmed: { variant: "default", icon: "mdi:check-circle-outline" },
  Cancelled: { variant: "destructive", icon: "mdi:close-circle-outline" },
}

interface SpaceMember {
  id: string
  userId: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface MeetingParticipant {
  id: string
  meetingId: string
  userId: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface Meeting {
  id: string
  title: string
  description?: string | null
  location?: string | null
  meetingLink?: string | null
  status: string
  startDate: string
  endDate?: string | null
  ownerId: string
  owner: { id: string; name: string | null; email: string; image: string | null }
  assignedTo?: { id: string; name: string | null; email: string; image: string | null } | null
  participants: MeetingParticipant[]
}

const defaultForm = {
  title: "",
  description: "",
  location: "",
  meetingLink: "",
  status: "Scheduled" as string,
  startDate: "",
  endDate: "",
  participantIds: [] as string[],
}

export default function MeetingsPage() {
  const spaceId = useCurrentSpace()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null)
  const [search, setSearch] = useState("")
  const [form, setForm] = useState({ ...defaultForm })

  const fetchMeetings = () => {
    if (!spaceId) return
    fetch(`/api/meetings?spaceId=${spaceId}`)
      .then(r => r.json())
      .then(setMeetings)
      .catch(() => {})
  }

  const fetchMembers = () => {
    if (!spaceId) return
    fetch(`/api/spaces/${spaceId}/members`)
      .then(r => r.json())
      .then(setMembers)
      .catch(() => {})
  }

  useEffect(() => { fetchMeetings() }, [spaceId])
  useEffect(() => { fetchMembers() }, [spaceId])

  const toggleParticipant = (userId: string) => {
    setForm(prev => ({
      ...prev,
      participantIds: prev.participantIds.includes(userId)
        ? prev.participantIds.filter(id => id !== userId)
        : [...prev.participantIds, userId]
    }))
  }

  const handleCreate = async () => {
    await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, spaceId })
    })
    setShowCreate(false)
    setForm({ ...defaultForm })
    fetchMeetings()
  }

  const handleUpdate = async (id: string, data: any) => {
    await fetch(`/api/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
    setEditMeeting(null)
    fetchMeetings()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this meeting?")) return
    await fetch(`/api/meetings/${id}`, { method: "DELETE" })
    setEditMeeting(null)
    fetchMeetings()
  }

  const filtered = meetings.filter(m =>
    !search || m.title.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  }

  const formatDateTime = (dateStr: string) => {
    return `${formatDate(dateStr)} · ${formatTime(dateStr)}`
  }

  // Edit form state helpers
  const editParticipantIds = editMeeting?.participants?.map(p => p.userId) || []
  const toggleEditParticipant = (userId: string) => {
    if (!editMeeting) return
    const currentIds = editMeeting.participants?.map(p => p.userId) || []
    const newIds = currentIds.includes(userId)
      ? currentIds.filter(id => id !== userId)
      : [...currentIds, userId]
    // We store the new participantIds on the editMeeting object
    setEditMeeting({
      ...editMeeting,
      participants: newIds.map(uid => ({
        id: `temp-${uid}`,
        meetingId: editMeeting.id,
        userId: uid,
        user: members.find(m => m.userId === uid)?.user || { id: uid, name: null, email: "", image: null }
      }))
    } as any)
  }

  const renderParticipantsPills = (selectedIds: string[], onToggle: (id: string) => void) => {
    if (members.length === 0) return null
    return (
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
          <Icon icon="mdi:account-group-outline" width={14} />
          Participants
        </label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {members.map(member => {
            const isSelected = selectedIds.includes(member.userId)
            return (
              <button
                key={member.userId}
                type="button"
                onClick={() => onToggle(member.userId)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors min-h-[32px] ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {member.user.image ? (
                  <img src={member.user.image} alt="" className="w-4 h-4 rounded-full" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold">
                    {(member.user.name || member.user.email)[0]?.toUpperCase()}
                  </span>
                )}
                {member.user.name || member.user.email}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const renderMeetingForm = (isEdit: boolean) => {
    if (isEdit && editMeeting) {
      const currentParticipantIds = editMeeting.participants?.map(p => p.userId) || []
      return (
        <div className="space-y-3">
          <Input
            value={editMeeting.title}
            onChange={e => setEditMeeting({ ...editMeeting, title: e.target.value })}
            placeholder="Meeting Title"
            className="min-h-[44px]"
          />
          <Input
            value={editMeeting.description || ""}
            onChange={e => setEditMeeting({ ...editMeeting, description: e.target.value })}
            placeholder="Description"
            className="min-h-[44px]"
          />
          <Input
            value={editMeeting.location || ""}
            onChange={e => setEditMeeting({ ...editMeeting, location: e.target.value })}
            placeholder="Location"
            className="min-h-[44px]"
          />
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Icon icon="mdi:video-outline" width={14} />
              Meeting Link
            </label>
            <Input
              value={editMeeting.meetingLink || ""}
              onChange={e => setEditMeeting({ ...editMeeting, meetingLink: e.target.value })}
              placeholder="Zoom / Google Meet / Teams URL"
              className="min-h-[44px] mt-1"
            />
          </div>
          <Select value={editMeeting.status} onValueChange={v => setEditMeeting({ ...editMeeting, status: v })}>
            <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Icon icon="mdi:calendar-outline" width={14} />
                Start Date & Time
              </label>
              <Input
                type="datetime-local"
                value={editMeeting.startDate ? new Date(editMeeting.startDate).toISOString().slice(0, 16) : ""}
                onChange={e => setEditMeeting({ ...editMeeting, startDate: e.target.value })}
                className="min-h-[44px] mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Icon icon="mdi:calendar-outline" width={14} />
                End Date & Time
              </label>
              <Input
                type="datetime-local"
                value={editMeeting.endDate ? new Date(editMeeting.endDate).toISOString().slice(0, 16) : ""}
                onChange={e => setEditMeeting({ ...editMeeting, endDate: e.target.value })}
                className="min-h-[44px] mt-1"
              />
            </div>
          </div>
          {renderParticipantsPills(currentParticipantIds, toggleEditParticipant)}
          <div className="flex gap-2">
            <Button
              onClick={() => handleUpdate(editMeeting.id, {
                ...editMeeting,
                participantIds: currentParticipantIds,
              })}
              className="flex-1 min-h-[44px]"
              disabled={!editMeeting.title}
            >
              Save Changes
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(editMeeting.id)}
              className="min-h-[44px] min-w-[44px]"
            >
              <Icon icon="mdi:delete-outline" width={16} />
            </Button>
          </div>
        </div>
      )
    }

    // Create form
    return (
      <div className="space-y-3">
        <Input
          placeholder="Meeting Title *"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          className="min-h-[44px]"
        />
        <Input
          placeholder="Description"
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          className="min-h-[44px]"
        />
        <Input
          placeholder="Location"
          value={form.location}
          onChange={e => setForm({ ...form, location: e.target.value })}
          className="min-h-[44px]"
        />
        <div>
          <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Icon icon="mdi:video-outline" width={14} />
            Meeting Link
          </label>
          <Input
            placeholder="Zoom / Google Meet / Teams URL"
            value={form.meetingLink}
            onChange={e => setForm({ ...form, meetingLink: e.target.value })}
            className="min-h-[44px] mt-1"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Icon icon="mdi:calendar-outline" width={14} />
              Start Date & Time *
            </label>
            <Input
              type="datetime-local"
              value={form.startDate}
              onChange={e => setForm({ ...form, startDate: e.target.value })}
              className="min-h-[44px] mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Icon icon="mdi:calendar-outline" width={14} />
              End Date & Time
            </label>
            <Input
              type="datetime-local"
              value={form.endDate}
              onChange={e => setForm({ ...form, endDate: e.target.value })}
              className="min-h-[44px] mt-1"
            />
          </div>
        </div>
        {renderParticipantsPills(form.participantIds, toggleParticipant)}
        <Button
          onClick={handleCreate}
          className="w-full min-h-[44px]"
          disabled={!form.title || !form.startDate}
        >
          <Icon icon="mdi:plus" width={16} className="mr-1" />
          Create Meeting
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{meetings.length} Meetings</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Icon icon="mdi:magnify" width={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search meetings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-56 min-h-[44px]"
            />
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="min-h-[44px] w-full sm:w-auto">
                <Icon icon="mdi:plus" width={16} className="mr-1" />
                Add Meeting
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Meeting</DialogTitle></DialogHeader>
              {renderMeetingForm(false)}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Meeting Cards */}
      <div className="space-y-3">
        {filtered.map(m => {
          const badgeInfo = statusBadgeMap[m.status] || statusBadgeMap.Scheduled
          return (
            <Card
              key={m.id}
              className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
              onClick={() => setEditMeeting(m)}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Calendar icon */}
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon icon="mdi:calendar-outline" width={22} className="text-primary" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Title + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium truncate">{m.title}</p>
                      <Badge variant={badgeInfo.variant} className="flex-shrink-0 gap-1">
                        <Icon icon={badgeInfo.icon} width={12} />
                        {m.status}
                      </Badge>
                    </div>

                    {/* Date & Time */}
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Icon icon="mdi:clock-outline" width={14} className="flex-shrink-0" />
                      <span>{formatDateTime(m.startDate)}</span>
                      {m.endDate && (
                        <span className="text-muted-foreground">→ {formatTime(m.endDate)}</span>
                      )}
                    </div>

                    {/* Location */}
                    {m.location && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Icon icon="mdi:map-marker-outline" width={14} className="flex-shrink-0" />
                        <span className="truncate">{m.location}</span>
                      </div>
                    )}

                    {/* Meeting Link */}
                    {m.meetingLink && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Icon icon="mdi:video-outline" width={14} className="flex-shrink-0 text-primary" />
                        <a
                          href={m.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline truncate"
                          onClick={e => e.stopPropagation()}
                        >
                          Join Meeting
                        </a>
                      </div>
                    )}

                    {/* Participants */}
                    {m.participants && m.participants.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Icon icon="mdi:account-group-outline" width={14} className="flex-shrink-0 text-muted-foreground" />
                        <div className="flex items-center -space-x-1.5">
                          {m.participants.slice(0, 5).map(p => (
                            <div
                              key={p.id}
                              className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center"
                              title={p.user.name || p.user.email}
                            >
                              {p.user.image ? (
                                <img src={p.user.image} alt="" className="w-full h-full rounded-full" />
                              ) : (
                                <span className="text-[9px] font-bold text-muted-foreground">
                                  {(p.user.name || p.user.email)[0]?.toUpperCase()}
                                </span>
                              )}
                            </div>
                          ))}
                          {m.participants.length > 5 && (
                            <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                              <span className="text-[9px] font-bold text-muted-foreground">
                                +{m.participants.length - 5}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground ml-1">
                          {m.participants.length} participant{m.participants.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    )}

                    {/* Description snippet */}
                    {m.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{m.description}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {meetings.length === 0 && (
          <div className="text-center py-16">
            <Icon icon="mdi:calendar-outline" width={48} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No meetings scheduled</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Click "Add Meeting" to create one</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editMeeting} onOpenChange={() => setEditMeeting(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Meeting</DialogTitle></DialogHeader>
          {renderMeetingForm(true)}
        </DialogContent>
      </Dialog>
    </div>
  )
}
