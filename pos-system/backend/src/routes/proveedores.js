const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  res.json(await prisma.proveedor.findMany({ orderBy: { nombre: 'asc' } }));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const proveedor = await prisma.proveedor.findUnique({ where: { id: Number(req.params.id) } });
  if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
  res.json(proveedor);
}));

router.post('/', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const { nombre, contacto, telefono, email } = req.body;
  const proveedor = await prisma.proveedor.create({ data: { nombre, contacto, telefono, email } });
  res.status(201).json(proveedor);
}));

router.put('/:id', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const { nombre, contacto, telefono, email } = req.body;
  const proveedor = await prisma.proveedor.update({
    where: { id: Number(req.params.id) },
    data: { nombre, contacto, telefono, email },
  });
  res.json(proveedor);
}));

router.delete('/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  await prisma.proveedor.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
}));

module.exports = router;
