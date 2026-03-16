const row = {
    'Fechas ': '12/03/2026',
    'monto ': '$241.103',
    'Ingreso/Egreso': 'Ingreso',
    'descripción ': 'saldo inicio año ',
};

const rawDate = row["Fechas "] || row["Fecha"] || row["Date"] || "";
const rawAmount = row["monto "] || row["Monto"] || row["monto"] || "0";
const rawType = row["Ingreso/Egreso"] || row["tipo"] || row["Tipo"] || "Ingreso";
const rawDesc = row["descripción "] || row["Descripción"] || row["descripcion"] || "";

const cleanAmountStr = rawAmount.toString().replace(/[^0-9,\.-]+/g, "").replace(/\./g, "").replace(",", ".");
let amountClean = parseFloat(cleanAmountStr);

console.log({ rawAmount, cleanAmountStr, amountClean });
