import { prisma } from '../db.js';
import { HttpError, badRequest, conflict, notFound } from '../lib/errors.js';
import { autorizarDispositivo, revocarDispositivos } from './routerWifi.js';
import {
  ESTADOS_ACCESO,
  estadoAcceso,
  generarCodigo,
  listaMacs,
  minutosPorConsumo,
  normalizarCodigo,
  normalizarMac,
} from './wifiReglas.js';

// Valores por defecto, iguales a los del esquema (por si la fila se borrara).
const CONFIG_INICIAL = {
  id: 1,
  activo: true,
  minutosPorMil: 10,
  minutosMinimo: 30,
  minutosMaximo: 180,
  montoMinimo: 2000,
  dispositivos: 1,
  horasParaActivar: 12,
  redNombre: '',
  portalUrl: '',
};

export async function obtenerConfig(db = prisma) {
  return (await db.configWifi.findUnique({ where: { id: 1 } })) ?? CONFIG_INICIAL;
}

export async function guardarConfig(datos) {
  return prisma.configWifi.upsert({ where: { id: 1 }, create: { ...datos, id: 1 }, update: datos });
}

// Montos de referencia para que el encargado vea el efecto de la regla.
export const MONTOS_EJEMPLO = [1500, 3000, 5000, 8000, 12000, 20000, 30000];
export const simular = (cfg) => MONTOS_EJEMPLO.map((total) => ({ total, minutos: minutosPorConsumo(total, cfg) }));

// Se llama DENTRO de la transacción de cobro: si la venta se cobra, el código
// existe; si el cobro falla, no queda un código huérfano.
export async function emitirAccesoWifi(tx, venta) {
  const cfg = await obtenerConfig(tx);
  const minutos = minutosPorConsumo(venta.total, cfg);
  if (!minutos) return null;

  let codigo = null;
  for (let intento = 0; intento < 5 && !codigo; intento++) {
    const candidato = generarCodigo();
    const ocupado = await tx.accesoWifi.findUnique({ where: { codigo: candidato }, select: { id: true } });
    if (!ocupado) codigo = candidato;
  }
  if (!codigo) throw new Error('No se pudo generar un código WiFi único');

  return tx.accesoWifi.create({
    data: {
      codigo,
      ventaId: venta.id,
      montoBase: venta.total,
      minutos,
      dispositivos: cfg.dispositivos,
      activableHasta: new Date(Date.now() + cfg.horasParaActivar * 3_600_000),
    },
  });
}

// Lo que ve el cliente: nunca la venta, el monto ni las MAC.
export function proyeccionPublica(acceso, cfg, ahora = new Date()) {
  const { estado, restanteSegundos } = estadoAcceso(acceso, ahora);
  return {
    codigo: acceso.codigo,
    minutos: acceso.minutos,
    estado,
    estadoTexto: ESTADOS_ACCESO[estado],
    restanteSegundos,
    activableHasta: acceso.activableHasta,
    expiraEn: acceso.expiraEn,
    red: cfg.redNombre || null,
  };
}

function buscarPorCodigo(db, texto) {
  const codigo = normalizarCodigo(texto);
  if (!codigo) throw badRequest('El código tiene 8 caracteres, por ejemplo ABCD-2345');
  return db.accesoWifi.findUnique({ where: { codigo } });
}

export async function consultarAcceso(texto) {
  const acceso = await buscarPorCodigo(prisma, texto);
  if (!acceso) throw notFound('Código no encontrado. Revisa que esté bien escrito.');
  return proyeccionPublica(acceso, await obtenerConfig());
}

const MENSAJE_NO_DISPONIBLE = {
  REVOCADO: 'Este código fue desactivado. Consulta en caja.',
  CADUCADO: 'Este código venció sin usarse. Consulta en caja.',
  AGOTADO: 'El tiempo de este código ya se usó por completo.',
};

