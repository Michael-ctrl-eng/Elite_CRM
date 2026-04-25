import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/voip/settings — Get current user's VoIP settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (session.user as any).id

    const settings = await db.voipSettings.findUnique({
      where: { userId },
    })

    if (!settings) {
      // Return defaults
      return NextResponse.json({
        sipServer: "",
        sipPort: "5060",
        wsPort: "8089",
        sipUsername: "",
        sipPassword: "",
        sipDomain: "",
        stunServer: "stun:stun.l.google.com:19302",
        turnServer: "",
        turnUsername: "",
        turnPassword: "",
        autoAnswer: false,
        doNotDisturb: false,
        callerId: "",
      })
    }

    // Don't expose password in GET
    return NextResponse.json({
      ...settings,
      sipPassword: settings.sipPassword ? "••••••••" : "",
      turnPassword: settings.turnPassword ? "••••••••" : "",
    })
  } catch (error) {
    console.error("VoIP Settings GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/voip/settings — Save VoIP settings
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await req.json()

    const {
      sipServer,
      sipPort,
      wsPort,
      sipUsername,
      sipPassword,
      sipDomain,
      stunServer,
      turnServer,
      turnUsername,
      turnPassword,
      autoAnswer,
      doNotDisturb,
      callerId,
    } = body

    // Build update data — don't overwrite password with mask
    const data: any = {
      sipServer: sipServer || "",
      sipPort: sipPort || "5060",
      wsPort: wsPort || "8089",
      sipUsername: sipUsername || "",
      sipDomain: sipDomain || "",
      stunServer: stunServer || "stun:stun.l.google.com:19302",
      turnServer: turnServer || "",
      turnUsername: turnUsername || "",
      autoAnswer: !!autoAnswer,
      doNotDisturb: !!doNotDisturb,
      callerId: callerId || "",
    }

    // Only update passwords if they're not the mask
    if (sipPassword && sipPassword !== "••••••••") {
      data.sipPassword = sipPassword
    }
    if (turnPassword && turnPassword !== "••••••••") {
      data.turnPassword = turnPassword
    }

    const settings = await db.voipSettings.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
        sipPassword: sipPassword && sipPassword !== "••••••••" ? sipPassword : "",
        turnPassword: turnPassword && turnPassword !== "••••••••" ? turnPassword : "",
      },
    })

    return NextResponse.json({
      ...settings,
      sipPassword: settings.sipPassword ? "••••••••" : "",
      turnPassword: settings.turnPassword ? "••••••••" : "",
    })
  } catch (error) {
    console.error("VoIP Settings POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
