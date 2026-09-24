import { z } from 'zod';

const esProduccion = process.env.NODE_ENV === 'production';
const SECRETO_DEMO = 'solo-para-desarrollo-cambiar-en-produccion';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  JWT_SECRET: esProduccion
    ? z.string().min(24, 'JWT_SECRET debe tener al menos 24 caracteres en producción')
    : z.string().min(1).default(SECRETO_DEMO),
  JWT_EXPIRES_IN: z.string().default('12h'),
  // Solo necesario si el frontend se sirve desde otro origen (en producción
  // el backend sirve el frontend compilado, mismo origen, sin CORS).
  CORS_ORIGIN: z.string().optional(),
  NOMBRE_LOCAL: z.string().default('Cafetería'),
});

const resultado = schema.safeParse(process.env);
if (!resultado.success) {
  console.error('Configuración inválida:\n' + z.prettifyError(resultado.error));
  process.exit(1);
}

export const config = resultado.data;
process.env.DATABASE_URL = config.DATABASE_URL;
