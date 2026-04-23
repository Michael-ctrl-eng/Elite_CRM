import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const spaceId = searchParams.get("spaceId")

    if (!spaceId) {
      return NextResponse.json({ customers: [], companies: [] })
    }

    // Fetch customers with phone numbers in the current space
    const customers = await db.customer.findMany({
      where: {
        spaceId,
        phone: { not: null },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
      orderBy: { name: "asc" },
    })

    // Fetch companies with phone numbers in the current space
    const companies = await db.company.findMany({
      where: {
        spaceId,
        phone: { not: null },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
      orderBy: { name: "asc" },
    })

    // Format response with type field
    const formattedCustomers = customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      type: "customer" as const,
    }))

    const formattedCompanies = companies.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      type: "company" as const,
    }))

    return NextResponse.json({
      customers: formattedCustomers,
      companies: formattedCompanies,
    })
  } catch (error) {
    console.error("VoIP contacts error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
