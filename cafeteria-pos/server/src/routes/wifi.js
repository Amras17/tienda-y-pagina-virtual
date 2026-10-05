import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { GESTION } from '../lib/roles.js';
import { paramId } from '../lib/validation.js';
import { guardarConfig, listarAccesos, obtenerConfig, resumenDelDia, revocarAcceso, simular } from '../services/wifi.js';

// Administración del WiFi por consumo (encargado de turno y administración).
const router = Router();
router.use(requireRole(GESTION));

const entero = (min, max) => z.coerce.number().int().min(min).max(max);

const configSchema = z
  .object({
    activo: z.boolean(),
    minutosPorMil: entero(1, 120),
    minutosMinimo: entero(5, 1440),
    minutosMaximo: entero(5, 1440),
    montoMinimo: entero(0, 1_000_000),
    dispositivos: entero(1, 5),
    horasParaActivar: entero(1, 72),
    redNombre: z.string().trim().max(32).default(''),
    portalUrl: z.string().trim().max(120).default(''),
  })
  .refine((c) => c.minutosMinimo <= c.minutosMaximo, {
    message: 'El mínimo de minutos no puede superar al máximo',
    path: ['minutosMinimo'],
  });

router.get('/config', async (req, res) => {
  const config = await obtenerConfig();
  res.json({ config, ejemplos: simular(config) });
});

router.put('/config', async (req, res) => {
  const config = await guardarConfig(configSchema.parse(req.body));
  res.json({ config, ejemplos: simular(config) });
});

router.get('/accesos', async (req, res) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
  const [accesos, resumen] = await Promise.all([listarAccesos(limit), resumenDelDia()]);
  res.json({ accesos, resumen });
});

router.post('/accesos/:id/revocar', async (req, res) => {
  res.json(await revocarAcceso(paramId(req)));
});

export default router;
