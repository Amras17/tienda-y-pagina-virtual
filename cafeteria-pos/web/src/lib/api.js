const API_URL = import.meta.env.VITE_API_URL || '/api';
const CLAVE_SESION = 'pos_sesion';

export function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION)) || null;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion) {
  if (sesion) localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  else localStorage.removeItem(CLAVE_SESION);
}

// Lo registra AuthProvider: ante un 401 (token vencido) se cierra la sesión
// y se vuelve al login en vez de dejar la app mostrando errores.
let alExpirar = () => {};
export const onSesionExpirada = (fn) => {
  alExpirar = fn;
};

function headers(auth) {
  const h = { 'Content-Type': 'application/json' };
  const token = auth && leerSesion()?.token;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: headers(auth),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && auth) alExpirar();
    throw new Error(data?.error || `Error ${res.status}`);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body = {}) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  // Sin token: pantalla pública del cliente.
  publico: (path) => request(`/publico${path}`, { auth: false }),
};

// El PDF requiere el token, así que no basta un <a href>: se descarga con
// fetch y se abre como blob. La pestaña se abre ANTES del await para que el
// navegador no la bloquee como popup.
export async function abrirPdfBoleta(boletaId) {
  const pestana = window.open('', '_blank');
  try {
    const res = await fetch(`${API_URL}/boletas/${boletaId}/pdf`, { headers: headers(true) });
    if (!res.ok) throw new Error('No se pudo obtener el PDF');
    const url = URL.createObjectURL(await res.blob());
    if (pestana) pestana.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    pestana?.close();
    throw err;
  }
}
