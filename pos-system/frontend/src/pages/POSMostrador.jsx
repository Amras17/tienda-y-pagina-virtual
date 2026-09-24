import { useEffect, useState } from 'react';
import { api, pdfUrl } from '../api/client.js';

export default function POSMostrador() {
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]); // [{ productoId, nombre, precioVenta, cantidad }]
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [ultimaBoleta, setUltimaBoleta] = useState(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    api.get('/productos').then((data) => {
      setProductos(data.filter((p) => p.activo && p.disponibleMostrador));
    });
  }, []);

  const categorias = [...new Set(productos.map((p) => p.categoria.nombre))];

  function agregarAlCarrito(producto) {
    setCarrito((prev) => {
      const existente = prev.find((i) => i.productoId === producto.id);
      if (existente) {
        return prev.map((i) => (i.productoId === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [...prev, { productoId: producto.id, nombre: producto.nombre, precioVenta: producto.precioVenta, cantidad: 1 }];
    });
  }

  function cambiarCantidad(productoId, delta) {
    setCarrito((prev) =>
      prev
        .map((i) => (i.productoId === productoId ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0),
    );
  }

  const totalCarrito = carrito.reduce((acc, i) => acc + i.precioVenta * i.cantidad, 0);

  async function cobrar() {
    if (!carrito.length) return;
    setError('');
    setProcesando(true);
    setUltimaBoleta(null);
    try {
      const venta = await api.post('/ventas', {
        tipo: 'MOSTRADOR',
        items: carrito.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
      });
      const resultado = await api.post(`/ventas/${venta.id}/cobrar`, {});
      setUltimaBoleta(resultado.boleta);
      setCarrito([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  const productosFiltrados = categoriaActiva ? productos.filter((p) => p.categoria.nombre === categoriaActiva) : productos;

  return (
    <div className="pos-layout">
      <div className="pos-productos">
        <h2>Mostrador</h2>
        <div className="categoria-tabs">
          <button className={!categoriaActiva ? 'chip chip-active' : 'chip'} onClick={() => setCategoriaActiva(null)}>Todas</button>
          {categorias.map((c) => (
            <button key={c} className={categoriaActiva === c ? 'chip chip-active' : 'chip'} onClick={() => setCategoriaActiva(c)}>{c}</button>
          ))}
        </div>
        <div className="grid-productos">
          {productosFiltrados.map((p) => (
            <button key={p.id} className="card-producto" onClick={() => agregarAlCarrito(p)}>
              <strong>{p.nombre}</strong>
              <span>${p.precioVenta.toLocaleString('es-CL')}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pos-carrito">
        <h3>Carrito</h3>
        {error && <div className="alert alert-error">{error}</div>}
        {carrito.length === 0 && <p className="text-muted">Sin productos agregados</p>}
        <ul className="lista-carrito">
          {carrito.map((i) => (
            <li key={i.productoId}>
              <span>{i.nombre}</span>
              <div className="cantidad-control">
                <button onClick={() => cambiarCantidad(i.productoId, -1)}>-</button>
                <span>{i.cantidad}</span>
                <button onClick={() => cambiarCantidad(i.productoId, 1)}>+</button>
              </div>
              <span>${(i.precioVenta * i.cantidad).toLocaleString('es-CL')}</span>
            </li>
          ))}
        </ul>
        <div className="total-carrito">Total: ${totalCarrito.toLocaleString('es-CL')}</div>
        <button className="btn btn-primary btn-block" disabled={!carrito.length || procesando} onClick={cobrar}>
          {procesando ? 'Procesando...' : 'Cobrar'}
        </button>

        {ultimaBoleta && (
          <div className="alert alert-success">
            Boleta N° {ultimaBoleta.folio} generada.{' '}
            <a href={pdfUrl(ultimaBoleta.id)} target="_blank" rel="noreferrer">Ver / imprimir PDF</a>
          </div>
        )}
      </div>
    </div>
  );
}
