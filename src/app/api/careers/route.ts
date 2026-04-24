import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://elitepartnersus.com",
  "https://www.elitepartnersus.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
]

function getCorsHeaders(origin: string | null) {
  // Allow any Vercel preview deployment or known production domains
  const isAllowed = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith(".vercel.app") ||
    origin.endsWith(".elitepartnersus.com")
  )
  const allowOrigin = isAllowed ? origin : ALLOWED_ORIGINS[1] // default to www
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  }
}

// Handle CORS preflight
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin")
  return new NextResponse(null, { status: 200, headers: getCorsHeaders(origin) })
}

// POST /api/careers — Public endpoint for the website careers form
// Supports both JSON and FormData
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  const cors = getCorsHeaders(origin)

  try {
    const contentType = req.headers.get("content-type") || ""
    let body: Record<string, any>

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      // Parse as FormData — collect duplicate keys (like checkboxes) as arrays
      const formData = await req.formData()
      body = {}
      formData.forEach((value, key) => {
        if (value instanceof File) {
          // Skip file blobs — store only the name for now
          if (value.size > 0) body[key] = value.name || null
          return
        }
        // Handle duplicate keys (e.g. skills checkboxes): collect into arrays
        if (body[key] !== undefined) {
          if (Array.isArray(body[key])) {
            body[key].push(value)
          } else {
            body[key] = [body[key], value]
          }
        } else {
          body[key] = value
        }
      })
    } else {
      // Parse as JSON
      body = await req.json()
    }

    // Extract fields (supporting multiple field name formats from the website form)
    const fullName = body.fullName || body.full_name
    const email = body.email
    const phone = body.phone || body.whatsapp
    const position = body.field || body.position
    const location = body.city || body.location
    const linkedin = body.linkedin
    const education = body.education
    const experience = body.experience || body.work_experience
    const skills = Array.isArray(body.skills) ? body.skills.join(", ") : (body.skills || "")
    const coverLetter = body.notes || body.cover_message || body.coverLetter
    const videoUrl = body.videoUrl || body.video_url
    const voiceMessageUrl = body.voiceNoteUrl || body.voice_note_url || null

    const expertiseLevel = body.expertise_level || body.expertiseLevel
    const englishLevel = body.english_level || body.englishLevel
    const currentStatus = body.current_status || body.currentStatus
    const age = body.age ? String(body.age) : null

    if (!fullName || !email) {
      return NextResponse.json(
        { success: false, error: "Name and email are required" },
        { status: 400, headers: cors }
      )
    }

    // Check for duplicate email
    const existing = await db.applicant.findFirst({
      where: { email },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: "This email has already submitted an application." },
        { status: 409, headers: cors }
      )
    }

    // Find the "Elite" space (the main company space)
    const space = await db.space.findFirst({
      where: {
        OR: [
          { slug: "elite-partners" },
          { slug: "elite" },
          { name: { contains: "Elite" } },
        ],
      },
    })

    let targetSpaceId = space?.id
    if (!targetSpaceId) {
      // Fallback: use the first space
      const firstSpace = await db.space.findFirst()
      if (!firstSpace) {
        return NextResponse.json(
          { success: false, error: "No workspace found. Please set up the CRM first." },
          { status: 500, headers: cors }
        )
      }
      targetSpaceId = firstSpace.id
    }

    // Combine extra fields into notes if they don't have dedicated columns
    const extraInfo = [
      age ? `Age: ${age}` : null,
      currentStatus ? `Current Status: ${currentStatus}` : null,
      expertiseLevel ? `Expertise Level: ${expertiseLevel}` : null,
      englishLevel ? `English Level: ${englishLevel}` : null,
    ].filter(Boolean).join("\n")

    const fullNotes = [coverLetter, extraInfo].filter(Boolean).join("\n\n---\n\n")

    // Create applicant
    const applicant = await db.applicant.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        position: position || null,
        location: location || null,
        linkedin: linkedin || null,
        education: education || null,
        experience: experience || null,
        skills: skills || null,
        coverLetter: coverLetter || null,
        voiceMessageUrl: voiceMessageUrl || null,
        videoUrl: videoUrl || null,
        status: "New",
        source: "website_form",
        notes: fullNotes || null,
        spaceId: targetSpaceId!,
      },
    })

    return NextResponse.json(
      { success: true, id: applicant.id },
      { status: 200, headers: cors }
    )
  } catch (err) {
    console.error("Careers API error:", err)
    return NextResponse.json(
      { success: false, error: "Internal server error. Please try again." },
      { status: 500, headers: cors }
    )
  }
}
