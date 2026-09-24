import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, login, prisma, producto, publico } from './helpers.js';

after(() => prisma.$disconnect());

test('login: credenciales inválidas y rutas sin token', async () => {
  await request(app).post('/api/auth/login').send({ email: 'admin@cafeteria.cl', password: 'mala' }).expect(401);
  await request(app).get('/api/ventas').expect(401);
  await request(app).get('/api/ventas').set('Authorization', 'Bearer basura').expect(401);
  const me = await (await login('ADMIN')).get('/api/auth/me');
  assert.equal(me.body.rol, 'ADMIN');
});

test('permisos por rol', async () => {
  const cajero = await login('CAJERO');
  const garzon = await login('GARZON');
  const encargado = await login('ENCARGADO');
  const espresso = await producto('Espresso');

  await cajero.get('/api/dashboard').expect(403);
  await cajero.get('/api/reportes/ventas').expect(403);
  await cajero.post('/api/insumos', { nombre: 'X', unidadMedida: 'kg' }).expect(403);
  await garzon.post('/api/ventas', { tipo: 'MOSTRADOR', items: [{ productoId: espresso.id, cantidad: 1 }] }).expect(403);

  await encargado.get('/api/dashboard').expect(200);
  // ENCARGADO no tiene acciones de administración global (eliminar).
  await encargado.del('/api/insumos/1').expect(403);
  await encargado.del('/api/productos/1').expect(403);
});

test('comanda: nunca expone precios y marcar listo cambia la pantalla del cliente', async () => {
  const cajero = await login('CAJERO');
  const latte = await producto('Latte');
  const v = await cajero.post('/api/ventas', {
    tipo: 'MOSTRADOR',
    clienteNombre: 'Sofía',
    items: [{ productoId: latte.id, cantidad: 1, notas: 'leche de avena' }],
  });
  await cajero.post(`/api/ventas/${v.body.id}/cobrar`).expect(200);

  const comanda = await cajero.get('/api/comanda/pendientes');
  const pedido = comanda.body.find((p) => p.ventaId === v.body.id);
  assert.equal(pedido.items[0].notas, 'leche de avena');
  assert.doesNotMatch(JSON.stringify(comanda.body), /precio|subtotal|total|costo/i);

  const antes = await publico(`/api/publico/orden/${v.body.codigo}`);
  assert.equal(antes.body.estado, 'Preparando');
  assert.doesNotMatch(JSON.stringify(antes.body), /costo|margen|folio|usuario|codigo/i);

  await cajero.post(`/api/comanda/ventas/${v.body.id}/listo`).expect(200);
  const despues = await publico(`/api/publico/orden/${v.body.codigo}`);
  assert.equal(despues.body.estado, 'Listo para retirar');
  assert.ok(!(await cajero.get('/api/comanda/pendientes')).body.some((p) => p.ventaId === v.body.id));

  // El id correlativo no sirve para espiar pedidos ajenos.
  await publico(`/api/publico/orden/${v.body.id}`).expect(400);
});

test('orden de compra: recibir crea lotes una sola vez', async () => {
  const encargado = await login('ENCARGADO');
  const insumo = await prisma.insumo.findFirstOrThrow({ where: { nombre: 'Azúcar' } });
  const proveedor = await prisma.proveedor.findFirstOrThrow();
  const orden = await encargado.post('/api/ordenes-compra', {
    proveedorId: proveedor.id,
    items: [{ insumoId: insumo.id, cantidad: 10, costoUnitario: 1000 }],
  });
  assert.equal(orden.status, 201);
  const antes = await prisma.loteInsumo.count({ where: { insumoId: insumo.id } });
  await encargado.post(`/api/ordenes-compra/${orden.body.id}/recibir`).expect(200);
  await encargado.post(`/api/ordenes-compra/${orden.body.id}/recibir`).expect(409);
  assert.equal(await prisma.loteInsumo.count({ where: { insumoId: insumo.id } }), antes + 1);
});

test('recetas y costeo', async () => {
  const encargado = await login('ENCARGADO');
  const espresso = await producto('Espresso');
  const cafe = await prisma.insumo.findFirstOrThrow({ where: { nombre: 'Café en grano' } });

  const r = await encargado.put(`/api/recetas/${espresso.id}`, { items: [{ insumoId: cafe.id, cantidadNecesaria: 0.02 }] });
  assert.equal(r.body.items.length, 1);
  const costo = await encargado.get(`/api/recetas/${espresso.id}/costo`);
  assert.equal(costo.body.costo, Math.round(0.02 * 9000));
  assert.equal(costo.body.margen, 1800 - 180);

  await encargado
    .put(`/api/recetas/${espresso.id}`, { items: [{ insumoId: cafe.id, cantidadNecesaria: 1 }, { insumoId: cafe.id, cantidadNecesaria: 2 }] })
    .expect(400);
});
