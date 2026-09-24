import { useMemo, useState } from 'react';
import { clp } from '../lib/format.js';

// Grilla de productos con filtro por categoría (compartida por mostrador y mesas).
export function GrillaProductos({ productos, onAgregar }) {
  const [categoria, setCategoria] = useState(null);
  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria.nombre))], [productos]);
  const visibles = categoria ? productos.filter((p) => p.categoria.nombre === categoria) : productos;

  return (
    <>
      <div className="chips">
        {[null, ...categorias].map((c) => (
          <button key={c ?? 'todas'} className={`chip ${categoria === c ? 'chip-activo' : ''}`} onClick={() => setCategoria(c)}>
            {c ?? 'Todas'}
          </button>
        ))}
      </div>
      <div className="grilla-productos">
        {visibles.map((p) => (
          <button key={p.id} className="tarjeta-producto" onClick={() => onAgregar(p)}>
            <strong>{p.nombre}</strong>
            <span>{clp(p.precioVenta)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// Estado del carrito: una línea por producto, con cantidad y notas para la comanda.
export function useCarrito() {
  const [lineas, setLineas] = useState([]);

  return {
    lineas,
    total: lineas.reduce((acc, l) => acc + l.precioVenta * l.cantidad, 0),
    agregar: (p) =>
      setLineas((prev) =>
        prev.some((l) => l.productoId === p.id)
          ? prev.map((l) => (l.productoId === p.id ? { ...l, cantidad: l.cantidad + 1 } : l))
          : [...prev, { productoId: p.id, nombre: p.nombre, precioVenta: p.precioVenta, cantidad: 1, notas: '' }],
      ),
    cambiar: (productoId, delta) =>
      setLineas((prev) =>
        prev.map((l) => (l.productoId === productoId ? { ...l, cantidad: l.cantidad + delta } : l)).filter((l) => l.cantidad > 0),
      ),
    anotar: (productoId, notas) => setLineas((prev) => prev.map((l) => (l.productoId === productoId ? { ...l, notas } : l))),
    vaciar: () => setLineas([]),
    items: () => lineas.map(({ productoId, cantidad, notas }) => ({ productoId, cantidad, notas: notas.trim() || null })),
  };
}

export function Carrito({ carrito }) {
  if (!carrito.lineas.length) return <p className="texto-suave">Toca un producto para agregarlo.</p>;
  return (
    <ul className="carrito">
      {carrito.lineas.map((l) => (
        <li key={l.productoId}>
          <div className="carrito-fila">
            <span className="carrito-nombre">{l.nombre}</span>
            <div className="cantidad">
              <button aria-label="Quitar uno" onClick={() => carrito.cambiar(l.productoId, -1)}>−</button>
              <span>{l.cantidad}</span>
              <button aria-label="Agregar uno" onClick={() => carrito.cambiar(l.productoId, 1)}>+</button>
            </div>
            <span className="carrito-monto">{clp(l.precioVenta * l.cantidad)}</span>
          </div>
          <input
            className="carrito-notas"
            placeholder="Nota para barra (ej. sin azúcar)"
            value={l.notas}
            maxLength={200}
            onChange={(e) => carrito.anotar(l.productoId, e.target.value)}
          />
        </li>
      ))}
    </ul>
  );
}

export function useProductosDisponibles(productos, campo) {
  return useMemo(() => (productos || []).filter((p) => p.activo && p[campo]), [productos, campo]);
}
