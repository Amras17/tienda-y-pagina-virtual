const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Rutas PUBLICAS (sin JWT): pensadas para una pantalla/tablet mirando hacia
// el cliente. Exponen deliberadamente muy poco: solo lo que le sirve a un
// cliente para seguir su propio pedido. NUNCA se exponen aqui: costos,
// margenes, insumos/receta, datos de otros clientes/mesas, ni informacion
// de otras ventas.
function estadoSimple(venta) {
  if (venta.estado === 'ABIERTA') return 'Preparando';
  if (venta.estado === 'PAGADA') return 'Listo para retirar';
  return 'Anulado';
}

function proyeccionCliente(venta) {
  return {
    ventaId: venta.id,
    mesaNumero: venta.mesa ? venta.mesa.numero : null,
    estado: estadoSimple(venta),
    items: venta.items.map((item) => ({
      nombreProducto: item.producto.nombre,
      cantidad: item.cantidad,
    })),
    total: venta.total, // IVA incluido, sin desglose de costos internos
  };
}

router.get('/venta/:ventaId', asyncHandler(async (req, res) => {
  const venta = await prisma.venta.findUnique({
    where: { id: Number(req.params.ventaId) },
    include: { items: { include: { producto: true } }, mesa: true },
  });
  if (!venta) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(proyeccionCliente(venta));
}));

// Pedido vigente de una mesa. Solo se considera "vigente" mientras la mesa
// siga OCUPADA y la venta siga ABIERTA: apenas se cobra, cobrarVenta() libera
// la mesa, asi que una mesa LIBRE nunca debe devolver el pedido (ya cerrado)
// del cliente anterior en esta pantalla publica.
router.get('/mesa/:mesaId', asyncHandler(async (req, res) => {
  const mesa = await prisma.mesa.findUnique({ where: { id: Number(req.params.mesaId) } });
  if (!mesa || mesa.estado !== 'OCUPADA') {
    return res.status(404).json({ error: 'No hay un pedido vigente para esta mesa' });
  }

  const venta = await prisma.venta.findFirst({
    where: { mesaId: mesa.id, estado: 'ABIERTA' },
    include: { items: { include: { producto: true } }, mesa: true },
    orderBy: { fecha: 'desc' },
  });
  if (!venta) return res.status(404).json({ error: 'No hay un pedido vigente para esta mesa' });
  res.json(proyeccionCliente(venta));
}));

module.exports = router;
