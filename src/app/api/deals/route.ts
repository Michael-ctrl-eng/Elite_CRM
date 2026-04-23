import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const dealSchema = z.object({
  title: z.string().min(1),
  value: z.number().optional(),
  currency: z.enum(["USD", "EUR", "GBP"]).default("USD"),
  stage: z.enum(["New", "Contacted", "Proposal", "Negotiation", "Won", "Lost"]).default("New"),
  probability: z.number().min(0).max(100).optional(),
  closeDate: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
  source: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  spaceId: z.string(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const spaceId = searchParams.get("spaceId")
    if (!spaceId) return NextResponse.json({ error: "spaceId required" }, { status: 422 })

    const where: any = { spaceId }
    const stage = searchParams.get("stage")
    if (stage) where.stage = stage
    const search = searchParams.get("search")
    if (search) where.title = { contains: search }

    const deals = await db.deal.findMany({
      where,
      include: { 
        owner: { select: { id: true, name: true, email: true, image: true } },
        contact: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(deals)
  } catch (error) {
    console.error("Deals GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const data = dealSchema.parse(body)
    const userId = (session.user as any).id

    const deal = await db.deal.create({
      data: {
        ...data,
        closeDate: data.closeDate ? new Date(data.closeDate) : undefined,
        ownerId: userId,
      },
      include: { owner: { select: { id: true, name: true } } }
    })

    await db.activityLog.create({
      data: { action: "Create", entity: "Deal", entityId: deal.id, details: `Created deal "${deal.title}"`, spaceId: data.spaceId, userId }
    })

    return NextResponse.json(deal, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
