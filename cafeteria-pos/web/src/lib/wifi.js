// Espejo de server/src/services/wifiReglas.js para previsualizar la regla
// mientras se edita (el valor que vale es el que calcula el servidor al cobrar).
export function minutosPorConsumo(total, cfg) {
  const n = (k) => Number(cfg[k]) || 0;
  if (!cfg.activo || total < n('montoMinimo')) return 0;
  const redondeado = Math.floor(((total / 1000) * n('minutosPorMil')) / 5) * 5;
  return Math.min(n('minutosMaximo'), Math.max(n('minutosMinimo'), redondeado));
}

export function tiempo(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${seg}` : `${m}:${seg}`;
}

export const minutosTexto = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);
