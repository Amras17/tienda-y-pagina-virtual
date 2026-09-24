import { prisma } from '../db.js';

// Costo unitario vigente por insumo: el del lote más reciente (aproxima el
// costo de reposición actual) o, si aún no tiene lotes, el de referencia.
async function costosVigentes() {
  const [insumos, ultimosLotes] = await Promise.all([
    prisma.insumo.findMany({ select: { id: true, costoUnitarioReferencia: true } }),
    prisma.loteInsumo.findMany({
      orderBy: [{ fechaIngreso: 'desc' }, { id: 'desc' }],
      distinct: ['insumoId'],
      select: { insumoId: true, costoUnitario: true },
    }),
  ]);
  const costos = new Map(insumos.map((i) => [i.id, i.costoUnitarioReferencia]));
  for (const l of ultimosLotes) costos.set(l.insumoId, l.costoUnitario);
  return costos;
}

// Costo, margen y % de margen de uno o todos los productos activos, con un
// número fijo de consultas (sin N+1).
export async function rentabilidad({ productoId } = {}) {
  const [productos, costos] = await Promise.all([
    prisma.producto.findMany({
      where: productoId ? { id: productoId } : { activo: true },
      select: { id: true, nombre: true, precioVenta: true, receta: true },
    }),
    costosVigentes(),
  ]);

  return productos
    .map((p) => {
      const costo = Math.round(
        p.receta.reduce((acc, r) => acc + (costos.get(r.insumoId) || 0) * r.cantidadNecesaria, 0),
      );
      const margen = p.precioVenta > 0 ? (p.precioVenta - costo) / p.precioVenta : 0;
      return {
        productoId: p.id,
        nombre: p.nombre,
        precioVenta: p.precioVenta,
        costo,
        margen: p.precioVenta - costo,
        margenPorcentaje: Math.round(margen * 1000) / 10,
      };
    })
    .sort((a, b) => b.margenPorcentaje - a.margenPorcentaje);
}
