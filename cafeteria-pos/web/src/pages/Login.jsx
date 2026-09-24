import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { inicioPorRol, useAuth } from '../lib/auth.jsx';
import { useAccion } from '../lib/hooks.js';
import { Alerta } from '../components/ui.jsx';

const DEMO = ['admin', 'encargado', 'cajero', 'garzon'];

export default function Login() {
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { ocupado, error, ejecutar } = useAccion();

  if (usuario) return <Navigate to={inicioPorRol(usuario.rol)} replace />;

  async function enviar(e) {
    e.preventDefault();
    const u = await ejecutar(() => login(email, password));
    if (u) navigate(inicioPorRol(u.rol), { replace: true });
  }

  return (
    <div className="login">
      <form className="login-tarjeta" onSubmit={enviar}>
        <h1>☕ POS Cafetería</h1>
        <p className="texto-suave">Inicia sesión para continuar</p>
        <Alerta>{error}</Alerta>
        <label>
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn btn-primario" disabled={ocupado}>
          {ocupado ? 'Ingresando…' : 'Ingresar'}
        </button>
        <div className="login-demo">
          <strong>Usuarios demo</strong> (contraseña <code>demo1234</code>)
          <div className="chips">
            {DEMO.map((u) => (
              <button
                type="button"
                key={u}
                className="chip"
                onClick={() => {
                  setEmail(`${u}@cafeteria.cl`);
                  setPassword('demo1234');
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
