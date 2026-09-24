import { Router } from 'express';
import { prisma } from '../db.js';
import { requireRole } from '../auth.js';
import { GESTION } from '../lib/roles.js';
import { alertasStockMinimo } from '../services/stock.js';
import { rentabilidad } from '../services/costeo.js';
import { inicioDelDia, ventasPorPeriodo } from '../services/reportes.js';

const router = Router();
router.use(requireRole(GESTION));

// Todo el dashboard en UNA respuesta (antes eran 5 llamadas), resuelto con
// agregaciones en la base en vez de traer todas las ventas a memoria.
router.get('/', async (req, res) => {
  const hoy = inicioDelDia();
  const hace14 = inicioDelDia(new Date(Date.now() - 13 * 86_400_000));

  const [hoyAgg, topAgg, modalidadAgg, alertas, ventasPorDia, margenes] = await Promise.all([
    prisma.venta.aggregate({ where: { estado: 'PAGADA', fecha: { gte: hoy } }, _count: true, _sum: { total: true } }),
    prisma.ventaItem.groupBy({
      by: ['productoId'],
      where: { venta: { estado: 'PAGADA' } },
      _sum: { cantidad: true, subtotal: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 10,
    }),
    prisma.venta.groupBy({ by: ['tipo'], where: { estado: 'PAGADA' }, _count: true, _sum: { total: true } }),
    alertasStockMinimo(),
    ventasPorPeriodo({ desde: hace14, agrupacion: 'dia', rellenar: true }),
    rentabilidad(),
  ]);

  const nombres = new Map(
    (await prisma.producto.findMany({ where: { id: { in: topAgg.map((t) => t.productoId) } }, select: { id: true, nombre: true } }))
      .map((p) => [p.id, p.nombre]),
  );
  const modalidad = Object.fromEntries(
    ['MOSTRADOR', 'MESA'].map((tipo) => {
      const g = modalidadAgg.find((m) => m.tipo === tipo);
      return [tipo.toLowerCase(), { cantidad: g?._count || 0, total: g?._sum.total || 0 }];
    }),
  );
  const totalHoy = hoyAgg._sum.total || 0;

  res.json({
    kpis: {
      ventasHoyCantidad: hoyAgg._count,
      ventasHoyTotal: totalHoy,
      ticketPromedio: hoyAgg._count ? Math.round(totalHoy / hoyAgg._count) : 0,
      alertasStockCantidad: alertas.length,
    },
    masVendidos: topAgg.map((t) => ({
      productoId: t.productoId,
      nombre: nombres.get(t.productoId),
      cantidad: t._sum.cantidad,
      total: t._sum.subtotal,
    })),
    modalidad,
    ventasPorDia,
    alertas,
    rentabilidad: margenes,
  });
});

export default router;
