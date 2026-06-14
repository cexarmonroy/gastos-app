import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { authOptions } from "./auth";

type AuthSession = Session & { user: { id: string; role: string; email?: string | null } };

export async function assertAuthenticated(): Promise<AuthSession> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("No autorizado. Debes iniciar sesión.");
  }
  return session as AuthSession;
}

export async function assertRole(...roles: Role[]): Promise<AuthSession> {
  const session = await assertAuthenticated();
  if (!roles.includes(session.user.role as Role)) {
    throw new Error("No tienes permisos para esta acción.");
  }
  return session;
}

/** ADMIN o DIRECTIVA — operaciones de escritura financiera. */
export async function assertCanWrite(): Promise<string> {
  const session = await assertRole(Role.ADMIN, Role.DIRECTIVA);
  return session.user.id;
}

/** ADMIN o DIRECTIVA — conciliación, transferencias, reportes sensibles. */
export async function assertCanManage(): Promise<string> {
  const session = await assertRole(Role.ADMIN, Role.DIRECTIVA);
  return session.user.id;
}

/** Solo ADMIN — gestión de usuarios e invitaciones. */
export async function assertAdmin(): Promise<string> {
  const session = await assertRole(Role.ADMIN);
  return session.user.id;
}
