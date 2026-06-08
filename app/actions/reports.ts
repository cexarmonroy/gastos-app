"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildAssemblySnapshot, type AssemblyReportSnapshot } from "@/lib/finance/assembly-report";
import { toMovementRecord } from "@/lib/finance/map-movement";
import { ORG_SLUG } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";
import { fetchEvents } from "@/app/actions/events";
import { fetchProjects } from "@/app/actions/projects";

async function assertCanAccessReports() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user?.id) {
    throw new Error("Debes iniciar sesión.");
  }

  if (role !== "ADMIN" && role !== "DIRECTIVA") {
    throw new Error("No tienes permisos para ver reportes.");
  }
}

export async function fetchAssemblyReportData(year: string): Promise<AssemblyReportSnapshot> {
  await assertCanAccessReports();

  const organization = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });

  if (!organization) {
    throw new Error("Organización no configurada.");
  }

  const movements = await prisma.movement.findMany({
    where: { organizationId: organization.id, deletedAt: null },
    include: {
      fund: true,
      category: true,
      event: true,
      project: true,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const [eventSummaries, projectSummaries] = await Promise.all([
    fetchEvents(),
    fetchProjects(),
  ]);

  return buildAssemblySnapshot(
    movements.map(toMovementRecord),
    year,
    eventSummaries,
    projectSummaries
  );
}
