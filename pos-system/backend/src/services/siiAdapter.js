// STUB de integracion con el Servicio de Impuestos Internos (SII) de Chile
// para facturacion electronica (DTE - Documento Tributario Electronico).
//
// Esta funcion NO emite documentos tributarios reales. Para una integracion
// real se necesita, como minimo:
//   1. RUT y razon social de la empresa emisora, certificado digital (.pfx)
//      vigente ante el SII para firmar los DTE.
//   2. Folios CAF (Codigo de Autorizacion de Folios) autorizados y
//      descargados desde el sitio del SII para el tipo de documento
//      (Boleta Electronica 39 / Factura Electronica 33, etc).
//   3. Un proveedor de facturacion electronica autorizado que exponga una
//      API (alternativas usadas en Chile: OpenFactura, Haulmer/Simple API,
//      Facturacion Movil, Bsale, etc.) o bien implementar el armado XML +
//      firma + envio SOAP directamente contra los webservices del SII
//      (mucho mas complejo y fuera del alcance de este MVP).
//   4. Manejo de estados asincronos (aceptado/rechazado/reparo) y
//      almacenamiento del XML timbrado + PDF con representacion grafica
//      (formato "boleta/factura" con timbre PDF417).
//
// Mientras no se conecte un proveedor real, el sistema opera en modo
// "boleta interna": genera un PDF simple (ver invoiceService.js) que sirve
// como comprobante interno, pero NO tiene validez tributaria ante el SII.
async function emitirDTE(boleta) {
  return {
    estado: 'STUB',
    mensaje: 'Integracion SII pendiente de credenciales y proveedor autorizado. Ver comentarios en siiAdapter.js.',
    folio: boleta.folio,
  };
}

module.exports = { emitirDTE };
