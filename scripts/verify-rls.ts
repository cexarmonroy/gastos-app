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
  const rlsStatus = await prisma.$queryRaw<
    Array<{ table_name: string; rls_enabled: boolean; rls_forced: boolean }>
  >`
    SELECT
      c.relname AS table_name,
      c.relrowsecurity AS rls_enabled,
      c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname = ANY(${TABLES}::text[])
    ORDER BY c.relname
  `;

  const policies = await prisma.$queryRaw<
    Array<{ tablename: string; policyname: string; roles: string[]; cmd: string }>
  >`
    SELECT tablename, policyname, roles, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `;

  console.log("=== RLS POR TABLA ===");
  for (const table of TABLES) {
    const row = rlsStatus.find((r) => r.table_name === table);
    if (!row) {
      console.log(`${table}: NO EXISTE`);
      continue;
    }
    const status = row.rls_enabled ? "HABILITADO" : "DESHABILITADO";
    const forced = row.rls_forced ? " (forzado)" : "";
    console.log(`${table}: ${status}${forced}`);
  }

  console.log("\n=== POLÍTICAS RLS ===");
  if (policies.length === 0) {
    console.log("Ninguna política definida (acceso vía PostgREST = deny all si RLS está ON)");
  } else {
    for (const p of policies) {
      console.log(`${p.tablename} → ${p.policyname} [${p.cmd}] roles=${p.roles.join(",")}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
