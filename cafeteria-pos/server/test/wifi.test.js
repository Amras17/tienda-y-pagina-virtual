import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, login, prisma, producto, publico } from './helpers.js';

after(() => prisma.$disconnect());

const activar = (codigo, mac) => request(app).post('/api/publico/wifi/activar').send({ codigo, mac });

async function cobrar(usuario, productoNombre, cantidad) {
  const p = await producto(productoNombre);
  const v = await usuario.post('/api/ventas', { tipo: 'MOSTRADOR', items: [{ productoId: p.id, cantidad }] });
  return (await usuario.post(`/api/ventas/${v.body.id}/cobrar`).expect(200)).body;
}

test('el cobro emite un código WiFi proporcional al total', async () => {
  const cajero = await login('CAJERO');

  // Latte $2.800 → 28 min → sube al mínimo de 30.
  const chico = await cobrar(cajero, 'Latte', 1);
  assert.equal(chico.wifi.minutos, 30);
  assert.match(chico.wifi.codigo, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // 4 lattes $11.200 → 112 min → 110.
  const grande = await cobrar(cajero, 'Latte', 4);
  assert.equal(grande.wifi.minutos, 110);

  // Bajo el monto mínimo no hay código (Espresso $1.800 < $2.000).
  const minimo = await cobrar(cajero, 'Espresso', 1);
  assert.equal(minimo.wifi, null);

  // La pantalla pública del pedido muestra la clave una vez pagado.
  const pantalla = await publico(`/api/publico/orden/${grande.venta.codigo}`);
  assert.deepEqual(pantalla.body.wifi, { clave: grande.wifi.codigo, minutos: 110 });

  // La boleta PDF se sigue generando con la sección WiFi.
  await cajero.get(`/api/boletas/${grande.boleta.id}/pdf`).expect(200);
});

test('portal: activa una vez, respeta el límite de equipos y no expone la venta', async () => {
  const cajero = await login('CAJERO');
  const { wifi } = await cobrar(cajero, 'Latte', 2);

  const consulta = await publico(`/api/publico/wifi/${wifi.codigo.toLowerCase().replace('-', '')}`);
  assert.equal(consulta.status, 200);
  assert.equal(consulta.body.estado, 'SIN_USAR');
  assert.doesNotMatch(JSON.stringify(consulta.body), /venta|monto|total|mac|folio/i);

  const primera = await activar(wifi.codigo, 'aa-bb-cc-dd-ee-01');
  assert.equal(primera.status, 200);
  assert.equal(primera.body.estado, 'ACTIVO');
  assert.ok(primera.body.restanteSegundos <= wifi.minutos * 60);

  // Reconexión del mismo equipo: mismo vencimiento, no regala tiempo.
  const reconexion = await activar(wifi.codigo, 'AA:BB:CC:DD:EE:01');
  assert.equal(reconexion.status, 200);
  assert.equal(reconexion.body.expiraEn, primera.body.expiraEn);

  // Un segundo equipo con el mismo código (límite por defecto: 1).
  await activar(wifi.codigo, 'aa-bb-cc-dd-ee-02').expect(409);

  await activar('ZZZZ-ZZZZ').expect(404);
  await activar('123').expect(400);
});

test('administración: regla configurable, simulación y revocación (solo gestión)', async () => {
  const cajero = await login('CAJERO');
  const encargado = await login('ENCARGADO');
  await cajero.get('/api/wifi/config').expect(403);

  const actual = await encargado.get('/api/wifi/config');
  assert.equal(actual.body.config.minutosPorMil, 10);

  const nueva = { ...actual.body.config, minutosPorMil: 5, minutosMinimo: 20, minutosMaximo: 120, montoMinimo: 3000, redNombre: 'Emporio Clientes' };
  const guardada = await encargado.put('/api/wifi/config', nueva);
  assert.equal(guardada.status, 200);
  assert.deepEqual(
    guardada.body.ejemplos.find((e) => e.total === 8000),
    { total: 8000, minutos: 40 },
  );
  await encargado.put('/api/wifi/config', { ...nueva, minutosMinimo: 200 }).expect(400);

  const { wifi } = await cobrar(cajero, 'Latte', 3); // $8.400 con la regla nueva → 40 min
  assert.equal(wifi.minutos, 40);

  const lista = await encargado.get('/api/wifi/accesos');
  const acceso = lista.body.accesos.find((a) => a.codigo === wifi.codigo);
  assert.equal(acceso.estado, 'SIN_USAR');
  assert.ok(lista.body.resumen.emitidos >= 1);

  await encargado.post(`/api/wifi/accesos/${acceso.id}/revocar`).expect(200);
  await activar(wifi.codigo).expect(410);

  // Desactivado: los cobros ya no emiten código.
  await encargado.put('/api/wifi/config', { ...nueva, activo: false }).expect(200);
  assert.equal((await cobrar(cajero, 'Latte', 3)).wifi, null);
});
