import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

// Serve uploaded deal attachment files
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params
    const filePath = path.join(process.cwd(), "uploads", ...pathSegments)

    // Security: prevent path traversal
    const resolved = path.resolve(filePath)
    if (!resolved.startsWith(path.join(process.cwd(), "uploads"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const fileBuffer = await readFile(resolved)

    // Determine content type from extension
    const ext = path.extname(resolved).toLowerCase()
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".bmp": "image/bmp",
      ".txt": "text/plain",
      ".csv": "text/csv",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".ppt": "application/vnd.ms-powerpoint",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }

    const contentType = mimeTypes[ext] || "application/octet-stream"
    const headers = new Headers()
    headers.set("Content-Type", contentType)
    headers.set("Content-Length", String(fileBuffer.length))

    // Inline for viewable types
    const inlineTypes = ["application/pdf", "image/", "text/"]
    const isInline = inlineTypes.some(t => contentType.startsWith(t))
    const fileName = pathSegments[pathSegments.length - 1]
    headers.set("Content-Disposition", `${isInline ? "inline" : "attachment"}; filename="${fileName}"`)

    return new NextResponse(fileBuffer, { headers })
  } catch (error) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
