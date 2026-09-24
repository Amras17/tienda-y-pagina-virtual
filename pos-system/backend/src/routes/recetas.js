const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const costingService = require('../services/costingService');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const recetas = await prisma.receta.findMany({
    include: { producto: true, items: { include: { insumo: true } } },
  });
  res.json(recetas);
}));

router.get('/:productoId', asyncHandler(async (req, res) => {
  const receta = await prisma.receta.findUnique({
    where: { productoId: Number(req.params.productoId) },
    include: { items: { include: { insumo: true } } },
  });
  res.json(receta || null);
}));

router.get('/:productoId/costo', asyncHandler(async (req, res) => {
  const margen = await costingService.calcularMargen(Number(req.params.productoId));
  if (!margen) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(margen);
}));

// Crea o reemplaza por completo la receta de un producto.
router.put('/:productoId', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const productoId = Number(req.params.productoId);
  const { items } = req.body; // [{ insumoId, cantidadNecesaria }]

  const receta = await prisma.$transaction(async (tx) => {
    let receta = await tx.receta.findUnique({ where: { productoId } });
    if (!receta) {
      receta = await tx.receta.create({ data: { productoId } });
    } else {
      await tx.recetaItem.deleteMany({ where: { recetaId: receta.id } });
    }
    await tx.recetaItem.createMany({
      data: items.map((i) => ({
        recetaId: receta.id,
        insumoId: Number(i.insumoId),
        cantidadNecesaria: Number(i.cantidadNecesaria),
      })),
    });
    return tx.receta.findUnique({ where: { id: receta.id }, include: { items: { include: { insumo: true } } } });
  });

  res.json(receta);
}));

module.exports = router;
