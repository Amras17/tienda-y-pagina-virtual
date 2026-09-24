const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const prisma = require('../utils/prisma');
const siiAdapter = require('./siiAdapter');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'boletas');

function asegurarCarpeta() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

// Genera el PDF de una boleta interna (comprobante). No es un DTE valido
// ante el SII: es un comprobante interno de la cafeteria (ver siiAdapter.js).
//
// NOTA sobre impresion termica: este PDF se puede enviar directamente al
// dialogo de impresion del navegador/SO apuntando a una impresora termica
// configurada como impresora de sistema (via driver del fabricante). Es la
// via practica sin SDK propietario para este MVP. Si mas adelante se
// requiere impresion ESC/POS directa (sin PDF, mas rapida), el punto de
// integracion seria aqui mismo: reemplazar/complementar generarPDF con una
// llamada a una libreria como `node-thermal-printer`, construyendo el
// ticket con sus comandos (texto, corte de papel, cajon monedas) en vez de
// (o ademas de) el PDF.
function generarPDF(boletaData) {
  asegurarCarpeta();
  const { folio, tipo, fecha, items, subtotal, impuesto, total, clienteNombre } = boletaData;
  const filePath = path.join(STORAGE_DIR, `boleta-${folio}.pdf`);
  const doc = new PDFDocument({ size: [227, 500], margin: 10 }); // ancho aprox ticket 80mm

  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(14).text('Cafeteria', { align: 'center' });
  doc.fontSize(8).text('Boleta interna (no valida ante el SII)', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(9).text(`${tipo} N° ${folio}`);
  doc.text(`Fecha: ${new Date(fecha).toLocaleString('es-CL')}`);
  if (clienteNombre) doc.text(`Cliente: ${clienteNombre}`);
  doc.moveDown(0.5);
  doc.text('--------------------------------');

  items.forEach((item) => {
    doc.text(`${item.cantidad} x ${item.nombreProducto}`);
    doc.text(`   $${item.precioUnitario.toLocaleString('es-CL')}  =  $${item.subtotal.toLocaleString('es-CL')}`);
  });

  doc.text('--------------------------------');
  doc.text(`Subtotal: $${subtotal.toLocaleString('es-CL')}`);
  doc.text(`IVA (19%): $${impuesto.toLocaleString('es-CL')}`);
  doc.fontSize(11).text(`TOTAL: $${total.toLocaleString('es-CL')}`, { align: 'right' });
  doc.moveDown();
  doc.fontSize(8).text('Gracias por su compra', { align: 'center' });

  doc.end();

  return `boletas/boleta-${folio}.pdf`;
}

async function generarBoletaParaVenta(ventaId) {
  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { items: { include: { producto: true } } },
  });
  if (!venta) throw new Error('Venta no encontrada');

  // El folio correlativo se calcula manualmente (max folio existente + 1)
  // dentro de una transaccion, ya que SQLite solo admite un autoincrement()
  // nativo por tabla (usado por "id").
  const boleta = await prisma.$transaction(async (tx) => {
    const ultima = await tx.boleta.findFirst({ orderBy: { folio: 'desc' } });
    const folio = (ultima ? ultima.folio : 0) + 1;
    return tx.boleta.create({
      data: {
        ventaId,
        folio,
        tipo: 'BOLETA',
        pdfPath: '',
        estadoSII: 'NO_ENVIADA',
      },
    });
  });

  const pdfPath = generarPDF({
    folio: boleta.folio,
    tipo: boleta.tipo,
    fecha: boleta.fecha,
    clienteNombre: venta.clienteNombre,
    items: venta.items.map((item) => ({
      nombreProducto: item.producto.nombre,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: item.subtotal,
    })),
    subtotal: venta.subtotal,
    impuesto: venta.impuesto,
    total: venta.total,
  });

  const boletaActualizada = await prisma.boleta.update({
    where: { id: boleta.id },
    data: { pdfPath },
  });

  return boletaActualizada;
}

// Intenta emitir el DTE via el adaptador SII (actualmente un stub) y deja
// registro del intento en el estado de la boleta.
async function enviarSII(boletaId) {
  const boleta = await prisma.boleta.findUnique({ where: { id: boletaId } });
  if (!boleta) throw new Error('Boleta no encontrada');

  const resultado = await siiAdapter.emitirDTE(boleta);

  await prisma.boleta.update({
    where: { id: boletaId },
    data: { estadoSII: 'STUB' },
  });

  return resultado;
}

function rutaAbsolutaPDF(pdfPath) {
  // pdfPath se guarda como "boletas/boleta-<folio>.pdf" relativo a storage/
  return path.join(__dirname, '..', '..', 'storage', pdfPath);
}

module.exports = { generarBoletaParaVenta, enviarSII, rutaAbsolutaPDF };
