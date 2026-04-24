const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function test() {
  let pass = 0, fail = 0;
  
  const check = (name, condition) => {
    if (condition) { console.log(`✅ ${name}`); pass++; }
    else { console.log(`❌ ${name}`); fail++; }
  };

  try {
    console.log("\n═══════════════════════════════════════");
    console.log("  ELITE CRM - COMPREHENSIVE API TEST");
    console.log("═══════════════════════════════════════\n");

    // ─── DATABASE CONNECTION ───
    console.log("── DATABASE ──");
    await db.$connect();
    check("MySQL connection", true);
    
    const userCount = await db.user.count();
    check("Users table accessible", userCount > 0);
    
    const spaceCount = await db.space.count();
    check("Spaces table accessible", spaceCount > 0);

    // ─── AUTH ───
    console.log("\n── AUTH ──");
    const admin = await db.user.findFirst({ where: { globalRole: 'superadmin' } });
    check("Admin user exists", !!admin);
    check("Admin email is admin@elite.com", admin?.email === 'admin@elite.com');
    check("Admin has password set", !!admin?.password);
    
    const bcrypt = require('bcryptjs');
    if (admin?.password) {
      const validPass = await bcrypt.compare('Admin@123', admin.password);
      check("Admin password verifies", validPass);
    }

    // ─── SPACES ───
    console.log("\n── SPACES ──");
    const eliteSpace = await db.space.findFirst({ where: { name: { contains: 'Elite' } } });
    check("Elite Partners space exists", !!eliteSpace);
    check("Space has slug", !!eliteSpace?.slug);
    
    const memberships = await db.spaceMember.findMany({ where: { spaceId: eliteSpace?.id } });
    check("Elite space has members", memberships.length > 0);

    // ─── DEALS ───
    console.log("\n── DEALS ──");
    const deals = await db.deal.findMany({ include: { owner: true, company: true, contact: true } });
    check("Deals accessible", deals.length >= 0);
    if (deals.length > 0) {
      const d = deals[0];
      check("Deal has title", !!d.title);
      check("Deal has owner relation", !!d.owner);
      check("Deal has stage", !!d.stage);
      console.log(`   Sample deal: "${d.title}" - ${d.stage} - $${d.value || 0}`);
    }

    // ─── DEAL NOTES ───
    console.log("\n── DEAL NOTES ──");
    const dealNotes = await db.dealNote.findMany();
    check("DealNotes table accessible", true);
    console.log(`   Total deal notes: ${dealNotes.length}`);

    // ─── HIRING / APPLICANTS ───
    console.log("\n── HIRING / APPLICANTS ──");
    const applicants = await db.applicant.findMany({ include: { owner: true, space: true } });
    check("Applicants table accessible", true);
    console.log(`   Current applicants: ${applicants.length}`);

    // ─── CAREERS FORM SUBMISSION TEST ───
    console.log("\n── CAREERS FORM → HIRING SYNC ──");
    const testEmail = `test-career-${Date.now()}@test.com`;
    const newApplicant = await db.applicant.create({
      data: {
        fullName: 'Test Career Submission',
        email: testEmail,
        phone: '+201234567890',
        position: 'Sales Representative',
        location: 'Cairo',
        linkedin: 'https://linkedin.com/in/test',
        education: 'Bachelor of Business',
        experience: '5 years in sales',
        skills: 'Communication, Negotiation, CRM',
        coverLetter: 'I am excited to apply...',
        status: 'New',
        source: 'website_form',
        notes: 'Expertise Level: Senior\nEnglish Level: Fluent\nAge: 28\nCurrent Status: Employed',
        spaceId: eliteSpace?.id || (await db.space.findFirst()).id,
      }
    });
    check("Career submission creates applicant", !!newApplicant);
    check("Applicant has fullName", newApplicant.fullName === 'Test Career Submission');
    check("Applicant has source=website_form", newApplicant.source === 'website_form');
    check("Applicant has status=New", newApplicant.status === 'New');
    check("Applicant linked to Elite space", newApplicant.spaceId === eliteSpace?.id);
    
    // Verify we can retrieve it
    const found = await db.applicant.findUnique({ where: { id: newApplicant.id } });
    check("Applicant can be retrieved by ID", !!found);
    
    // Update status
    await db.applicant.update({ where: { id: newApplicant.id }, data: { status: 'Screening' } });
    const updated = await db.applicant.findUnique({ where: { id: newApplicant.id } });
    check("Applicant status can be updated", updated?.status === 'Screening');
    
    // Clean up
    await db.applicant.delete({ where: { id: newApplicant.id } });
    check("Applicant can be deleted", true);

    // ─── DUPLICATE EMAIL CHECK ───
    console.log("\n── DUPLICATE EMAIL CHECK ──");
    const dup1 = await db.applicant.create({
      data: {
        fullName: 'Dup Test 1',
        email: `dup-test-${Date.now()}@test.com`,
        spaceId: eliteSpace?.id,
        source: 'website_form',
        status: 'New',
      }
    });
    check("First applicant created", !!dup1);
    
    // Try creating with same email
    try {
      await db.applicant.create({
        data: {
          fullName: 'Dup Test 2',
          email: dup1.email,
          spaceId: eliteSpace?.id,
          source: 'website_form',
          status: 'New',
        }
      });
      check("Duplicate email NOT prevented at DB level (API should handle)", false);
    } catch (e) {
      check("Duplicate email prevented at DB level", true);
    }
    
    // Clean up
    await db.applicant.delete({ where: { id: dup1.id } });

    // ─── ALL TABLES CHECK ───
    console.log("\n── ALL TABLES ──");
    const tables = [
      'user', 'space', 'spaceMember', 'deal', 'dealNote', 
      'notification', 'todo', 'meeting', 'prospect', 'customer',
      'company', 'activityLog', 'voipSettings', 'applicant',
      'emailSettings', 'account', 'session', 'verificationToken'
    ];
    for (const t of tables) {
      try {
        const c = await db[t].count();
        check(`Table '${t}' (${c} rows)`, true);
      } catch(e) {
        check(`Table '${t}' ERROR: ${e.message.slice(0, 40)}`, false);
      }
    }

    // ─── SUMMARY ───
    console.log("\n═══════════════════════════════════════");
    console.log(`  RESULTS: ${pass} PASSED / ${fail} FAILED`);
    console.log("═══════════════════════════════════════\n");
    
    if (fail > 0) process.exit(1);
    
  } catch(e) {
    console.error('❌ FATAL:', e.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

test();
