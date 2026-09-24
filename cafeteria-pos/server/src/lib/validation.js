import { z } from 'zod';

export const id = z.coerce.number().int().positive();
export const idParam = z.object({ id });

// Parsea y devuelve req.params.id como entero positivo (400 si no lo es).
export const paramId = (req, nombre = 'id') => id.parse(req.params[nombre]);

export const textoOpcional = z
  .string()
  .trim()
  .max(200)
  .optional()
  .nullable()
  .transform((v) => v || null);

export const itemsVenta = z
  .array(
    z.object({
      productoId: id,
      cantidad: z.coerce.number().int().positive().max(999),
      notas: textoOpcional,
    }),
  )
  .min(1, 'Debe incluir al menos un ítem');
