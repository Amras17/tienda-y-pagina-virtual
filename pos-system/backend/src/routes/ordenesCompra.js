const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const stockService = require('../services/stockService');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const ordenes = await prisma.ordenCompra.findMany({
    include: { proveedor: true, items: { include: { insumo: true } } },
    orderBy: { fecha: 'desc' },
  });
  res.json(ordenes);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const orden = await prisma.ordenCompra.findUnique({
    where: { id: Number(req.params.id) },
    include: { proveedor: true, items: { include: { insumo: true } } },
  });
  if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
  res.json(orden);
}));

router.post('/', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const { proveedorId, items } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'La orden debe tener al menos un item' });

  const orden = await prisma.ordenCompra.create({
    data: {
      proveedorId: Number(proveedorId),
      estado: 'PENDIENTE',
      items: {
        create: items.map((i) => ({
          insumoId: Number(i.insumoId),
          cantidad: Number(i.cantidad),
          costoUnitario: Number(i.costoUnitario),
        })),
      },
    },
    include: { items: true },
  });
  res.status(201).json(orden);
}));

// Marca la orden como RECIBIDA y genera automaticamente un lote + movimiento
// de ingreso de stock por cada item.
router.post('/:id/recibir', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const orden = await prisma.ordenCompra.findUnique({ where: { id }, include: { items: true } });
  if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
  if (orden.estado === 'RECIBIDA') return res.status(400).json({ error: 'La orden ya fue recibida' });

  for (const item of orden.items) {
    await stockService.ingresarStock({
      insumoId: item.insumoId,
      cantidad: item.cantidad,
      costoUnitario: item.costoUnitario,
      proveedorId: orden.proveedorId,
    });
  }

  const actualizada = await prisma.ordenCompra.update({
    where: { id },
    data: { estado: 'RECIBIDA' },
    include: { items: { include: { insumo: true } }, proveedor: true },
  });
  res.json(actualizada);
}));

module.exports = router;
