'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Deal, DealTask, DealAttachment, DealParticipant } from '../types';
import AvatarInitials from '@/components/ui/AvatarInitials';
import {
  X, Edit, Trash2, Download, Plus, Loader, Send, Activity, RefreshCw, Clock,
  CheckCircle2, Circle, FileText, Image as ImageIcon, Paperclip, Trash,
  Globe, Linkedin, Building2, Users, Mail, Phone, ExternalLink, Calendar, User, ChevronDown, ChevronUp, Eye
} from 'lucide-react';
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
  spaceMembers?: any[];
}

export default function DealDetail({
  isOpen, deal, onClose, onDelete, onEdit, onAddNotes, onExport,
  isDeleting = false, isEditing = false, isExporting = false, spaceMembers = [],
}: DealDetailProps) {
  const [notes, setNotes] = useState<DealNote[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<'updates' | 'activity' | 'tasks' | 'attachments'>('updates');

  // Tasks state
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '', assigneeId: '' });
  const [submittingTask, setSubmittingTask] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<DealAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<DealAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchNotes = useCallback(async (dealId: string) => {
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/notes`);
      if (res.ok) setNotes(await res.json());
    } catch (err) { console.error('Failed to fetch notes:', err); }
    finally { setNotesLoading(false); }
  }, []);

  const fetchActivityLog = useCallback(async (dealId: string) => {
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}`);
      if (res.ok) {
        const dealData = await res.json();
        const logRes = await fetch(`/api/activity?spaceId=${dealData.spaceId}&entityId=${dealId}&limit=20`);
        if (logRes.ok) setActivityLog(Array.isArray(await logRes.json()) ? await logRes.json() : []);
        else setActivityLog([]);
      }
    } catch (err) { console.error('Failed to fetch activity log:', err); setActivityLog([]); }
    finally { setActivityLoading(false); }
  }, []);

  const fetchTasks = useCallback(async (dealId: string) => {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/tasks`);
      if (res.ok) setTasks(await res.json());
    } catch (err) { console.error('Failed to fetch tasks:', err); }
    finally { setTasksLoading(false); }
  }, []);

  const fetchAttachments = useCallback(async (dealId: string) => {
    setAttachmentsLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/attachments`);
      if (res.ok) setAttachments(await res.json());
    } catch (err) { console.error('Failed to fetch attachments:', err); }
    finally { setAttachmentsLoading(false); }
  }, []);

  useEffect(() => {
    if (isOpen && deal?.id) {
      fetchNotes(deal.id);
      fetchActivityLog(deal.id);
      fetchTasks(deal.id);
      fetchAttachments(deal.id);
      setActiveTab('updates');
      setNewNoteContent('');
      setPreviewAttachment(null);
    }
  }, [isOpen, deal?.id, fetchNotes, fetchActivityLog, fetchTasks, fetchAttachments]);

  const handleAddNote = async () => {
    if (!deal?.id || !newNoteContent.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      });
      if (res.ok) {
        const newNote = await res.json();
        setNotes(prev => [newNote, ...prev]);
        setNewNoteContent('');
        toast.success('Update added successfully');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to add update');
      }
    } catch { toast.error('Failed to add update'); }
    finally { setSubmittingNote(false); }
  };

  const handleAddTask = async () => {
    if (!deal?.id || !newTask.title.trim()) return;
    setSubmittingTask(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description || undefined,
          dueDate: newTask.dueDate || undefined,
          assigneeId: newTask.assigneeId || undefined,
        }),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks(prev => [task, ...prev]);
        setNewTask({ title: '', description: '', dueDate: '', assigneeId: '' });
        setShowAddTask(false);
        toast.success('Task added');
      } else {
        toast.error('Failed to add task');
      }
    } catch { toast.error('Failed to add task'); }
    finally { setSubmittingTask(false); }
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    try {
      const res = await fetch(`/api/deals/${deal?.id}/tasks/${taskId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      }
    } catch { toast.error('Failed to update task'); }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/deals/${deal?.id}/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        toast.success('Task deleted');
      }
    } catch { toast.error('Failed to delete task'); }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !deal?.id) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/deals/${deal.id}/attachments`, { method: 'POST', body: formData });
      if (res.ok) {
        const attachment = await res.json();
        setAttachments(prev => [attachment, ...prev]);
        toast.success('File uploaded');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Upload failed');
      }
    } catch { toast.error('Upload failed'); }
    finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const res = await fetch(`/api/deals/${deal?.id}/attachments/${attachmentId}`, { method: 'DELETE' });
      if (res.ok) {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId));
        if (previewAttachment?.id === attachmentId) setPreviewAttachment(null);
        toast.success('Attachment deleted');
      }
    } catch { toast.error('Failed to delete attachment'); }
  };

  if (!deal) return null;

  const getCompanyName = (company: any) => {
    if (!company) return null;
    if (typeof company === 'string') return company;
    if (typeof company === 'object' && company?.name) return company.name;
    return null;
  };

  const getContactName = (contact: any) => {
    if (!contact) return null;
    if (typeof contact === 'string') return contact;
    if (typeof contact === 'object' && contact?.name) return contact.name;
    return null;
  };

  const getOwnerName = (owner: any) => {
    if (!owner) return 'No Owner';
    if (typeof owner === 'string') return owner;
    if (typeof owner === 'object' && owner?.name) return owner.name;
    if (typeof owner === 'object' && owner?.email) return owner.email;
    return 'Unknown Owner';
  };

  const getCurrencySymbol = (currency?: string) => {
    switch (currency?.toUpperCase()) { case 'EUR': return '€'; case 'GBP': return '£'; default: return '$'; }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatRelativeTime = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getFileIcon = (mimeType?: string | null) => {
    if (!mimeType) return <FileText size={16} className="text-muted-foreground" />;
    if (mimeType.startsWith('image/')) return <ImageIcon size={16} className="text-blue-500" />;
    if (mimeType === 'application/pdf') return <FileText size={16} className="text-red-500" />;
    return <FileText size={16} className="text-muted-foreground" />;
  };

  const isPreviewable = (mimeType?: string | null) => {
    if (!mimeType) return false;
    return mimeType.startsWith('image/') || mimeType === 'application/pdf' || mimeType.startsWith('text/');
  };

  const completedTasks = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="fixed inset-0 z-[1]" onClick={onClose} aria-hidden="true" />
      <div className={[
        'relative z-[2] flex flex-col bg-card shadow-lg',
        'fixed bottom-0 left-0 right-0 h-[92vh] rounded-t-2xl',
        'lg:bottom-auto lg:left-auto lg:right-0 lg:top-0 lg:h-full lg:w-[560px] lg:rounded-none',
      ].join(' ')} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">

        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border shrink-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-lg font-semibold text-foreground truncate">{deal.title || deal.dealName}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant={deal.stage}>{deal.stage}</Badge>
              <span className="text-sm text-muted-foreground">{getCurrencySymbol(deal.currency)}{((deal.value ?? deal.amount) || 0).toLocaleString()}</span>
              {(deal as any).industry && <Badge variant="outline" className="text-xs">{(deal as any).industry}</Badge>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 rounded-md p-1 hover:bg-accent" aria-label="Close">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Deal Details */}
          <div className="border-b border-border">
            <section className="p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {/* Basic details */}
                {getCompanyName((deal as any).company) && (
                  <div className="flex flex-col">
                    <span className="font-medium text-muted-foreground text-xs">Company</span>
                    <span className="text-foreground">{getCompanyName((deal as any).company)}</span>
                  </div>
                )}
                {getContactName((deal as any).contact) && (
                  <div className="flex flex-col">
                    <span className="font-medium text-muted-foreground text-xs">Contact</span>
                    <span className="text-foreground">{getContactName((deal as any).contact)}</span>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-medium text-muted-foreground text-xs">Stage</span>
                  <span><Badge variant={deal.stage}>{deal.stage}</Badge></span>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-muted-foreground text-xs">Amount</span>
                  <span className="text-foreground">{getCurrencySymbol(deal.currency)}{((deal.value ?? deal.amount) || 0).toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-muted-foreground text-xs">Owner</span>
                  <span className="flex items-center gap-1.5 text-foreground">
                    <AvatarInitials name={getOwnerName(deal.owner)} size={18} />
                    {getOwnerName(deal.owner)}
                  </span>
                </div>
                {(deal as any).closeDate && (
                  <div className="flex flex-col">
                    <span className="font-medium text-muted-foreground text-xs">Close Date</span>
                    <span className="text-foreground">{formatDate((deal as any).closeDate)}</span>
                  </div>
                )}

                {/* New fields */}
                {(deal as any).websiteUrl && (
                  <div className="flex flex-col col-span-2">
                    <span className="font-medium text-muted-foreground text-xs">Website</span>
                    <a href={(deal as any).websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 text-xs">
                      <Globe size={12} /> {(deal as any).websiteUrl}
                    </a>
                  </div>
                )}
                {(deal as any).linkedInUrl && (
                  <div className="flex flex-col col-span-2">
                    <span className="font-medium text-muted-foreground text-xs">LinkedIn</span>
                    <a href={(deal as any).linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 text-xs">
                      <Linkedin size={12} /> {(deal as any).linkedInUrl}
                    </a>
                  </div>
                )}
                {(deal as any).industry && (
                  <div className="flex flex-col">
                    <span className="font-medium text-muted-foreground text-xs">Industry</span>
                    <span className="flex items-center gap-1 text-foreground"><Building2 size={12} />{(deal as any).industry}</span>
                  </div>
                )}
                {(deal as any).companySize && (
                  <div className="flex flex-col">
                    <span className="font-medium text-muted-foreground text-xs">Company Size</span>
                    <span className="flex items-center gap-1 text-foreground"><Users size={12} />{(deal as any).companySize}</span>
                  </div>
                )}
                {(deal as any).dealEmail && (
                  <div className="flex flex-col">
                    <span className="font-medium text-muted-foreground text-xs">Email</span>
                    <a href={`mailto:${(deal as any).dealEmail}`} className="text-blue-500 hover:underline flex items-center gap-1 text-xs"><Mail size={12} />{(deal as any).dealEmail}</a>
                  </div>
                )}
                {(deal as any).dealPhone && (
                  <div className="flex flex-col">
                    <span className="font-medium text-muted-foreground text-xs">Phone</span>
                    <span className="flex items-center gap-1 text-foreground"><Phone size={12} />{(deal as any).dealPhone}</span>
                  </div>
                )}
              </div>

              {/* Main Participant */}
              {(deal as any).mainParticipant && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <span className="font-medium text-muted-foreground text-xs">Main Participant</span>
                  <div className="flex items-center gap-2 mt-1">
                    <AvatarInitials name={(deal as any).mainParticipant.name || ''} size={22} />
                    <span className="text-sm text-foreground">{(deal as any).mainParticipant.name || (deal as any).mainParticipant.email}</span>
                  </div>
                </div>
              )}

              {/* Other Participants */}
              {(deal as any).participants && (deal as any).participants.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <span className="font-medium text-muted-foreground text-xs">Participants</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(deal as any).participants.map((p: DealParticipant) => (
                      <div key={p.id} className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1">
                        <AvatarInitials name={p.user?.name || ''} size={18} />
                        <span className="text-xs text-foreground">{p.user?.name || p.user?.email}</span>
                        {p.role === 'main' && <Badge className="text-[10px] px-1 py-0 ml-1" variant="outline">Main</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Description */}
          {(deal as any).description && (
            <div className="border-b border-border">
              <section className="p-4 sm:p-5">
                <h3 className="font-medium text-foreground mb-2 text-sm">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{(deal as any).description}</p>
              </section>
            </div>
          )}

          {/* Tab Header */}
          <div className="flex border-b border-border overflow-x-auto">
            {[
              { key: 'updates' as const, label: 'Updates', icon: RefreshCw, count: notes.length },
              { key: 'tasks' as const, label: `Tasks (${completedTasks}/${totalTasks})`, icon: CheckCircle2 },
              { key: 'attachments' as const, label: `Files (${attachments.length})`, icon: Paperclip },
              { key: 'activity' as const, label: 'Activity', icon: Activity },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 sm:px-5 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── UPDATES TAB ── */}
          {activeTab === 'updates' && (
            <section className="p-4 sm:p-5">
              <div className="mb-6 bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Add Update</span>
                </div>
                <Textarea
                  placeholder="Write a deal update..."
                  value={newNoteContent}
                  onChange={e => setNewNoteContent(e.target.value)}
                  className="min-h-[60px] max-h-32 resize-none text-sm bg-background"
                  rows={2}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAddNote(); } }}
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">Ctrl+Enter to post</p>
                  <Button onClick={handleAddNote} disabled={!newNoteContent.trim() || submittingNote} size="sm" className="gap-1.5">
                    {submittingNote ? <Loader className="animate-spin" size={14} /> : <Send size={14} />}
                    Post
                  </Button>
                </div>
              </div>

              {notesLoading ? (
                <div className="flex items-center justify-center py-8"><Loader className="animate-spin text-muted-foreground" size={20} /></div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8"><RefreshCw className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No updates yet</p></div>
              ) : (
                <div className="space-y-0">
                  {notes.map((note, idx) => (
                    <div key={note.id} className={`relative ${idx !== notes.length - 1 ? 'pb-5' : ''}`}>
                      {idx !== notes.length - 1 && <div className="absolute left-[15px] top-[40px] bottom-0 w-px bg-border" />}
                      <div className="flex gap-3">
                        <div className="shrink-0 relative z-10">
                          {note.user.image ? (
                            <img src={note.user.image} alt={note.user.name || note.user.email} className="w-8 h-8 rounded-full object-cover ring-2 ring-background" />
                          ) : <AvatarInitials name={note.user.name} email={note.user.email} size={32} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="bg-muted/30 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-sm font-semibold text-foreground truncate">{note.user.name || note.user.email}</span>
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatRelativeTime(note.createdAt)}</span>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">{note.content}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── TASKS TAB ── */}
          {activeTab === 'tasks' && (
            <section className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Tasks</span>
                  {totalTasks > 0 && (
                    <span className="text-xs text-muted-foreground">{completedTasks}/{totalTasks} done</span>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowAddTask(!showAddTask)} className="gap-1.5">
                  <Plus size={14} /> Add Task
                </Button>
              </div>

              {/* Add Task Form */}
              {showAddTask && (
                <div className="bg-muted/30 rounded-lg p-3 mb-4 space-y-2">
                  <Input placeholder="Task title *" value={newTask.title} onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))} />
                  <Textarea placeholder="Description (optional)" value={newTask.description} onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))} className="min-h-[40px] resize-none" rows={2} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="datetime-local" value={newTask.dueDate} onChange={e => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))} placeholder="Due date & time" />
                    <select
                      value={newTask.assigneeId}
                      onChange={e => setNewTask(prev => ({ ...prev, assigneeId: e.target.value }))}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Unassigned</option>
                      {spaceMembers.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name || m.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddTask} disabled={!newTask.title || submittingTask}>
                      {submittingTask ? <Loader className="animate-spin" size={14} /> : 'Add'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowAddTask(false); setNewTask({ title: '', description: '', dueDate: '', assigneeId: '' }); }}>Cancel</Button>
                  </div>
                </div>
              )}

              {tasksLoading ? (
                <div className="flex items-center justify-center py-8"><Loader className="animate-spin text-muted-foreground" size={20} /></div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8"><CheckCircle2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No tasks yet</p></div>
              ) : (
                <div className="space-y-1">
                  {/* Incomplete tasks first */}
                  {tasks.filter(t => !t.completed).map(task => (
                    <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors group">
                      <button onClick={() => handleToggleTask(task.id, task.completed)} className="mt-0.5 shrink-0">
                        <Circle size={18} className="text-muted-foreground hover:text-accent-foreground transition-colors" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{task.title}</p>
                        {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {task.dueDate && (
                            <span className="flex items-center gap-1"><Calendar size={10} />{new Date(task.dueDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                          )}
                          {task.assignee && <span className="flex items-center gap-1"><User size={10} />{task.assignee.name || task.assignee.email}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded">
                        <Trash size={14} className="text-destructive" />
                      </button>
                    </div>
                  ))}
                  {/* Completed tasks */}
                  {tasks.filter(t => t.completed).map(task => (
                    <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors group opacity-60">
                      <button onClick={() => handleToggleTask(task.id, task.completed)} className="mt-0.5 shrink-0">
                        <CheckCircle2 size={18} className="text-green-500" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground line-through">{task.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {task.dueDate && <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(task.dueDate)}</span>}
                          {task.assignee && <span className="flex items-center gap-1"><User size={10} />{task.assignee.name || task.assignee.email}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded">
                        <Trash size={14} className="text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── ATTACHMENTS TAB ── */}
          {activeTab === 'attachments' && (
            <section className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-foreground">Attachments</span>
                <div>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadAttachment} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" />
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="gap-1.5">
                    {uploadingFile ? <Loader className="animate-spin" size={14} /> : <Plus size={14} />}
                    Upload
                  </Button>
                </div>
              </div>

              {/* File Preview */}
              {previewAttachment && (
                <div className="mb-4 border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
                    <span className="text-xs font-medium text-foreground truncate">{previewAttachment.fileName}</span>
                    <button onClick={() => setPreviewAttachment(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                  </div>
                  <div className="max-h-[400px] overflow-auto bg-black/5">
                    {previewAttachment.mimeType?.startsWith('image/') ? (
                      <img
                        src={`/api/deals/${deal.id}/attachments/${previewAttachment.id}`}
                        alt={previewAttachment.fileName}
                        className="max-w-full mx-auto"
                      />
                    ) : previewAttachment.mimeType === 'application/pdf' ? (
                      <iframe
                        src={`/api/deals/${deal.id}/attachments/${previewAttachment.id}`}
                        className="w-full h-[400px]"
                        title={previewAttachment.fileName}
                      />
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileText size={32} className="mx-auto mb-2" />
                        <p className="text-sm">Preview not available for this file type</p>
                        <a
                          href={`/api/deals/${deal.id}/attachments/${previewAttachment.id}`}
                          download={previewAttachment.fileName}
                          className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                        >
                          Download instead
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {attachmentsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader className="animate-spin text-muted-foreground" size={20} /></div>
              ) : attachments.length === 0 ? (
                <div className="text-center py-8"><Paperclip className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No attachments yet</p></div>
              ) : (
                <div className="space-y-1">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors group">
                      {getFileIcon(att.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{att.fileName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {att.fileSize && <span>{(att.fileSize / 1024).toFixed(1)} KB</span>}
                          <span>{formatRelativeTime(att.createdAt)}</span>
                          {att.uploader && <span>by {att.uploader.name || att.uploader.email}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isPreviewable(att.mimeType) && (
                          <button
                            onClick={() => setPreviewAttachment(previewAttachment?.id === att.id ? null : att)}
                            className="p-1.5 rounded hover:bg-accent/50 transition-colors"
                            title="Preview"
                          >
                            <Eye size={14} className="text-muted-foreground" />
                          </button>
                        )}
                        <a
                          href={`/api/deals/${deal.id}/attachments/${att.id}`}
                          download={att.fileName}
                          className="p-1.5 rounded hover:bg-accent/50 transition-colors"
                          title="Download"
                        >
                          <Download size={14} className="text-muted-foreground" />
                        </a>
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1.5 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 size={14} className="text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── ACTIVITY TAB ── */}
          {activeTab === 'activity' && (
            <section className="p-4 sm:p-5">
              {activityLoading ? (
                <div className="flex items-center justify-center py-8"><Loader className="animate-spin text-muted-foreground" size={20} /></div>
              ) : activityLog.length === 0 ? (
                <div className="text-center py-8"><Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No activity recorded</p></div>
              ) : (
                <div className="space-y-0">
                  {activityLog.map((log, idx) => (
                    <div key={log.id} className={`flex gap-3 ${idx !== activityLog.length - 1 ? 'pb-4 mb-4 border-b border-border/50' : ''}`}>
                      <div className="shrink-0 mt-1.5"><div className="w-2 h-2 rounded-full bg-muted-foreground/40" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{log.action}</span>
                          {log.details && <span className="text-muted-foreground"> — {log.details}</span>}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">by {log.user?.name || log.user?.email || 'System'}</span>
                          <span className="text-xs text-muted-foreground">· {formatRelativeTime(log.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Footer ── */}
        {(onDelete || onEdit || onExport) && (
          <div className="flex flex-wrap justify-between gap-2 border-t border-border px-3 sm:px-4 py-3 bg-card shrink-0">
            {onDelete && (
              <Button onClick={() => onDelete(deal.id)} disabled={isDeleting}
                className="p-1 text-sm font-medium rounded-lg text-destructive border border-destructive hover:bg-destructive/10 disabled:opacity-50">
                {isDeleting ? <Loader className="animate-spin" size={15} /> : <Trash2 size={15} />}
              </Button>
            )}
            <div className="flex flex-wrap gap-2">
              {onEdit && (
                <Button onClick={() => onEdit(deal as Deal)} className="px-3 sm:px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent whitespace-nowrap gap-1.5">
                  <Edit size={15} /> Edit Deal
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
