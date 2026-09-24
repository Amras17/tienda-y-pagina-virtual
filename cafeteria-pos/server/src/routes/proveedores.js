import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { GESTION } from '../lib/roles.js';
import { notFound } from '../lib/errors.js';
import { paramId, textoOpcional } from '../lib/validation.js';

const router = Router();
router.use(requireAuth);

const proveedorSchema = z.object({
  nombre: z.string().trim().min(1),
  contacto: textoOpcional,
  telefono: textoOpcional,
  email: textoOpcional,
});

router.get('/', async (req, res) => res.json(await prisma.proveedor.findMany({ orderBy: { nombre: 'asc' } })));

router.get('/:id', async (req, res) => {
  const proveedor = await prisma.proveedor.findUnique({ where: { id: paramId(req) } });
  if (!proveedor) throw notFound('Proveedor no encontrado');
  res.json(proveedor);
});

router.post('/', requireRole(GESTION), async (req, res) => {
  res.status(201).json(await prisma.proveedor.create({ data: proveedorSchema.parse(req.body) }));
});

router.put('/:id', requireRole(GESTION), async (req, res) => {
  const data = proveedorSchema.partial().parse(req.body);
  res.json(await prisma.proveedor.update({ where: { id: paramId(req) }, data }));
});

router.delete('/:id', requireRole(['ADMIN']), async (req, res) => {
  await prisma.proveedor.delete({ where: { id: paramId(req) } });
  res.status(204).end();
});

export default router;
