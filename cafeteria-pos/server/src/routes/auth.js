import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { firmarToken, limitarIntentos, requireAuth } from '../auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

router.post('/login', limitarIntentos(), async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  const valido = usuario?.activo && (await bcrypt.compare(password, usuario.passwordHash));
  if (!valido) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json(firmarToken(usuario));
});

router.get('/me', requireAuth, (req, res) => res.json(req.usuario));

export default router;
