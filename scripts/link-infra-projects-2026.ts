import { PrismaClient, ProjectFundingMode, ProjectStatus } from "@prisma/client";

const ORG_SLUG = "cgpa";
const FUND_CODE = "FONDO_AHORRO";
const CATEGORY_CODE = "INFRAESTRUCTURA";

const INFRA_PROJECTS = [
  {
    name: "Pasto sintético patio colegio",
    targetAmount: 1_623_410,
    movementId: "4e66a7eb-0851-4d01-8e46-7d83e5e3e2e7",
    description:
      "Instalación de pasto sintético en el patio del colegio. Inversión Fondo de Ahorro 2026.",
    movementDescription: "Pasto sintético patio colegio",
  },
  {
    name: "Refrigerador área convivencia escolar",
    targetAmount: 211_980,
    movementId: "3168dd3c-6d92-41e3-978f-a30145a3035e",
    description:
      "Refrigerador para el área de convivencia escolar. Inversión Fondo de Ahorro 2026.",
    movementDescription: "Refrigerador área convivencia escolar",
  },
  {
    name: "Instalación pasto sintético párvulo",
    targetAmount: 689_540,
    movementId: "97b4d1d2-8389-41b5-b8c1-211d912fa2c6",
    description:
      "Instalación de pasto sintético en párvulo. Inversión Fondo de Ahorro 2026.",
    movementDescription: "Instalación pasto sintético párvulo",
  },
] as const;

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { slug: ORG_SLUG },
  });

  const fund = await prisma.fund.findFirstOrThrow({
    where: { organizationId: organization.id, code: FUND_CODE },
  });

  const category = await prisma.category.findFirst({
    where: { organizationId: organization.id, code: CATEGORY_CODE, active: true },
  });

  if (!category) {
    throw new Error(`Categoría ${CATEGORY_CODE} no encontrada. Ejecuta npm run db:seed`);
  }

  console.log(`Organización: ${organization.name}`);
  console.log(`Fondo: ${fund.name}`);
  console.log(`Categoría destino: ${category.name}\n`);

  for (const spec of INFRA_PROJECTS) {
    const movement = await prisma.movement.findFirst({
      where: {
        id: spec.movementId,
        organizationId: organization.id,
        fundId: fund.id,
        deletedAt: null,
        movementType: "EXPENSE",
      },
    });

    if (!movement) {
      throw new Error(`Movimiento no encontrado: ${spec.movementId} (${spec.name})`);
    }

    const amount = Number(movement.amount);
    if (Math.abs(amount - spec.targetAmount) > 0.01) {
      throw new Error(
        `Monto distinto para "${spec.name}": esperado ${spec.targetAmount}, encontrado ${amount}`
      );
    }

    let project = await prisma.project.findFirst({
      where: { organizationId: organization.id, name: spec.name },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          organizationId: organization.id,
          name: spec.name,
          targetAmount: spec.targetAmount,
          status: ProjectStatus.COMPLETED,
          fundingMode: ProjectFundingMode.EXECUTION,
          description: spec.description,
        },
      });
      console.log(`✓ Proyecto creado: ${project.name}`);
    } else {
      project = await prisma.project.update({
        where: { id: project.id },
        data: {
          targetAmount: spec.targetAmount,
          status: ProjectStatus.COMPLETED,
          fundingMode: ProjectFundingMode.EXECUTION,
          description: spec.description,
        },
      });
      console.log(`✓ Proyecto actualizado: ${project.name}`);
    }

    const updatedMovement = await prisma.movement.update({
      where: { id: movement.id },
      data: {
        projectId: project.id,
        categoryId: category.id,
        description: spec.movementDescription,
      },
    });

    console.log(
      `  → Movimiento ${updatedMovement.date.toISOString().slice(0, 10)} ` +
        `$${Number(updatedMovement.amount).toLocaleString("es-CL")} vinculado`
    );
  }

  const total = INFRA_PROJECTS.reduce((sum, item) => sum + item.targetAmount, 0);
  console.log(`\nListo. ${INFRA_PROJECTS.length} proyectos, inversión total: $${total.toLocaleString("es-CL")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
