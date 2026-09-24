import { prisma } from '../db.js';

const dos = (n) => String(n).padStart(2, '0');
const DIA_MS = 86_400_000;

// Claves de período en hora LOCAL del servidor (definir TZ, p. ej.
// America/Santiago): agrupar por UTC corre las ventas nocturnas al día
// siguiente.
function semanaISO(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // jueves de esa semana
  const primeraSemana = new Date(d.getFullYear(), 0, 4);
  const n = 1 + Math.round(((d - primeraSemana) / DIA_MS - 3 + ((primeraSemana.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-S${dos(n)}`;
}

export function clavePeriodo(fecha, agrupacion) {
  const d = new Date(fecha);
  if (agrupacion === 'mes') return `${d.getFullYear()}-${dos(d.getMonth() + 1)}`;
  if (agrupacion === 'semana') return semanaISO(d);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function inicioDelDia(fecha = new Date()) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Ventas pagadas agrupadas por período. Con `rellenar`, incluye los días sin
// ventas en 0 para que el gráfico no "salte" días.
export async function ventasPorPeriodo({ desde, hasta, agrupacion = 'dia', rellenar = false }) {
  const ventas = await prisma.venta.findMany({
    where: { estado: 'PAGADA', fecha: { gte: desde, lte: hasta } },
    select: { fecha: true, total: true },
    orderBy: { fecha: 'asc' },
  });

  const grupos = new Map();
  if (rellenar && agrupacion === 'dia' && desde) {
    for (let d = inicioDelDia(desde); d <= (hasta || new Date()); d.setDate(d.getDate() + 1)) {
      const k = clavePeriodo(d, 'dia');
      grupos.set(k, { periodo: k, cantidad: 0, total: 0 });
    }
  }
  for (const v of ventas) {
    const k = clavePeriodo(v.fecha, agrupacion);
    const g = grupos.get(k) || { periodo: k, cantidad: 0, total: 0 };
    g.cantidad += 1;
    g.total += v.total;
    grupos.set(k, g);
  }
  return [...grupos.values()];
}
