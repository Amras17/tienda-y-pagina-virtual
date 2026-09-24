export const TASA_IVA = 0.19;

// Los precios de venta incluyen IVA (práctica habitual en boletas a
// consumidor final en Chile). Se desglosa neto e IVA a partir del total,
// en pesos enteros: neto + iva === total siempre.
export function calcularTotales(items) {
  const total = items.reduce((acc, i) => acc + i.subtotal, 0);
  const subtotal = Math.round(total / (1 + TASA_IVA));
  return { subtotal, impuesto: total - subtotal, total };
}
