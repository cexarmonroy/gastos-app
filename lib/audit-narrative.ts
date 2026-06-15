import type { AuditAction } from "@prisma/client";
import {
  AUDIT_ACTION_LABELS,
  formatAuditEntity,
  formatAuditField,
  formatAuditValue,
} from "./audit-labels";

export interface AuditLogNarrativeInput {
  action: AuditAction | string;
  entity: string;
  userEmail: string;
  oldValues?: unknown;
  newValues?: unknown;
  metadata?: unknown;
}

function userLabel(email: string): string {
  if (email === "Sistema") return "Sistema";
  const local = email.split("@")[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function describeChange(oldValues: unknown, newValues: unknown): string | null {
  if (!oldValues || !newValues || typeof oldValues !== "object" || typeof newValues !== "object") {
    return null;
  }

  const oldObj = oldValues as Record<string, unknown>;
  const newObj = newValues as Record<string, unknown>;
  const changes: string[] = [];

  for (const key of Object.keys(newObj)) {
    const before = oldObj[key];
    const after = newObj[key];
    if (before !== after && after !== undefined) {
      changes.push(
        `${formatAuditField(key)}: ${formatAuditValue(key, before)} → ${formatAuditValue(key, after)}`
      );
    }
  }

  return changes.length > 0 ? changes.join(", ") : null;
}

export function formatAuditNarrative(log: AuditLogNarrativeInput): string {
  const who = userLabel(log.userEmail);
  const actionLabel = AUDIT_ACTION_LABELS[log.action] ?? String(log.action);
  const entityLabel = formatAuditEntity(log.entity);
  const meta =
    log.metadata && typeof log.metadata === "object"
      ? (log.metadata as Record<string, unknown>)
      : null;

  if (log.action === "LOGIN_FAILED") {
    const email = meta?.email ? ` (${meta.email})` : "";
    return `${who} — intento de inicio de sesión fallido${email}`;
  }

  if (log.action === "SECURITY_ALERT") {
    const event = meta?.event ? ` — ${meta.event}` : "";
    const ip = meta?.ip ? ` desde ${meta.ip}` : "";
    return `Alerta de seguridad${event}${ip}`;
  }

  if (log.action === "EXPORT") {
    const format = meta?.format ? String(meta.format).toUpperCase() : "datos";
    const source = meta?.source ? ` (${meta.source})` : "";
    const count = meta?.recordCount != null ? ` — ${meta.recordCount} registros` : "";
    return `${who} exportó ${format}${source}${count}`;
  }

  if (log.action === "IMPORT") {
    return `${who} importó datos en ${entityLabel}`;
  }

  if (log.action === "CREATE" && log.entity === "users") {
    const email = meta?.email ?? (log.newValues as Record<string, unknown>)?.email;
    return `${who} invitó usuario${email ? ` ${email}` : ""}`;
  }

  if (meta?.bulk === true && meta?.categoryName) {
    return `${who} categorizó ${meta.count} movimientos como "${meta.categoryName}"`;
  }

  const change = describeChange(log.oldValues, log.newValues);
  if (change) {
    return `${who} ${actionLabel.toLowerCase()} ${entityLabel.toLowerCase()}: ${change}`;
  }

  const description =
    (log.newValues as Record<string, unknown>)?.description ??
    (log.oldValues as Record<string, unknown>)?.description;

  if (description) {
    return `${who} ${actionLabel.toLowerCase()} ${entityLabel.toLowerCase()}: "${description}"`;
  }

  return `${who} ${actionLabel.toLowerCase()} ${entityLabel.toLowerCase()}`;
}
