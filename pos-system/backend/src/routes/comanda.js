const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
// Cualquier rol interno puede operar la comanda (barista/cocina/garzon/
// cajero/encargado/admin); es una vista puramente operativa, sin precios.
router.use(requireRole('ADMIN', 'ENCARGADO', 'CAJERO', 'GARZON'));

// Pedidos pendientes: ventas ABIERTAS o recien PAGADAS que aun tengan items
// sin marcar como preparados. Pensado para polling cada pocos segundos.
router.get('/pendientes', asyncHandler(async (req, res) => {
  const ventas = await prisma.venta.findMany({
    where: {
      estado: { in: ['ABIERTA', 'PAGADA'] },
      items: { some: { preparado: false } },
    },
    include: { items: { include: { producto: true } }, mesa: true },
    orderBy: { fecha: 'asc' },
  });

  // Solo se exponen los campos operativos: nunca precios, subtotal ni total.
  const resultado = ventas.map((venta) => ({
    ventaId: venta.id,
    tipo: venta.tipo,
    mesaNumero: venta.mesa ? venta.mesa.numero : null,
    fecha: venta.fecha,
    segundosTranscurridos: Math.floor((Date.now() - new Date(venta.fecha).getTime()) / 1000),
    items: venta.items
      .filter((item) => !item.preparado)
      .map((item) => ({
        itemId: item.id,
        nombreProducto: item.producto.nombre,
        cantidad: item.cantidad,
        notas: item.notas,
      })),
  }));

  res.json(resultado);
}));

// Marca un item de la comanda como listo/entregado.
router.post('/items/:itemId/listo', asyncHandler(async (req, res) => {
  const item = await prisma.ventaItem.update({
    where: { id: Number(req.params.itemId) },
    data: { preparado: true, preparadoEn: new Date() },
  });
  res.json(item);
}));

module.exports = router;
