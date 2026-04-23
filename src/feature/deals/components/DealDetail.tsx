'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Table';
import { Deal } from '../types';
import AvatarInitials from '@/components/ui/AvatarInitials';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/Button';
import { X, Edit, Trash2, Download, Plus, Loader, Send, MessageSquare, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface DealNoteUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface DealNote {
  id: string;
  content: string;
  dealId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: DealNoteUser;
}

interface ActivityLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface DealDetailProps {
  isOpen: boolean;
  deal: Deal | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (deal: Deal) => void;
  onAddNotes?: (id: string) => void;
  onExport?: (id: string) => void;
  isDeleting?: boolean;
  isEditing?: boolean;
  isExporting?: boolean;
}

export default function DealDetail({
  isOpen,
  deal,
  onClose,
  onDelete,
  onEdit,
  onAddNotes,
  onExport,
  isDeleting = false,
  isEditing = false,
  isExporting = false,
}: DealDetailProps) {
  const [notes, setNotes] = useState<DealNote[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'activity'>('notes');

  const fetchNotes = useCallback(async (dealId: string) => {
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setNotesLoading(false);
    }
  }, []);

  const fetchActivityLog = useCallback(async (dealId: string) => {
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}`);
      if (res.ok) {
        const dealData = await res.json();
        // Fetch activity logs for this deal's space, filtered by entityId
        const spaceId = dealData.spaceId;
        const logRes = await fetch(`/api/activity?spaceId=${spaceId}&entityId=${dealId}&limit=20`);
        if (logRes.ok) {
          const logData = await logRes.json();
          setActivityLog(Array.isArray(logData) ? logData : []);
        } else {
          setActivityLog([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch activity log:', err);
      setActivityLog([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && deal?.id) {
      fetchNotes(deal.id);
      fetchActivityLog(deal.id);
      setActiveTab('notes');
      setNewNoteContent('');
    }
  }, [isOpen, deal?.id, fetchNotes, fetchActivityLog]);

  const handleAddNote = async () => {
    if (!deal?.id || !newNoteContent.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      });
      if (res.ok) {
        const newNote = await res.json();
        setNotes((prev) => [newNote, ...prev]);
        setNewNoteContent('');
        toast.success('Note added successfully');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to add note');
      }
    } catch (err) {
      console.error('Failed to add note:', err);
      toast.error('Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  if (!deal) return null;

  const getCompanyName = (company: any) => {
    if (!company) return 'No Company';
    if (typeof company === 'string') return company;
    if (typeof company === 'object' && company?.fullName) return company.fullName;
    if (typeof company === 'object' && company?.name) return company.name;
    return 'Unknown Company';
  };

  const getContactName = (contact: any) => {
    if (!contact) return 'No Contact';
    if (typeof contact === 'string') return contact;
    if (typeof contact === 'object' && contact?.fullName) return contact.fullName;
    if (typeof contact === 'object' && contact?.name) return contact.name;
    return 'Unknown Contact';
  };

  const getOwnerName = (owner: any) => {
    if (!owner) return 'No Owner';
    if (typeof owner === 'string') return owner;
    if (typeof owner === 'object' && owner?.name) return owner.name;
    if (typeof owner === 'object' && owner?.email) return owner.email;
    return 'Unknown Owner';
  };

  const getCurrencySymbol = (currency?: string) => {
    switch (currency?.toUpperCase()) {
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'USD':
      default: return '$';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const details = [
    { label: 'Company', value: getCompanyName(deal.company) },
    { label: 'Contact', value: getContactName(deal.contact) },
    { label: 'Stage', value: (<Badge variant={deal.stage}>{deal.stage}</Badge>) },
    { label: 'Amount', value: `${getCurrencySymbol((deal as any).currency)}${deal.amount.toLocaleString()}` },
    {
      label: 'Owner',
      value: (
        <span className="flex items-center gap-2">
          <AvatarInitials name={getOwnerName(deal.owner)} size={24} />
          {getOwnerName(deal.owner)}
        </span>
      ),
    },
    deal.priority && { label: 'Tags', value: deal.priority },
    deal.closeDate && { label: 'Closed Date', value: formatDate((deal as any).closeDate) },
    (deal as any).lastActivity && { label: 'Last Activity', value: formatDate((deal as any).lastActivity) },
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];

  return (
    <Modal open={isOpen} onClose={onClose}>
      {/* Clickable backdrop overlay */}
      <div
        className="fixed inset-0 z-[1]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Responsive panel */}
      <div
        className={[
          'relative z-[2] flex flex-col bg-card shadow-lg',
          // Mobile: bottom sheet — full width, rounded top corners, 92vh
          'fixed bottom-0 left-0 right-0 h-[92vh] rounded-t-2xl',
          // Desktop (lg+): right-side panel — fixed right, full height, 500px
          'lg:bottom-auto lg:left-auto lg:right-0 lg:top-0 lg:h-full lg:w-[500px] lg:rounded-none',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={deal.dealName}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground truncate pr-2">{deal.dealName}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 rounded-md p-1 hover:bg-accent"
            aria-label="Close panel"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Deal Details */}
          <div className="border-b border-border">
            <section className="p-4 sm:p-6 space-y-4">
              <h3 className="font-medium text-foreground">Deal Overview</h3>
              <div className="space-y-3 text-sm">
                {details.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-1 sm:flex-row sm:gap-0 items-start sm:items-center"
                  >
                    <span className="font-medium capitalize text-foreground sm:w-28 sm:shrink-0">
                      {item.label}:
                    </span>
                    <span className="flex items-center capitalize text-muted-foreground sm:ml-2">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Deal Description */}
          {(deal as any).description && (
            <div className="border-b border-border">
              <section className="p-4 sm:p-6">
                <h3 className="font-medium text-foreground mb-2">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {(deal as any).description}
                </p>
              </section>
            </div>
          )}

          {/* Notes & Activity Tabs */}
          <div className="border-b border-border">
            {/* Tab Header */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'notes'
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Notes
                {notes.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-xs font-medium">
                    {notes.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'activity'
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Activity className="w-4 h-4" />
                Activity
              </button>
            </div>

            {/* Notes Tab Content */}
            {activeTab === 'notes' && (
              <section className="p-4 sm:p-6">
                {/* Add Note Form */}
                <div className="mb-6">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a note..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="min-h-[44px] max-h-32 resize-none text-sm"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleAddNote();
                        }
                      }}
                    />
                    <Button
                      onClick={handleAddNote}
                      disabled={!newNoteContent.trim() || submittingNote}
                      className="shrink-0 px-3 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingNote ? (
                        <Loader className="animate-spin" size={16} />
                      ) : (
                        <Send size={16} />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Press Ctrl+Enter to send
                  </p>
                </div>

                {/* Notes Timeline */}
                {notesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="animate-spin text-muted-foreground" size={20} />
                    <span className="ml-2 text-sm text-muted-foreground">Loading notes...</span>
                  </div>
                ) : notes.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No notes yet</p>
                    <p className="text-xs text-muted-foreground/70">Add a note to start the conversation</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {notes.map((note, idx) => (
                      <div
                        key={note.id}
                        className={`flex gap-3 ${idx !== notes.length - 1 ? 'pb-4 mb-4 border-b border-border/50' : ''}`}
                      >
                        {/* Avatar */}
                        <div className="shrink-0 mt-0.5">
                          {note.user.image ? (
                            <img
                              src={note.user.image}
                              alt={note.user.name || note.user.email}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <AvatarInitials
                              name={note.user.name}
                              email={note.user.email}
                              size={32}
                            />
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">
                              {note.user.name || note.user.email}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(note.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                            {note.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Activity Tab Content */}
            {activeTab === 'activity' && (
              <section className="p-4 sm:p-6">
                {activityLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="animate-spin text-muted-foreground" size={20} />
                    <span className="ml-2 text-sm text-muted-foreground">Loading activity...</span>
                  </div>
                ) : activityLog.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No activity recorded</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {activityLog.map((log, idx) => (
                      <div
                        key={log.id}
                        className={`flex gap-3 ${idx !== activityLog.length - 1 ? 'pb-4 mb-4 border-b border-border/50' : ''}`}
                      >
                        {/* Timeline dot */}
                        <div className="shrink-0 mt-1.5">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            <span className="font-medium">{log.action}</span>
                            {log.details && (
                              <span className="text-muted-foreground"> — {log.details}</span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              by {log.user?.name || log.user?.email || 'System'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              · {formatRelativeTime(log.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        {(onDelete || onEdit || onExport) && (
          <div className="flex flex-wrap justify-between gap-2 border-t border-border px-3 sm:px-4 py-3 sm:py-4 bg-card shrink-0">
            {onDelete && (
              <Button
                onClick={() => onDelete(deal.id)}
                disabled={isDeleting}
                className="p-1 text-sm font-medium rounded-lg text-destructive border border-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <Loader className="animate-spin" size={15} />
                ) : (
                  <Trash2 size={15} />
                )}
              </Button>
            )}
            <div className="flex flex-wrap gap-2">
              {onExport && (
                <Button
                  onClick={() => onExport(deal.id)}
                  disabled={isExporting}
                  className="px-3 sm:px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <Loader className="animate-spin" size={15} />
                  ) : (
                    <Download size={15} />
                  )}
                  Export
                </Button>
              )}
              {onEdit && (
                <Button
                  onClick={() => onEdit(deal as Deal)}
                  className="px-3 sm:px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent whitespace-nowrap"
                >
                  {isEditing ? (
                    <Loader className="animate-spin" size={15} />
                  ) : (
                    <Edit size={15} />
                  )}
                  Edit Deal
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
