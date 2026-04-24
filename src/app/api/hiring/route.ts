import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/hiring — List applicants for a space
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const spaceId = searchParams.get("spaceId")
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    if (!spaceId) return NextResponse.json({ error: "spaceId is required" }, { status: 400 })

    // Verify user has access to this space
    const membership = await db.spaceMember.findFirst({
      where: { userId: (session.user as any).id, spaceId },
    })
    if (!membership) return NextResponse.json({ error: "Access denied" }, { status: 403 })

    const where: any = { spaceId }
    if (status && status !== "all") where.status = status
    if (search) where.fullName = { contains: search, mode: "insensitive" }

    const applicants = await db.applicant.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    // Get stats
    const stats = await db.applicant.groupBy({
      by: ["status"],
      where: { spaceId },
      _count: { id: true },
    })

    return NextResponse.json({ applicants, stats })
  } catch (error) {
    console.error("Hiring GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/hiring — Create applicant (authenticated or public from website form)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Check if this is a public submission (from the website careers form)
    const apiKey = req.headers.get("x-api-key")
    const isPublicSubmission = apiKey === process.env.CAREERS_API_KEY

    if (!isPublicSubmission) {
      const session = await getServerSession(authOptions)
      if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const {
      fullName, email, phone, position, location, linkedin, portfolio,
      experience, education, skills, coverLetter, resumeUrl, voiceMessageUrl,
      videoUrl, status, source, notes, tags, spaceId, ownerId,
    } = body

    if (!fullName || !spaceId) {
      return NextResponse.json({ error: "fullName and spaceId are required" }, { status: 400 })
    }

    // For public submissions, verify the space exists
    if (isPublicSubmission) {
      const space = await db.space.findFirst({
        where: { slug: spaceId },
      })
      if (!space) return NextResponse.json({ error: "Invalid space" }, { status: 400 })

      const applicant = await db.applicant.create({
        data: {
          fullName,
          email: email || null,
          phone: phone || null,
          position: position || null,
          location: location || null,
          linkedin: linkedin || null,
          portfolio: portfolio || null,
          experience: experience || null,
          education: education || null,
          skills: skills || null,
          coverLetter: coverLetter || null,
          resumeUrl: resumeUrl || null,
          voiceMessageUrl: voiceMessageUrl || null,
          videoUrl: videoUrl || null,
          status: "New",
          source: source || "website_form",
          notes: notes || null,
          tags: tags || null,
          spaceId: space.id,
          ownerId: ownerId || null,
        },
        include: {
          owner: { select: { id: true, name: true, email: true, image: true } },
        },
      })

      return NextResponse.json(applicant, { status: 201 })
    }

    // Authenticated creation
    const applicant = await db.applicant.create({
      data: {
        fullName,
        email: email || null,
        phone: phone || null,
        position: position || null,
        location: location || null,
        linkedin: linkedin || null,
        portfolio: portfolio || null,
        experience: experience || null,
        education: education || null,
        skills: skills || null,
        coverLetter: coverLetter || null,
        resumeUrl: resumeUrl || null,
        voiceMessageUrl: voiceMessageUrl || null,
        videoUrl: videoUrl || null,
        status: status || "New",
        source: source || "manual",
        notes: notes || null,
        tags: tags || null,
        spaceId,
        ownerId: ownerId || (await getServerSession(authOptions))?.user ? ((await getServerSession(authOptions))!.user as any).id : null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    // Activity log
    const session = await getServerSession(authOptions)
    if (session?.user) {
      await db.activityLog.create({
        data: {
          action: "Create",
          entity: "Applicant",
          entityId: applicant.id,
          details: `New applicant "${fullName}" added`,
          spaceId,
          userId: (session.user as any).id,
        },
      })
    }

    return NextResponse.json(applicant, { status: 201 })
  } catch (error) {
    console.error("Hiring POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
