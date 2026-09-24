import { useEffect, useState } from 'react';
import { api, pdfUrl } from '../api/client.js';

export default function Boletas() {
  const [boletas, setBoletas] = useState([]);

  useEffect(() => { api.get('/boletas').then(setBoletas); }, []);

  return (
    <div>
      <h2>Boletas emitidas</h2>
      <table className="tabla">
        <thead><tr><th>Folio</th><th>Fecha</th><th>Total</th><th>Estado SII</th><th></th></tr></thead>
        <tbody>
          {boletas.map((b) => (
            <tr key={b.id}>
              <td>{b.folio}</td>
              <td>{new Date(b.fecha).toLocaleString('es-CL')}</td>
              <td>${b.venta.total.toLocaleString('es-CL')}</td>
              <td>{b.estadoSII}</td>
              <td><a className="btn btn-sm btn-secondary" href={pdfUrl(b.id)} target="_blank" rel="noreferrer">Ver PDF</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
