import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// CORS headers - allow the main website to submit
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://elitepartnersus.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// POST /api/careers — Public endpoint for the website careers form
// Supports both JSON and FormData
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || ""
    let body: Record<string, any>

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      // Parse as FormData
      const formData = await req.formData()
      body = {}
      formData.forEach((value, key) => {
        // Skip File objects for now (we store URLs, not files)
        if (typeof value === "string") {
          body[key] = value
        } else if (value instanceof File) {
          // For voice notes - convert to base64 or skip
          // We'll store these as URLs in production; for now skip file blobs
          body[key] = value.name || null
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
    const skills = Array.isArray(body.skills) ? body.skills.join(", ") : (body.other_skills || body.skills || "")
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
        { status: 400, headers: corsHeaders }
      )
    }

    // Check for duplicate email
    const existing = await db.applicant.findFirst({
      where: { email },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: "This email has already submitted an application." },
        { status: 409, headers: corsHeaders }
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
          { status: 500, headers: corsHeaders }
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
      { status: 200, headers: corsHeaders }
    )
  } catch (err) {
    console.error("Careers API error:", err)
    return NextResponse.json(
      { success: false, error: "Internal server error. Please try again." },
      { status: 500, headers: corsHeaders }
    )
  }
}
