import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function Stock() {
  const [insumos, setInsumos] = useState([]);
  const [modalInsumo, setModalInsumo] = useState(null);
  const [cantidad, setCantidad] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [error, setError] = useState('');
  const [nuevo, setNuevo] = useState({ nombre: '', unidadMedida: '', stockMinimo: '', costoUnitarioReferencia: '' });

  async function cargar() {
    setInsumos(await api.get('/insumos'));
  }

  useEffect(() => { cargar(); }, []);

  async function ingresarStock(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/insumos/${modalInsumo.id}/ingresar-stock`, {
        cantidad: Number(cantidad),
        costoUnitario: Number(costoUnitario) || modalInsumo.costoUnitarioReferencia,
      });
      setModalInsumo(null);
      setCantidad('');
      setCostoUnitario('');
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function crearInsumo(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/insumos', nuevo);
      setNuevo({ nombre: '', unidadMedida: '', stockMinimo: '', costoUnitarioReferencia: '' });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Stock de insumos</h2>
      {error && <div className="alert alert-error">{error}</div>}

      <table className="tabla">
        <thead>
          <tr><th>Insumo</th><th>Unidad</th><th>Stock actual</th><th>Mínimo</th><th>Costo ref.</th><th></th></tr>
        </thead>
        <tbody>
          {insumos.map((i) => (
            <tr key={i.id} className={i.stockActual < i.stockMinimo ? 'fila-alerta' : ''}>
              <td>{i.nombre}</td>
              <td>{i.unidadMedida}</td>
              <td>{i.stockActual.toLocaleString('es-CL')}</td>
              <td>{i.stockMinimo}</td>
              <td>${i.costoUnitarioReferencia.toLocaleString('es-CL')}</td>
              <td><button className="btn btn-sm btn-secondary" onClick={() => setModalInsumo(i)}>Ingresar stock</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalInsumo && (
        <div className="modal-backdrop" onClick={() => setModalInsumo(null)}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={ingresarStock}>
            <h3>Ingresar stock: {modalInsumo.nombre}</h3>
            <label>Cantidad ({modalInsumo.unidadMedida})</label>
            <input type="number" step="0.01" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
            <label>Costo unitario (opcional, usa el de referencia si se deja vacío)</label>
            <input type="number" step="0.01" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} />
            <div className="acciones-mesa">
              <button type="button" className="btn btn-secondary" onClick={() => setModalInsumo(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </div>
          </form>
        </div>
      )}

      <h3>Nuevo insumo</h3>
      <form className="form-inline" onSubmit={crearInsumo}>
        <input placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required />
        <input placeholder="Unidad (kg, lt, un)" value={nuevo.unidadMedida} onChange={(e) => setNuevo({ ...nuevo, unidadMedida: e.target.value })} required />
        <input type="number" step="0.01" placeholder="Stock mínimo" value={nuevo.stockMinimo} onChange={(e) => setNuevo({ ...nuevo, stockMinimo: e.target.value })} required />
        <input type="number" step="0.01" placeholder="Costo referencia" value={nuevo.costoUnitarioReferencia} onChange={(e) => setNuevo({ ...nuevo, costoUnitarioReferencia: e.target.value })} required />
        <button type="submit" className="btn btn-primary">Crear</button>
      </form>
    </div>
  );
}
