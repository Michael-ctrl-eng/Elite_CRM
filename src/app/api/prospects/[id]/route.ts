import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const item = await db.prospect.findUnique({ where: { id }, include: { owner: { select: { id: true, name: true, email: true, image: true } }, companyRel: { select: { id: true, name: true } } } })
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(item)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const userId = (session.user as any).id
    const item = await db.prospect.update({ where: { id }, data: body })
    await db.activityLog.create({ data: { action: "Update", entity: "Prospect", entityId: id, details: `Updated prospect "${item.name}"`, spaceId: item.spaceId, userId } })
    return NextResponse.json(item)
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const userId = (session.user as any).id
    const item = await db.prospect.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await db.prospect.delete({ where: { id } })
    await db.activityLog.create({ data: { action: "Delete", entity: "Prospect", entityId: id, details: `Deleted prospect "${item.name}"`, spaceId: item.spaceId, userId } })
    return NextResponse.json({ message: "Deleted" })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}
