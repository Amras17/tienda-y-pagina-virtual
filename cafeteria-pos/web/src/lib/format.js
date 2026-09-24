const formatoCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const formatoNumero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 });

export const clp = (n) => formatoCLP.format(Math.round(n || 0));
export const num = (n) => formatoNumero.format(n || 0);
export const fechaHora = (f) => new Date(f).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });

export function duracion(segundos) {
  const m = Math.floor(segundos / 60);
  return `${m}:${String(segundos % 60).padStart(2, '0')}`;
}
