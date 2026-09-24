const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const productos = await prisma.producto.findMany({
    include: { categoria: true },
    orderBy: { nombre: 'asc' },
  });
  res.json(productos);
}));

router.get('/categorias', asyncHandler(async (req, res) => {
  res.json(await prisma.categoriaProducto.findMany({ orderBy: { nombre: 'asc' } }));
}));

router.post('/categorias', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const categoria = await prisma.categoriaProducto.create({ data: { nombre: req.body.nombre } });
  res.status(201).json(categoria);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const producto = await prisma.producto.findUnique({
    where: { id: Number(req.params.id) },
    include: { categoria: true, receta: { include: { items: { include: { insumo: true } } } } },
  });
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(producto);
}));

router.post('/', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const { nombre, categoriaId, precioVenta, disponibleMostrador, disponibleMesa } = req.body;
  const producto = await prisma.producto.create({
    data: {
      nombre,
      categoriaId: Number(categoriaId),
      precioVenta: Number(precioVenta),
      disponibleMostrador: disponibleMostrador !== false,
      disponibleMesa: disponibleMesa !== false,
    },
  });
  res.status(201).json(producto);
}));

router.put('/:id', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const { nombre, categoriaId, precioVenta, activo, disponibleMostrador, disponibleMesa } = req.body;
  const producto = await prisma.producto.update({
    where: { id: Number(req.params.id) },
    data: { nombre, categoriaId: Number(categoriaId), precioVenta: Number(precioVenta), activo, disponibleMostrador, disponibleMesa },
  });
  res.json(producto);
}));

router.delete('/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  await prisma.producto.update({ where: { id: Number(req.params.id) }, data: { activo: false } });
  res.status(204).end();
}));

module.exports = router;
