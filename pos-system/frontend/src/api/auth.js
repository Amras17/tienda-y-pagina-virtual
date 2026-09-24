export function getUsuario() {
  const raw = localStorage.getItem('pos_usuario');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(token, usuario) {
  localStorage.setItem('pos_token', token);
  localStorage.setItem('pos_usuario', JSON.stringify(usuario));
}

export function cerrarSesion() {
  localStorage.removeItem('pos_token');
  localStorage.removeItem('pos_usuario');
}

export function estaAutenticado() {
  return !!localStorage.getItem('pos_token');
}
