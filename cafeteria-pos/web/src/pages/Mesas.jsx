import { useState } from 'react';
import { Link } from 'react-router';
import { api, abrirPdfBoleta } from '../lib/api.js';
import { GESTION, useAuth } from '../lib/auth.jsx';
import { clp } from '../lib/format.js';
import { useAccion, useDatos, usePolling } from '../lib/hooks.js';
import { Carrito, GrillaProductos, useCarrito, useProductosDisponibles } from '../components/pos.jsx';
import { Alerta } from '../components/ui.jsx';

export default function Mesas() {
  const { puede } = useAuth();
  const mesas = useDatos(() => api.get('/mesas'));
  const { data: catalogo } = useDatos(() => api.get('/productos'));
  const productos = useProductosDisponibles(catalogo, 'disponibleMesa');
  const [mesaId, setMesaId] = useState(null);
  const [ultimaBoleta, setUltimaBoleta] = useState(null);
  const carrito = useCarrito();
  const { ocupado, error, setError, ejecutar } = useAccion();

  // Varios garzones/cajeros ven el mismo plano de mesas actualizado.
  usePolling(mesas.recargar, 10_000);

  const mesa = mesas.data?.find((m) => m.id === mesaId);
  const venta = mesa?.ventaAbierta;

  function seleccionar(id) {
    setMesaId(id);
    setUltimaBoleta(null);
    setError('');
    carrito.vaciar();
  }

  async function enviarPedido() {
    const ok = await ejecutar(() =>
      venta
        ? api.post(`/ventas/${venta.id}/items`, { items: carrito.items() })
        : api.post('/ventas', { tipo: 'MESA', mesaId, items: carrito.items() }),
    );
    if (ok) {
      carrito.vaciar();
      await mesas.recargar();
    }
  }

  async function cobrar() {
    const r = await ejecutar(() => api.post(`/ventas/${venta.id}/cobrar`));
    if (r) {
      setUltimaBoleta(r.boleta);
      await mesas.recargar();
    }
  }

  async function anular() {
    if (!window.confirm(`¿Anular el pedido de la mesa ${mesa.numero}?`)) return;
    if (await ejecutar(() => api.post(`/ventas/${venta.id}/anular`))) await mesas.recargar();
  }

  return (
    <div>
      <h2>Mesas</h2>
      <Alerta>{mesas.error}</Alerta>
      <div className="grilla-mesas">
        {mesas.data?.map((m) => (
          <button
            key={m.id}
            className={`tarjeta-mesa ${m.estado === 'OCUPADA' ? 'ocupada' : 'libre'} ${m.id === mesaId ? 'seleccionada' : ''}`}
            onClick={() => seleccionar(m.id)}
          >
            <strong>Mesa {m.numero}</strong>
            <span>{m.capacidad} personas</span>
            <span className="insignia">{m.estado === 'OCUPADA' ? clp(m.ventaAbierta.total) : 'Libre'}</span>
          </button>
        ))}
      </div>

      {mesa && (
        <div className="pos detalle-mesa">
          <section>
            <h3>Agregar a mesa {mesa.numero}</h3>
            <GrillaProductos productos={productos} onAgregar={carrito.agregar} />
          </section>

          <aside className="panel-carrito">
            <div className="fila-titulo">
              <h3>Mesa {mesa.numero}</h3>
              <Link to={`/pantalla-cliente/mesa/${mesa.id}`} target="_blank" className="enlace-suave">
                Pantalla de la mesa ↗
              </Link>
            </div>

            {venta ? (
              <>
                <h4>Pedido actual #{venta.id}</h4>
                <ul className="lista-simple">
                  {venta.items.map((i) => (
                    <li key={i.id}>
                      <span>
                        {i.cantidad} × {i.producto.nombre} {i.preparado && <span title="Preparado">✓</span>}
                      </span>
                      <span>{clp(i.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                <div className="total">Total {clp(venta.total)}</div>
              </>
            ) : (
              <p className="texto-suave">Mesa libre: agrega productos para abrir un pedido.</p>
            )}

            <h4>Nuevos ítems</h4>
            <Carrito carrito={carrito} />
            <div className="acciones">
              <button className="btn" disabled={!carrito.lineas.length || ocupado} onClick={enviarPedido}>
                {venta ? 'Agregar al pedido' : 'Abrir pedido'}
              </button>
              {venta && (
                <button className="btn btn-primario" disabled={ocupado || carrito.lineas.length > 0} onClick={cobrar} title={carrito.lineas.length ? 'Primero envía o vacía los nuevos ítems' : ''}>
                  Cobrar mesa
                </button>
              )}
              {venta && puede(GESTION) && (
                <button className="btn btn-peligro" disabled={ocupado} onClick={anular}>
                  Anular
                </button>
              )}
            </div>
            <Alerta>{error}</Alerta>
            {ultimaBoleta && (
              <Alerta tipo="exito">
                Boleta N° {ultimaBoleta.folio} emitida.{' '}
                <button className="btn btn-sm" onClick={() => abrirPdfBoleta(ultimaBoleta.id).catch((e) => setError(e.message))}>
                  Ver / imprimir PDF
                </button>
              </Alerta>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
