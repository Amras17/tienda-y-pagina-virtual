import { useState } from 'react';
import { api } from '../lib/api.js';
import { clp } from '../lib/format.js';
import { useAccion, useDatos } from '../lib/hooks.js';
import { Alerta } from '../components/ui.jsx';

const NUEVO = { nombre: '', categoriaId: '', precioVenta: '', activo: true, disponibleMostrador: true, disponibleMesa: true };

// Productos vendibles + su receta (insumos por unidad) + costo y margen.
export default function Carta() {
  const productos = useDatos(() => api.get('/productos'));
  const categorias = useDatos(() => api.get('/productos/categorias'));
  const { data: insumos } = useDatos(() => api.get('/insumos'));
  const [seleccion, setSeleccion] = useState(null); // id | 'nuevo' | null
  const [form, setForm] = useState(NUEVO);
  const [receta, setReceta] = useState([]);
  const [costo, setCosto] = useState(null);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [mensaje, setMensaje] = useState('');
  const { ocupado, error, ejecutar } = useAccion();

  async function abrir(id) {
    setMensaje('');
    setSeleccion(id);
    if (id === 'nuevo') {
      setForm({ ...NUEVO, categoriaId: categorias.data?.[0]?.id ?? '' });
      setReceta([]);
      setCosto(null);
      return;
    }
    const r = await ejecutar(() => Promise.all([api.get(`/productos/${id}`), api.get(`/recetas/${id}/costo`)]));
    if (!r) return;
    const [p, c] = r;
    setForm({
      nombre: p.nombre,
      categoriaId: p.categoriaId,
      precioVenta: p.precioVenta,
      activo: p.activo,
      disponibleMostrador: p.disponibleMostrador,
      disponibleMesa: p.disponibleMesa,
    });
    setReceta(p.receta.map(({ insumoId, cantidadNecesaria }) => ({ insumoId, cantidadNecesaria })));
    setCosto(c);
  }

  async function guardar(e) {
    e.preventDefault();
    setMensaje('');
    const r = await ejecutar(async () => {
      const p = seleccion === 'nuevo' ? await api.post('/productos', form) : await api.put(`/productos/${seleccion}`, form);
      await api.put(`/recetas/${p.id}`, { items: receta });
      return { p, c: await api.get(`/recetas/${p.id}/costo`) };
    });
    if (r) {
      setSeleccion(r.p.id);
      setCosto(r.c);
      setMensaje('Producto y receta guardados.');
      productos.recargar();
    }
  }

  async function crearCategoria() {
    const c = await ejecutar(() => api.post('/productos/categorias', { nombre: nuevaCategoria }));
    if (c) {
      setNuevaCategoria('');
      await categorias.recargar();
      setForm((f) => ({ ...f, categoriaId: c.id }));
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const editarItem = (idx, cambios) => setReceta((r) => r.map((it, i) => (i === idx ? { ...it, ...cambios } : it)));
  const insumoLibre = insumos?.find((i) => !receta.some((r) => r.insumoId === i.id));

  return (
    <div className="carta">
      <aside>
        <div className="fila-titulo">
          <h2>Carta</h2>
          <button className="btn btn-sm btn-primario" onClick={() => abrir('nuevo')}>+ Producto</button>
        </div>
        <Alerta>{productos.error}</Alerta>
        <ul className="lista-seleccion">
          {productos.data?.map((p) => (
            <li key={p.id}>
              <button className={seleccion === p.id ? 'activo' : ''} onClick={() => abrir(p.id)}>
                <span>
                  {p.nombre} {!p.activo && <small className="texto-suave">(inactivo)</small>}
                  <small className="texto-suave bloque">{p.categoria.nombre}</small>
                </span>
                <span>{clp(p.precioVenta)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section>
        {!seleccion && <p className="texto-suave">Elige un producto para editar su precio y receta, o crea uno nuevo.</p>}
        {seleccion && (
          <form onSubmit={guardar} className="formulario">
            <h3>{seleccion === 'nuevo' ? 'Nuevo producto' : form.nombre}</h3>
            <div className="form-linea">
              <label className="crece">
                Nombre
                <input required value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
              </label>
              <label>
                Precio (IVA incl.)
                <input type="number" min="0" step="1" required value={form.precioVenta} onChange={(e) => set('precioVenta', e.target.value)} />
              </label>
              <label>
                Categoría
                <select required value={form.categoriaId} onChange={(e) => set('categoriaId', e.target.value)}>
                  {categorias.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
            </div>
            <div className="form-linea">
              <input placeholder="Nueva categoría" value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)} />
              <button type="button" className="btn btn-sm" disabled={!nuevaCategoria.trim()} onClick={crearCategoria}>Crear categoría</button>
            </div>
            <div className="form-linea">
              {[['activo', 'Activo'], ['disponibleMostrador', 'En mostrador'], ['disponibleMesa', 'En mesas']].map(([k, t]) => (
                <label key={k} className="check">
                  <input type="checkbox" checked={form[k]} onChange={(e) => set(k, e.target.checked)} /> {t}
                </label>
              ))}
            </div>

            <h4>Receta (por unidad vendida)</h4>
            {receta.map((it, idx) => {
              const insumo = insumos?.find((i) => i.id === it.insumoId);
              return (
                <div className="form-linea" key={idx}>
                  <select value={it.insumoId} onChange={(e) => editarItem(idx, { insumoId: Number(e.target.value) })}>
                    {insumos?.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                  </select>
                  <input type="number" step="any" min="0" required aria-label="Cantidad" value={it.cantidadNecesaria} onChange={(e) => editarItem(idx, { cantidadNecesaria: e.target.value })} />
                  <span className="texto-suave">{insumo?.unidadMedida}</span>
                  <button type="button" className="btn btn-sm" onClick={() => setReceta((r) => r.filter((_, i) => i !== idx))}>Quitar</button>
                </div>
              );
            })}
            <div className="acciones">
              <button type="button" className="btn" disabled={!insumoLibre} onClick={() => setReceta((r) => [...r, { insumoId: insumoLibre.id, cantidadNecesaria: '' }])}>
                + Agregar insumo
              </button>
              <button className="btn btn-primario" disabled={ocupado}>Guardar</button>
            </div>
            <Alerta>{error}</Alerta>
            <Alerta tipo="exito">{mensaje}</Alerta>

            {costo && (
              <div className="costeo">
                <div><span>Precio de venta</span><strong>{clp(costo.precioVenta)}</strong></div>
                <div><span>Costo receta</span><strong>{clp(costo.costo)}</strong></div>
                <div><span>Margen</span><strong>{clp(costo.margen)} ({costo.margenPorcentaje}%)</strong></div>
              </div>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
