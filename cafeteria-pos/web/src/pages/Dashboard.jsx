import { useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';
import { api } from '../lib/api.js';
import { clp, num } from '../lib/format.js';
import { useDatos } from '../lib/hooks.js';
import { Alerta, Vacio } from '../components/ui.jsx';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

const CAFE = '#6f4e37';
const CARAMELO = '#c8a165';
const moneda = { callbacks: { label: (ctx) => ` ${clp(ctx.parsed.y ?? ctx.parsed)}` } };
const base = { responsive: true, maintainAspectRatio: false };

// Contenedor de altura fija: Chart.js ocupa ese alto en vez de crecer con el ancho.
const Lienzo = ({ children }) => <div className="lienzo">{children}</div>;

const PERIODOS = {
  dia: { titulo: 'Últimos 30 días', dias: 30 },
  semana: { titulo: 'Últimas 12 semanas', dias: 84 },
  mes: { titulo: 'Últimos 12 meses', dias: 365 },
};

function Kpi({ titulo, valor, alerta }) {
  return (
    <div className={`kpi ${alerta ? 'kpi-alerta' : ''}`}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

export default function Dashboard() {
  const { data: d, error } = useDatos(() => api.get('/dashboard'));
  const [agrupacion, setAgrupacion] = useState('dia');
  const reporte = useDatos(() => {
    const desde = new Date(Date.now() - PERIODOS[agrupacion].dias * 86_400_000).toISOString();
    return api.get(`/reportes/ventas?desde=${desde}&agrupacion=${agrupacion}`);
  }, [agrupacion]);

  if (error) return <Alerta>{error}</Alerta>;
  if (!d) return <div className="cargando">Cargando…</div>;

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="kpis">
        <Kpi titulo="Ventas de hoy" valor={d.kpis.ventasHoyCantidad} />
        <Kpi titulo="Total vendido hoy" valor={clp(d.kpis.ventasHoyTotal)} />
        <Kpi titulo="Ticket promedio" valor={clp(d.kpis.ticketPromedio)} />
        <Kpi titulo="Alertas de stock" valor={d.kpis.alertasStockCantidad} alerta={d.kpis.alertasStockCantidad > 0} />
      </div>

      <div className="graficos">
        <div className="grafico">
          <h3>Productos más vendidos</h3>
          <Lienzo>
            <Bar
              data={{ labels: d.masVendidos.map((p) => p.nombre), datasets: [{ label: 'Unidades', data: d.masVendidos.map((p) => p.cantidad), backgroundColor: CAFE, borderRadius: 4 }] }}
              options={{ ...base, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { precision: 0 } } } }}
            />
          </Lienzo>
        </div>
        <div className="grafico">
          <h3>Ventas por modalidad</h3>
          <Lienzo>
            <Doughnut
              data={{
                labels: [`Mostrador (${d.modalidad.mostrador.cantidad})`, `Mesa (${d.modalidad.mesa.cantidad})`],
                datasets: [{ data: [d.modalidad.mostrador.total, d.modalidad.mesa.total], backgroundColor: [CAFE, CARAMELO] }],
              }}
              options={{ ...base, plugins: { tooltip: moneda, legend: { position: 'bottom' } } }}
            />
          </Lienzo>
        </div>
        <div className="grafico ancho">
          <div className="fila-titulo">
            <h3>Ventas — {PERIODOS[agrupacion].titulo}</h3>
            <select value={agrupacion} onChange={(e) => setAgrupacion(e.target.value)}>
              <option value="dia">Por día</option>
              <option value="semana">Por semana</option>
              <option value="mes">Por mes</option>
            </select>
          </div>
          <Lienzo>
            <Line
              data={{
                labels: (reporte.data || []).map((v) => v.periodo),
                datasets: [{ label: 'Total', data: (reporte.data || []).map((v) => v.total), borderColor: CAFE, backgroundColor: 'rgba(111,78,55,.12)', fill: true, cubicInterpolationMode: 'monotone' }],
              }}
              options={{ ...base, plugins: { legend: { display: false }, tooltip: moneda }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => clp(v) } } } }}
            />
          </Lienzo>
        </div>
      </div>

      <div className="dos-columnas">
        <section>
          <h3>Alertas de stock mínimo</h3>
          {d.alertas.length === 0 ? (
            <Vacio>Sin alertas por ahora.</Vacio>
          ) : (
            <table className="tabla">
              <thead><tr><th>Insumo</th><th className="num">Stock</th><th className="num">Mínimo</th></tr></thead>
              <tbody>
                {d.alertas.map((a) => (
                  <tr key={a.id} className="fila-alerta">
                    <td>{a.nombre}</td>
                    <td className="num">{num(a.stockActual)} {a.unidadMedida}</td>
                    <td className="num">{num(a.stockMinimo)} {a.unidadMedida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section>
          <h3>Rentabilidad por producto</h3>
          <table className="tabla">
            <thead><tr><th>Producto</th><th className="num">Precio</th><th className="num">Costo</th><th className="num">Margen</th></tr></thead>
            <tbody>
              {d.rentabilidad.map((r) => (
                <tr key={r.productoId}>
                  <td>{r.nombre}</td>
                  <td className="num">{clp(r.precioVenta)}</td>
                  <td className="num">{clp(r.costo)}</td>
                  <td className="num">{r.margenPorcentaje}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
