import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client.js';

const INTERVALO_POLLING_MS = 5000;

// Pantalla PUBLICA orientada al cliente (sin login), pensada para un
// monitor/tablet en el mostrador o la mesa. Consume /api/publico/*, que
// deliberadamente NO expone costos, márgenes, insumos ni datos de otras
// ventas/mesas: solo el pedido propio, su estado y el total con IVA.
export default function PantallaCliente() {
  const { mesaId, ventaId } = useParams();
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const ruta = ventaId ? `/publico/venta/${ventaId}` : `/publico/mesa/${mesaId}`;
      const data = await api.getPublic(ruta);
      setPedido(data);
      setError('');
    } catch (err) {
      setPedido(null);
      setError(err.message);
    }
  }, [mesaId, ventaId]);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, INTERVALO_POLLING_MS);
    return () => clearInterval(id);
  }, [cargar]);

  return (
    <div className="pantalla-cliente">
      <h1>☕ Su pedido</h1>
      {error && <p className="pantalla-cliente-vacio">{error}</p>}
      {pedido && (
        <div className="pantalla-cliente-card">
          {pedido.mesaNumero && <p className="pantalla-cliente-mesa">Mesa {pedido.mesaNumero}</p>}
          <ul className="pantalla-cliente-items">
            {pedido.items.map((item, idx) => (
              <li key={idx}>{item.cantidad} x {item.nombreProducto}</li>
            ))}
          </ul>
          <div className={`pantalla-cliente-estado estado-${pedido.estado === 'Listo para retirar' ? 'listo' : 'preparando'}`}>
            {pedido.estado}
          </div>
          <div className="pantalla-cliente-total">Total a pagar: ${pedido.total.toLocaleString('es-CL')}</div>
        </div>
      )}
    </div>
  );
}
