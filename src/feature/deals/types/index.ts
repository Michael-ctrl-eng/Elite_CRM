
export type Deal = {
  id: string
  dealName: string
  title?: string  // API returns 'title', some components use 'dealName'
  company: any
  contact: any
  stage: 'New' | 'Contacted' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost'
  amount: number
  value?: number  // API returns 'value', some components use 'amount'
  currency?: string
  ownerImage?: string
  activity?: string
  lastActivity?: string
  tags?: string
  closeDate?: string
  probability?: number | null
  description?: string
  source?: string
  priority?: string
  notes?: string
  files?: { url: string; name?: string; size?: number; mimeType?: string }[];
  contactId?: string | null
  companyId?: string | null
  spaceId?: string
  ownerId?: string
  userId?: string;
  owner?: {
    id: string;
    name?: string;
    email: string;
    image?: string;
  } | string;
  // New fields
  websiteUrl?: string
  linkedInUrl?: string
  industry?: string
  companySize?: string
  dealEmail?: string
  dealPhone?: string
  mainParticipantId?: string
  mainParticipant?: {
    id: string;
    name?: string;
    email: string;
    image?: string;
  }
  participants?: DealParticipant[]
  tasks?: DealTask[]
  attachments?: DealAttachment[]
  createdAt?: string;
  updatedAt?: string;
}

export type DealParticipant = {
  id: string
  dealId: string
  userId: string
  role: 'main' | 'member'
  user: {
    id: string
    name?: string
    email: string
    image?: string
  }
  createdAt: string
}

export type DealTask = {
  id: string
  dealId: string
  title: string
  description?: string
  dueDate?: string | null
  completed: boolean
  assigneeId?: string | null
  createdBy: string
  assignee?: {
    id: string
    name?: string
    email: string
    image?: string
  }
  creator?: {
    id: string
    name?: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

export type DealAttachment = {
  id: string
  dealId: string
  fileName: string
  filePath: string
  fileSize?: number | null
  mimeType?: string | null
  uploadedBy: string
  uploader?: {
    id: string
    name?: string
    email: string
  }
  createdAt: string
}
