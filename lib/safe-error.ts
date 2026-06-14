const SAFE_PATTERNS = [
  "no autorizado",
  "no tienes permisos",
  "debes iniciar sesión",
  "no encontrado",
  "no válid",
  "inválid",
  "debe ser",
  "no se puede",
  "supera el límite",
  "formato no permitido",
  "no configurado",
  "ya existe un usuario",
  "email inválido",
  "archivo o movimiento",
  "tipo de evidencia",
  "adjunto no encontrado",
  "movimiento no encontrado",
  "categoría",
  "fondo",
  "transferencia",
  "proyecto",
  "actividad",
  "meta debe",
];

/** Expone solo mensajes de negocio/validación; oculta errores internos de BD o APIs. */
export function toClientError(error: unknown, fallback = "Ocurrió un error inesperado."): string {
  if (!(error instanceof Error)) return fallback;

  const msg = error.message.trim();
  if (!msg) return fallback;

  const lower = msg.toLowerCase();
  const isSafe = SAFE_PATTERNS.some((pattern) => lower.includes(pattern));

  return isSafe ? msg : fallback;
}
