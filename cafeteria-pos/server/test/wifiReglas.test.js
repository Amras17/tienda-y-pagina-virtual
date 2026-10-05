import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estadoAcceso,
  generarCodigo,
  minutosPorConsumo,
  normalizarCodigo,
  normalizarMac,
} from '../src/services/wifiReglas.js';

// Reglas puras: no necesitan base de datos.
const REGLA = { activo: true, minutosPorMil: 10, minutosMinimo: 30, minutosMaximo: 180, montoMinimo: 2000 };

test('minutos proporcionales al ticket, redondeados a 5 y acotados', () => {
  assert.equal(minutosPorConsumo(1500, REGLA), 0); // bajo el monto mínimo: sin WiFi
  assert.equal(minutosPorConsumo(2000, REGLA), 30); // 20 min → sube al mínimo
  assert.equal(minutosPorConsumo(4800, REGLA), 45); // 48 min → baja a 45
  assert.equal(minutosPorConsumo(9000, REGLA), 90);
  assert.equal(minutosPorConsumo(50000, REGLA), 180); // tope
  assert.equal(minutosPorConsumo(9000, { ...REGLA, activo: false }), 0);
  // Proporcional: más consumo nunca da menos minutos.
  let anterior = 0;
  for (let total = 2000; total <= 40000; total += 700) {
    const m = minutosPorConsumo(total, REGLA);
    assert.ok(m >= anterior);
    assert.equal(m % 5, 0);
    anterior = m;
  }
});

test('códigos legibles y normalización de lo que escribe el cliente', () => {
  for (let i = 0; i < 200; i++) assert.match(generarCodigo(), /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(normalizarCodigo(' ab2c d3ef '), 'AB2C-D3EF');
  assert.equal(normalizarCodigo('AB2C-D3E'), null); // incompleto
  assert.equal(normalizarCodigo('AB0C-D3EF'), null); // el 0 no existe en el alfabeto
  assert.equal(normalizarMac('aa-bb-cc-dd-ee-ff'), 'AA:BB:CC:DD:EE:FF');
  assert.equal(normalizarMac('aabb.ccdd.eeff'), 'AA:BB:CC:DD:EE:FF');
  assert.equal(normalizarMac('no-es-mac'), null);
});

test('estado del acceso según el reloj', () => {
  const ahora = new Date('2026-10-05T15:00:00Z');
  const base = { minutos: 60, revocado: false, activableHasta: new Date('2026-10-05T20:00:00Z') };
  assert.deepEqual(estadoAcceso(base, ahora), { estado: 'SIN_USAR', restanteSegundos: 3600 });
  assert.equal(estadoAcceso({ ...base, activableHasta: new Date('2026-10-05T14:00:00Z') }, ahora).estado, 'CADUCADO');
  const activo = { ...base, activadoEn: new Date('2026-10-05T14:30:00Z'), expiraEn: new Date('2026-10-05T15:30:00Z') };
  assert.deepEqual(estadoAcceso(activo, ahora), { estado: 'ACTIVO', restanteSegundos: 1800 });
  assert.equal(estadoAcceso({ ...activo, expiraEn: new Date('2026-10-05T14:59:00Z') }, ahora).estado, 'AGOTADO');
  assert.equal(estadoAcceso({ ...activo, revocado: true }, ahora).estado, 'REVOCADO');
});
