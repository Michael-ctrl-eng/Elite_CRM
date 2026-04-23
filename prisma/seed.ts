import { db } from "@/lib/db"
import { hash } from "bcryptjs"

async function seed() {
  console.log("🌱 Seeding Elite CRM...")

  // Create spaces
  const space1 = await db.space.upsert({
    where: { slug: "elite-hq" },
    update: {},
    create: { name: "Elite HQ", slug: "elite-hq", description: "Main Elite workspace", industry: "Technology" }
  })

  const space2 = await db.space.upsert({
    where: { slug: "acme-corp" },
    update: {},
    create: { name: "Acme Corp", slug: "acme-corp", description: "Acme Corporation workspace", industry: "Manufacturing" }
  })

  const space3 = await db.space.upsert({
    where: { slug: "global-solutions" },
    update: {},
    create: { name: "Global Solutions", slug: "global-solutions", description: "Global Solutions Inc workspace", industry: "Consulting" }
  })

  // SuperAdmin user
  const superAdmin = await db.user.upsert({
    where: { email: "admin@elite.com" },
    update: {},
    create: {
      name: "Elite SuperAdmin",
      email: "admin@elite.com",
      password: await hash("admin123", 12),
      status: "Active",
      globalRole: "superadmin",
      isDemo: false,
      lastSeen: new Date(),
    }
  })

  // Demo user
  const demoUser = await db.user.upsert({
    where: { email: "demo@elite.com" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@elite.com",
      password: await hash("demo123", 12),
      status: "Active",
      globalRole: "admin",
      isDemo: true,
      lastSeen: new Date(),
    }
  })

  // Manager user
  const manager = await db.user.upsert({
    where: { email: "manager@elite.com" },
    update: {},
    create: {
      name: "Sarah Manager",
      email: "manager@elite.com",
      password: await hash("manager123", 12),
      status: "Active",
      globalRole: "manager",
      isDemo: false,
      lastSeen: new Date(),
    }
  })

  // Viewer user
  const viewer = await db.user.upsert({
    where: { email: "viewer@elite.com" },
    update: {},
    create: {
      name: "Tom Viewer",
      email: "viewer@elite.com",
      password: await hash("viewer123", 12),
      status: "Active",
      globalRole: "viewer",
      isDemo: false,
      lastSeen: new Date(),
    }
  })

  // Add members to spaces
  const memberships = [
    { userId: superAdmin.id, spaceId: space1.id, role: "admin" },
    { userId: superAdmin.id, spaceId: space2.id, role: "admin" },
    { userId: superAdmin.id, spaceId: space3.id, role: "admin" },
    { userId: demoUser.id, spaceId: space1.id, role: "admin" },
    { userId: demoUser.id, spaceId: space2.id, role: "manager" },
    { userId: manager.id, spaceId: space1.id, role: "manager" },
    { userId: manager.id, spaceId: space3.id, role: "manager" },
    { userId: viewer.id, spaceId: space1.id, role: "viewer" },
  ]

  for (const m of memberships) {
    await db.spaceMember.upsert({
      where: { userId_spaceId: { userId: m.userId, spaceId: m.spaceId } },
      update: { role: m.role },
      create: m,
    })
  }

  // Create sample companies
  const companies = []
  const companyNames = ["TechVista Inc", "BlueSky Solutions", "Digital Dynamics", "Nexus Group", "Pinnacle Systems"]
  for (const name of companyNames) {
    const c = await db.company.create({
      data: { name, email: `info@${name.toLowerCase().replace(/\s+/g, '')}.com`, phone: "+1-555-0123", industry: "Technology", status: "Active", spaceId: space1.id, ownerId: demoUser.id }
    })
    companies.push(c)
  }

  // Create sample customers
  const customerNames = ["Alice Johnson", "Bob Smith", "Carol Davis", "David Wilson", "Eva Martinez", "Frank Brown"]
  for (const name of customerNames) {
    await db.customer.create({
      data: { name, email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`, phone: "+1-555-0100", company: companies[Math.floor(Math.random() * companies.length)].name, status: "Active", value: Math.floor(Math.random() * 50000) + 5000, spaceId: space1.id, ownerId: demoUser.id }
    })
  }

  // Create sample deals
  const stages = ["New", "Contacted", "Proposal", "Negotiation", "Won", "Lost"]
  const dealNames = ["Enterprise License Deal", "SaaS Annual Contract", "Platform Integration", "Data Migration Project", "Custom Development", "Support Package", "Cloud Migration", "Security Audit"]
  for (const name of dealNames) {
    await db.deal.create({
      data: { title: name, value: Math.floor(Math.random() * 100000) + 10000, currency: "USD", stage: stages[Math.floor(Math.random() * stages.length)], probability: Math.floor(Math.random() * 100), spaceId: space1.id, ownerId: demoUser.id, companyId: companies[Math.floor(Math.random() * companies.length)].id }
    })
  }

  // Create sample todos
  const todoItems = [
    { title: "Follow up with TechVista", priority: "High", status: "Todo" },
    { title: "Prepare quarterly report", priority: "Medium", status: "InProgress" },
    { title: "Update CRM documentation", priority: "Low", status: "Todo" },
    { title: "Review partnership proposal", priority: "Urgent", status: "Todo" },
    { title: "Schedule team meeting", priority: "Medium", status: "Done" },
  ]
  for (const t of todoItems) {
    await db.todo.create({
      data: { title: t.title, priority: t.priority as any, status: t.status as any, dueDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000), spaceId: space1.id, ownerId: demoUser.id }
    })
  }

  // Create sample meetings
  const meetingItems = [
    { title: "Sales Pipeline Review", status: "Scheduled" },
    { title: "Client Onboarding Call", status: "Confirmed" },
    { title: "Product Demo - BlueSky", status: "Scheduled" },
  ]
  for (const m of meetingItems) {
    const startHour = 9 + Math.floor(Math.random() * 8)
    await db.meeting.create({
      data: { title: m.title, status: m.status as any, startDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000), endDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000 + 3600000), location: "Conference Room A", spaceId: space1.id, ownerId: demoUser.id }
    })
  }

  // Create sample prospects
  const prospectNames = ["James Cooper", "Linda Zhao", "Mark Thompson", "Nina Patel"]
  const prospectStatuses = ["New", "Cold", "Qualified", "WarmLead"]
  for (const name of prospectNames) {
    await db.prospect.create({
      data: { name, email: `${name.toLowerCase().replace(/\s+/g, '.')}@prospecting.com`, phone: "+1-555-0200", status: prospectStatuses[Math.floor(Math.random() * prospectStatuses.length)] as any, value: Math.floor(Math.random() * 30000) + 5000, spaceId: space1.id, ownerId: demoUser.id }
    })
  }

  // Add data to space2
  const acmeCompanies = ["Stellar Industries", "Orion Manufacturing", "Atlas Engineering"]
  for (const name of acmeCompanies) {
    await db.company.create({
      data: { name, email: `contact@${name.toLowerCase().replace(/\s+/g, '')}.com`, industry: "Manufacturing", status: "Active", spaceId: space2.id, ownerId: superAdmin.id }
    })
  }

  for (let i = 0; i < 3; i++) {
    await db.deal.create({
      data: { title: `Acme Deal ${i + 1}`, value: 25000 + i * 15000, stage: stages[i] as any, currency: "USD", spaceId: space2.id, ownerId: superAdmin.id }
    })
  }

  console.log("✅ Seed complete!")
  console.log("")
  console.log("🔑 Login Credentials:")
  console.log("  SuperAdmin: admin@elite.com / admin123")
  console.log("  Demo User:  demo@elite.com / demo123")
  console.log("  Manager:    manager@elite.com / manager123")
  console.log("  Viewer:     viewer@elite.com / viewer123")
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect())
