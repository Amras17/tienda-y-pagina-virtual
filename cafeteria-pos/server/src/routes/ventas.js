import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { CAJA, GESTION, INTERNOS } from '../lib/roles.js';
import { HttpError, notFound } from '../lib/errors.js';
import { id, itemsVenta, paramId, textoOpcional } from '../lib/validation.js';
import { agregarItems, anularVenta, cobrarVenta, crearVenta } from '../services/ventas.js';

const router = Router();
router.use(requireRole(INTERNOS));

const incluir = {
  items: { include: { producto: { select: { nombre: true } } }, orderBy: { id: 'asc' } },
  usuario: { select: { id: true, nombre: true } },
  mesa: true,
  boleta: true,
};

const ventaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('MOSTRADOR'), clienteNombre: textoOpcional, items: itemsVenta }),
  z.object({ tipo: z.literal('MESA'), mesaId: id, clienteNombre: textoOpcional, items: itemsVenta }),
]);

router.get('/', async (req, res) => {
  const { estado, limit } = z
    .object({
      estado: z.enum(['ABIERTA', 'PAGADA', 'ANULADA']).optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
    })
    .parse(req.query);
  res.json(await prisma.venta.findMany({ where: { estado }, include: incluir, orderBy: { fecha: 'desc' }, take: limit }));
});

router.get('/:id', async (req, res) => {
  const venta = await prisma.venta.findUnique({ where: { id: paramId(req) }, include: incluir });
  if (!venta) throw notFound('Venta no encontrada');
  res.json(venta);
});

// MOSTRADOR: caja (ADMIN, ENCARGADO, CAJERO). MESA: cualquier rol interno.
// Si la mesa ya tiene pedido abierto, los ítems se suman a ese pedido.
router.post('/', async (req, res) => {
  const datos = ventaSchema.parse(req.body);
  if (datos.tipo === 'MOSTRADOR' && !CAJA.includes(req.usuario.rol)) {
    throw new HttpError(403, 'Su rol no puede registrar ventas de mostrador');
  }
  const venta = await crearVenta({ ...datos, mesaId: datos.mesaId ?? null, usuarioId: req.usuario.id });
  res.status(201).json(venta);
});

router.post('/:id/items', async (req, res) => {
  const { items } = z.object({ items: itemsVenta }).parse(req.body);
  res.json(await agregarItems(paramId(req), items));
});

// Cobro: descuenta stock (FIFO) y emite la boleta, de forma atómica.
router.post('/:id/cobrar', async (req, res) => {
  res.json(await cobrarVenta(paramId(req)));
});

router.post('/:id/anular', requireRole(GESTION), async (req, res) => {
  res.json(await anularVenta(paramId(req)));
});

export default router;
