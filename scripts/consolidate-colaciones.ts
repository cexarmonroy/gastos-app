import { PrismaClient } from "@prisma/client";

const ORG_SLUG = "cgpa";

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { slug: ORG_SLUG },
  });

  const colaciones = await prisma.category.findFirstOrThrow({
    where: { organizationId: organization.id, code: "ALIMENTACION" },
  });

  const legacy = await prisma.category.findFirst({
    where: { organizationId: organization.id, code: "COLACIONES_SOLIDARIAS" },
  });

  if (!legacy) {
    console.log("No hay categoría COLACIONES_SOLIDARIAS; nada que consolidar.");
    return;
  }

  const result = await prisma.movement.updateMany({
    where: {
      organizationId: organization.id,
      categoryId: legacy.id,
    },
    data: { categoryId: colaciones.id },
  });

  await prisma.category.update({
    where: { id: legacy.id },
    data: { active: false },
  });

  console.log(`Movimientos unificados en "Colaciones": ${result.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
