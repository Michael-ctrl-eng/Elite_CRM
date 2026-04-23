import { db } from "@/lib/db"
import { hash } from "bcryptjs"

async function seed() {
  console.log("🌱 Seeding Elite CRM...")

  // ─── Create Elite Partners Space ───
  const eliteSpace = await db.space.upsert({
    where: { slug: "elite-partners" },
    update: {},
    create: {
      name: "Elite Partners",
      slug: "elite-partners",
      description: "Elite Partners company workspace",
      industry: "Consulting",
      isActive: true,
    }
  })

  // ─── SuperAdmin ───
  const superAdmin = await db.user.upsert({
    where: { email: "admin@elite.com" },
    update: {
      password: await hash("super@admin1", 12),
      status: "Active",
      globalRole: "superadmin",
      name: "Elite SuperAdmin",
    },
    create: {
      name: "Elite SuperAdmin",
      email: "admin@elite.com",
      password: await hash("super@admin1", 12),
      status: "Active",
      globalRole: "superadmin",
      isDemo: false,
      lastSeen: new Date(),
    }
  })

  // ─── Ahmed Anwar - Manager ───
  const ahmed = await db.user.upsert({
    where: { email: "ahmedanwar161118@gmail.com" },
    update: {
      password: await hash("Ahmed@elite1", 12),
      status: "Active",
      globalRole: "manager",
      name: "Ahmed Anwar",
    },
    create: {
      name: "Ahmed Anwar",
      email: "ahmedanwar161118@gmail.com",
      password: await hash("Ahmed@elite1", 12),
      status: "Active",
      globalRole: "manager",
      isDemo: false,
      lastSeen: new Date(),
    }
  })

  // ─── Gaser Gamal - Manager ───
  const gaser = await db.user.upsert({
    where: { email: "gasergamal93@gmail.com" },
    update: {
      password: await hash("Gaser@elite1", 12),
      status: "Active",
      globalRole: "manager",
      name: "Gaser Gamal",
    },
    create: {
      name: "Gaser Gamal",
      email: "gasergamal93@gmail.com",
      password: await hash("Gaser@elite1", 12),
      status: "Active",
      globalRole: "manager",
      isDemo: false,
      lastSeen: new Date(),
    }
  })

  // ─── Elite Partners Admin ───
  const eliteAdmin = await db.user.upsert({
    where: { email: "elite@partners.com" },
    update: {
      password: await hash("Elite@admin1", 12),
      status: "Active",
      globalRole: "admin",
      name: "Elite Partners Admin",
    },
    create: {
      name: "Elite Partners Admin",
      email: "elite@partners.com",
      password: await hash("Elite@admin1", 12),
      status: "Active",
      globalRole: "admin",
      isDemo: false,
      lastSeen: new Date(),
    }
  })

  // ─── Space Memberships ───
  const memberships = [
    { userId: superAdmin.id, spaceId: eliteSpace.id, role: "admin" },
    { userId: ahmed.id, spaceId: eliteSpace.id, role: "manager" },
    { userId: gaser.id, spaceId: eliteSpace.id, role: "manager" },
    { userId: eliteAdmin.id, spaceId: eliteSpace.id, role: "admin" },
  ]

  for (const m of memberships) {
    await db.spaceMember.upsert({
      where: { userId_spaceId: { userId: m.userId, spaceId: m.spaceId } },
      update: { role: m.role },
      create: m,
    })
  }

  console.log("✅ Seed complete!")
  console.log("")
  console.log("🔑 Login Credentials:")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("  SuperAdmin:  admin@elite.com / super@admin1")
  console.log("  Admin:       elite@partners.com / Elite@admin1")
  console.log("  Manager:     ahmedanwar161118@gmail.com / Ahmed@elite1")
  console.log("  Manager:     gasergamal93@gmail.com / Gaser@elite1")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("🏢 Space: Elite Partners (elite-partners)")
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect())
