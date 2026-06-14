"use server";

import { revalidatePath } from "next/cache";
import { AttachmentType, AuditAction } from "@prisma/client";
import { assertAuthenticated, assertCanWrite } from "@/lib/auth-guards";
import { ORG_SLUG } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";
import {
  buildStoragePath,
  createSignedDownloadUrl,
  getStorageAdmin,
  getStorageBucket,
  isStorageConfigured,
} from "@/lib/supabase/storage";
import { validateFileContent } from "@/lib/file-validation";
import { toClientError } from "@/lib/safe-error";
import { parseInput } from "@/lib/validations/parse";
import { attachmentIdSchema, attachmentUploadSchema } from "@/lib/validations/schemas";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  RECEIPT: "Boleta",
  INVOICE: "Factura",
  TRANSFER: "Comprobante transferencia",
  QUOTE: "Cotización",
  OTHER: "Otro",
};

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

export async function getStorageStatus() {
  await assertAuthenticated();
  return { configured: isStorageConfigured(), bucket: getStorageBucket() };
}

export async function getMovementAttachments(movementId: string) {
  await assertCanWrite();
  const organizationId = await getOrganizationId();

  const attachments = await prisma.attachment.findMany({
    where: { organizationId, movementId },
    include: { uploadedBy: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return attachments.map((item) => ({
    id: item.id,
    fileName: item.fileName,
    mimeType: item.mimeType,
    fileSize: item.fileSize,
    attachmentType: item.attachmentType,
    attachmentTypeLabel: ATTACHMENT_TYPE_LABELS[item.attachmentType],
    uploadedByEmail: item.uploadedBy?.email ?? "Sistema",
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function uploadMovementAttachment(formData: FormData) {
  try {
    if (!isStorageConfigured()) {
      return {
        success: false as const,
        error: "Supabase Storage no está configurado. Contacta al administrador.",
      };
    }

    const userId = await assertCanWrite();
    const organizationId = await getOrganizationId();
    const movementId = String(formData.get("movementId") ?? "");
    const attachmentType = String(formData.get("attachmentType") ?? "OTHER");
    const file = formData.get("file");

    const validated = parseInput(attachmentUploadSchema, {
      movementId,
      attachmentType,
    });

    if (!(file instanceof File)) {
      return { success: false as const, error: "Archivo o movimiento inválido." };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { success: false as const, error: "El archivo supera el límite de 5 MB." };
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return {
        success: false as const,
        error: "Formato no permitido. Usa PDF, JPG, PNG o WEBP.",
      };
    }

    const movement = await prisma.movement.findFirst({
      where: { id: validated.movementId, organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!movement) {
      return { success: false as const, error: "Movimiento no encontrado." };
    }

    const storagePath = buildStoragePath(ORG_SLUG, validated.movementId, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileValidation = validateFileContent(new Uint8Array(buffer), file.type);

    if (!fileValidation.valid) {
      return { success: false as const, error: fileValidation.error };
    }

    const supabase = getStorageAdmin();

    const { error: uploadError } = await supabase.storage
      .from(getStorageBucket())
      .upload(storagePath, buffer, { contentType: fileValidation.mimeType, upsert: false });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const attachment = await prisma.attachment.create({
      data: {
        organizationId,
        movementId: validated.movementId,
        fileName: file.name,
        storagePath,
        mimeType: fileValidation.mimeType,
        fileSize: file.size,
        attachmentType: validated.attachmentType,
        uploadedById: userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.CREATE,
        entity: "attachments",
        entityId: attachment.id,
        newValues: {
          movementId: validated.movementId,
          fileName: file.name,
          attachmentType: validated.attachmentType,
          fileSize: file.size,
        },
      },
    });

    revalidatePath("/records");
    revalidatePath("/audit");

    return { success: true as const, attachmentId: attachment.id };
  } catch (error) {
    console.error("Error uploading attachment:", error);
    return {
      success: false as const,
      error: toClientError(error, "Error al subir el archivo."),
    };
  }
}

export async function deleteMovementAttachment(attachmentId: string) {
  try {
    if (!isStorageConfigured()) {
      return { success: false as const, error: "Supabase Storage no está configurado." };
    }

    const { attachmentId: id } = parseInput(attachmentIdSchema, { attachmentId });
    const userId = await assertCanWrite();
    const organizationId = await getOrganizationId();

    const attachment = await prisma.attachment.findFirst({
      where: { id, organizationId },
    });

    if (!attachment) {
      return { success: false as const, error: "Adjunto no encontrado." };
    }

    const supabase = getStorageAdmin();
    await supabase.storage.from(getStorageBucket()).remove([attachment.storagePath]);

    await prisma.attachment.delete({ where: { id: attachment.id } });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.DELETE,
        entity: "attachments",
        entityId: attachment.id,
        oldValues: {
          movementId: attachment.movementId,
          fileName: attachment.fileName,
          attachmentType: attachment.attachmentType,
        },
      },
    });

    revalidatePath("/records");
    revalidatePath("/audit");

    return { success: true as const };
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return {
      success: false as const,
      error: toClientError(error, "Error al eliminar el adjunto."),
    };
  }
}

export async function getAttachmentDownloadUrl(attachmentId: string) {
  try {
    const { attachmentId: id } = parseInput(attachmentIdSchema, { attachmentId });
    await assertCanWrite();
    const organizationId = await getOrganizationId();

    const attachment = await prisma.attachment.findFirst({
      where: { id, organizationId },
      select: { storagePath: true, fileName: true },
    });

    if (!attachment) {
      return { success: false as const, error: "Adjunto no encontrado." };
    }

    const url = await createSignedDownloadUrl(attachment.storagePath);
    return { success: true as const, url, fileName: attachment.fileName };
  } catch (error) {
    return {
      success: false as const,
      error: toClientError(error, "No se pudo descargar el archivo."),
    };
  }
}

export async function getAttachmentTypeOptions() {
  await assertAuthenticated();
  return Object.entries(ATTACHMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));
}