// Primera activación: el reloj empieza a correr. Activaciones siguientes
// (reconexión, otro equipo dentro del límite): devuelven el tiempo restante.
// Con MAC (enviada por el router) se respeta el límite de equipos por código.
export async function activarAcceso(texto, macTexto) {
  const mac = macTexto ? normalizarMac(macTexto) : null;

  const acceso = await prisma.$transaction(async (tx) => {
    const actual = await buscarPorCodigo(tx, texto);
    if (!actual) throw notFound('Código no encontrado. Revisa que esté bien escrito.');

    const ahora = new Date();
    const { estado } = estadoAcceso(actual, ahora);
    if (MENSAJE_NO_DISPONIBLE[estado]) throw new HttpError(410, MENSAJE_NO_DISPONIBLE[estado]);

    const data = {};
    const macs = listaMacs(actual.macs);
    if (mac && !macs.includes(mac)) {
      if (macs.length >= actual.dispositivos) {
        throw conflict(
          actual.dispositivos === 1
            ? 'Este código ya se está usando en otro equipo.'
            : `Este código ya se está usando en ${actual.dispositivos} equipos.`,
        );
      }
      data.macs = [...macs, mac].join(',');
    }
    if (!actual.activadoEn) {
      data.activadoEn = ahora;
      data.expiraEn = new Date(ahora.getTime() + actual.minutos * 60_000);
    }
    if (!Object.keys(data).length) return actual;

    // Condicionado a los valores leídos: si otro equipo activó el mismo código
    // en paralelo, uno de los dos reintenta en vez de pasar el límite.
    const { count } = await tx.accesoWifi.updateMany({
      where: { id: actual.id, macs: actual.macs, activadoEn: actual.activadoEn },
      data,
    });
    if (count === 0) throw conflict('El código se está activando en otro equipo. Intenta de nuevo.');
    return tx.accesoWifi.findUnique({ where: { id: actual.id } });
  });

  const vista = proyeccionPublica(acceso, await obtenerConfig());
  await autorizarDispositivo({ codigo: acceso.codigo, mac, segundos: vista.restanteSegundos });
  return vista;
}

export async function listarAccesos(limit) {
  const accesos = await prisma.accesoWifi.findMany({
    orderBy: { creadoEn: 'desc' },
    take: limit,
    include: { venta: { select: { tipo: true, mesa: { select: { numero: true } }, boleta: { select: { folio: true } } } } },
  });
  const ahora = new Date();
  return accesos.map(({ venta, macs, ...a }) => {
    const { estado, restanteSegundos } = estadoAcceso(a, ahora);
    return {
      ...a,
      equiposConectados: listaMacs(macs).length,
      estado,
      estadoTexto: ESTADOS_ACCESO[estado],
      restanteSegundos,
      origen: venta.tipo === 'MESA' ? `Mesa ${venta.mesa?.numero}` : 'Mostrador',
      folio: venta.boleta?.folio ?? null,
    };
  });
}

// Resumen del día (hora local del servidor): códigos emitidos, usados y minutos.
export async function resumenDelDia() {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const [emitidos, usados] = await Promise.all([
    prisma.accesoWifi.aggregate({ where: { creadoEn: { gte: inicio } }, _count: true, _sum: { minutos: true } }),
    prisma.accesoWifi.count({ where: { creadoEn: { gte: inicio }, activadoEn: { not: null } } }),
  ]);
  return { emitidos: emitidos._count, usados, minutosOtorgados: emitidos._sum.minutos ?? 0 };
}

export async function revocarAcceso(id) {
  const acceso = await prisma.accesoWifi.findUnique({ where: { id } });
  if (!acceso) throw notFound('Acceso WiFi no encontrado');
  const actualizado = await prisma.accesoWifi.update({ where: { id }, data: { revocado: true } });
  await revocarDispositivos({ codigo: acceso.codigo, macs: listaMacs(acceso.macs) });
  return actualizado;
}
