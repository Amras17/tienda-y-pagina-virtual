import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import Layout, { RequireRole, SECCIONES } from './components/Layout.jsx';
import { inicioPorRol, useAuth } from './lib/auth.jsx';
import Login from './pages/Login.jsx';

// Cada pantalla es un chunk aparte: el cajero no descarga Chart.js del dashboard.
const PAGINAS = {
  '/mostrador': lazy(() => import('./pages/Mostrador.jsx')),
  '/mesas': lazy(() => import('./pages/Mesas.jsx')),
  '/comanda': lazy(() => import('./pages/Comanda.jsx')),
  '/boletas': lazy(() => import('./pages/Boletas.jsx')),
  '/stock': lazy(() => import('./pages/Stock.jsx')),
  '/carta': lazy(() => import('./pages/Carta.jsx')),
  '/proveedores': lazy(() => import('./pages/Proveedores.jsx')),
  '/dashboard': lazy(() => import('./pages/Dashboard.jsx')),
};
const PantallaCliente = lazy(() => import('./pages/PantallaCliente.jsx'));

function Inicio() {
  const { usuario } = useAuth();
  return <Navigate to={usuario ? inicioPorRol(usuario.rol) : '/login'} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<div className="cargando">Cargando…</div>}>
      <Routes>
        {/* Pantalla pública orientada al cliente: sin login ni menú. */}
        <Route path="/pantalla-cliente/mesa/:mesaId" element={<PantallaCliente />} />
        <Route path="/pantalla-cliente/orden/:codigo" element={<PantallaCliente />} />
        <Route path="/login" element={<Login />} />

        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          {SECCIONES.map(({ ruta, roles }) => {
            const Pagina = PAGINAS[ruta];
            return (
              <Route
                key={ruta}
                path={ruta}
                element={
                  <RequireRole roles={roles}>
                    <Pagina />
                  </RequireRole>
                }
              />
            );
          })}
          <Route path="*" element={<Inicio />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
