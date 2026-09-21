import { format as formatDate } from "date-fns";
import type { Locale } from "date-fns";

/**
 * `Movement.date`, `FundraisingEvent.date` y `Transfer.date` son columnas
 * Postgres `@db.Date` (sin hora ni huso horario). En JS quedan ancladas a
 * medianoche UTC. Formatearlas con los getters locales de date-fns le resta
 * un día a cualquier huso horario detrás de UTC (p. ej. America/Santiago).
 * Estas funciones leen los componentes Y/M/D en UTC y reconstruyen una fecha
 * local a esa misma medianoche, para que formatear/agrupar/comparar dé el
 * día correcto sin importar la zona horaria del visor.
 */
export function toCalendarDate(value: Date | string): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function formatCalendarDate(
  value: Date | string,
  formatStr: string,
  options?: { locale?: Locale }
): string {
  return formatDate(toCalendarDate(value), formatStr, options);
}

export function toDateInputValue(value: Date | string): string {
  const cal = toCalendarDate(value);
  return `${cal.getFullYear()}-${String(cal.getMonth() + 1).padStart(2, "0")}-${String(cal.getDate()).padStart(2, "0")}`;
}

export function todayDateInputValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
