import { useCallback, useEffect, useRef, useState } from 'react';

// Carga datos de la API con estado de error y función para recargar.
export function useDatos(cargar, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const cargarRef = useCallback(cargar, deps);

  const recargar = useCallback(async () => {
    try {
      setData(await cargarRef());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [cargarRef]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { data, error, recargar, setError };
}

// Ejecuta `fn` cada `ms` milisegundos mientras la pestaña esté visible
// (una pantalla de comanda en segundo plano no consulta al servidor).
export function usePolling(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;

  useEffect(() => {
    let id;
    const tick = () => ref.current();
    const iniciar = () => {
      clearInterval(id);
      if (document.visibilityState === 'visible') {
        tick();
        id = setInterval(tick, ms);
      }
    };
    iniciar();
    document.addEventListener('visibilitychange', iniciar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', iniciar);
    };
  }, [ms]);
}

// Envuelve una acción async: evita dobles envíos y captura el error.
export function useAccion() {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const ejecutar = useCallback(async (fn) => {
    setOcupado(true);
    setError('');
    try {
      return await fn();
    } catch (err) {
      setError(err.message);
      return undefined;
    } finally {
      setOcupado(false);
    }
  }, []);
  return { ocupado, error, setError, ejecutar };
}
