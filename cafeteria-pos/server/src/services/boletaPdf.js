import PDFDocument from 'pdfkit';
import { config } from '../config.js';

const clp = (n) => `$${Math.round(n).toLocaleString('es-CL')}`;

// Genera el PDF de la boleta interna AL VUELO y lo escribe en `destino`
// (típicamente la respuesta HTTP). No se guarda en disco: siempre refleja la
// base de datos, no requiere volumen de almacenamiento y no hay carrera entre
// "escribir el archivo" y "descargarlo".
//
// Formato ticket 80 mm, imprimible desde el diálogo del navegador en una
// impresora térmica instalada como impresora del sistema. Para impresión
// ESC/POS directa (corte de papel, cajón), el punto de integración es este
// archivo, p. ej. con `node-thermal-printer`.
export function escribirBoletaPdf(boleta, destino) {
  const { venta } = boleta;
  const alto = 230 + venta.items.length * 26 + (venta.clienteNombre ? 12 : 0);
  const doc = new PDFDocument({ size: [227, alto], margin: 12, info: { Title: `Boleta ${boleta.folio}` } });
  doc.pipe(destino);

  const linea = () => doc.text('-'.repeat(44), { align: 'center' });

  doc.font('Helvetica-Bold').fontSize(13).text(config.NOMBRE_LOCAL, { align: 'center' });
  doc.font('Helvetica').fontSize(7).text('Boleta interna — sin validez tributaria ante el SII', { align: 'center' });
  doc.moveDown(0.6).fontSize(9);
  doc.text(`${boleta.tipo} N° ${boleta.folio}`);
  doc.text(`Fecha: ${new Date(boleta.fecha).toLocaleString('es-CL')}`);
  doc.text(venta.tipo === 'MESA' && venta.mesa ? `Mesa ${venta.mesa.numero}` : 'Mostrador');
  if (venta.clienteNombre) doc.text(`Cliente: ${venta.clienteNombre}`);
  linea();

  for (const item of venta.items) {
    doc.text(`${item.cantidad} x ${item.producto.nombre}`);
    doc.text(`${clp(item.precioUnitario)} c/u   ${clp(item.subtotal)}`, { align: 'right' });
  }

  linea();
  doc.text(`Neto: ${clp(venta.subtotal)}`, { align: 'right' });
  doc.text(`IVA (19%): ${clp(venta.impuesto)}`, { align: 'right' });
  doc.font('Helvetica-Bold').fontSize(12).text(`TOTAL: ${clp(venta.total)}`, { align: 'right' });
  doc.moveDown().font('Helvetica').fontSize(8).text('¡Gracias por su visita!', { align: 'center' });
  doc.end();
}
