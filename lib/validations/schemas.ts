import { z } from "zod";
import { AttachmentType, ProjectFundingMode, ProjectStatus, Role } from "@prisma/client";

const optionalUuid = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z.string().uuid().optional()
);

export const fundTabSchema = z.enum(["caja_chica", "fondo_ahorro"]);
export const movementTypeLabelSchema = z.enum(["Ingreso", "Egreso"]);

export const createMovementSchema = z.object({
  date: z.string().min(1, "La fecha es obligatoria."),
  amount: z.number().positive("El monto debe ser mayor a cero."),
  type: movementTypeLabelSchema,
  description: z.string().trim().min(1, "La descripción es obligatoria.").max(500),
  fund: fundTabSchema,
  categoryId: optionalUuid,
  eventId: optionalUuid,
  projectId: optionalUuid,
});

export const updateMovementSchema = createMovementSchema.extend({
  id: z.string().uuid("ID de movimiento inválido."),
});

export const applyCategorySuggestionSchema = z.object({
  movementId: z.string().uuid("ID de movimiento inválido."),
  categoryId: z.string().uuid("ID de categoría inválido."),
});

export const bulkCategorySuggestionSchema = z.object({
  movementIds: z.array(z.string().uuid()).min(1, "Selecciona al menos un movimiento."),
  categoryId: z.string().uuid("ID de categoría inválido."),
});

export const attachmentUploadSchema = z.object({
  movementId: z.string().uuid("ID de movimiento inválido."),
  attachmentType: z.nativeEnum(AttachmentType),
  supersedesId: optionalUuid,
});

export const createEventSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
  date: z.string().min(1, "La fecha es obligatoria."),
  goal: z.number().positive().nullable().optional(),
  description: z.string().trim().max(1000).optional(),
});

export const updateEventSchema = z.object({
  id: z.string().uuid("ID de actividad inválido."),
  input: createEventSchema,
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
  targetAmount: z.number().positive("La meta debe ser mayor a cero."),
  status: z.nativeEnum(ProjectStatus).optional(),
  fundingMode: z.nativeEnum(ProjectFundingMode).optional(),
  description: z.string().trim().max(1000).optional(),
});

export const updateProjectSchema = z.object({
  id: z.string().uuid("ID de proyecto inválido."),
  input: createProjectSchema,
});

export const createTransferSchema = z.object({
  fromFund: fundTabSchema,
  toFund: fundTabSchema,
  amount: z.number().positive("El monto debe ser mayor a cero."),
  date: z.string().min(1, "La fecha es obligatoria."),
  description: z.string().trim().max(500),
}).refine((data) => data.fromFund !== data.toFund, {
  message: "El fondo origen y destino deben ser distintos.",
  path: ["toFund"],
});

export const inviteUserSchema = z.object({
  email: z.string().email("Email inválido.").transform((e) => e.toLowerCase().trim()),
  role: z.nativeEnum(Role),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(128)
    .optional(),
});

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid("ID de usuario inválido."),
  role: z.nativeEnum(Role),
});

export const voidMovementSchema = z.object({
  id: z.string().uuid("ID de movimiento inválido."),
});

export const attachmentIdSchema = z.object({
  attachmentId: z.string().uuid("ID de adjunto inválido."),
});
