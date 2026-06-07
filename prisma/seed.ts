import { CategoryType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORG_SLUG = "cgpa";

const FUNDS = [
  {
    code: "CAJA_CHICA",
    name: "Caja Chica",
    description: "Dinero operativo para gastos menores del centro de padres.",
    sortOrder: 1,
  },
  {
    code: "FONDO_AHORRO",
    name: "Fondo de Ahorro",
    description: "Reservas para proyectos e infraestructura.",
    sortOrder: 2,
  },
] as const;

const CATEGORIES = [
  { code: "INSCRIPCION_SOCIOS", name: "Inscripción de socios", type: CategoryType.INCOME, sortOrder: 1 },
  { code: "BINGO", name: "Bingo", type: CategoryType.INCOME, sortOrder: 2 },
  { code: "RIFA", name: "Rifa", type: CategoryType.INCOME, sortOrder: 3 },
  { code: "COMPLETADA", name: "Completada", type: CategoryType.INCOME, sortOrder: 4 },
  { code: "DONACION", name: "Donación", type: CategoryType.INCOME, sortOrder: 5 },
  { code: "VENTA", name: "Venta", type: CategoryType.INCOME, sortOrder: 6 },
  { code: "OTROS", name: "Otros ingresos", type: CategoryType.INCOME, sortOrder: 99 },
  { code: "MATERIALES", name: "Materiales", type: CategoryType.EXPENSE, sortOrder: 10 },
  { code: "EVENTOS", name: "Eventos", type: CategoryType.EXPENSE, sortOrder: 11 },
  { code: "PREMIOS", name: "Premios", type: CategoryType.EXPENSE, sortOrder: 12 },
  { code: "ALIMENTACION", name: "Colaciones", type: CategoryType.EXPENSE, sortOrder: 13 },
  { code: "MANTENCION", name: "Mantención", type: CategoryType.EXPENSE, sortOrder: 14 },
  { code: "INFRAESTRUCTURA", name: "Infraestructura", type: CategoryType.EXPENSE, sortOrder: 15 },
  { code: "OTROS_GASTO", name: "Otros gastos", type: CategoryType.EXPENSE, sortOrder: 99 },
] as const;

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {
      name: "Centro de Padres y Apoderados",
      active: true,
    },
    create: {
      name: "Centro de Padres y Apoderados",
      slug: ORG_SLUG,
      active: true,
    },
  });

  for (const fund of FUNDS) {
    await prisma.fund.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: fund.code,
        },
      },
      update: {
        name: fund.name,
        description: fund.description,
        sortOrder: fund.sortOrder,
        active: true,
      },
      create: {
        organizationId: organization.id,
        code: fund.code,
        name: fund.name,
        description: fund.description,
        sortOrder: fund.sortOrder,
        active: true,
      },
    });
  }

  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: category.code,
        },
      },
      update: {
        name: category.name,
        type: category.type,
        sortOrder: category.sortOrder,
        active: true,
      },
      create: {
        organizationId: organization.id,
        code: category.code,
        name: category.name,
        type: category.type,
        sortOrder: category.sortOrder,
        active: true,
      },
    });
  }

  console.log(`Organización lista: ${organization.name} (${organization.slug})`);
  console.log(`Fondos: ${FUNDS.length}`);
  console.log(`Categorías: ${CATEGORIES.length}`);
}

main()
  .catch((error) => {
    console.error("Error en seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
