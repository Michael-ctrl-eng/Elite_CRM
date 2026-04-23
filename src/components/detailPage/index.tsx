'use client';
import React from 'react';
import {Download, Edit, Loader, Plus, Trash2, X} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import {Button} from '../ui/Button';

export interface FileAttachment {
    url: string;
    name?: string;
    size?: number;      // in bytes
    mimeType?: string;  // e.g., 'application/pdf'
}

export interface DetailItem {
    label: string;
    value: React.ReactNode; // can be text, JSX, badges, etc.
    fullWidth?: boolean;    // if you need it to span full width (e.g., multi-line)
}

interface DetailModalProps {
    isOpen: boolean;
    title: string;
    details: DetailItem[]; // Dynamic key-value fields
    description?: string;
    notes?: string;
    attachments?: FileAttachment[];
    activityLog?: { action: string; user: string; timestamp: Date }[];
    onClose: () => void;
    onDelete?: () => void;
    onEdit?: () => void;
    onReschedule?: () => void;
    onAddNotes?: () => void;
    onExport?: () => void;
    editLabel?: string;
    isDeleting?: boolean;
    isEditing?: boolean;
    isExporting?: boolean;
}

const DetailModal: React.FC<DetailModalProps> = ({
                                                     isOpen,
                                                     title,
                                                     details,
                                                     description,
                                                     notes,
                                                     attachments,
                                                     activityLog,
                                                     onClose,
                                                     onDelete,
                                                     onEdit,
                                                     onReschedule,
                                                     onAddNotes,
                                                     onExport,
                                                     editLabel,
                                                     isDeleting = false,
                                                     isEditing = false,
                                                     isExporting = false,
                                                 }) => {
    if (!isOpen) return null;

    const handleFileDownload = async (fileUrl: string) => {
        try {
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = fileUrl.split('/').pop() || 'file';
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error downloading file:', error);
        }
    };

    return (
        <Modal open={isOpen} onClose={onClose}>
            {/* Clickable backdrop overlay — closes modal on click */}
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
                    // Desktop (lg+): right-side panel — fixed right, full height, 455px
                    'lg:bottom-auto lg:left-auto lg:right-0 lg:top-0 lg:h-full lg:w-[455px] lg:rounded-none',
                ].join(' ')}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                {/* Mobile drag handle indicator */}
                <div className="flex justify-center pt-3 pb-1 lg:hidden">
                    <div className="w-10 h-1 rounded-full bg-muted-foreground/30"/>
                </div>

                {/* ── Header ── */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border shrink-0">
                    <h2 className="text-lg font-semibold text-foreground truncate pr-2">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0 rounded-md p-1 hover:bg-accent"
                        aria-label="Close panel"
                    >
                        <X className="w-5 h-5 sm:w-6 sm:h-6"/>
                    </button>
                </div>

                {/* ── Scrollable content ── */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {/* Dynamic Details */}
                    <div className="border-b border-border">
                        <section className="p-4 sm:p-6 space-y-6 sm:space-y-8">
                            <h3 className="font-medium text-foreground mb-4">Project Overview</h3>
                            <div className="space-y-3 text-sm">
                                {details.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={[
                                            'flex flex-col gap-1 sm:flex-row sm:gap-0',
                                            item.fullWidth
                                                ? 'items-start'
                                                : 'items-start sm:items-center',
                                        ].join(' ')}
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

                    {/* Description */}
                    {description && (
                        <div className="border-b border-border">
                            <section className="p-4 sm:p-6 space-y-6 sm:space-y-8">
                                <h3 className="font-medium text-foreground mb-2">Description</h3>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap capitalize">
                                    {description}
                                </p>
                            </section>
                        </div>
                    )}

                    {/* Notes */}
                    {notes && (
                        <div className="border-b border-border">
                            <section className="p-4 sm:p-6 space-y-6 sm:space-y-8">
                                <h3 className="font-medium text-foreground mb-2">Notes</h3>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap capitalize">
                                    {notes}
                                </p>
                            </section>
                        </div>
                    )}

                    {/* Attached Files */}
                    <div className="border-b border-border">
                        <section className="p-4 sm:p-6 space-y-6 sm:space-y-8">
                            <h3 className="font-medium text-foreground mb-2">Attached Files</h3>
                            {attachments && attachments.length > 0 ? (
                                <div className="space-y-2">
                                    {attachments.map((file, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between px-3 sm:px-4 py-3 gap-2 sm:gap-4"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm text-primary block truncate">
                                                    {file.url}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleFileDownload(file.url)}
                                                className="flex items-center text-muted-foreground border border-border px-2 sm:px-3 rounded-md shadow-sm text-sm py-1 hover:text-foreground hover:bg-accent whitespace-nowrap shrink-0"
                                            >
                                                <Download className="w-4 h-4 mr-1 sm:mr-2"/>
                                                <span className="hidden sm:inline">Download</span>
                                                <span className="sm:hidden">Save</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">No attached files</div>
                            )}
                        </section>
                    </div>

                    {/* Status Log */}
                    <section className="p-4 sm:p-6 space-y-6 sm:space-y-8">
                        <h3 className="font-medium text-foreground mb-2">Status Log</h3>
                        {activityLog && activityLog.length > 0 ? (
                            <div className="space-y-3 text-sm">
                                {activityLog.map((log, idx) => (
                                    <div key={idx}>
                                        <div className="text-foreground capitalize">
                                            {log.action} by {log.user}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">No Status yet</div>
                        )}
                    </section>
                </div>

                {/* ── Footer ── */}
                {(onDelete || onEdit || onReschedule || onAddNotes || onExport) && (
                    <div className="flex flex-wrap justify-between gap-2 border-t border-border px-3 sm:px-4 py-3 sm:py-4 bg-card shrink-0">
                        {onDelete && (
                            <Button
                                onClick={onDelete}
                                disabled={isDeleting}
                                className="p-1 text-sm font-medium rounded-lg text-destructive border border-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? (
                                    <Loader className="animate-spin" size={15}/>
                                ) : (
                                    <Trash2 size={15}/>
                                )}
                            </Button>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {onExport && (
                                <Button
                                    onClick={onExport}
                                    disabled={isExporting}
                                    className="px-3 sm:px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isExporting ? (
                                        <Loader className="animate-spin" size={15}/>
                                    ) : (
                                        <img src="/icons/File.svg" alt="Export" className='h-4 w-4'/>
                                    )}
                                    Export
                                </Button>
                            )}
                            {onEdit && (
                                <Button
                                    onClick={onEdit}
                                    className="px-3 sm:px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent whitespace-nowrap"
                                >
                                    {isEditing ? (
                                        <Loader className="animate-spin" size={15}/>
                                    ) : (
                                        <Edit size={15}/>
                                    )}
                                    {editLabel || "Edit Task"}
                                </Button>
                            )}
                            {onReschedule && (
                                <Button
                                    onClick={onReschedule}
                                    className="px-3 sm:px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent"
                                >
                                    Reschedule
                                </Button>
                            )}
                            {onAddNotes && (
                                <Button
                                    onClick={onAddNotes}
                                    className="px-3 sm:px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent whitespace-nowrap"
                                >
                                    <Plus size={15}/>
                                    Add Notes
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default DetailModal;
