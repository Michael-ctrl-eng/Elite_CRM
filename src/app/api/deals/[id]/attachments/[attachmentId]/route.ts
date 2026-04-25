import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { readFile, unlink, stat } from "fs/promises"
import path from "path"

// GET /api/deals/[id]/attachments/[attachmentId] - Serve/preview an attachment
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id, attachmentId } = await params

    const attachment = await db.dealAttachment.findFirst({
      where: { id: attachmentId, dealId: id },
    })
    if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 })

    const fullPath = path.join(process.cwd(), attachment.filePath)
    const fileBuffer = await readFile(fullPath)

    // Return file with proper content type for inline preview
    const headers = new Headers()
    headers.set("Content-Type", attachment.mimeType || "application/octet-stream")
    headers.set("Content-Length", String(fileBuffer.length))

    // For PDFs, images, and text-based docs, allow inline display
    const inlineTypes = [
      "application/pdf",
      "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/bmp",
      "text/plain", "text/csv", "text/html",
    ]
    if (inlineTypes.includes(attachment.mimeType || "")) {
      headers.set("Content-Disposition", `inline; filename="${attachment.fileName}"`)
    } else {
      headers.set("Content-Disposition", `attachment; filename="${attachment.fileName}"`)
    }

    return new NextResponse(fileBuffer, { headers })
  } catch (error) {
    console.error("Attachment GET:", error)
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}

// DELETE /api/deals/[id]/attachments/[attachmentId] - Delete an attachment
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id, attachmentId } = await params

    const attachment = await db.dealAttachment.findFirst({
      where: { id: attachmentId, dealId: id },
    })
    if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 })

    // Delete file from disk
    try {
      const fullPath = path.join(process.cwd(), attachment.filePath)
      await unlink(fullPath)
    } catch (e) {
      // File may already be deleted, continue
    }

    // Delete DB record
    await db.dealAttachment.delete({ where: { id: attachmentId } })

    return NextResponse.json({ message: "Attachment deleted" })
  } catch (error) {
    console.error("Attachment DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
