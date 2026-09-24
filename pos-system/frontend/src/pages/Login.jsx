import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { guardarSesion } from '../api/auth.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const data = await api.post('/auth/login', { email, password });
      guardarSesion(data.token, data.usuario);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>☕ POS Cafetería</h1>
        <p className="text-muted">Inicia sesión para continuar</p>
        {error && <div className="alert alert-error">{error}</div>}
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@cafeteria.cl" />
        <label>Contraseña</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="demo1234" />
        <button className="btn btn-primary" type="submit" disabled={cargando}>
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
        <div className="login-hint">
          <strong>Usuarios demo</strong> (contraseña: demo1234)
          <ul>
            <li>admin@cafeteria.cl</li>
            <li>encargado@cafeteria.cl</li>
            <li>cajero@cafeteria.cl</li>
            <li>garzon@cafeteria.cl</li>
          </ul>
        </div>
      </form>
    </div>
  );
}
