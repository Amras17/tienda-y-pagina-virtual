import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { GESTION } from '../lib/roles.js';
import { notFound } from '../lib/errors.js';
import { id, paramId } from '../lib/validation.js';
import { ingresarStock, insumosConStock } from '../services/stock.js';

const router = Router();
router.use(requireAuth);

const insumoSchema = z.object({
  nombre: z.string().trim().min(1),
  unidadMedida: z.string().trim().min(1).max(10),
  stockMinimo: z.coerce.number().min(0).default(0),
  costoUnitarioReferencia: z.coerce.number().min(0).default(0),
});

const ingresoSchema = z.object({
  cantidad: z.coerce.number().positive(),
  costoUnitario: z.coerce.number().min(0).optional(),
  proveedorId: id.optional().nullable(),
});

router.get('/', async (req, res) => res.json(await insumosConStock()));

router.get('/:id', async (req, res) => {
  const insumo = await prisma.insumo.findUnique({
    where: { id: paramId(req) },
    include: {
      lotes: { orderBy: { fechaIngreso: 'desc' }, take: 50 },
      movimientos: { orderBy: { fecha: 'desc' }, take: 50 },
    },
  });
  if (!insumo) throw notFound('Insumo no encontrado');
  res.json(insumo);
});

router.post('/', requireRole(GESTION), async (req, res) => {
  res.status(201).json(await prisma.insumo.create({ data: insumoSchema.parse(req.body) }));
});

router.put('/:id', requireRole(GESTION), async (req, res) => {
  const data = insumoSchema.partial().parse(req.body);
  res.json(await prisma.insumo.update({ where: { id: paramId(req) }, data }));
});

router.delete('/:id', requireRole(['ADMIN']), async (req, res) => {
  await prisma.insumo.delete({ where: { id: paramId(req) } });
  res.status(204).end();
});

// Ingreso manual de stock: crea un lote nuevo. Sin costo explícito se usa el
// costo de referencia del insumo.
router.post('/:id/ingresar-stock', requireRole(GESTION), async (req, res) => {
  const insumoId = paramId(req);
  const { cantidad, costoUnitario, proveedorId } = ingresoSchema.parse(req.body);
  const insumo = await prisma.insumo.findUnique({ where: { id: insumoId } });
  if (!insumo) throw notFound('Insumo no encontrado');

  const lote = await prisma.$transaction((tx) =>
    ingresarStock(
      {
        insumoId,
        cantidad,
        costoUnitario: costoUnitario ?? insumo.costoUnitarioReferencia,
        proveedorId: proveedorId ?? null,
      },
      tx,
    ),
  );
  res.status(201).json(lote);
});

export default router;
