const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const invoiceService = require('../services/invoiceService');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const boletas = await prisma.boleta.findMany({
    include: { venta: { include: { items: { include: { producto: true } } } } },
    orderBy: { fecha: 'desc' },
  });
  res.json(boletas);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const boleta = await prisma.boleta.findUnique({
    where: { id: Number(req.params.id) },
    include: { venta: { include: { items: { include: { producto: true } } } } },
  });
  if (!boleta) return res.status(404).json({ error: 'Boleta no encontrada' });
  res.json(boleta);
}));

router.get('/:id/pdf', asyncHandler(async (req, res) => {
  const boleta = await prisma.boleta.findUnique({ where: { id: Number(req.params.id) } });
  if (!boleta) return res.status(404).json({ error: 'Boleta no encontrada' });
  const rutaAbsoluta = invoiceService.rutaAbsolutaPDF(boleta.pdfPath);
  res.download(rutaAbsoluta, `boleta-${boleta.folio}.pdf`);
}));

// Intenta emitir el DTE real ante el SII (stub, ver services/siiAdapter.js).
router.post('/:id/enviar-sii', asyncHandler(async (req, res) => {
  const resultado = await invoiceService.enviarSII(Number(req.params.id));
  res.json(resultado);
}));

module.exports = router;
