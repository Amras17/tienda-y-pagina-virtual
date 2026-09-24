import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { GESTION } from '../lib/roles.js';
import { badRequest, notFound } from '../lib/errors.js';
import { id, paramId } from '../lib/validation.js';
import { rentabilidad } from '../services/costeo.js';

const router = Router();
router.use(requireRole(GESTION));

const recetaSchema = z.object({
  items: z.array(z.object({ insumoId: id, cantidadNecesaria: z.coerce.number().positive() })),
});

async function leerReceta(productoId) {
  const items = await prisma.recetaItem.findMany({
    where: { productoId },
    include: { insumo: true },
    orderBy: { id: 'asc' },
  });
  return { productoId, items };
}

router.get('/:productoId', async (req, res) => {
  res.json(await leerReceta(paramId(req, 'productoId')));
});

router.get('/:productoId/costo', async (req, res) => {
  const [costo] = await rentabilidad({ productoId: paramId(req, 'productoId') });
  if (!costo) throw notFound('Producto no encontrado');
  res.json(costo);
});

// Reemplaza por completo la receta de un producto.
router.put('/:productoId', async (req, res) => {
  const productoId = paramId(req, 'productoId');
  const { items } = recetaSchema.parse(req.body);
  if (new Set(items.map((i) => i.insumoId)).size !== items.length) {
    throw badRequest('Un insumo no puede repetirse en la misma receta');
  }
  await prisma.$transaction([
    prisma.recetaItem.deleteMany({ where: { productoId } }),
    prisma.recetaItem.createMany({ data: items.map((i) => ({ ...i, productoId })) }),
  ]);
  res.json(await leerReceta(productoId));
});

export default router;
