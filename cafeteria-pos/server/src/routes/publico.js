import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { notFound } from '../lib/errors.js';
import { paramId } from '../lib/validation.js';

const router = Router();

// Rutas PÚBLICAS (sin JWT) para la pantalla que mira al cliente. La consulta
// selecciona a mano solo lo que el cliente puede ver: nunca costos, márgenes,
// recetas, stock, folio, usuario ni datos de otros pedidos.
const seleccion = {
  estado: true,
  total: true,
  mesa: { select: { numero: true } },
  items: {
    orderBy: { id: 'asc' },
    select: { cantidad: true, preparado: true, producto: { select: { nombre: true } } },
  },
};

// El estado refleja la preparación real (comanda), no el pago.
function proyeccionCliente(venta) {
  const listo = venta.items.length > 0 && venta.items.every((i) => i.preparado);
  return {
    mesaNumero: venta.mesa?.numero ?? null,
    estado: venta.estado === 'ANULADA' ? 'Anulado' : listo ? 'Listo para retirar' : 'Preparando',
    items: venta.items.map((i) => ({ nombreProducto: i.producto.nombre, cantidad: i.cantidad })),
    total: venta.total, // IVA incluido
  };
}

router.get('/orden/:codigo', async (req, res) => {
  const codigo = z.string().min(10).max(40).parse(req.params.codigo);
  const venta = await prisma.venta.findUnique({ where: { codigo }, select: seleccion });
  if (!venta) throw notFound('Pedido no encontrado');
  res.json(proyeccionCliente(venta));
});

// Pedido vigente de una mesa: solo mientras esté ABIERTO. Una vez cobrado,
// la pantalla de la mesa no vuelve a mostrar el pedido del cliente anterior.
router.get('/mesa/:mesaId', async (req, res) => {
  const venta = await prisma.venta.findFirst({
    where: { mesaId: paramId(req, 'mesaId'), estado: 'ABIERTA' },
    select: seleccion,
  });
  if (!venta) throw notFound('No hay un pedido vigente para esta mesa');
  res.json(proyeccionCliente(venta));
});

export default router;
