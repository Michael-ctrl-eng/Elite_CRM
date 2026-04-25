import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

// GET /api/deals/[id]/attachments - List attachments for a deal
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params

    const attachments = await db.dealAttachment.findMany({
      where: { dealId: id },
      include: {
        uploader: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(attachments)
  } catch (error) {
    console.error("Attachments GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/deals/[id]/attachments - Upload attachment for a deal
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const userId = (session.user as any).id

    // Verify deal exists
    const deal = await db.deal.findUnique({ where: { id } })
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 422 })

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 422 })
    }

    // Save file to disk
    const uploadsDir = path.join(process.cwd(), "uploads", "deals", id)
    await mkdir(uploadsDir, { recursive: true })

    const fileExt = path.extname(file.name) || ""
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${fileExt}`
    const filePath = path.join(uploadsDir, uniqueName)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    // Save attachment record to DB
    const attachment = await db.dealAttachment.create({
      data: {
        dealId: id,
        fileName: file.name,
        filePath: `/uploads/deals/${id}/${uniqueName}`,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        uploadedBy: userId,
      },
      include: {
        uploader: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error("Attachments POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
