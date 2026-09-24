import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { GESTION } from '../lib/roles.js';
import { conflict, notFound } from '../lib/errors.js';
import { id, paramId } from '../lib/validation.js';
import { ingresarStock } from '../services/stock.js';

const router = Router();
router.use(requireAuth);

const incluir = { proveedor: true, items: { include: { insumo: true } } };

const ordenSchema = z.object({
  proveedorId: id,
  items: z
    .array(z.object({ insumoId: id, cantidad: z.coerce.number().positive(), costoUnitario: z.coerce.number().min(0) }))
    .min(1, 'La orden debe tener al menos un ítem'),
});

router.get('/', async (req, res) => {
  res.json(await prisma.ordenCompra.findMany({ include: incluir, orderBy: { fecha: 'desc' }, take: 100 }));
});

router.get('/:id', async (req, res) => {
  const orden = await prisma.ordenCompra.findUnique({ where: { id: paramId(req) }, include: incluir });
  if (!orden) throw notFound('Orden no encontrada');
  res.json(orden);
});

router.post('/', requireRole(GESTION), async (req, res) => {
  const { proveedorId, items } = ordenSchema.parse(req.body);
  const orden = await prisma.ordenCompra.create({
    data: { proveedorId, items: { create: items } },
    include: incluir,
  });
  res.status(201).json(orden);
});

// Marca la orden como RECIBIDA y crea un lote de stock por ítem, todo en una
// transacción: o se recibe completa o no se recibe.
router.post('/:id/recibir', requireRole(GESTION), async (req, res) => {
  const ordenId = paramId(req);
  const orden = await prisma.$transaction(async (tx) => {
    const { count } = await tx.ordenCompra.updateMany({
      where: { id: ordenId, estado: 'PENDIENTE' },
      data: { estado: 'RECIBIDA' },
    });
    if (count === 0) {
      const existe = await tx.ordenCompra.count({ where: { id: ordenId } });
      throw existe ? conflict('La orden ya fue recibida') : notFound('Orden no encontrada');
    }
    const actual = await tx.ordenCompra.findUnique({ where: { id: ordenId }, include: { items: true } });
    for (const item of actual.items) {
      await ingresarStock(
        {
          insumoId: item.insumoId,
          cantidad: item.cantidad,
          costoUnitario: item.costoUnitario,
          proveedorId: actual.proveedorId,
          referencia: `Orden de compra #${ordenId}`,
        },
        tx,
      );
    }
    return tx.ordenCompra.findUnique({ where: { id: ordenId }, include: incluir });
  });
  res.json(orden);
});

export default router;
