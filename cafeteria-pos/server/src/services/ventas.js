import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { calcularTotales } from './totales.js';
import { descontarPorVenta } from './stock.js';

// Ítems con precio congelado al momento de la venta (un cambio de precio
// posterior no altera pedidos ya tomados).
async function preciarItems(db, items, tipo) {
  const ids = [...new Set(items.map((i) => i.productoId))];
  const productos = await db.producto.findMany({ where: { id: { in: ids } } });
  const porId = new Map(productos.map((p) => [p.id, p]));
  const campoDisponible = tipo === 'MESA' ? 'disponibleMesa' : 'disponibleMostrador';

  return items.map((item) => {
    const p = porId.get(item.productoId);
    if (!p || !p.activo) throw badRequest(`Producto ${item.productoId} no existe o está inactivo`);
    if (!p[campoDisponible]) throw badRequest(`"${p.nombre}" no está disponible para ${tipo.toLowerCase()}`);
    return {
      productoId: p.id,
      cantidad: item.cantidad,
      precioUnitario: p.precioVenta,
      subtotal: p.precioVenta * item.cantidad,
      notas: item.notas ?? null,
    };
  });
}

async function recalcularTotales(tx, ventaId) {
  const items = await tx.ventaItem.findMany({ where: { ventaId }, select: { subtotal: true } });
  return tx.venta.update({ where: { id: ventaId }, data: calcularTotales(items), include: { items: true } });
}

async function anexarItems(tx, venta, items) {
  const conPrecio = await preciarItems(tx, items, venta.tipo);
  await tx.ventaItem.createMany({ data: conPrecio.map((i) => ({ ...i, ventaId: venta.id })) });
  return recalcularTotales(tx, venta.id);
}

// Crea una venta ABIERTA. Para MESA, si la mesa ya tiene un pedido abierto
// (p. ej. otro garzón lo abrió un segundo antes) los ítems se suman a ese
// pedido en vez de crear un segundo pedido para la misma mesa.
export async function crearVenta({ tipo, mesaId, usuarioId, clienteNombre, items }) {
  return prisma.$transaction(async (tx) => {
    if (tipo === 'MESA') {
      const mesa = await tx.mesa.findUnique({ where: { id: mesaId } });
      if (!mesa) throw notFound('Mesa no encontrada');
      const abierta = await tx.venta.findFirst({ where: { mesaId, estado: 'ABIERTA' } });
      if (abierta) return anexarItems(tx, abierta, items);
    }
    const conPrecio = await preciarItems(tx, items, tipo);
    return tx.venta.create({
      data: {
        tipo,
        mesaId: tipo === 'MESA' ? mesaId : null,
        usuarioId,
        clienteNombre,
        ...calcularTotales(conPrecio),
        items: { create: conPrecio },
      },
      include: { items: true },
    });
  });
}

// Agrega ítems a una venta ABIERTA. La verificación de estado ocurre dentro
// de la misma transacción que la inserción, así un cobro concurrente no deja
// ítems colgando de una venta ya pagada.
export async function agregarItems(ventaId, items) {
  return prisma.$transaction(async (tx) => {
    const venta = await tx.venta.findUnique({ where: { id: ventaId } });
    if (!venta) throw notFound('Venta no encontrada');
    if (venta.estado !== 'ABIERTA') throw conflict('Solo se pueden agregar ítems a una venta ABIERTA');
    return anexarItems(tx, venta, items);
  });
}

// Cobra una venta en UNA sola transacción: marca PAGADA, descuenta stock FIFO
// y emite la boleta con folio correlativo. Si algo falla, no queda nada a
// medias (ni stock descontado sin boleta, ni boleta sin venta pagada).
export async function cobrarVenta(ventaId, intentos = 3) {
  try {
    return await prisma.$transaction(async (tx) => {
      // updateMany condicionado a ABIERTA "reclama" la venta de forma atómica:
      // ante un doble clic o reintento de red, solo un cobro gana.
      const { count } = await tx.venta.updateMany({
        where: { id: ventaId, estado: 'ABIERTA' },
        data: { estado: 'PAGADA' },
      });
      if (count === 0) {
        const existe = await tx.venta.count({ where: { id: ventaId } });
        throw existe ? conflict('La venta ya fue cobrada o anulada') : notFound('Venta no encontrada');
      }

      await descontarPorVenta(tx, ventaId);

      const ultima = await tx.boleta.aggregate({ _max: { folio: true } });
      const boleta = await tx.boleta.create({
        data: { ventaId, folio: (ultima._max.folio || 0) + 1 },
      });
      const venta = await tx.venta.findUnique({ where: { id: ventaId }, include: { items: true } });
      return { venta, boleta };
    });
  } catch (err) {
    // Dos cobros simultáneos de ventas distintas pueden calcular el mismo
    // folio (en PostgreSQL); el índice único lo impide y se reintenta.
    const choqueFolio = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
    if (choqueFolio && intentos > 1) return cobrarVenta(ventaId, intentos - 1);
    throw err;
  }
}

// Anula un pedido ABIERTO (no cobrado). Al derivarse el estado de la mesa de
// sus ventas abiertas, la mesa queda libre automáticamente. Una venta ya
// PAGADA no se anula aquí: ya descontó stock y emitió boleta (requeriría una
// nota de crédito).
export async function anularVenta(ventaId) {
  const { count } = await prisma.venta.updateMany({
    where: { id: ventaId, estado: 'ABIERTA' },
    data: { estado: 'ANULADA' },
  });
  if (count === 0) {
    const existe = await prisma.venta.count({ where: { id: ventaId } });
    throw existe ? conflict('Solo se pueden anular pedidos abiertos (no cobrados)') : notFound('Venta no encontrada');
  }
  return prisma.venta.findUnique({ where: { id: ventaId } });
}
