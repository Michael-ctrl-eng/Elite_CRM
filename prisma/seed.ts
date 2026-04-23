import { db } from "@/lib/db"
import { hash } from "bcryptjs"

async function seed() {
  console.log("🌱 Seeding Elite CRM...")

  // ════════════════════════════════════════════════════
  // SPACE 1: Elite Partners (REAL - Production Space)
  // ════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════
  // SPACE 2: Demo Space (Demo / Testing)
  // ════════════════════════════════════════════════════
  const demoSpace = await db.space.upsert({
    where: { slug: "demo-space" },
    update: {},
    create: {
      name: "Demo Space",
      slug: "demo-space",
      description: "Demo workspace for testing and exploration — data shown is not real",
      industry: "Technology",
      isActive: true,
    }
  })

  // ════════════════════════════════════════════════════
  // REAL USERS (Elite Partners)
  // ════════════════════════════════════════════════════

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

  // ════════════════════════════════════════════════════
  // DEMO USERS (Demo Space)
  // ════════════════════════════════════════════════════

  const demoAdmin = await db.user.upsert({
    where: { email: "demo.admin@elite.com" },
    update: {},
    create: {
      name: "Demo Admin",
      email: "demo.admin@elite.com",
      password: await hash("Demo@admin1", 12),
      status: "Active",
      globalRole: "admin",
      isDemo: true,
      lastSeen: new Date(),
    }
  })

  const demoManager = await db.user.upsert({
    where: { email: "demo.manager@elite.com" },
    update: {},
    create: {
      name: "Sarah Demo",
      email: "demo.manager@elite.com",
      password: await hash("Demo@manager1", 12),
      status: "Active",
      globalRole: "manager",
      isDemo: true,
      lastSeen: new Date(),
    }
  })

  const demoViewer = await db.user.upsert({
    where: { email: "demo.viewer@elite.com" },
    update: {},
    create: {
      name: "Tom Viewer",
      email: "demo.viewer@elite.com",
      password: await hash("Demo@viewer1", 12),
      status: "Active",
      globalRole: "viewer",
      isDemo: true,
      lastSeen: new Date(),
    }
  })

  // ════════════════════════════════════════════════════
  // SPACE MEMBERSHIPS
  // ════════════════════════════════════════════════════

  // Elite Partners memberships
  const eliteMemberships = [
    { userId: superAdmin.id, spaceId: eliteSpace.id, role: "admin" },
    { userId: ahmed.id, spaceId: eliteSpace.id, role: "manager" },
    { userId: gaser.id, spaceId: eliteSpace.id, role: "manager" },
    { userId: eliteAdmin.id, spaceId: eliteSpace.id, role: "admin" },
  ]

  // Demo Space memberships
  const demoMemberships = [
    { userId: superAdmin.id, spaceId: demoSpace.id, role: "admin" },
    { userId: demoAdmin.id, spaceId: demoSpace.id, role: "admin" },
    { userId: demoManager.id, spaceId: demoSpace.id, role: "manager" },
    { userId: demoViewer.id, spaceId: demoSpace.id, role: "viewer" },
  ]

  const allMemberships = [...eliteMemberships, ...demoMemberships]
  for (const m of allMemberships) {
    await db.spaceMember.upsert({
      where: { userId_spaceId: { userId: m.userId, spaceId: m.spaceId } },
      update: { role: m.role },
      create: m,
    })
  }

  // ════════════════════════════════════════════════════
  // DEMO SPACE - Sample Data
  // ════════════════════════════════════════════════════

  // Sample companies for Demo Space
  const demoCompanies = []
  const companyNames = ["TechVista Inc", "BlueSky Solutions", "Digital Dynamics", "Nexus Group", "Pinnacle Systems"]
  for (const name of companyNames) {
    const c = await db.company.create({
      data: {
        name,
        email: `info@${name.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: "+1-555-0123",
        industry: "Technology",
        status: "Active",
        spaceId: demoSpace.id,
        ownerId: demoAdmin.id,
      }
    })
    demoCompanies.push(c)
  }

  // Sample customers for Demo Space
  const customerNames = ["Alice Johnson", "Bob Smith", "Carol Davis", "David Wilson", "Eva Martinez", "Frank Brown"]
  for (const name of customerNames) {
    await db.customer.create({
      data: {
        name,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        phone: "+1-555-0100",
        company: demoCompanies[Math.floor(Math.random() * demoCompanies.length)].name,
        status: "Active",
        value: Math.floor(Math.random() * 50000) + 5000,
        spaceId: demoSpace.id,
        ownerId: demoAdmin.id,
      }
    })
  }

  // Sample deals for Demo Space
  const stages = ["New", "Contacted", "Proposal", "Negotiation", "Won", "Lost"]
  const dealNames = ["Enterprise License Deal", "SaaS Annual Contract", "Platform Integration", "Data Migration Project", "Custom Development", "Support Package", "Cloud Migration", "Security Audit"]
  for (const name of dealNames) {
    await db.deal.create({
      data: {
        title: name,
        value: Math.floor(Math.random() * 100000) + 10000,
        currency: "USD",
        stage: stages[Math.floor(Math.random() * stages.length)],
        probability: Math.floor(Math.random() * 100),
        spaceId: demoSpace.id,
        ownerId: demoAdmin.id,
        companyId: demoCompanies[Math.floor(Math.random() * demoCompanies.length)].id,
      }
    })
  }

  // Sample todos for Demo Space
  const todoItems = [
    { title: "Follow up with TechVista", priority: "High", status: "Todo" },
    { title: "Prepare quarterly report", priority: "Medium", status: "InProgress" },
    { title: "Update CRM documentation", priority: "Low", status: "Todo" },
    { title: "Review partnership proposal", priority: "Urgent", status: "Todo" },
    { title: "Schedule team meeting", priority: "Medium", status: "Done" },
  ]
  for (const t of todoItems) {
    await db.todo.create({
      data: {
        title: t.title,
        priority: t.priority as any,
        status: t.status as any,
        dueDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000),
        spaceId: demoSpace.id,
        ownerId: demoAdmin.id,
      }
    })
  }

  // Sample meetings for Demo Space
  const meetingItems = [
    { title: "Sales Pipeline Review", status: "Scheduled" },
    { title: "Client Onboarding Call", status: "Confirmed" },
    { title: "Product Demo - BlueSky", status: "Scheduled" },
  ]
  for (const m of meetingItems) {
    await db.meeting.create({
      data: {
        title: m.title,
        status: m.status as any,
        startDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000 + 3600000),
        location: "Conference Room A",
        spaceId: demoSpace.id,
        ownerId: demoAdmin.id,
      }
    })
  }

  // Sample prospects for Demo Space
  const prospectNames = ["James Cooper", "Linda Zhao", "Mark Thompson", "Nina Patel"]
  const prospectStatuses = ["New", "Cold", "Qualified", "WarmLead"]
  for (const name of prospectNames) {
    await db.prospect.create({
      data: {
        name,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@prospecting.com`,
        phone: "+1-555-0200",
        status: prospectStatuses[Math.floor(Math.random() * prospectStatuses.length)] as any,
        value: Math.floor(Math.random() * 30000) + 5000,
        spaceId: demoSpace.id,
        ownerId: demoAdmin.id,
      }
    })
  }

  console.log("")
  console.log("✅ Seed complete!")
  console.log("")
  console.log("═══════════════════════════════════════════════════════")
  console.log("🏢 SPACE: Elite Partners (elite-partners) — PRODUCTION")
  console.log("═══════════════════════════════════════════════════════")
  console.log("  SuperAdmin:  admin@elite.com / super@admin1")
  console.log("  Admin:       elite@partners.com / Elite@admin1")
  console.log("  Manager:     ahmedanwar161118@gmail.com / Ahmed@elite1")
  console.log("  Manager:     gasergamal93@gmail.com / Gaser@elite1")
  console.log("")
  console.log("═══════════════════════════════════════════════════════")
  console.log("🏢 SPACE: Demo Space (demo-space) — DEMO / TESTING")
  console.log("═══════════════════════════════════════════════════════")
  console.log("  Admin:       demo.admin@elite.com / Demo@admin1")
  console.log("  Manager:     demo.manager@elite.com / Demo@manager1")
  console.log("  Viewer:      demo.viewer@elite.com / Demo@viewer1")
  console.log("  SuperAdmin:  admin@elite.com / super@admin1 (also member)")
  console.log("═══════════════════════════════════════════════════════")
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect())
