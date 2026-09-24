import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';

const INTERVALO_POLLING_MS = 5000;

function formatearTiempo(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Pantalla de comanda (cocina/barra): solo lo operativo, sin precios ni
// totales ni datos de costeo, tal como exige el diseño del sistema.
export default function Comanda() {
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const data = await api.get('/comanda/pendientes');
      setPedidos(data);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, INTERVALO_POLLING_MS);
    return () => clearInterval(id);
  }, [cargar]);

  async function marcarListo(itemId) {
    await api.post(`/comanda/items/${itemId}/listo`, {});
    cargar();
  }

  return (
    <div>
      <h2>Comanda — Pedidos pendientes</h2>
      <p className="text-muted">Se actualiza automáticamente cada {INTERVALO_POLLING_MS / 1000} segundos.</p>
      {error && <div className="alert alert-error">{error}</div>}

      {pedidos.length === 0 && <p className="text-muted">No hay pedidos pendientes.</p>}

      <div className="grid-comanda">
        {pedidos.map((pedido) => (
          <div key={pedido.ventaId} className="card-comanda">
            <div className="card-comanda-header">
              <strong>{pedido.tipo === 'MESA' ? `Mesa ${pedido.mesaNumero}` : 'Mostrador'}</strong>
              <span>Orden #{pedido.ventaId}</span>
              <span className="badge">{formatearTiempo(pedido.segundosTranscurridos)}</span>
            </div>
            <ul className="lista-comanda">
              {pedido.items.map((item) => (
                <li key={item.itemId}>
                  <span>{item.cantidad} x {item.nombreProducto}</span>
                  {item.notas && <em>{item.notas}</em>}
                  <button className="btn btn-sm btn-primary" onClick={() => marcarListo(item.itemId)}>Listo</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
