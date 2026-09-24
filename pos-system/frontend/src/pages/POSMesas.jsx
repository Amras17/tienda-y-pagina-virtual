import { useEffect, useState } from 'react';
import { api, pdfUrl } from '../api/client.js';

export default function POSMesas() {
  const [mesas, setMesas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [carritoNuevo, setCarritoNuevo] = useState([]);
  const [error, setError] = useState('');
  const [ultimaBoleta, setUltimaBoleta] = useState(null);
  const [procesando, setProcesando] = useState(false);

  async function cargarMesas() {
    const data = await api.get('/mesas');
    setMesas(data);
  }

  useEffect(() => {
    cargarMesas();
    api.get('/productos').then((data) => setProductos(data.filter((p) => p.activo && p.disponibleMesa)));
  }, []);

  const mesa = mesas.find((m) => m.id === mesaSeleccionada);
  const ventaAbierta = mesa?.ventas?.[0] || null;

  function abrirMesa(m) {
    setMesaSeleccionada(m.id);
    setCarritoNuevo([]);
    setUltimaBoleta(null);
    setError('');
  }

  function agregarAlCarrito(producto) {
    setCarritoNuevo((prev) => {
      const existente = prev.find((i) => i.productoId === producto.id);
      if (existente) return prev.map((i) => (i.productoId === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i));
      return [...prev, { productoId: producto.id, nombre: producto.nombre, precioVenta: producto.precioVenta, cantidad: 1 }];
    });
  }

  async function confirmarPedido() {
    if (!carritoNuevo.length) return;
    setError('');
    setProcesando(true);
    try {
      const items = carritoNuevo.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad }));
      if (ventaAbierta) {
        await api.post(`/ventas/${ventaAbierta.id}/items`, { items });
      } else {
        await api.post('/ventas', { tipo: 'MESA', mesaId: mesaSeleccionada, items });
      }
      setCarritoNuevo([]);
      await cargarMesas();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function cobrarMesa() {
    if (!ventaAbierta) return;
    setError('');
    setProcesando(true);
    try {
      const resultado = await api.post(`/ventas/${ventaAbierta.id}/cobrar`, {});
      setUltimaBoleta(resultado.boleta);
      await cargarMesas();
      setMesaSeleccionada(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <h2>Mesas</h2>
      <div className="grid-mesas">
        {mesas.map((m) => (
          <button
            key={m.id}
            className={`card-mesa ${m.estado === 'OCUPADA' ? 'mesa-ocupada' : 'mesa-libre'}`}
            onClick={() => abrirMesa(m)}
          >
            <strong>Mesa {m.numero}</strong>
            <span>{m.capacidad} personas</span>
            <span className="badge">{m.estado}</span>
          </button>
        ))}
      </div>

      {mesa && (
        <div className="mesa-detalle">
          <h3>Mesa {mesa.numero} {ventaAbierta ? `(venta #${ventaAbierta.id} abierta)` : '(nuevo pedido)'}</h3>
          {error && <div className="alert alert-error">{error}</div>}

          {ventaAbierta && (
            <div>
              <h4>Pedido actual</h4>
              <ul className="lista-carrito">
                {ventaAbierta.items.map((i) => (
                  <li key={i.id}>
                    <span>{i.producto.nombre} x{i.cantidad}</span>
                    <span>${i.subtotal.toLocaleString('es-CL')}</span>
                  </li>
                ))}
              </ul>
              <div className="total-carrito">Total actual: ${ventaAbierta.total.toLocaleString('es-CL')}</div>
            </div>
          )}

          <h4>Agregar productos</h4>
          <div className="grid-productos">
            {productos.map((p) => (
              <button key={p.id} className="card-producto" onClick={() => agregarAlCarrito(p)}>
                <strong>{p.nombre}</strong>
                <span>${p.precioVenta.toLocaleString('es-CL')}</span>
              </button>
            ))}
          </div>

          {carritoNuevo.length > 0 && (
            <ul className="lista-carrito">
              {carritoNuevo.map((i) => (
                <li key={i.productoId}>
                  <span>{i.nombre} x{i.cantidad}</span>
                  <span>${(i.precioVenta * i.cantidad).toLocaleString('es-CL')}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="acciones-mesa">
            <button className="btn btn-secondary" disabled={!carritoNuevo.length || procesando} onClick={confirmarPedido}>
              {ventaAbierta ? 'Agregar al pedido' : 'Abrir pedido'}
            </button>
            {ventaAbierta && (
              <button className="btn btn-primary" disabled={procesando} onClick={cobrarMesa}>Cobrar mesa</button>
            )}
          </div>

          {ultimaBoleta && (
            <div className="alert alert-success">
              Boleta N° {ultimaBoleta.folio} generada.{' '}
              <a href={pdfUrl(ultimaBoleta.id)} target="_blank" rel="noreferrer">Ver / imprimir PDF</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
