import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function firmarToken(usuario) {
  const payload = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol };
  return { token: jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN }), usuario: payload };
}

export function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  try {
    req.usuario = jwt.verify(token, config.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

// Exige autenticación y que el rol esté dentro de los permitidos.
export function requireRole(roles) {
  return [
    requireAuth,
    (req, res, next) =>
      roles.includes(req.usuario.rol)
        ? next()
        : res.status(403).json({ error: 'No tiene permisos para esta acción' }),
  ];
}

// Limitador simple en memoria para /login (sin dependencias externas):
// máximo `max` intentos por IP por ventana.
export function limitarIntentos({ max = 10, ventanaMs = 60_000 } = {}) {
  const intentos = new Map();
  return (req, res, next) => {
    const ahora = Date.now();
    const clave = req.ip;
    if (intentos.size > 5000) {
      for (const [k, r] of intentos) if (ahora > r.reinicio) intentos.delete(k);
    }
    const registro = intentos.get(clave);
    if (!registro || ahora > registro.reinicio) {
      intentos.set(clave, { cuenta: 1, reinicio: ahora + ventanaMs });
      return next();
    }
    registro.cuenta += 1;
    if (registro.cuenta > max) {
      return res.status(429).json({ error: 'Demasiados intentos, espere un minuto' });
    }
    return next();
  };
}
