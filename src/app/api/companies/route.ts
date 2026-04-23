import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const companySchema = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  status: z.enum(["Active", "FollowUp", "Inactive"]).default("Active"),
  notes: z.string().optional(),
  tags: z.string().optional(),
  address: z.string().optional(),
  spaceId: z.string(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = (session.user as any).id
    const globalRole = (session.user as any).globalRole
    const { searchParams } = new URL(req.url)
    const spaceId = searchParams.get("spaceId")

    // Build where clause
    const where: any = {}
    if (spaceId) {
      where.spaceId = spaceId
    } else if (globalRole !== "superadmin") {
      const memberships = await db.spaceMember.findMany({ where: { userId }, select: { spaceId: true } })
      where.spaceId = { in: memberships.map(m => m.spaceId) }
    }
    const status = searchParams.get("status")
    if (status) where.status = status
    const search = searchParams.get("search")
    if (search) where.name = { contains: search }

    const companies = await db.company.findMany({ where, include: { owner: { select: { id: true, name: true, email: true, image: true } } }, orderBy: { createdAt: "desc" } })
    return NextResponse.json(companies)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = (session.user as any).id
    let body = await req.json()

    // If no spaceId, use user's first space
    if (!body.spaceId) {
      const membership = await db.spaceMember.findFirst({ where: { userId }, orderBy: { joinedAt: "asc" } })
      if (!membership) return NextResponse.json({ error: "No space available" }, { status: 422 })
      body.spaceId = membership.spaceId
    }

    const data = companySchema.parse(body)
    const company = await db.company.create({ data: { ...data, ownerId: userId }, include: { owner: { select: { id: true, name: true } } } })
    await db.activityLog.create({ data: { action: "Create", entity: "Company", entityId: company.id, details: `Created company "${company.name}"`, spaceId: data.spaceId, userId } })
    return NextResponse.json(company, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
