'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import { Badge } from '@/components/ui/badge';
import { Deal } from '../types';
import AvatarInitials from '@/components/ui/AvatarInitials';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { X, Edit, Trash2, Download, Plus, Loader, Send, MessageSquare, Activity, RefreshCw, Clock, User, TrendingUp } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'updates' | 'activity'>('updates');

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
      setActiveTab('updates');
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
        toast.success('Update added successfully');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to add update');
      }
    } catch (err) {
      console.error('Failed to add note:', err);
      toast.error('Failed to add update');
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
    if (typeof company === 'object' && contact?.fullName) return contact.fullName;
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

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
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
    { label: 'Amount', value: `${getCurrencySymbol(deal.currency)}${(deal.value ?? deal.amount || 0).toLocaleString()}` },
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
        aria-label={deal.title || deal.dealName}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border shrink-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-lg font-semibold text-foreground truncate">{deal.title || deal.dealName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={deal.stage}>{deal.stage}</Badge>
              <span className="text-sm text-muted-foreground">
                {getCurrencySymbol(deal.currency)}{(deal.value ?? deal.amount || 0).toLocaleString()}
              </span>
            </div>
          </div>
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
          {/* Deal Details - Compact */}
          <div className="border-b border-border">
            <section className="p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {details.map((item, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="font-medium capitalize text-muted-foreground text-xs">
                      {item.label}
                    </span>
                    <span className="flex items-center capitalize text-foreground">
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
              <section className="p-4 sm:p-5">
                <h3 className="font-medium text-foreground mb-2 text-sm">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {(deal as any).description}
                </p>
              </section>
            </div>
          )}

          {/* Updates & Activity Tabs */}
          <div>
            {/* Tab Header */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab('updates')}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'updates'
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Updates
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

            {/* Updates Tab Content */}
            {activeTab === 'updates' && (
              <section className="p-4 sm:p-5">
                {/* Add Update Form */}
                <div className="mb-6 bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={14} className="text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Add Update</span>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Write a deal update — what's happening, what changed, next steps..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="min-h-[60px] max-h-32 resize-none text-sm bg-background"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleAddNote();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      Ctrl+Enter to post
                    </p>
                    <Button
                      onClick={handleAddNote}
                      disabled={!newNoteContent.trim() || submittingNote}
                      size="sm"
                      className="gap-1.5"
                    >
                      {submittingNote ? (
                        <Loader className="animate-spin" size={14} />
                      ) : (
                        <Send size={14} />
                      )}
                      Post Update
                    </Button>
                  </div>
                </div>

                {/* Updates Timeline */}
                {notesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="animate-spin text-muted-foreground" size={20} />
                    <span className="ml-2 text-sm text-muted-foreground">Loading updates...</span>
                  </div>
                ) : notes.length === 0 ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No updates yet</p>
                    <p className="text-xs text-muted-foreground/70">Post the first deal update above</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {notes.map((note, idx) => (
                      <div
                        key={note.id}
                        className={`relative ${idx !== notes.length - 1 ? 'pb-5' : ''}`}
                      >
                        {/* Timeline line */}
                        {idx !== notes.length - 1 && (
                          <div className="absolute left-[15px] top-[40px] bottom-0 w-px bg-border" />
                        )}

                        <div className="flex gap-3">
                          {/* Avatar */}
                          <div className="shrink-0 relative z-10">
                            {note.user.image ? (
                              <img
                                src={note.user.image}
                                alt={note.user.name || note.user.email}
                                className="w-8 h-8 rounded-full object-cover ring-2 ring-background"
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
                            <div className="bg-muted/30 rounded-lg p-3">
                              {/* Header: User + Date */}
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-semibold text-foreground truncate">
                                    {note.user.name || note.user.email}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Clock size={10} className="text-muted-foreground/50" />
                                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                    {formatRelativeTime(note.createdAt)}
                                  </span>
                                </div>
                              </div>

                              {/* Full date */}
                              <div className="text-[10px] text-muted-foreground/60 mb-2">
                                {formatFullDate(note.createdAt)}
                              </div>

                              {/* Update content */}
                              <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                                {note.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Activity Tab Content */}
            {activeTab === 'activity' && (
              <section className="p-4 sm:p-5">
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
