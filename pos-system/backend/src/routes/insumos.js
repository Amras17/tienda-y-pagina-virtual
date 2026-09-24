const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const stockService = require('../services/stockService');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const insumos = await prisma.insumo.findMany({ include: { lotes: true }, orderBy: { nombre: 'asc' } });
  const conStock = insumos.map((insumo) => ({
    ...insumo,
    stockActual: insumo.lotes.reduce((acc, l) => acc + l.cantidadRestante, 0),
  }));
  res.json(conStock);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const insumo = await prisma.insumo.findUnique({
    where: { id: Number(req.params.id) },
    include: { lotes: { orderBy: { fechaIngreso: 'desc' } } },
  });
  if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado' });
  res.json(insumo);
}));

router.post('/', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const { nombre, unidadMedida, stockMinimo, costoUnitarioReferencia } = req.body;
  const insumo = await prisma.insumo.create({
    data: { nombre, unidadMedida, stockMinimo: Number(stockMinimo) || 0, costoUnitarioReferencia: Number(costoUnitarioReferencia) || 0 },
  });
  res.status(201).json(insumo);
}));

router.put('/:id', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const { nombre, unidadMedida, stockMinimo, costoUnitarioReferencia } = req.body;
  const insumo = await prisma.insumo.update({
    where: { id: Number(req.params.id) },
    data: { nombre, unidadMedida, stockMinimo: Number(stockMinimo), costoUnitarioReferencia: Number(costoUnitarioReferencia) },
  });
  res.json(insumo);
}));

router.delete('/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  await prisma.insumo.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
}));

// Ingreso manual de stock (crea un lote nuevo).
router.post('/:id/ingresar-stock', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const insumoId = Number(req.params.id);
  const { cantidad, costoUnitario, proveedorId } = req.body;
  if (!cantidad || cantidad <= 0) return res.status(400).json({ error: 'Cantidad invalida' });

  const lote = await stockService.ingresarStock({
    insumoId,
    cantidad: Number(cantidad),
    costoUnitario: Number(costoUnitario) || 0,
    proveedorId: proveedorId ? Number(proveedorId) : null,
  });
  res.status(201).json(lote);
}));

module.exports = router;
