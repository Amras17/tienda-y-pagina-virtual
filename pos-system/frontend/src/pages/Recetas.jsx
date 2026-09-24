import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function Recetas() {
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [productoId, setProductoId] = useState('');
  const [items, setItems] = useState([]);
  const [costo, setCosto] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    api.get('/productos').then(setProductos);
    api.get('/insumos').then(setInsumos);
  }, []);

  async function seleccionarProducto(id) {
    setProductoId(id);
    setMensaje('');
    setError('');
    if (!id) { setItems([]); setCosto(null); return; }
    const receta = await api.get(`/recetas/${id}`);
    setItems(receta ? receta.items.map((i) => ({ insumoId: i.insumoId, cantidadNecesaria: i.cantidadNecesaria })) : []);
    const margen = await api.get(`/recetas/${id}/costo`);
    setCosto(margen);
  }

  function agregarItem() {
    if (!insumos.length) return;
    setItems((prev) => [...prev, { insumoId: insumos[0].id, cantidadNecesaria: 0 }]);
  }

  function actualizarItem(idx, campo, valor) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  }

  function quitarItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    setMensaje('');
    try {
      await api.put(`/recetas/${productoId}`, { items });
      const margen = await api.get(`/recetas/${productoId}/costo`);
      setCosto(margen);
      setMensaje('Receta guardada correctamente.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Recetas</h2>
      {error && <div className="alert alert-error">{error}</div>}
      {mensaje && <div className="alert alert-success">{mensaje}</div>}

      <label>Producto</label>
      <select value={productoId} onChange={(e) => seleccionarProducto(e.target.value)}>
        <option value="">Selecciona un producto</option>
        {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>

      {productoId && (
        <form onSubmit={guardar}>
          <h3>Items de la receta</h3>
          {items.map((item, idx) => (
            <div className="form-inline" key={idx}>
              <select value={item.insumoId} onChange={(e) => actualizarItem(idx, 'insumoId', Number(e.target.value))}>
                {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidadMedida})</option>)}
              </select>
              <input
                type="number" step="0.001" value={item.cantidadNecesaria}
                onChange={(e) => actualizarItem(idx, 'cantidadNecesaria', Number(e.target.value))}
              />
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => quitarItem(idx)}>Quitar</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={agregarItem}>+ Agregar insumo</button>
          <div className="acciones-mesa">
            <button type="submit" className="btn btn-primary">Guardar receta</button>
          </div>

          {costo && (
            <div className="card-costeo">
              <p>Precio de venta: ${costo.precioVenta.toLocaleString('es-CL')}</p>
              <p>Costo de receta: ${costo.costo.toFixed(0)}</p>
              <p>Margen: {costo.margenPorcentaje}%</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
