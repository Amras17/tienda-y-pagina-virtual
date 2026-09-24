import { Link, useNavigate } from 'react-router-dom';
import { getUsuario, cerrarSesion } from '../api/auth.js';

export default function Navbar() {
  const usuario = getUsuario();
  const navigate = useNavigate();

  if (!usuario) return null;

  const esAdminOEncargado = usuario.rol === 'ADMIN' || usuario.rol === 'ENCARGADO';

  function salir() {
    cerrarSesion();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">☕ POS Cafetería</div>
      <div className="navbar-links">
        <Link to="/mostrador">Mostrador</Link>
        <Link to="/mesas">Mesas</Link>
        <Link to="/comanda">Comanda</Link>
        {esAdminOEncargado && <Link to="/stock">Stock</Link>}
        {esAdminOEncargado && <Link to="/recetas">Recetas</Link>}
        {esAdminOEncargado && <Link to="/proveedores">Proveedores</Link>}
        {esAdminOEncargado && <Link to="/dashboard">Dashboard</Link>}
        <Link to="/boletas">Boletas</Link>
      </div>
      <div className="navbar-user">
        <span>{usuario.nombre} ({usuario.rol})</span>
        <button onClick={salir} className="btn btn-secondary btn-sm">Salir</button>
      </div>
    </nav>
  );
}
