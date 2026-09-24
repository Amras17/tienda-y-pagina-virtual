import { useEffect, useState } from 'react';
import { Bar, Pie, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Tooltip, Legend,
} from 'chart.js';
import { api } from '../api/client.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend);

const COLOR_PRIMARIO = '#6f4e37';
const COLOR_SECUNDARIO = '#c8a165';
const COLOR_ALERTA = '#c0392b';

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [masVendidos, setMasVendidos] = useState([]);
  const [modalidad, setModalidad] = useState(null);
  const [ventasPorDia, setVentasPorDia] = useState([]);
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    api.get('/dashboard/kpis').then(setKpis);
    api.get('/dashboard/mas-vendidos').then(setMasVendidos);
    api.get('/dashboard/ventas-por-modalidad').then(setModalidad);
    api.get('/dashboard/stock-alertas').then(setAlertas);
    const desde = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    api.get(`/reportes/ventas?desde=${desde}&agrupacion=dia`).then(setVentasPorDia);
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>

      {kpis && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-label">Ventas de hoy</span>
            <span className="kpi-value">{kpis.ventasHoyCantidad}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Total vendido hoy</span>
            <span className="kpi-value">${kpis.ventasHoyTotal.toLocaleString('es-CL')}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Ticket promedio</span>
            <span className="kpi-value">${Math.round(kpis.ticketPromedio).toLocaleString('es-CL')}</span>
          </div>
          <div className="kpi-card kpi-alerta">
            <span className="kpi-label">Alertas de stock</span>
            <span className="kpi-value">{kpis.alertasStockCantidad}</span>
          </div>
        </div>
      )}

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Productos más vendidos</h3>
          <Bar
            data={{
              labels: masVendidos.map((p) => p.nombre),
              datasets: [{ label: 'Cantidad vendida', data: masVendidos.map((p) => p.cantidad), backgroundColor: COLOR_PRIMARIO }],
            }}
            options={{ responsive: true, plugins: { legend: { display: false } } }}
          />
        </div>

        {modalidad && (
          <div className="chart-card">
            <h3>Ventas por modalidad</h3>
            <Pie
              data={{
                labels: ['Mostrador', 'Mesa'],
                datasets: [{ data: [modalidad.mostrador.cantidad, modalidad.mesa.cantidad], backgroundColor: [COLOR_PRIMARIO, COLOR_SECUNDARIO] }],
              }}
            />
          </div>
        )}

        <div className="chart-card chart-wide">
          <h3>Ventas por día (últimos 14 días)</h3>
          <Line
            data={{
              labels: ventasPorDia.map((v) => v.periodo),
              datasets: [{ label: 'Total ($)', data: ventasPorDia.map((v) => v.total), borderColor: COLOR_PRIMARIO, backgroundColor: COLOR_PRIMARIO }],
            }}
          />
        </div>
      </div>

      <h3>Alertas de stock mínimo</h3>
      {alertas.length === 0 && <p className="text-muted">Sin alertas por ahora.</p>}
      <table className="tabla">
        <thead><tr><th>Insumo</th><th>Stock actual</th><th>Mínimo</th></tr></thead>
        <tbody>
          {alertas.map((a) => (
            <tr key={a.id} style={{ color: COLOR_ALERTA }}>
              <td>{a.nombre}</td><td>{a.stockActual}</td><td>{a.stockMinimo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
