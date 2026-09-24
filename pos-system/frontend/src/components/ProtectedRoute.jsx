import { Navigate } from 'react-router-dom';
import { estaAutenticado, getUsuario } from '../api/auth.js';

// Protege una ruta: exige sesion iniciada y, opcionalmente, uno de los
// roles permitidos. ENCARGADO hereda las vistas operativas de ADMIN salvo
// las explicitamente marcadas como "solo administracion" (gestion global).
export default function ProtectedRoute({ children, roles }) {
  if (!estaAutenticado()) return <Navigate to="/login" replace />;

  const usuario = getUsuario();
  if (roles && !roles.includes(usuario?.rol)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
