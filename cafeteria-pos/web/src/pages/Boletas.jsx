import { api, abrirPdfBoleta } from '../lib/api.js';
import { clp, fechaHora } from '../lib/format.js';
import { useDatos } from '../lib/hooks.js';
import { Alerta } from '../components/ui.jsx';

export default function Boletas() {
  const { data: boletas, error, setError } = useDatos(() => api.get('/boletas'));

  return (
    <div>
      <h2>Boletas emitidas</h2>
      <p className="texto-suave">Comprobantes internos, sin validez tributaria ante el SII.</p>
      <Alerta>{error}</Alerta>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr><th>Folio</th><th>Fecha</th><th>Origen</th><th className="num">Total</th><th>SII</th><th /></tr>
          </thead>
          <tbody>
            {boletas?.map((b) => (
              <tr key={b.id}>
                <td>{b.folio}</td>
                <td>{fechaHora(b.fecha)}</td>
                <td>{b.venta.tipo === 'MESA' ? `Mesa ${b.venta.mesa?.numero}` : 'Mostrador'}</td>
                <td className="num">{clp(b.venta.total)}</td>
                <td>{b.estadoSII === 'NO_ENVIADA' ? 'No enviada' : b.estadoSII}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => abrirPdfBoleta(b.id).catch((e) => setError(e.message))}>
                    Ver PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
