import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireRole } from '../auth.js';
import { INTERNOS } from '../lib/roles.js';
import { notFound } from '../lib/errors.js';
import { paramId } from '../lib/validation.js';
import { escribirBoletaPdf } from '../services/boletaPdf.js';
import { emitirDTE } from '../services/sii.js';

const router = Router();
router.use(requireRole(INTERNOS));

const detalle = {
  venta: {
    include: { mesa: true, items: { include: { producto: { select: { nombre: true } } }, orderBy: { id: 'asc' } } },
  },
};

async function buscar(id) {
  const boleta = await prisma.boleta.findUnique({ where: { id }, include: detalle });
  if (!boleta) throw notFound('Boleta no encontrada');
  return boleta;
}

router.get('/', async (req, res) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
  const boletas = await prisma.boleta.findMany({
    orderBy: { folio: 'desc' },
    take: limit,
    include: { venta: { select: { total: true, tipo: true, mesa: { select: { numero: true } } } } },
  });
  res.json(boletas);
});

router.get('/:id', async (req, res) => res.json(await buscar(paramId(req))));

router.get('/:id/pdf', async (req, res) => {
  const boleta = await buscar(paramId(req));
  res.type('application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="boleta-${boleta.folio}.pdf"`);
  escribirBoletaPdf(boleta, res);
});

// Intenta emitir el DTE ante el SII (stub, ver services/sii.js).
router.post('/:id/enviar-sii', async (req, res) => {
  const boleta = await buscar(paramId(req));
  const resultado = await emitirDTE(boleta);
  await prisma.boleta.update({ where: { id: boleta.id }, data: { estadoSII: 'STUB' } });
  res.json(resultado);
});

export default router;
