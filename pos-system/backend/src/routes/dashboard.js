const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const stockService = require('../services/stockService');
const costingService = require('../services/costingService');

const router = express.Router();
router.use(requireAuth);
// Dashboard y reportes: operativos, disponibles para ADMIN y ENCARGADO
// (visibilidad total del turno/dia), no para CAJERO/GARZON.
router.use(requireRole('ADMIN', 'ENCARGADO'));

router.get('/kpis', asyncHandler(async (req, res) => {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const ventasHoy = await prisma.venta.findMany({
    where: { estado: 'PAGADA', fecha: { gte: inicioHoy } },
  });

  const totalHoy = ventasHoy.reduce((acc, v) => acc + v.total, 0);
  const ticketPromedio = ventasHoy.length ? totalHoy / ventasHoy.length : 0;
  const alertas = await stockService.alertasStockMinimo();

  res.json({
    ventasHoyCantidad: ventasHoy.length,
    ventasHoyTotal: totalHoy,
    ticketPromedio,
    alertasStockCantidad: alertas.length,
  });
}));

router.get('/mas-vendidos', asyncHandler(async (req, res) => {
  const items = await prisma.ventaItem.findMany({
    where: { venta: { estado: 'PAGADA' } },
    include: { producto: true },
  });

  const agrupado = {};
  for (const item of items) {
    const key = item.productoId;
    if (!agrupado[key]) agrupado[key] = { productoId: key, nombre: item.producto.nombre, cantidad: 0, total: 0 };
    agrupado[key].cantidad += item.cantidad;
    agrupado[key].total += item.subtotal;
  }

  const resultado = Object.values(agrupado).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
  res.json(resultado);
}));

router.get('/ventas-por-modalidad', asyncHandler(async (req, res) => {
  const ventas = await prisma.venta.findMany({ where: { estado: 'PAGADA' } });
  const mostrador = ventas.filter((v) => v.tipo === 'MOSTRADOR');
  const mesa = ventas.filter((v) => v.tipo === 'MESA');
  res.json({
    mostrador: { cantidad: mostrador.length, total: mostrador.reduce((a, v) => a + v.total, 0) },
    mesa: { cantidad: mesa.length, total: mesa.reduce((a, v) => a + v.total, 0) },
  });
}));

router.get('/stock-alertas', asyncHandler(async (req, res) => {
  res.json(await stockService.alertasStockMinimo());
}));

router.get('/rentabilidad', asyncHandler(async (req, res) => {
  const productos = await prisma.producto.findMany({ where: { activo: true } });
  const resultado = [];
  for (const producto of productos) {
    const margen = await costingService.calcularMargen(producto.id);
    if (margen) resultado.push({ ...margen, nombre: producto.nombre });
  }
  res.json(resultado.sort((a, b) => b.margenPorcentaje - a.margenPorcentaje));
}));

module.exports = router;
