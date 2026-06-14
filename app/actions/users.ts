"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertAdmin } from "@/lib/auth-guards";
import { ORG_SLUG } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";
import { toClientError } from "@/lib/safe-error";
import { parseInput } from "@/lib/validations/parse";
import { inviteUserSchema, updateUserRoleSchema } from "@/lib/validations/schemas";

async function getOrganizationId() {
  const organization = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });

  if (!organization) {
    throw new Error("Organización no configurada.");
  }

  return organization.id;
}

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function listUsers() {
  await assertAdmin();

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      memberships: {
        select: { organization: { select: { slug: true } } },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    hasMembership: user.memberships.some((m) => m.organization.slug === ORG_SLUG),
  }));
}

export async function inviteUser(input: unknown) {
  try {
    const adminId = await assertAdmin();
    const data = parseInput(inviteUserSchema, input);
    const organizationId = await getOrganizationId();

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new Error("Ya existe un usuario con ese email.");
    }

    const plainPassword = data.password ?? generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: data.role,
        memberships: {
          create: {
            organizationId,
            role: data.role,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: adminId,
        action: AuditAction.CREATE,
        entity: "users",
        entityId: user.id,
        newValues: { email: user.email, role: user.role },
        metadata: { source: "admin_invite" },
      },
    });

    revalidatePath("/users");

    return {
      success: true as const,
      userId: user.id,
      email: user.email,
      temporaryPassword: data.password ? undefined : plainPassword,
    };
  } catch (error) {
    console.error("Error inviting user:", error);
    return {
      success: false as const,
      error: toClientError(error, "No se pudo crear el usuario."),
    };
  }
}

export async function updateUserRole(input: unknown) {
  try {
    const adminId = await assertAdmin();
    const { userId, role } = parseInput(updateUserRoleSchema, input);
    const organizationId = await getOrganizationId();

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { organizationId } } },
    });

    if (!existing) {
      throw new Error("Usuario no encontrado.");
    }

    if (existing.id === adminId && role !== Role.ADMIN) {
      throw new Error("No puedes quitarte el rol de administrador a ti mismo.");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    if (existing.memberships[0]) {
      await prisma.organizationMember.update({
        where: { id: existing.memberships[0].id },
        data: { role },
      });
    } else {
      await prisma.organizationMember.create({
        data: { organizationId, userId, role },
      });
    }

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: adminId,
        action: AuditAction.UPDATE,
        entity: "users",
        entityId: userId,
        oldValues: { role: existing.role },
        newValues: { role },
      },
    });

    revalidatePath("/users");

    return { success: true as const };
  } catch (error) {
    console.error("Error updating user role:", error);
    return {
      success: false as const,
      error: toClientError(error, "No se pudo actualizar el rol."),
    };
  }
}
