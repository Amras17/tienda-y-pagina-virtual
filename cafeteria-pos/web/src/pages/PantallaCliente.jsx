import { useParams } from 'react-router';
import { api } from '../lib/api.js';
import { clp } from '../lib/format.js';
import { useDatos, usePolling } from '../lib/hooks.js';

// Pantalla PÚBLICA para el cliente (tablet/monitor, sin login). Consume
// /api/publico/*, que solo expone el pedido propio: ítems, estado y total.
export default function PantallaCliente() {
  const { mesaId, codigo } = useParams();
  const ruta = codigo ? `/orden/${codigo}` : `/mesa/${mesaId}`;
  const { data: pedido, error, recargar } = useDatos(() => api.publico(ruta), [ruta]);
  usePolling(recargar, 5000);

  const listo = pedido?.estado === 'Listo para retirar';

  return (
    <div className="pantalla-cliente">
      <h1>☕ Su pedido</h1>
      {error && <p className="pantalla-cliente-vacio">{error}</p>}
      {pedido && !error && (
        <div className="pantalla-cliente-tarjeta">
          {pedido.mesaNumero && <p className="pantalla-cliente-mesa">Mesa {pedido.mesaNumero}</p>}
          <ul>
            {pedido.items.map((i, idx) => (
              <li key={idx}>
                <span>{i.cantidad} ×</span> {i.nombreProducto}
              </li>
            ))}
          </ul>
          <div className={`pantalla-cliente-estado ${listo ? 'listo' : ''}`}>{pedido.estado}</div>
          <div className="pantalla-cliente-total">Total {clp(pedido.total)}</div>
        </div>
      )}
    </div>
  );
}
