import { Router } from 'express';
import { prisma } from '../db.js';
import { requireRole } from '../auth.js';
import { INTERNOS } from '../lib/roles.js';
import { notFound } from '../lib/errors.js';
import { paramId } from '../lib/validation.js';

const router = Router();
// Vista operativa para barra/cocina: cualquier rol interno.
router.use(requireRole(INTERNOS));

// Pedidos con ítems por preparar. Se usa `select` explícito: los precios,
// subtotales y totales NUNCA salen de la base hacia esta pantalla.
router.get('/pendientes', async (req, res) => {
  const ventas = await prisma.venta.findMany({
    where: { estado: { in: ['ABIERTA', 'PAGADA'] }, items: { some: { preparado: false } } },
    orderBy: { fecha: 'asc' },
    select: {
      id: true,
      tipo: true,
      fecha: true,
      clienteNombre: true,
      mesa: { select: { numero: true } },
      items: {
        where: { preparado: false },
        orderBy: { id: 'asc' },
        select: { id: true, cantidad: true, notas: true, creadoEn: true, producto: { select: { nombre: true } } },
      },
    },
  });
  const ahora = Date.now();
  res.json(
    ventas.map((v) => ({
      ventaId: v.id,
      tipo: v.tipo,
      mesaNumero: v.mesa?.numero ?? null,
      clienteNombre: v.clienteNombre,
      fecha: v.fecha,
      segundosTranscurridos: Math.floor((ahora - v.fecha.getTime()) / 1000),
      items: v.items.map((i) => ({
        itemId: i.id,
        nombreProducto: i.producto.nombre,
        cantidad: i.cantidad,
        notas: i.notas,
      })),
    })),
  );
});

router.post('/items/:itemId/listo', async (req, res) => {
  const item = await prisma.ventaItem.update({
    where: { id: paramId(req, 'itemId') },
    data: { preparado: true, preparadoEn: new Date() },
    select: { id: true, preparado: true, preparadoEn: true },
  });
  res.json(item);
});

// Marca todo el pedido como listo de una vez.
router.post('/ventas/:ventaId/listo', async (req, res) => {
  const ventaId = paramId(req, 'ventaId');
  const { count } = await prisma.ventaItem.updateMany({
    where: { ventaId, preparado: false },
    data: { preparado: true, preparadoEn: new Date() },
  });
  if (count === 0 && !(await prisma.venta.count({ where: { id: ventaId } }))) throw notFound('Pedido no encontrado');
  res.json({ ventaId, itemsMarcados: count });
});

export default router;
