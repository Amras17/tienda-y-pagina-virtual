const prisma = require('../utils/prisma');
const stockService = require('./stockService');
const invoiceService = require('./invoiceService');

const TASA_IVA = 0.19;

// Crea una venta ABIERTA con sus items. El precio unitario se toma del
// producto en el momento de la venta (evita que un cambio de precio
// posterior altere ventas ya tomadas).
async function crearVenta({ tipo, mesaId, usuarioId, clienteNombre, items }) {
  const productos = await prisma.producto.findMany({
    where: { id: { in: items.map((i) => i.productoId) } },
  });
  const productoPorId = Object.fromEntries(productos.map((p) => [p.id, p]));

  const itemsConPrecio = items.map((item) => {
    const producto = productoPorId[item.productoId];
    if (!producto) throw new Error(`Producto ${item.productoId} no existe`);
    const subtotal = producto.precioVenta * item.cantidad;
    return {
      productoId: item.productoId,
      cantidad: item.cantidad,
      precioUnitario: producto.precioVenta,
      subtotal,
      notas: item.notas || null,
    };
  });

  const { subtotal, total, impuesto } = calcularTotales(itemsConPrecio);

  const venta = await prisma.venta.create({
    data: {
      tipo,
      mesaId: tipo === 'MESA' ? mesaId : null,
      usuarioId,
      clienteNombre,
      subtotal,
      impuesto,
      total,
      estado: 'ABIERTA',
      items: { create: itemsConPrecio },
    },
    include: { items: { include: { producto: true } } },
  });

  if (tipo === 'MESA' && mesaId) {
    await prisma.mesa.update({ where: { id: mesaId }, data: { estado: 'OCUPADA' } });
  }

  return venta;
}

// Agrega items a una venta ABIERTA existente (ej. mesa que sigue pidiendo).
// La insercion de items y la relectura del estado ocurren dentro de la misma
// transaccion para no pisarse con un cobrarVenta() concurrente: si la venta
// dejo de estar ABIERTA entre la validacion inicial y el commit, se revierte
// todo en vez de agregar items a una venta ya cobrada.
async function agregarItems(ventaId, items) {
  const productos = await prisma.producto.findMany({
    where: { id: { in: items.map((i) => i.productoId) } },
  });
  const productoPorId = Object.fromEntries(productos.map((p) => [p.id, p]));

  const itemsConPrecio = items.map((item) => {
    const producto = productoPorId[item.productoId];
    if (!producto) throw new Error(`Producto ${item.productoId} no existe`);
    const subtotal = producto.precioVenta * item.cantidad;
    return {
      ventaId,
      productoId: item.productoId,
      cantidad: item.cantidad,
      precioUnitario: producto.precioVenta,
      subtotal,
      notas: item.notas || null,
    };
  });

  return prisma.$transaction(async (tx) => {
    const venta = await tx.venta.findUnique({ where: { id: ventaId } });
    if (!venta) throw new Error('Venta no encontrada');
    if (venta.estado !== 'ABIERTA') throw new Error('Solo se pueden agregar items a una venta ABIERTA');

    await tx.ventaItem.createMany({ data: itemsConPrecio });

    const ventaActualizada = await tx.venta.findUnique({ where: { id: ventaId }, include: { items: true } });
    const { subtotal, impuesto, total } = calcularTotales(ventaActualizada.items);
    return tx.venta.update({ where: { id: ventaId }, data: { subtotal, impuesto, total } });
  });
}

function calcularTotales(items) {
  const subtotalConIva = items.reduce((acc, i) => acc + i.subtotal, 0);
  // precioVenta se asume con IVA incluido (practica habitual en boletas a
  // consumidor final en Chile); se desglosa el IVA a partir del total.
  const subtotal = Math.round((subtotalConIva / (1 + TASA_IVA)) * 100) / 100;
  const impuesto = Math.round((subtotalConIva - subtotal) * 100) / 100;
  return { subtotal, impuesto, total: subtotalConIva };
}

async function recalcularTotales(ventaId) {
  const venta = await prisma.venta.findUnique({ where: { id: ventaId }, include: { items: true } });
  const { subtotal, impuesto, total } = calcularTotales(venta.items);
  return prisma.venta.update({ where: { id: ventaId }, data: { subtotal, impuesto, total } });
}

// Confirma el cobro de una venta: descuenta stock segun receta y genera la
// boleta en PDF.
async function cobrarVenta(ventaId) {
  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
  if (!venta) throw new Error('Venta no encontrada');

  // updateMany condicionado a estado ABIERTA "reclama" la venta de forma
  // atomica: si dos cobros llegan casi simultaneos para la misma venta
  // (doble click, reintento de red), solo uno logra el update (count === 1)
  // y el otro falla de inmediato sin descontar stock ni generar boleta dos
  // veces.
  const { count } = await prisma.venta.updateMany({
    where: { id: ventaId, estado: 'ABIERTA' },
    data: { estado: 'PAGADA' },
  });
  if (count === 0) throw new Error('La venta ya fue cobrada o anulada');

  await stockService.descontarStockPorVenta(ventaId);

  if (venta.tipo === 'MESA' && venta.mesaId) {
    await prisma.mesa.update({ where: { id: venta.mesaId }, data: { estado: 'LIBRE' } });
  }

  const boleta = await invoiceService.generarBoletaParaVenta(ventaId);

  return { venta: await prisma.venta.findUnique({ where: { id: ventaId }, include: { items: true } }), boleta };
}

module.exports = { crearVenta, agregarItems, cobrarVenta, calcularTotales, TASA_IVA };
