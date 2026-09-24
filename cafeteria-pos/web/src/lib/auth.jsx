import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, guardarSesion, leerSesion, onSesionExpirada } from './api.js';

// Grupos de roles (espejo de server/src/lib/roles.js).
export const GESTION = ['ADMIN', 'ENCARGADO'];
export const CAJA = ['ADMIN', 'ENCARGADO', 'CAJERO'];
export const INTERNOS = ['ADMIN', 'ENCARGADO', 'CAJERO', 'GARZON'];

export const inicioPorRol = (rol) => (rol === 'GARZON' ? '/mesas' : '/mostrador');

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesion);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    guardarSesion(null);
    setSesion(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => onSesionExpirada(logout), [logout]);

  const login = useCallback(async (email, password) => {
    const nueva = await api.login(email, password);
    guardarSesion(nueva);
    setSesion(nueva);
    return nueva.usuario;
  }, []);

  const valor = useMemo(() => {
    const usuario = sesion?.usuario ?? null;
    return { usuario, login, logout, puede: (roles) => !!usuario && roles.includes(usuario.rol) };
  }, [sesion, login, logout]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
