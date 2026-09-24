const prisma = require('../utils/prisma');

// Crea un lote nuevo de insumo (ingreso de stock) y su movimiento asociado.
async function ingresarStock({ insumoId, cantidad, costoUnitario, proveedorId }) {
  return prisma.$transaction(async (tx) => {
    const lote = await tx.loteInsumo.create({
      data: {
        insumoId,
        cantidadInicial: cantidad,
        cantidadRestante: cantidad,
        costoUnitario,
        proveedorId: proveedorId || null,
      },
    });
    await tx.movimientoStock.create({
      data: {
        insumoId,
        loteId: lote.id,
        tipo: 'INGRESO',
        cantidad,
        referencia: `Ingreso manual de stock`,
      },
    });
    return lote;
  });
}

// Descuenta stock de un insumo consumiendo lotes en orden FIFO
// (fechaIngreso ascendente, solo lotes con cantidadRestante > 0).
//
// Decision de negocio: si no hay stock suficiente en ningun lote, la venta
// NO se bloquea. Un cafe real no puede detener el mostrador por falta de
// registro de stock; en ese caso el insumo queda en 0 (nunca negativo a
// nivel de lote) y debe aparecer en las alertas de stock minimo para que
// el encargado reponga. Ver README, seccion "Decisiones de diseño".
async function descontarInsumoFIFO(tx, insumoId, cantidadRequerida, referencia) {
  let restante = cantidadRequerida;

  const lotes = await tx.loteInsumo.findMany({
    where: { insumoId, cantidadRestante: { gt: 0 } },
    orderBy: { fechaIngreso: 'asc' },
  });

  for (const lote of lotes) {
    if (restante <= 0) break;
    const consumo = Math.min(lote.cantidadRestante, restante);
    if (consumo <= 0) continue;

    await tx.loteInsumo.update({
      where: { id: lote.id },
      data: { cantidadRestante: lote.cantidadRestante - consumo },
    });
    await tx.movimientoStock.create({
      data: {
        insumoId,
        loteId: lote.id,
        tipo: 'SALIDA_VENTA',
        cantidad: consumo,
        referencia,
      },
    });
    restante -= consumo;
  }

  // Si queda un remanente sin cubrir, se registra igual el movimiento
  // (sin lote asociado) para dejar trazabilidad del faltante.
  if (restante > 0) {
    await tx.movimientoStock.create({
      data: {
        insumoId,
        loteId: null,
        tipo: 'SALIDA_VENTA',
        cantidad: restante,
        referencia: `${referencia} (stock insuficiente, faltante registrado)`,
      },
    });
  }
}

// Recorre los items de una venta y descuenta stock segun la receta de cada
// producto vendido, consumiendo insumos en FIFO.
async function descontarStockPorVenta(ventaId) {
  return prisma.$transaction(async (tx) => {
    const venta = await tx.venta.findUnique({
      where: { id: ventaId },
      include: { items: { include: { producto: { include: { receta: { include: { items: true } } } } } } },
    });
    if (!venta) throw new Error('Venta no encontrada');

    for (const ventaItem of venta.items) {
      const receta = ventaItem.producto.receta;
      if (!receta) continue; // producto sin receta definida (ej. venta de insumo suelto)
      for (const recetaItem of receta.items) {
        const cantidadNecesaria = recetaItem.cantidadNecesaria * ventaItem.cantidad;
        await descontarInsumoFIFO(tx, recetaItem.insumoId, cantidadNecesaria, `Venta #${ventaId}`);
      }
    }
  });
}

// Suma la cantidadRestante de todos los lotes de un insumo => stock actual.
async function stockActual(insumoId) {
  const resultado = await prisma.loteInsumo.aggregate({
    where: { insumoId },
    _sum: { cantidadRestante: true },
  });
  return resultado._sum.cantidadRestante || 0;
}

// Devuelve insumos cuyo stock actual esta por debajo del stockMinimo.
async function alertasStockMinimo() {
  const insumos = await prisma.insumo.findMany({ include: { lotes: true } });
  return insumos
    .map((insumo) => {
      const stock = insumo.lotes.reduce((acc, lote) => acc + lote.cantidadRestante, 0);
      return { ...insumo, stockActual: stock };
    })
    .filter((insumo) => insumo.stockActual < insumo.stockMinimo);
}

module.exports = {
  ingresarStock,
  descontarStockPorVenta,
  stockActual,
  alertasStockMinimo,
};
