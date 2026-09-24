import { useState } from 'react';
import { api } from '../lib/api.js';
import { clp, fechaHora, num } from '../lib/format.js';
import { useAccion, useDatos } from '../lib/hooks.js';
import { Alerta } from '../components/ui.jsx';

const PROVEEDOR_VACIO = { nombre: '', contacto: '', telefono: '', email: '' };

export default function Proveedores() {
  const proveedores = useDatos(() => api.get('/proveedores'));
  const { data: insumos } = useDatos(() => api.get('/insumos'));
  const ordenes = useDatos(() => api.get('/ordenes-compra'));
  const [nuevo, setNuevo] = useState(PROVEEDOR_VACIO);
  const [orden, setOrden] = useState({ proveedorId: '', items: [] });
  const { ocupado, error, ejecutar } = useAccion();

  async function crearProveedor(e) {
    e.preventDefault();
    if (await ejecutar(() => api.post('/proveedores', nuevo))) {
      setNuevo(PROVEEDOR_VACIO);
      proveedores.recargar();
    }
  }

  const agregarItem = () => {
    const i = insumos?.[0];
    if (i) setOrden((o) => ({ ...o, items: [...o.items, { insumoId: i.id, cantidad: 1, costoUnitario: i.costoUnitarioReferencia }] }));
  };
  const editarItem = (idx, cambios) =>
    setOrden((o) => ({ ...o, items: o.items.map((it, i) => (i === idx ? { ...it, ...cambios } : it)) }));
  const quitarItem = (idx) => setOrden((o) => ({ ...o, items: o.items.filter((_, i) => i !== idx) }));

  async function crearOrden(e) {
    e.preventDefault();
    if (await ejecutar(() => api.post('/ordenes-compra', orden))) {
      setOrden({ proveedorId: '', items: [] });
      ordenes.recargar();
    }
  }

  async function recibir(id) {
    if (await ejecutar(() => api.post(`/ordenes-compra/${id}/recibir`))) ordenes.recargar();
  }

  const campo = (k) => ({ value: nuevo[k], onChange: (e) => setNuevo({ ...nuevo, [k]: e.target.value }) });

  return (
    <div>
      <h2>Proveedores</h2>
      <Alerta>{error || proveedores.error || ordenes.error}</Alerta>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Email</th></tr></thead>
          <tbody>
            {proveedores.data?.map((p) => (
              <tr key={p.id}><td>{p.nombre}</td><td>{p.contacto}</td><td>{p.telefono}</td><td>{p.email}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="form-linea" onSubmit={crearProveedor}>
        <input placeholder="Nombre" required {...campo('nombre')} />
        <input placeholder="Contacto" {...campo('contacto')} />
        <input placeholder="Teléfono" {...campo('telefono')} />
        <input placeholder="Email" type="email" {...campo('email')} />
        <button className="btn btn-primario" disabled={ocupado}>Agregar proveedor</button>
      </form>

      <h2>Órdenes de compra</h2>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th>#</th><th>Fecha</th><th>Proveedor</th><th>Ítems</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {ordenes.data?.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{fechaHora(o.fecha)}</td>
                <td>{o.proveedor.nombre}</td>
                <td>{o.items.map((i) => `${i.insumo.nombre} × ${num(i.cantidad)}`).join(', ')}</td>
                <td><span className={`insignia ${o.estado === 'PENDIENTE' ? 'insignia-alerta' : ''}`}>{o.estado}</span></td>
                <td>
                  {o.estado === 'PENDIENTE' && (
                    <button className="btn btn-sm btn-primario" disabled={ocupado} onClick={() => recibir(o.id)}>
                      Marcar recibida
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Nueva orden de compra</h3>
      <form onSubmit={crearOrden} className="formulario">
        <select value={orden.proveedorId} onChange={(e) => setOrden({ ...orden, proveedorId: e.target.value })} required>
          <option value="">Selecciona proveedor</option>
          {proveedores.data?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {orden.items.map((it, idx) => (
          <div className="form-linea" key={idx}>
            <select value={it.insumoId} onChange={(e) => editarItem(idx, { insumoId: Number(e.target.value) })}>
              {insumos?.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidadMedida})</option>)}
            </select>
            <input type="number" step="any" min="0" aria-label="Cantidad" value={it.cantidad} onChange={(e) => editarItem(idx, { cantidad: e.target.value })} />
            <input type="number" step="any" min="0" aria-label="Costo unitario" value={it.costoUnitario} onChange={(e) => editarItem(idx, { costoUnitario: e.target.value })} />
            <span className="texto-suave">{clp(it.cantidad * it.costoUnitario)}</span>
            <button type="button" className="btn btn-sm" onClick={() => quitarItem(idx)}>Quitar</button>
          </div>
        ))}
        <div className="acciones">
          <button type="button" className="btn" onClick={agregarItem}>+ Agregar ítem</button>
          <button className="btn btn-primario" disabled={ocupado || !orden.proveedorId || !orden.items.length}>Crear orden</button>
        </div>
      </form>
    </div>
  );
}
