import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { login, prisma, producto, publico, stockDe } from './helpers.js';

after(() => prisma.$disconnect());

test('venta de mostrador: totales con IVA incluido, stock FIFO y boleta', async () => {
  const cajero = await login('CAJERO');
  const latte = await producto('Latte');
  const leche = await stockDe('Leche entera');

  const venta = await cajero.post('/api/ventas', {
    tipo: 'MOSTRADOR',
    items: [{ productoId: latte.id, cantidad: 2, notas: 'sin espuma' }],
  });
  assert.equal(venta.status, 201);
  assert.equal(venta.body.total, 5600);
  assert.equal(venta.body.subtotal + venta.body.impuesto, 5600);
  assert.equal(venta.body.subtotal, Math.round(5600 / 1.19));

  const cobro = await cajero.post(`/api/ventas/${venta.body.id}/cobrar`);
  assert.equal(cobro.status, 200);
  assert.equal(cobro.body.venta.estado, 'PAGADA');
  assert.equal(cobro.body.boleta.folio, 1);
  assert.ok(Math.abs(leche - 0.4 - (await stockDe('Leche entera'))) < 1e-9);

  // Doble cobro (doble clic / reintento): rechazado, sin descontar de nuevo.
  const repetido = await cajero.post(`/api/ventas/${venta.body.id}/cobrar`);
  assert.equal(repetido.status, 409);
  assert.ok(Math.abs(leche - 0.4 - (await stockDe('Leche entera'))) < 1e-9);

  const pdf = await cajero.get(`/api/boletas/${cobro.body.boleta.id}/pdf`);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers['content-type'], /application\/pdf/);
});

test('FIFO consume primero el lote más antiguo y la falta de stock no bloquea la venta', async () => {
  const encargado = await login('ENCARGADO');
  const croissant = await producto('Croissant');
  const masa = await prisma.insumo.findFirstOrThrow({ where: { nombre: 'Masa de croissant' } });
  const loteViejo = await prisma.loteInsumo.findFirstOrThrow({ where: { insumoId: masa.id } });

  const nuevo = await encargado.post(`/api/insumos/${masa.id}/ingresar-stock`, { cantidad: 5, costoUnitario: 800 });
  assert.equal(nuevo.status, 201);

  // Vende todo el lote viejo + 2 del nuevo.
  const cantidad = loteViejo.cantidadRestante + 2;
  const venta = await encargado.post('/api/ventas', { tipo: 'MOSTRADOR', items: [{ productoId: croissant.id, cantidad }] });
  await encargado.post(`/api/ventas/${venta.body.id}/cobrar`).expect(200);

  assert.equal((await prisma.loteInsumo.findUnique({ where: { id: loteViejo.id } })).cantidadRestante, 0);
  assert.equal((await prisma.loteInsumo.findUnique({ where: { id: nuevo.body.id } })).cantidadRestante, 3);

  // Vender más de lo que hay: se cobra igual, ningún lote queda negativo y el
  // faltante queda registrado.
  const exceso = await encargado.post('/api/ventas', { tipo: 'MOSTRADOR', items: [{ productoId: croissant.id, cantidad: 10 }] });
  await encargado.post(`/api/ventas/${exceso.body.id}/cobrar`).expect(200);
  const lotes = await prisma.loteInsumo.findMany({ where: { insumoId: masa.id } });
  assert.ok(lotes.every((l) => l.cantidadRestante >= 0));
  const faltante = await prisma.movimientoStock.findFirst({ where: { insumoId: masa.id, loteId: null } });
  assert.equal(faltante.cantidad, 7);

  const insumos = await encargado.get('/api/insumos');
  assert.ok(insumos.body.find((i) => i.id === masa.id).stockActual < masa.stockMinimo);
  const dash = await encargado.get('/api/dashboard');
  assert.ok(dash.body.alertas.some((a) => a.id === masa.id));
});

test('mesa: pedido abierto, se suman ítems, pantalla pública y cobro libera la mesa', async () => {
  const garzon = await login('GARZON');
  const mesa = await prisma.mesa.findFirstOrThrow({ where: { numero: 3 } });
  const espresso = await producto('Espresso');
  const mocha = await producto('Mocha');

  const v1 = await garzon.post('/api/ventas', { tipo: 'MESA', mesaId: mesa.id, items: [{ productoId: espresso.id, cantidad: 1 }] });
  assert.equal(v1.status, 201);
  // Segundo "abrir pedido" sobre la misma mesa: se suma al pedido existente.
  const v2 = await garzon.post('/api/ventas', { tipo: 'MESA', mesaId: mesa.id, items: [{ productoId: mocha.id, cantidad: 2 }] });
  assert.equal(v2.body.id, v1.body.id);
  assert.equal(v2.body.total, 1800 + 2 * 3100);

  const mesas = await garzon.get('/api/mesas');
  const m = mesas.body.find((x) => x.id === mesa.id);
  assert.equal(m.estado, 'OCUPADA');
  assert.equal(m.ventaAbierta.items.length, 2);

  const pantalla = await publico(`/api/publico/mesa/${mesa.id}`);
  assert.equal(pantalla.status, 200);
  assert.deepEqual(Object.keys(pantalla.body).sort(), ['estado', 'items', 'mesaNumero', 'total']);
  assert.equal(pantalla.body.estado, 'Preparando');

  await garzon.post(`/api/ventas/${v1.body.id}/cobrar`).expect(200);
  const despues = (await garzon.get('/api/mesas')).body.find((x) => x.id === mesa.id);
  assert.equal(despues.estado, 'LIBRE');
  const pantallaDespues = await publico(`/api/publico/mesa/${mesa.id}`);
  assert.equal(pantallaDespues.status, 404);
});

test('anular un pedido abierto libera la mesa; uno pagado no se puede anular', async () => {
  const encargado = await login('ENCARGADO');
  const mesa = await prisma.mesa.findFirstOrThrow({ where: { numero: 5 } });
  const latte = await producto('Latte');
  const v = await encargado.post('/api/ventas', { tipo: 'MESA', mesaId: mesa.id, items: [{ productoId: latte.id, cantidad: 1 }] });

  await encargado.post(`/api/ventas/${v.body.id}/anular`).expect(200);
  assert.equal((await encargado.get('/api/mesas')).body.find((x) => x.id === mesa.id).estado, 'LIBRE');
  await encargado.post(`/api/ventas/${v.body.id}/items`, { items: [{ productoId: latte.id, cantidad: 1 }] }).expect(409);

  const pagada = await prisma.venta.findFirstOrThrow({ where: { estado: 'PAGADA' } });
  await encargado.post(`/api/ventas/${pagada.id}/anular`).expect(409);
});

test('validación de entrada', async () => {
  const cajero = await login('CAJERO');
  await cajero.post('/api/ventas', { tipo: 'MOSTRADOR', items: [] }).expect(400);
  await cajero.post('/api/ventas', { tipo: 'MESA', items: [{ productoId: 1, cantidad: 1 }] }).expect(400);
  await cajero.post('/api/ventas', { tipo: 'MOSTRADOR', items: [{ productoId: 9999, cantidad: 1 }] }).expect(400);
  await cajero.post('/api/ventas', { tipo: 'MOSTRADOR', items: [{ productoId: 1, cantidad: -2 }] }).expect(400);
  await cajero.get('/api/ventas/abc').expect(400);
  await cajero.get('/api/ventas/99999').expect(404);
});
