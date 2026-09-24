import { useState } from 'react';
import { api } from '../lib/api.js';
import { clp, num } from '../lib/format.js';
import { useAccion, useDatos } from '../lib/hooks.js';
import { Alerta, Modal } from '../components/ui.jsx';

const VACIO = { nombre: '', unidadMedida: '', stockMinimo: '', costoUnitarioReferencia: '' };

export default function Stock() {
  const insumos = useDatos(() => api.get('/insumos'));
  const { data: proveedores } = useDatos(() => api.get('/proveedores'));
  const [ingreso, setIngreso] = useState(null); // { insumo, cantidad, costoUnitario, proveedorId }
  const [nuevo, setNuevo] = useState(VACIO);
  const { ocupado, error, ejecutar } = useAccion();

  async function guardarIngreso(e) {
    e.preventDefault();
    const { insumo, cantidad, costoUnitario, proveedorId } = ingreso;
    const ok = await ejecutar(() =>
      api.post(`/insumos/${insumo.id}/ingresar-stock`, {
        cantidad,
        costoUnitario: costoUnitario === '' ? undefined : costoUnitario,
        proveedorId: proveedorId || null,
      }),
    );
    if (ok) {
      setIngreso(null);
      insumos.recargar();
    }
  }

  async function crear(e) {
    e.preventDefault();
    if (await ejecutar(() => api.post('/insumos', nuevo))) {
      setNuevo(VACIO);
      insumos.recargar();
    }
  }

  const campo = (k) => ({ value: nuevo[k], onChange: (e) => setNuevo({ ...nuevo, [k]: e.target.value }) });

  return (
    <div>
      <h2>Stock de insumos</h2>
      <Alerta>{insumos.error || (!ingreso && error)}</Alerta>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr><th>Insumo</th><th>Unidad</th><th className="num">Stock actual</th><th className="num">Mínimo</th><th className="num">Costo ref.</th><th /></tr>
          </thead>
          <tbody>
            {insumos.data?.map((i) => (
              <tr key={i.id} className={i.stockActual < i.stockMinimo ? 'fila-alerta' : ''}>
                <td>{i.nombre}</td>
                <td>{i.unidadMedida}</td>
                <td className="num">{num(i.stockActual)}</td>
                <td className="num">{num(i.stockMinimo)}</td>
                <td className="num">{clp(i.costoUnitarioReferencia)}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => setIngreso({ insumo: i, cantidad: '', costoUnitario: '', proveedorId: '' })}>
                    Ingresar stock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ingreso && (
        <Modal titulo={`Ingresar stock: ${ingreso.insumo.nombre}`} onCerrar={() => setIngreso(null)}>
          <form onSubmit={guardarIngreso} className="formulario">
            <label>
              Cantidad ({ingreso.insumo.unidadMedida})
              <input type="number" step="any" min="0" required autoFocus value={ingreso.cantidad} onChange={(e) => setIngreso({ ...ingreso, cantidad: e.target.value })} />
            </label>
            <label>
              Costo unitario (vacío = referencia {clp(ingreso.insumo.costoUnitarioReferencia)})
              <input type="number" step="any" min="0" value={ingreso.costoUnitario} onChange={(e) => setIngreso({ ...ingreso, costoUnitario: e.target.value })} />
            </label>
            <label>
              Proveedor (opcional)
              <select value={ingreso.proveedorId} onChange={(e) => setIngreso({ ...ingreso, proveedorId: e.target.value })}>
                <option value="">—</option>
                {proveedores?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <Alerta>{error}</Alerta>
            <div className="acciones">
              <button type="button" className="btn" onClick={() => setIngreso(null)}>Cancelar</button>
              <button className="btn btn-primario" disabled={ocupado}>Guardar lote</button>
            </div>
          </form>
        </Modal>
      )}

      <h3>Nuevo insumo</h3>
      <form className="form-linea" onSubmit={crear}>
        <input placeholder="Nombre" required {...campo('nombre')} />
        <input placeholder="Unidad (kg, lt, un)" required maxLength={10} {...campo('unidadMedida')} />
        <input type="number" step="any" min="0" placeholder="Stock mínimo" required {...campo('stockMinimo')} />
        <input type="number" step="any" min="0" placeholder="Costo referencia" required {...campo('costoUnitarioReferencia')} />
        <button className="btn btn-primario" disabled={ocupado}>Crear</button>
      </form>
    </div>
  );
}
