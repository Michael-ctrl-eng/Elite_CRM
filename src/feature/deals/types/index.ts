
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
  createdAt?: string;
  updatedAt?: string;
}
