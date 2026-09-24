import { useState } from 'react';
import { Link } from 'react-router';
import { api, abrirPdfBoleta } from '../lib/api.js';
import { clp } from '../lib/format.js';
import { useAccion, useDatos } from '../lib/hooks.js';
import { Carrito, GrillaProductos, useCarrito, useProductosDisponibles } from '../components/pos.jsx';
import { Alerta } from '../components/ui.jsx';

export default function Mostrador() {
  const { data, error: errorCarga } = useDatos(() => api.get('/productos'));
  const productos = useProductosDisponibles(data, 'disponibleMostrador');
  const carrito = useCarrito();
  const [cliente, setCliente] = useState('');
  const [ultima, setUltima] = useState(null);
  const { ocupado, error, setError, ejecutar } = useAccion();

  async function cobrar() {
    setUltima(null);
    const r = await ejecutar(async () => {
      const venta = await api.post('/ventas', { tipo: 'MOSTRADOR', clienteNombre: cliente, items: carrito.items() });
      return api.post(`/ventas/${venta.id}/cobrar`);
    });
    if (r) {
      setUltima(r);
      carrito.vaciar();
      setCliente('');
    }
  }

  return (
    <div className="pos">
      <section>
        <h2>Mostrador</h2>
        <Alerta>{errorCarga}</Alerta>
        <GrillaProductos productos={productos} onAgregar={carrito.agregar} />
      </section>

      <aside className="panel-carrito">
        <h3>Pedido</h3>
        <Carrito carrito={carrito} />
        <input placeholder="Nombre del cliente (opcional)" value={cliente} maxLength={60} onChange={(e) => setCliente(e.target.value)} />
        <div className="total">Total {clp(carrito.total)}</div>
        <button className="btn btn-primario btn-bloque btn-grande" disabled={!carrito.lineas.length || ocupado} onClick={cobrar}>
          {ocupado ? 'Procesando…' : 'Cobrar'}
        </button>
        <Alerta>{error}</Alerta>
        {ultima && (
          <Alerta tipo="exito">
            Boleta N° {ultima.boleta.folio} emitida por {clp(ultima.venta.total)}.
            <div className="acciones">
              <button className="btn btn-sm" onClick={() => abrirPdfBoleta(ultima.boleta.id).catch((e) => setError(e.message))}>
                Ver / imprimir PDF
              </button>
              <Link className="btn btn-sm" to={`/pantalla-cliente/orden/${ultima.venta.codigo}`} target="_blank">
                Pantalla cliente
              </Link>
            </div>
          </Alerta>
        )}
      </aside>
    </div>
  );
}
