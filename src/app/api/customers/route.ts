import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  status: z.enum(["Active", "FollowUp", "Inactive"]).default("Active"),
  value: z.number().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  address: z.string().optional(),
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
    const status = searchParams.get("status")
    if (status) where.status = status
    const search = searchParams.get("search")
    if (search) where.name = { contains: search }

    const customers = await db.customer.findMany({ where, include: { owner: { select: { id: true, name: true, email: true, image: true } }, companyRel: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } })
    return NextResponse.json(customers)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await req.json()
    const data = customerSchema.parse(body)
    const userId = (session.user as any).id
    const customer = await db.customer.create({ data: { ...data, ownerId: userId }, include: { owner: { select: { id: true, name: true } } } })
    await db.activityLog.create({ data: { action: "Create", entity: "Customer", entityId: customer.id, details: `Created customer "${customer.name}"`, spaceId: data.spaceId, userId } })
    return NextResponse.json(customer, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 422 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
