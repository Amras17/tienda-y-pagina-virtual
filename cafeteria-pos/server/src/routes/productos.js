import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { GESTION } from '../lib/roles.js';
import { notFound } from '../lib/errors.js';
import { id, paramId } from '../lib/validation.js';

const router = Router();
router.use(requireAuth);

const productoSchema = z.object({
  nombre: z.string().trim().min(1),
  categoriaId: id,
  precioVenta: z.coerce.number().int().min(0),
  activo: z.boolean().default(true),
  disponibleMostrador: z.boolean().default(true),
  disponibleMesa: z.boolean().default(true),
});

router.get('/', async (req, res) => {
  res.json(
    await prisma.producto.findMany({
      include: { categoria: true },
      orderBy: [{ categoria: { nombre: 'asc' } }, { nombre: 'asc' }],
    }),
  );
});

router.get('/categorias', async (req, res) => {
  res.json(await prisma.categoriaProducto.findMany({ orderBy: { nombre: 'asc' } }));
});

router.post('/categorias', requireRole(GESTION), async (req, res) => {
  const { nombre } = z.object({ nombre: z.string().trim().min(1) }).parse(req.body);
  res.status(201).json(await prisma.categoriaProducto.create({ data: { nombre } }));
});

router.get('/:id', async (req, res) => {
  const producto = await prisma.producto.findUnique({
    where: { id: paramId(req) },
    include: { categoria: true, receta: { include: { insumo: true } } },
  });
  if (!producto) throw notFound('Producto no encontrado');
  res.json(producto);
});

router.post('/', requireRole(GESTION), async (req, res) => {
  res.status(201).json(await prisma.producto.create({ data: productoSchema.parse(req.body) }));
});

// Actualización parcial: solo se modifican los campos enviados.
router.put('/:id', requireRole(GESTION), async (req, res) => {
  const data = productoSchema.partial().parse(req.body);
  for (const k of ['activo', 'disponibleMostrador', 'disponibleMesa']) if (!(k in req.body)) delete data[k];
  res.json(await prisma.producto.update({ where: { id: paramId(req) }, data }));
});

// Baja lógica: el producto conserva su historial de ventas.
router.delete('/:id', requireRole(['ADMIN']), async (req, res) => {
  await prisma.producto.update({ where: { id: paramId(req) }, data: { activo: false } });
  res.status(204).end();
});

export default router;
