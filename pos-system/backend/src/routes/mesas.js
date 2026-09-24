const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const mesas = await prisma.mesa.findMany({
    orderBy: { numero: 'asc' },
    include: { ventas: { where: { estado: 'ABIERTA' }, include: { items: { include: { producto: true } } } } },
  });
  res.json(mesas);
}));

router.post('/', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const { numero, capacidad } = req.body;
  const mesa = await prisma.mesa.create({ data: { numero: Number(numero), capacidad: Number(capacidad) || 4 } });
  res.status(201).json(mesa);
}));

router.put('/:id', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const { numero, capacidad, estado } = req.body;
  const mesa = await prisma.mesa.update({
    where: { id: Number(req.params.id) },
    data: { numero: numero !== undefined ? Number(numero) : undefined, capacidad: capacidad !== undefined ? Number(capacidad) : undefined, estado },
  });
  res.json(mesa);
}));

router.delete('/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  await prisma.mesa.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
}));

module.exports = router;
