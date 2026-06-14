import { PrismaClient } from "@prisma/client";

const TABLES = [
  "Organization",
  "OrganizationMember",
  "User",
  "Fund",
  "Category",
  "Movement",
  "Transfer",
  "FundraisingEvent",
  "Project",
  "AuditLog",
  "ReconciliationLog",
  "Attachment",
];

const prisma = new PrismaClient();

async function main() {
  console.log("Habilitando RLS en tablas públicas...");

  for (const table of TABLES) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    console.log(`  ✓ ${table}`);
  }

  console.log("\nVerificación post-aplicación:");
  const rlsStatus = await prisma.$queryRaw<
    Array<{ table_name: string; rls_enabled: boolean }>
  >`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname = ANY(${TABLES}::text[])
    ORDER BY c.relname
  `;

  for (const row of rlsStatus) {
    console.log(`  ${row.table_name}: ${row.rls_enabled ? "HABILITADO" : "DESHABILITADO"}`);
  }
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
