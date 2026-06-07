"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { AuditAction, MovementType, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { computeEventKpis } from "@/lib/finance/event-stats";
import { toMovementRecord } from "@/lib/finance/map-movement";
import { ORG_SLUG, type EventOption, type EventSummary } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";

interface EventInput {
  name: string;
  date: string;
  goal?: number | null;
  description?: string;
}

async function getOrganizationId() {
  const organization = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });

  if (!organization) {
    throw new Error("Organización no configurada. Ejecuta npm run db:seed");
  }

  return organization.id;
}

async function assertCanWrite() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user?.id) {
    throw new Error("Debes iniciar sesión.");
  }

  if (role !== "ADMIN" && role !== "DIRECTIVA") {
    throw new Error("No tienes permisos para gestionar actividades.");
  }

  return session.user.id;
}

function mapEventSummary(
  event: {
    id: string;
    name: string;
    date: Date;
    goal: Prisma.Decimal | null;
    description: string | null;
    movements: Array<{ amount: Prisma.Decimal; movementType: MovementType }>;
  }
): EventSummary {
  const goal = event.goal ? Number(event.goal) : null;
  const kpis = computeEventKpis(event.movements, goal);

  return {
    id: event.id,
    name: event.name,
    date: event.date.toISOString(),
    goal,
    description: event.description,
    totalIncome: kpis.totalIncome,
    totalExpense: kpis.totalExpense,
    profit: kpis.profit,
    movementCount: kpis.movementCount,
    goalProgress: kpis.goalProgress,
  };
}

export async function fetchEvents(): Promise<EventSummary[]> {
  const organizationId = await getOrganizationId();

  const events = await prisma.fundraisingEvent.findMany({
    where: { organizationId },
    include: {
      movements: {
        where: { deletedAt: null },
        select: { amount: true, movementType: true },
      },
    },
    orderBy: [{ date: "desc" }, { name: "asc" }],
  });

  return events.map(mapEventSummary);
}

export async function getEventDetail(id: string) {
  const organizationId = await getOrganizationId();

  const event = await prisma.fundraisingEvent.findFirst({
    where: { id, organizationId },
    include: {
      movements: {
        where: { deletedAt: null },
        include: { fund: true, category: true, event: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!event) {
    throw new Error("Actividad no encontrada.");
  }

  const summary = mapEventSummary({
    id: event.id,
    name: event.name,
    date: event.date,
    goal: event.goal,
    description: event.description,
    movements: event.movements,
  });

  return {
    ...summary,
    movements: event.movements.map(toMovementRecord),
  };
}

export async function getEventOptions(): Promise<EventOption[]> {
  const organizationId = await getOrganizationId();

  const events = await prisma.fundraisingEvent.findMany({
    where: { organizationId },
    orderBy: [{ date: "desc" }, { name: "asc" }],
    select: { id: true, name: true, date: true, goal: true },
  });

  return events.map((event) => ({
    id: event.id,
    name: event.name,
    date: event.date.toISOString(),
    goal: event.goal ? Number(event.goal) : null,
  }));
}

export async function createEvent(input: EventInput) {
  try {
    const userId = await assertCanWrite();
    const organizationId = await getOrganizationId();

    const event = await prisma.fundraisingEvent.create({
      data: {
        organizationId,
        name: input.name.trim(),
        date: new Date(input.date),
        goal:
          input.goal != null && input.goal > 0
            ? new Prisma.Decimal(input.goal.toFixed(2))
            : null,
        description: input.description?.trim() || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.CREATE,
        entity: "fundraising_events",
        entityId: event.id,
        newValues: {
          name: event.name,
          date: event.date.toISOString(),
          goal: event.goal?.toString() ?? null,
        },
      },
    });

    revalidatePath("/events");

    return { success: true as const, id: event.id };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

export async function updateEvent(id: string, input: EventInput) {
  try {
    const userId = await assertCanWrite();
    const organizationId = await getOrganizationId();

    const existing = await prisma.fundraisingEvent.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new Error("Actividad no encontrada.");
    }

    const event = await prisma.fundraisingEvent.update({
      where: { id },
      data: {
        name: input.name.trim(),
        date: new Date(input.date),
        goal:
          input.goal != null && input.goal > 0
            ? new Prisma.Decimal(input.goal.toFixed(2))
            : null,
        description: input.description?.trim() || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.UPDATE,
        entity: "fundraising_events",
        entityId: event.id,
        oldValues: {
          name: existing.name,
          date: existing.date.toISOString(),
          goal: existing.goal?.toString() ?? null,
        },
        newValues: {
          name: event.name,
          date: event.date.toISOString(),
          goal: event.goal?.toString() ?? null,
        },
      },
    });

    revalidatePath("/events");
    revalidatePath(`/events/${id}`);

    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
