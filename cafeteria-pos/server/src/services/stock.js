import { prisma } from '../db.js';

// Evita residuos de coma flotante (0.018 * 3 = 0.05399999...).
const redondear = (n) => Math.round(n * 1e6) / 1e6;

// Crea un lote nuevo (ingreso de stock) con su movimiento asociado.
// Acepta un cliente de transacción para componerse con otras operaciones.
export async function ingresarStock(
  { insumoId, cantidad, costoUnitario, proveedorId = null, referencia = 'Ingreso manual de stock' },
  db = prisma,
) {
  const lote = await db.loteInsumo.create({
    data: { insumoId, cantidadInicial: cantidad, cantidadRestante: cantidad, costoUnitario, proveedorId },
  });
  await db.movimientoStock.create({
    data: { insumoId, loteId: lote.id, tipo: 'INGRESO', cantidad, referencia },
  });
  return lote;
}

// Descuenta los insumos que consume una venta según las recetas, en orden
// FIFO (lote más antiguo primero). Debe ejecutarse dentro de la transacción
// de cobro (`tx`).
//
// Decisión de negocio: la falta de stock NO bloquea la venta. Un café real no
// puede detener el mostrador por un descuadre de inventario. Los lotes nunca
// quedan negativos; el faltante se registra como movimiento sin lote para
// que quede trazado y aparezca en las alertas de stock mínimo.
export async function descontarPorVenta(tx, ventaId) {
  const items = await tx.ventaItem.findMany({
    where: { ventaId },
    select: { cantidad: true, producto: { select: { receta: true } } },
  });

  // Consumo total por insumo (una sola pasada aunque varios productos
  // compartan insumo, p. ej. café en grano).
  const requerido = new Map();
  for (const item of items) {
    for (const r of item.producto.receta) {
      requerido.set(r.insumoId, (requerido.get(r.insumoId) || 0) + r.cantidadNecesaria * item.cantidad);
    }
  }
  if (requerido.size === 0) return;

  const lotes = await tx.loteInsumo.findMany({
    where: { insumoId: { in: [...requerido.keys()] }, cantidadRestante: { gt: 0 } },
    orderBy: [{ fechaIngreso: 'asc' }, { id: 'asc' }],
  });

  const referencia = `Venta #${ventaId}`;
  const movimientos = [];
  for (const [insumoId, cantidad] of requerido) {
    let restante = redondear(cantidad);
    for (const lote of lotes) {
      if (restante <= 0) break;
      if (lote.insumoId !== insumoId) continue;
      const consumo = redondear(Math.min(lote.cantidadRestante, restante));
      await tx.loteInsumo.update({
        where: { id: lote.id },
        data: { cantidadRestante: redondear(lote.cantidadRestante - consumo) },
      });
      movimientos.push({ insumoId, loteId: lote.id, tipo: 'SALIDA_VENTA', cantidad: consumo, referencia });
      restante = redondear(restante - consumo);
    }
    if (restante > 0) {
      movimientos.push({
        insumoId,
        loteId: null,
        tipo: 'SALIDA_VENTA',
        cantidad: restante,
        referencia: `${referencia} (stock insuficiente, faltante registrado)`,
      });
    }
  }
  await tx.movimientoStock.createMany({ data: movimientos });
}

// Stock actual por insumo (suma de cantidadRestante de sus lotes), en una
// sola consulta agregada.
export async function stockPorInsumo(db = prisma) {
  const filas = await db.loteInsumo.groupBy({ by: ['insumoId'], _sum: { cantidadRestante: true } });
  return new Map(filas.map((f) => [f.insumoId, redondear(f._sum.cantidadRestante || 0)]));
}

export async function insumosConStock() {
  const [insumos, stock] = await Promise.all([
    prisma.insumo.findMany({ orderBy: { nombre: 'asc' } }),
    stockPorInsumo(),
  ]);
  return insumos.map((i) => ({ ...i, stockActual: stock.get(i.id) || 0 }));
}

export async function alertasStockMinimo() {
  return (await insumosConStock()).filter((i) => i.stockActual < i.stockMinimo);
}
