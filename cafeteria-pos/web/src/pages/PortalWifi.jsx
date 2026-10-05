import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../lib/api.js';
import { useAccion } from '../lib/hooks.js';
import { minutosTexto, tiempo } from '../lib/wifi.js';

// Portal PÚBLICO (sin login) donde el cliente canjea el código de su boleta.
// Pensado para abrirse en el celular: el router de la red de clientes lo
// muestra como portal cautivo y agrega la MAC del equipo en la URL; cada
// fabricante la llama distinto.
const PARAMETROS_MAC = ['mac', 'clientMac', 'client_mac', 'id'];

// "ab12cd34" → "AB12-CD34" mientras se escribe.
function formatear(texto) {
  const limpio = texto.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return limpio.length > 4 ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio;
}

// Solo se ofrece volver a páginas http(s), nunca a otros esquemas.
function destinoSeguro(url) {
  try {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

export default function PortalWifi() {
  const [params] = useSearchParams();
  const mac = PARAMETROS_MAC.map((k) => params.get(k)).find(Boolean) || null;
  const destino = destinoSeguro(params.get('url') || params.get('redirect') || '');
  const [codigo, setCodigo] = useState(formatear(params.get('codigo') || ''));
  const [acceso, setAcceso] = useState(null);
  const [restante, setRestante] = useState(0);
  const { ocupado, error, ejecutar } = useAccion();

  // Cuenta regresiva local a partir de lo que informó el servidor.
  useEffect(() => {
    if (!acceso) return undefined;
    setRestante(acceso.restanteSegundos);
    if (acceso.estado !== 'ACTIVO') return undefined;
    const fin = Date.now() + acceso.restanteSegundos * 1000;
    const id = setInterval(() => setRestante(Math.max(0, (fin - Date.now()) / 1000)), 1000);
    return () => clearInterval(id);
  }, [acceso]);

  async function conectar(e) {
    e.preventDefault();
    const r = await ejecutar(() => api.publicoPost('/wifi/activar', { codigo, mac }));
    if (r) setAcceso(r);
  }

  const agotado = acceso && restante <= 0;

  return (
    <div className="portal-wifi">
      <div className="portal-wifi-tarjeta">
        <p className="portal-wifi-icono" aria-hidden="true">📶</p>
        <h1>WiFi de cortesía</h1>

        {!acceso || agotado ? (
          <form onSubmit={conectar}>
            <p>{agotado ? 'Tu tiempo de navegación terminó. ¡Gracias por tu visita!' : 'Escribe el código impreso en tu boleta.'}</p>
            <input
              className="portal-wifi-codigo"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABCD-2345"
              aria-label="Código WiFi"
              value={codigo}
              onChange={(e) => setCodigo(formatear(e.target.value))}
            />
            <button className="btn btn-primario btn-bloque btn-grande" disabled={codigo.length !== 9 || ocupado}>
              {ocupado ? 'Conectando…' : 'Conectar'}
            </button>
            {error && <p className="portal-wifi-error">{error}</p>}
          </form>
        ) : (
          <div className="portal-wifi-ok">
            <p>¡Listo! Ya puedes navegar{acceso.red ? ` en la red ${acceso.red}` : ''}.</p>
            <div className="portal-wifi-reloj">{tiempo(restante)}</div>
            <p className="texto-suave">
              Tiempo restante de {minutosTexto(acceso.minutos)}. Si te desconectas, vuelve a ingresar el mismo código: el
              tiempo sigue desde donde quedó.
            </p>
            {destino && (
              <a className="btn btn-primario btn-bloque" href={destino}>
                Seguir navegando
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
