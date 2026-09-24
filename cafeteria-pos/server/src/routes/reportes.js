import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { GESTION } from '../lib/roles.js';
import { ventasPorPeriodo } from '../services/reportes.js';

const router = Router();
router.use(requireRole(GESTION));

const querySchema = z.object({
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  agrupacion: z.enum(['dia', 'semana', 'mes']).default('dia'),
});

router.get('/ventas', async (req, res) => {
  const q = querySchema.parse(req.query);
  res.json(await ventasPorPeriodo({ ...q, rellenar: q.agrupacion === 'dia' }));
});

export default router;
