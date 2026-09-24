import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import POSMostrador from './pages/POSMostrador.jsx';
import POSMesas from './pages/POSMesas.jsx';
import Stock from './pages/Stock.jsx';
import Recetas from './pages/Recetas.jsx';
import Proveedores from './pages/Proveedores.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Boletas from './pages/Boletas.jsx';
import Comanda from './pages/Comanda.jsx';
import PantallaCliente from './pages/PantallaCliente.jsx';

const ROLES_ADMIN_ENCARGADO = ['ADMIN', 'ENCARGADO'];
const ROLES_TODOS_INTERNOS = ['ADMIN', 'ENCARGADO', 'CAJERO', 'GARZON'];

export default function App() {
  return (
    <Routes>
      {/* Pantalla publica orientada al cliente: sin login, sin Navbar. */}
      <Route path="/pantalla-cliente/mesa/:mesaId" element={<PantallaCliente />} />
      <Route path="/pantalla-cliente/orden/:ventaId" element={<PantallaCliente />} />

      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute roles={ROLES_TODOS_INTERNOS}>
            <div className="app-shell">
              <Navbar />
              <main className="app-content">
                <Routes>
                  <Route path="/" element={<Navigate to="/mostrador" replace />} />
                  <Route path="/mostrador" element={<POSMostrador />} />
                  <Route path="/mesas" element={<POSMesas />} />
                  <Route path="/comanda" element={<Comanda />} />
                  <Route path="/boletas" element={<Boletas />} />
                  <Route
                    path="/stock"
                    element={<ProtectedRoute roles={ROLES_ADMIN_ENCARGADO}><Stock /></ProtectedRoute>}
                  />
                  <Route
                    path="/recetas"
                    element={<ProtectedRoute roles={ROLES_ADMIN_ENCARGADO}><Recetas /></ProtectedRoute>}
                  />
                  <Route
                    path="/proveedores"
                    element={<ProtectedRoute roles={ROLES_ADMIN_ENCARGADO}><Proveedores /></ProtectedRoute>}
                  />
                  <Route
                    path="/dashboard"
                    element={<ProtectedRoute roles={ROLES_ADMIN_ENCARGADO}><Dashboard /></ProtectedRoute>}
                  />
                  <Route path="*" element={<Navigate to="/mostrador" replace />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
