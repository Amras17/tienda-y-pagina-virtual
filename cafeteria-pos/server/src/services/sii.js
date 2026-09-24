// STUB de integración con el SII (Chile) para facturación electrónica (DTE).
//
// NO emite documentos tributarios reales. Una integración real necesita:
//   1. RUT y razón social del emisor y certificado digital (.pfx) vigente.
//   2. Folios CAF autorizados por el SII para el tipo de documento
//      (Boleta Electrónica 39, Factura Electrónica 33, etc.).
//   3. Un proveedor autorizado con API (OpenFactura, Haulmer/Simple API,
//      Facturación Móvil, Bsale…) o implementar XML + firma + envío SOAP
//      directo a los webservices del SII.
//   4. Manejo de estados asíncronos (aceptado / rechazado / reparo) y
//      representación impresa con timbre PDF417.
//
// Mientras tanto el sistema opera en modo "boleta interna": un PDF que sirve
// de comprobante pero SIN validez tributaria.
export async function emitirDTE(boleta) {
  return {
    estado: 'STUB',
    mensaje: 'Integración SII pendiente de credenciales y proveedor autorizado (ver services/sii.js).',
    folio: boleta.folio,
  };
}
