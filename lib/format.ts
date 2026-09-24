const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const compactClp = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "$1.234.567" */
export const formatCLP = (n: number) => clp.format(n);

/** "+$12.000" / "−$8.500" */
export const formatSignedCLP = (n: number, isIncome: boolean) =>
  (isIncome ? "+" : "−") + clp.format(Math.abs(n));

/** Ejes de gráficos: "$1,2 M" */
export const formatCompactCLP = (n: number) => `$${compactClp.format(n)}`;
