import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api.js';
import { clp, fechaHora } from '../lib/format.js';
import { useAccion, useDatos } from '../lib/hooks.js';
import { minutosPorConsumo, minutosTexto, tiempo } from '../lib/wifi.js';
import { Alerta, Vacio } from '../components/ui.jsx';

const MONTOS_EJEMPLO = [1500, 3000, 5000, 8000, 12000, 20000, 30000];
const CAMPOS_NUMERO = [
  ['minutosPorMil', 'Minutos por cada $1.000', 'Proporción entre gasto y tiempo de navegación'],
  ['montoMinimo', 'Monto mínimo ($)', 'Bajo este total la boleta no trae WiFi'],
  ['minutosMinimo', 'Mínimo de minutos', 'Lo menos que entrega un código'],
  ['minutosMaximo', 'Tope de minutos', 'Lo más que entrega un código'],
  ['dispositivos', 'Equipos por código', 'Requiere que el router informe la MAC'],
  ['horasParaActivar', 'Horas para usar el código', 'Después de este plazo el código caduca sin usarse'],
];
const COLOR_ESTADO = { ACTIVO: 'insignia-exito', SIN_USAR: '', AGOTADO: 'insignia-apagada', CADUCADO: 'insignia-apagada', REVOCADO: 'insignia-alerta' };

export default function Wifi() {
  const config = useDatos(() => api.get('/wifi/config'));
  const accesos = useDatos(() => api.get('/wifi/accesos'));
  const [form, setForm] = useState(null);
  const [guardado, setGuardado] = useState(false);
  const { ocupado, error, ejecutar } = useAccion();

  useEffect(() => {
    if (config.data) setForm(config.data.config);
  }, [config.data]);

  async function guardar(e) {
    e.preventDefault();
    setGuardado(false);
    const { id, actualizadoEn, ...datos } = form;
    if (await ejecutar(() => api.put('/wifi/config', datos))) {
      setGuardado(true);
      config.recargar();
    }
  }

  async function revocar(a) {
    if (!window.confirm(`¿Desactivar el código ${a.codigo}? El cliente dejará de navegar.`)) return;
    if (await ejecutar(() => api.post(`/wifi/accesos/${a.id}/revocar`))) accesos.recargar();
  }

  const r = accesos.data?.resumen;
  const cambiar = (k, v) => {
    setGuardado(false);
    setForm({ ...form, [k]: v });
  };

  return (
    <div>
      <div className="fila-titulo">
        <h2>WiFi por consumo</h2>
        <Link to="/portal-wifi" target="_blank" className="enlace-suave">
          Portal del cliente ↗
        </Link>
      </div>
      <p className="texto-suave">
        Cada cobro genera un código con minutos de navegación proporcionales al total pagado. El código va impreso en la
        boleta y el tiempo empieza a correr cuando el cliente lo usa por primera vez.
      </p>
      <Alerta>{config.error || accesos.error}</Alerta>

      {r && (
        <div className="kpis">
          <div className="kpi"><span>Códigos emitidos hoy</span><strong>{r.emitidos}</strong></div>
          <div className="kpi"><span>Usados hoy</span><strong>{r.usados}</strong></div>
          <div className="kpi"><span>Tiempo entregado hoy</span><strong>{minutosTexto(r.minutosOtorgados)}</strong></div>
        </div>
      )}

      {form && (
        <div className="dos-columnas">
          <form className="formulario" onSubmit={guardar}>
            <h3>Regla</h3>
            <label className="check">
              <input type="checkbox" checked={form.activo} onChange={(e) => cambiar('activo', e.target.checked)} />
              Entregar WiFi con cada cobro
            </label>
            <div className="grilla-campos">
              {CAMPOS_NUMERO.map(([k, titulo, ayuda]) => (
                <label key={k} title={ayuda}>
                  {titulo}
                  <input type="number" min="0" step="1" required value={form[k]} onChange={(e) => cambiar(k, e.target.value)} />
                  <small>{ayuda}</small>
                </label>
              ))}
            </div>
            <label>
              Nombre de la red (se imprime en la boleta)
              <input maxLength={32} placeholder="Ej. Emporio Clientes" value={form.redNombre} onChange={(e) => cambiar('redNombre', e.target.value)} />
            </label>
            <label>
              Dirección del portal (opcional, se imprime en la boleta)
              <input maxLength={120} placeholder="Ej. http://192.168.1.10:4000/portal-wifi" value={form.portalUrl} onChange={(e) => cambiar('portalUrl', e.target.value)} />
            </label>
            <Alerta>{error}</Alerta>
            {guardado && <Alerta tipo="exito">Regla guardada: se aplica desde el próximo cobro.</Alerta>}
            <div className="acciones">
              <button className="btn btn-primario" disabled={ocupado}>Guardar regla</button>
            </div>
          </form>

          <div>
            <h3>Así queda</h3>
            <table className="tabla">
              <thead>
                <tr><th className="num">Total de la boleta</th><th className="num">WiFi</th></tr>
              </thead>
              <tbody>
                {MONTOS_EJEMPLO.map((total) => {
                  const min = minutosPorConsumo(total, form);
                  return (
                    <tr key={total}>
                      <td className="num">{clp(total)}</td>
                      <td className="num">{min ? minutosTexto(min) : <span className="texto-suave">Sin WiFi</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="texto-suave">Los minutos se redondean hacia abajo a múltiplos de 5.</p>
          </div>
        </div>
      )}

      <h3>Códigos recientes</h3>
      {accesos.data && !accesos.data.accesos.length && <Vacio>Aún no hay códigos emitidos.</Vacio>}
      {accesos.data?.accesos.length > 0 && (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th><th>Emitido</th><th>Origen</th><th className="num">Boleta</th><th className="num">Total</th>
                <th className="num">Minutos</th><th>Estado</th><th className="num">Restante</th><th className="num">Equipos</th><th />
              </tr>
            </thead>
            <tbody>
              {accesos.data.accesos.map((a) => (
                <tr key={a.id}>
                  <td><code>{a.codigo}</code></td>
                  <td>{fechaHora(a.creadoEn)}</td>
                  <td>{a.origen}</td>
                  <td className="num">{a.folio ?? '—'}</td>
                  <td className="num">{clp(a.montoBase)}</td>
                  <td className="num">{a.minutos}</td>
                  <td><span className={`insignia ${COLOR_ESTADO[a.estado]}`}>{a.estadoTexto}</span></td>
                  <td className="num">{a.estado === 'ACTIVO' ? tiempo(a.restanteSegundos) : '—'}</td>
                  <td className="num">{a.equiposConectados}/{a.dispositivos}</td>
                  <td>
                    {(a.estado === 'ACTIVO' || a.estado === 'SIN_USAR') && (
                      <button className="btn btn-sm btn-peligro" disabled={ocupado} onClick={() => revocar(a)}>
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
