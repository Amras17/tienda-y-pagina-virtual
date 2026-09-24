const prisma = require('../utils/prisma');

// Costo unitario a usar por insumo: el del lote mas reciente si existe
// (aproxima el costo de reposicion actual), o el costoUnitarioReferencia
// del insumo si aun no tiene lotes ingresados.
async function costoUnitarioVigente(insumoId) {
  const ultimoLote = await prisma.loteInsumo.findFirst({
    where: { insumoId },
    orderBy: { fechaIngreso: 'desc' },
  });
  if (ultimoLote) return ultimoLote.costoUnitario;

  const insumo = await prisma.insumo.findUnique({ where: { id: insumoId } });
  return insumo ? insumo.costoUnitarioReferencia : 0;
}

async function calcularCostoReceta(productoId) {
  const receta = await prisma.receta.findUnique({
    where: { productoId },
    include: { items: { include: { insumo: true } } },
  });
  if (!receta) return 0;

  let costoTotal = 0;
  for (const item of receta.items) {
    const costoUnitario = await costoUnitarioVigente(item.insumoId);
    costoTotal += costoUnitario * item.cantidadNecesaria;
  }
  return costoTotal;
}

async function calcularMargen(productoId) {
  const producto = await prisma.producto.findUnique({ where: { id: productoId } });
  if (!producto) return null;

  const costo = await calcularCostoReceta(productoId);
  const margen = producto.precioVenta > 0 ? (producto.precioVenta - costo) / producto.precioVenta : 0;
  return {
    productoId,
    precioVenta: producto.precioVenta,
    costo,
    margen,
    margenPorcentaje: Math.round(margen * 10000) / 100,
  };
}

module.exports = { calcularCostoReceta, calcularMargen, costoUnitarioVigente };
