import { randomBytes } from 'node:crypto';

// Reglas puras del WiFi por consumo (sin base de datos, fáciles de probar).

export const REDONDEO_MINUTOS = 5;

// Minutos de WiFi que corresponden a un total pagado (CLP, IVA incluido).
//   - Bajo `montoMinimo`, o con el WiFi desactivado: 0 (no se emite código).
//   - Proporcional: `minutosPorMil` por cada $1.000, redondeado hacia abajo a
//     múltiplos de 5 para que el número impreso sea fácil de leer.
//   - Acotado entre `minutosMinimo` y `minutosMaximo`.
export function minutosPorConsumo(total, cfg) {
  if (!cfg.activo || total < cfg.montoMinimo) return 0;
  const bruto = (total / 1000) * cfg.minutosPorMil;
  const redondeado = Math.floor(bruto / REDONDEO_MINUTOS) * REDONDEO_MINUTOS;
  return Math.min(cfg.minutosMaximo, Math.max(cfg.minutosMinimo, redondeado));
}

// Sin 0/O ni 1/I: el código se dicta y se escribe en el celular sin confusión.
// 32 símbolos: un byte % 32 no tiene sesgo (256 es múltiplo de 32).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO = 8;

export function generarCodigo(azar = randomBytes) {
  const bytes = azar(LARGO);
  let codigo = '';
  for (let i = 0; i < LARGO; i++) codigo += ALFABETO[bytes[i] % ALFABETO.length];
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}

// Acepta lo que escribe el cliente ("ab12 cd34", "AB12CD34", "ab12-cd34") y
// lo deja en el formato guardado. Devuelve null si no puede ser un código.
export function normalizarCodigo(texto) {
  const limpio = String(texto ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (limpio.length !== LARGO) return null;
  if ([...limpio].some((c) => !ALFABETO.includes(c))) return null;
  return `${limpio.slice(0, 4)}-${limpio.slice(4)}`;
}

export const ESTADOS_ACCESO = {
  SIN_USAR: 'Sin usar',
  ACTIVO: 'Activo',
  AGOTADO: 'Tiempo agotado',
  CADUCADO: 'Caducado sin usar',
  REVOCADO: 'Revocado',
};

// Estado de un acceso en un instante dado y segundos de navegación restantes.
export function estadoAcceso(acceso, ahora = new Date()) {
  if (acceso.revocado) return { estado: 'REVOCADO', restanteSegundos: 0 };
  if (!acceso.activadoEn) {
    return new Date(acceso.activableHasta) > ahora
      ? { estado: 'SIN_USAR', restanteSegundos: acceso.minutos * 60 }
      : { estado: 'CADUCADO', restanteSegundos: 0 };
  }
  const restante = Math.floor((new Date(acceso.expiraEn) - ahora) / 1000);
  return restante > 0 ? { estado: 'ACTIVO', restanteSegundos: restante } : { estado: 'AGOTADO', restanteSegundos: 0 };
}

export const listaMacs = (macs) => (macs ? macs.split(',').filter(Boolean) : []);

// "AA-BB-CC-DD-EE-FF", "aabb.ccdd.eeff"… → "AA:BB:CC:DD:EE:FF". null si no es una MAC.
export function normalizarMac(texto) {
  const hex = String(texto ?? '')
    .toUpperCase()
    .replace(/[^0-9A-F]/g, '');
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g).join(':');
}
