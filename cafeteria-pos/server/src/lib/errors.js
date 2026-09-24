import { z } from 'zod';
import { Prisma } from '@prisma/client';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'No encontrado') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);

const MENSAJES_PRISMA = {
  P2002: [409, 'Ya existe un registro con ese valor único'],
  P2003: [409, 'El registro está en uso por otros datos y no se puede modificar/eliminar'],
  P2025: [404, 'Registro no encontrado'],
};

// Middleware de errores centralizado: traduce errores conocidos (validación,
// Prisma, HttpError) a respuestas JSON { error } con el status correcto.
export function errorHandler(err, req, res, _next) {
  if (err instanceof z.ZodError) {
    const detalle = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    return res.status(400).json({ error: `Datos inválidos — ${detalle}` });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && MENSAJES_PRISMA[err.code]) {
    const [status, error] = MENSAJES_PRISMA[err.code];
    return res.status(status).json({ error });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}
