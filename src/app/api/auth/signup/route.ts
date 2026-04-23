import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: "Signup is not available" }, { status: 404 })
}
