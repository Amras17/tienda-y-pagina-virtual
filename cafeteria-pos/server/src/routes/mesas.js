import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { GESTION } from '../lib/roles.js';
import { conflict } from '../lib/errors.js';
import { paramId } from '../lib/validation.js';

const router = Router();
router.use(requireAuth);

const mesaSchema = z.object({
  numero: z.coerce.number().int().positive(),
  capacidad: z.coerce.number().int().positive().default(4),
});

// Estado derivado: OCUPADA si y solo si tiene un pedido ABIERTO.
router.get('/', async (req, res) => {
  const mesas = await prisma.mesa.findMany({
    orderBy: { numero: 'asc' },
    include: {
      ventas: {
        where: { estado: 'ABIERTA' },
        include: { items: { include: { producto: { select: { nombre: true } } }, orderBy: { id: 'asc' } } },
      },
    },
  });
  res.json(
    mesas.map(({ ventas, ...mesa }) => ({
      ...mesa,
      estado: ventas.length ? 'OCUPADA' : 'LIBRE',
      ventaAbierta: ventas[0] || null,
    })),
  );
});

router.post('/', requireRole(GESTION), async (req, res) => {
  res.status(201).json(await prisma.mesa.create({ data: mesaSchema.parse(req.body) }));
});

router.put('/:id', requireRole(GESTION), async (req, res) => {
  const data = mesaSchema.partial().parse(req.body);
  if (!('capacidad' in req.body)) delete data.capacidad;
  res.json(await prisma.mesa.update({ where: { id: paramId(req) }, data }));
});

router.delete('/:id', requireRole(['ADMIN']), async (req, res) => {
  const mesaId = paramId(req);
  if (await prisma.venta.count({ where: { mesaId } })) {
    throw conflict('La mesa tiene ventas registradas; no se puede eliminar');
  }
  await prisma.mesa.delete({ where: { id: mesaId } });
  res.status(204).end();
});

export default router;
