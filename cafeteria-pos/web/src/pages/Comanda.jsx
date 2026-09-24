import { api } from '../lib/api.js';
import { duracion } from '../lib/format.js';
import { useDatos, usePolling } from '../lib/hooks.js';
import { Alerta, Vacio } from '../components/ui.jsx';

const INTERVALO_MS = 5000;
const DEMORA_SEG = 10 * 60;

// Barra/cocina: solo lo operativo. El backend nunca envía precios ni totales.
export default function Comanda() {
  const { data: pedidos, error, setError, recargar } = useDatos(() => api.get('/comanda/pendientes'));
  usePolling(recargar, INTERVALO_MS);

  async function marcar(ruta) {
    try {
      await api.post(ruta);
      await recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Comanda</h2>
      <p className="texto-suave">Se actualiza sola cada {INTERVALO_MS / 1000} segundos.</p>
      <Alerta>{error}</Alerta>
      {pedidos?.length === 0 && <Vacio>No hay pedidos pendientes. ☕</Vacio>}

      <div className="grilla-comanda">
        {pedidos?.map((p) => (
          <article key={p.ventaId} className={`tarjeta-comanda ${p.segundosTranscurridos > DEMORA_SEG ? 'demorada' : ''}`}>
            <header>
              <strong>{p.tipo === 'MESA' ? `Mesa ${p.mesaNumero}` : 'Mostrador'}</strong>
              <span>#{p.ventaId}{p.clienteNombre && ` · ${p.clienteNombre}`}</span>
              <span className="insignia">{duracion(p.segundosTranscurridos)}</span>
            </header>
            <ul>
              {p.items.map((i) => (
                <li key={i.itemId}>
                  <div>
                    <strong>{i.cantidad} × {i.nombreProducto}</strong>
                    {i.notas && <em>{i.notas}</em>}
                  </div>
                  <button className="btn btn-sm btn-primario" onClick={() => marcar(`/comanda/items/${i.itemId}/listo`)}>
                    Listo
                  </button>
                </li>
              ))}
            </ul>
            {p.items.length > 1 && (
              <button className="btn btn-sm btn-bloque" onClick={() => marcar(`/comanda/ventas/${p.ventaId}/listo`)}>
                Todo listo
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
