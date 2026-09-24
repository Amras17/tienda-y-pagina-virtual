const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('ADMIN', 'ENCARGADO'));

function claveAgrupacion(fecha, agrupacion) {
  const d = new Date(fecha);
  if (agrupacion === 'mes') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (agrupacion === 'semana') {
    const primerDiaAno = new Date(d.getFullYear(), 0, 1);
    const numSemana = Math.ceil(((d - primerDiaAno) / 86400000 + primerDiaAno.getDay() + 1) / 7);
    return `${d.getFullYear()}-S${numSemana}`;
  }
  return d.toISOString().slice(0, 10); // dia por defecto
}

router.get('/ventas', asyncHandler(async (req, res) => {
  const { desde, hasta, agrupacion = 'dia' } = req.query;

  const where = { estado: 'PAGADA' };
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = new Date(desde);
    if (hasta) where.fecha.lte = new Date(hasta);
  }

  const ventas = await prisma.venta.findMany({ where, orderBy: { fecha: 'asc' } });

  const agrupado = {};
  for (const venta of ventas) {
    const key = claveAgrupacion(venta.fecha, agrupacion);
    if (!agrupado[key]) agrupado[key] = { periodo: key, cantidad: 0, total: 0 };
    agrupado[key].cantidad += 1;
    agrupado[key].total += venta.total;
  }

  res.json(Object.values(agrupado));
}));

module.exports = router;
