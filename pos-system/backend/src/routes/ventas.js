const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const saleService = require('../services/saleService');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const { estado } = req.query;
  const ventas = await prisma.venta.findMany({
    where: estado ? { estado } : undefined,
    include: { items: { include: { producto: true } }, usuario: true, mesa: true, boleta: true },
    orderBy: { fecha: 'desc' },
  });
  res.json(ventas);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const venta = await prisma.venta.findUnique({
    where: { id: Number(req.params.id) },
    include: { items: { include: { producto: true } }, usuario: true, mesa: true, boleta: true },
  });
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  res.json(venta);
}));

// Crea una venta MOSTRADOR o MESA con sus items iniciales.
router.post('/', requireRole('ADMIN', 'ENCARGADO', 'CAJERO', 'GARZON'), asyncHandler(async (req, res) => {
  const { tipo, mesaId, clienteNombre, items } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'La venta debe tener al menos un item' });
  if (tipo === 'MESA' && !mesaId) return res.status(400).json({ error: 'mesaId es requerido para ventas de tipo MESA' });

  const venta = await saleService.crearVenta({
    tipo,
    mesaId: mesaId ? Number(mesaId) : null,
    usuarioId: req.usuario.id,
    clienteNombre,
    items,
  });
  res.status(201).json(venta);
}));

// Agrega items a una venta ABIERTA (ej. mesa que sigue pidiendo antes de pagar).
router.post('/:id/items', requireRole('ADMIN', 'ENCARGADO', 'CAJERO', 'GARZON'), asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Debe incluir al menos un item' });
  const venta = await saleService.agregarItems(Number(req.params.id), items);
  res.json(venta);
}));

// Confirma el cobro: descuenta stock y genera boleta.
router.post('/:id/cobrar', requireRole('ADMIN', 'ENCARGADO', 'CAJERO', 'GARZON'), asyncHandler(async (req, res) => {
  const resultado = await saleService.cobrarVenta(Number(req.params.id));
  res.json(resultado);
}));

router.post('/:id/anular', requireRole('ADMIN', 'ENCARGADO'), asyncHandler(async (req, res) => {
  const ventaId = Number(req.params.id);
  const venta = await prisma.venta.update({ where: { id: ventaId }, data: { estado: 'ANULADA' } });

  // Si era una venta de mesa, liberarla: de lo contrario la mesa queda
  // OCUPADA para siempre y no se puede volver a usar desde el POS.
  if (venta.tipo === 'MESA' && venta.mesaId) {
    await prisma.mesa.update({ where: { id: venta.mesaId }, data: { estado: 'LIBRE' } });
  }

  res.json(venta);
}));

module.exports = router;
