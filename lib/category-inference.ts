import { CategoryType, MovementType } from "@prisma/client";

const INCOME_RULES: Array<{ code: string; keywords: string[] }> = [
  { code: "INSCRIPCION_SOCIOS", keywords: ["inscripcion", "inscripción", "socio", "cuota social"] },
  { code: "BINGO", keywords: ["bingo", "carton", "cartón", "cartones"] },
  { code: "RIFA", keywords: ["rifa", "sorteo"] },
  { code: "COMPLETADA", keywords: ["completada", "completadas"] },
  { code: "DONACION", keywords: ["donacion", "donación", "donativo", "aporte"] },
  { code: "VENTA", keywords: ["venta", "ventas", "kiosco", "cocina"] },
];

const EXPENSE_RULES: Array<{ code: string; keywords: string[] }> = [
  { code: "MATERIALES", keywords: ["material", "materiales", "utiles", "útiles", "papeleria", "papelería"] },
  { code: "EVENTOS", keywords: ["evento", "eventos", "actividad", "actividades", "fiesta"] },
  { code: "PREMIOS", keywords: ["premio", "premios", "trofeo", "medalla"] },
  {
    code: "ALIMENTACION",
    keywords: [
      "colaciones solidarias",
      "colacion solidaria",
      "colación solidaria",
      "alimentacion",
      "alimentación",
      "comida",
      "colacion",
      "colación",
      "once",
    ],
  },
  { code: "MANTENCION", keywords: ["mantencion", "mantención", "reparacion", "reparación", "arreglo"] },
  { code: "INFRAESTRUCTURA", keywords: ["infraestructura", "techo", "patio", "construccion", "construcción"] },
  {
    code: "DONACION_GASTO",
    keywords: ["donacion", "donación", "donativo", "donativos", "donaciones", "aporte"],
  },
];

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function inferCategoryCode(
  description: string,
  movementType: MovementType
): string {
  const text = normalizeText(description);
  const rules = movementType === MovementType.INCOME ? INCOME_RULES : EXPENSE_RULES;

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => text.includes(normalizeText(keyword)))) {
      return rule.code;
    }
  }

  return movementType === MovementType.INCOME ? "OTROS" : "OTROS_GASTO";
}

export function inferCategoryType(movementType: MovementType): CategoryType {
  return movementType === MovementType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
}
