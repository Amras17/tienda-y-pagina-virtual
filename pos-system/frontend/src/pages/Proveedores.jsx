import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [nuevoProveedor, setNuevoProveedor] = useState({ nombre: '', contacto: '', telefono: '', email: '' });
  const [nuevaOrden, setNuevaOrden] = useState({ proveedorId: '', items: [] });
  const [error, setError] = useState('');

  async function cargarTodo() {
    const [p, i, o] = await Promise.all([api.get('/proveedores'), api.get('/insumos'), api.get('/ordenes-compra')]);
    setProveedores(p); setInsumos(i); setOrdenes(o);
  }

  useEffect(() => { cargarTodo(); }, []);

  async function crearProveedor(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/proveedores', nuevoProveedor);
      setNuevoProveedor({ nombre: '', contacto: '', telefono: '', email: '' });
      await cargarTodo();
    } catch (err) { setError(err.message); }
  }

  function agregarItemOrden() {
    if (!insumos.length) return;
    setNuevaOrden((prev) => ({ ...prev, items: [...prev.items, { insumoId: insumos[0].id, cantidad: 1, costoUnitario: insumos[0].costoUnitarioReferencia }] }));
  }

  function actualizarItemOrden(idx, campo, valor) {
    setNuevaOrden((prev) => ({ ...prev, items: prev.items.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)) }));
  }

  async function crearOrden(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/ordenes-compra', nuevaOrden);
      setNuevaOrden({ proveedorId: '', items: [] });
      await cargarTodo();
    } catch (err) { setError(err.message); }
  }

  async function recibirOrden(id) {
    setError('');
    try {
      await api.post(`/ordenes-compra/${id}/recibir`, {});
      await cargarTodo();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <h2>Proveedores</h2>
      {error && <div className="alert alert-error">{error}</div>}

      <table className="tabla">
        <thead><tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Email</th></tr></thead>
        <tbody>
          {proveedores.map((p) => (
            <tr key={p.id}><td>{p.nombre}</td><td>{p.contacto}</td><td>{p.telefono}</td><td>{p.email}</td></tr>
          ))}
        </tbody>
      </table>

      <form className="form-inline" onSubmit={crearProveedor}>
        <input placeholder="Nombre" value={nuevoProveedor.nombre} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, nombre: e.target.value })} required />
        <input placeholder="Contacto" value={nuevoProveedor.contacto} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, contacto: e.target.value })} />
        <input placeholder="Teléfono" value={nuevoProveedor.telefono} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, telefono: e.target.value })} />
        <input placeholder="Email" value={nuevoProveedor.email} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, email: e.target.value })} />
        <button className="btn btn-primary" type="submit">Agregar proveedor</button>
      </form>

      <h2>Órdenes de compra</h2>
      <table className="tabla">
        <thead><tr><th>ID</th><th>Proveedor</th><th>Estado</th><th>Items</th><th></th></tr></thead>
        <tbody>
          {ordenes.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>{o.proveedor.nombre}</td>
              <td>{o.estado}</td>
              <td>{o.items.map((i) => `${i.insumo.nombre} x${i.cantidad}`).join(', ')}</td>
              <td>{o.estado === 'PENDIENTE' && <button className="btn btn-sm btn-primary" onClick={() => recibirOrden(o.id)}>Marcar recibida</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Nueva orden de compra</h3>
      <form onSubmit={crearOrden}>
        <select value={nuevaOrden.proveedorId} onChange={(e) => setNuevaOrden({ ...nuevaOrden, proveedorId: e.target.value })} required>
          <option value="">Selecciona proveedor</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {nuevaOrden.items.map((item, idx) => (
          <div className="form-inline" key={idx}>
            <select value={item.insumoId} onChange={(e) => actualizarItemOrden(idx, 'insumoId', Number(e.target.value))}>
              {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
            <input type="number" step="0.01" value={item.cantidad} onChange={(e) => actualizarItemOrden(idx, 'cantidad', Number(e.target.value))} placeholder="Cantidad" />
            <input type="number" step="0.01" value={item.costoUnitario} onChange={(e) => actualizarItemOrden(idx, 'costoUnitario', Number(e.target.value))} placeholder="Costo unitario" />
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={agregarItemOrden}>+ Agregar item</button>
        <div className="acciones-mesa">
          <button type="submit" className="btn btn-primary" disabled={!nuevaOrden.proveedorId || !nuevaOrden.items.length}>Crear orden</button>
        </div>
      </form>
    </div>
  );
}
