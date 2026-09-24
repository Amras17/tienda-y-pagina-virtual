const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y password son requeridos' });
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.activo) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }

  const valido = await bcrypt.compare(password, usuario.passwordHash);
  if (!valido) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }

  const payload = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  res.json({ token, usuario: payload });
}));

module.exports = router;
