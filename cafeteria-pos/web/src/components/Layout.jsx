import { NavLink, Navigate, Outlet } from 'react-router';
import { CAJA, GESTION, INTERNOS, useAuth } from '../lib/auth.jsx';

// Única fuente de verdad de las secciones: la usa el menú y el guardia de rutas.
export const SECCIONES = [
  { ruta: '/mostrador', titulo: 'Mostrador', roles: CAJA },
  { ruta: '/mesas', titulo: 'Mesas', roles: INTERNOS },
  { ruta: '/comanda', titulo: 'Comanda', roles: INTERNOS },
  { ruta: '/boletas', titulo: 'Boletas', roles: INTERNOS },
  { ruta: '/stock', titulo: 'Stock', roles: GESTION },
  { ruta: '/carta', titulo: 'Carta y recetas', roles: GESTION },
  { ruta: '/proveedores', titulo: 'Proveedores', roles: GESTION },
  { ruta: '/dashboard', titulo: 'Dashboard', roles: GESTION },
];

export default function Layout() {
  const { usuario, logout, puede } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;

  return (
    <div className="app">
      <header className="navbar">
        <span className="navbar-marca">☕ POS Cafetería</span>
        <nav className="navbar-links">
          {SECCIONES.filter((s) => puede(s.roles)).map((s) => (
            <NavLink key={s.ruta} to={s.ruta}>
              {s.titulo}
            </NavLink>
          ))}
        </nav>
        <div className="navbar-usuario">
          <span>
            {usuario.nombre} <small>({usuario.rol})</small>
          </span>
          <button className="btn btn-claro btn-sm" onClick={logout}>
            Salir
          </button>
        </div>
      </header>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}

export function RequireRole({ roles, children }) {
  const { usuario, puede } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return puede(roles) ? children : <Navigate to="/" replace />;
}
