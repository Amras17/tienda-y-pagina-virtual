const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Sembrando datos demo de la cafeteria...');

  const passwordHash = await bcrypt.hash('demo1234', 10);

  const [admin, encargado, cajero, garzon] = await Promise.all([
    prisma.usuario.upsert({
      where: { email: 'admin@cafeteria.cl' },
      update: {},
      create: { nombre: 'Ana Administradora', email: 'admin@cafeteria.cl', passwordHash, rol: 'ADMIN' },
    }),
    prisma.usuario.upsert({
      where: { email: 'encargado@cafeteria.cl' },
      update: {},
      create: { nombre: 'Eduardo Encargado', email: 'encargado@cafeteria.cl', passwordHash, rol: 'ENCARGADO' },
    }),
    prisma.usuario.upsert({
      where: { email: 'cajero@cafeteria.cl' },
      update: {},
      create: { nombre: 'Carla Cajera', email: 'cajero@cafeteria.cl', passwordHash, rol: 'CAJERO' },
    }),
    prisma.usuario.upsert({
      where: { email: 'garzon@cafeteria.cl' },
      update: {},
      create: { nombre: 'Gabriel Garzon', email: 'garzon@cafeteria.cl', passwordHash, rol: 'GARZON' },
    }),
  ]);

  const proveedores = await Promise.all([
    prisma.proveedor.create({ data: { nombre: 'Café del Valle Ltda.', contacto: 'Marcos Diaz', telefono: '+56911111111', email: 'ventas@cafedelvalle.cl' } }),
    prisma.proveedor.create({ data: { nombre: 'Lacteos Sur', contacto: 'Paula Rojas', telefono: '+56922222222', email: 'contacto@lacteossur.cl' } }),
    prisma.proveedor.create({ data: { nombre: 'Insumos Panaderos SpA', contacto: 'Jorge Lira', telefono: '+56933333333', email: 'pedidos@insumospanaderos.cl' } }),
  ]);
  const [proveedorCafe, proveedorLacteos, proveedorPanaderia] = proveedores;

  const insumosData = [
    { nombre: 'Café en grano', unidadMedida: 'kg', stockMinimo: 3, costoUnitarioReferencia: 9000, proveedor: proveedorCafe },
    { nombre: 'Leche entera', unidadMedida: 'lt', stockMinimo: 10, costoUnitarioReferencia: 1200, proveedor: proveedorLacteos },
    { nombre: 'Azúcar', unidadMedida: 'kg', stockMinimo: 5, costoUnitarioReferencia: 1100, proveedor: proveedorPanaderia },
    { nombre: 'Vasos desechables 12oz', unidadMedida: 'un', stockMinimo: 100, costoUnitarioReferencia: 60, proveedor: proveedorPanaderia },
    { nombre: 'Tapas 12oz', unidadMedida: 'un', stockMinimo: 100, costoUnitarioReferencia: 30, proveedor: proveedorPanaderia },
    { nombre: 'Canela molida', unidadMedida: 'kg', stockMinimo: 0.5, costoUnitarioReferencia: 6000, proveedor: proveedorPanaderia },
    { nombre: 'Sirope de vainilla', unidadMedida: 'lt', stockMinimo: 1, costoUnitarioReferencia: 8500, proveedor: proveedorCafe },
    { nombre: 'Masa de croissant', unidadMedida: 'un', stockMinimo: 20, costoUnitarioReferencia: 700, proveedor: proveedorPanaderia },
    { nombre: 'Chocolate en polvo', unidadMedida: 'kg', stockMinimo: 1, costoUnitarioReferencia: 7200, proveedor: proveedorPanaderia },
  ];

  const insumos = {};
  for (const data of insumosData) {
    const insumo = await prisma.insumo.create({
      data: {
        nombre: data.nombre,
        unidadMedida: data.unidadMedida,
        stockMinimo: data.stockMinimo,
        costoUnitarioReferencia: data.costoUnitarioReferencia,
      },
    });
    insumos[data.nombre] = insumo;

    // Ingreso inicial de stock (crea el primer lote FIFO de cada insumo).
    const cantidadInicial = data.stockMinimo * 4;
    const lote = await prisma.loteInsumo.create({
      data: {
        insumoId: insumo.id,
        cantidadInicial,
        cantidadRestante: cantidadInicial,
        costoUnitario: data.costoUnitarioReferencia,
        proveedorId: data.proveedor.id,
        fechaIngreso: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.movimientoStock.create({
      data: { insumoId: insumo.id, loteId: lote.id, tipo: 'INGRESO', cantidad: cantidadInicial, referencia: 'Stock inicial (seed)' },
    });
  }

  const categoriaBebidas = await prisma.categoriaProducto.create({ data: { nombre: 'Bebidas calientes' } });
  const categoriaPasteleria = await prisma.categoriaProducto.create({ data: { nombre: 'Pastelería' } });

  async function crearProductoConReceta({ nombre, categoriaId, precioVenta, recetaItems }) {
    const producto = await prisma.producto.create({
      data: { nombre, categoriaId, precioVenta, disponibleMostrador: true, disponibleMesa: true },
    });
    const receta = await prisma.receta.create({ data: { productoId: producto.id } });
    for (const item of recetaItems) {
      await prisma.recetaItem.create({
        data: { recetaId: receta.id, insumoId: insumos[item.insumo].id, cantidadNecesaria: item.cantidad },
      });
    }
    return producto;
  }

  const espresso = await crearProductoConReceta({
    nombre: 'Espresso',
    categoriaId: categoriaBebidas.id,
    precioVenta: 1800,
    recetaItems: [
      { insumo: 'Café en grano', cantidad: 0.018 },
      { insumo: 'Vasos desechables 12oz', cantidad: 1 },
      { insumo: 'Tapas 12oz', cantidad: 1 },
    ],
  });

  const latte = await crearProductoConReceta({
    nombre: 'Latte',
    categoriaId: categoriaBebidas.id,
    precioVenta: 2800,
    recetaItems: [
      { insumo: 'Café en grano', cantidad: 0.018 },
      { insumo: 'Leche entera', cantidad: 0.2 },
      { insumo: 'Vasos desechables 12oz', cantidad: 1 },
      { insumo: 'Tapas 12oz', cantidad: 1 },
    ],
  });

  const cappuccino = await crearProductoConReceta({
    nombre: 'Cappuccino',
    categoriaId: categoriaBebidas.id,
    precioVenta: 2900,
    recetaItems: [
      { insumo: 'Café en grano', cantidad: 0.018 },
      { insumo: 'Leche entera', cantidad: 0.15 },
      { insumo: 'Canela molida', cantidad: 0.003 },
      { insumo: 'Vasos desechables 12oz', cantidad: 1 },
      { insumo: 'Tapas 12oz', cantidad: 1 },
    ],
  });

  const vainillaLatte = await crearProductoConReceta({
    nombre: 'Latte de vainilla',
    categoriaId: categoriaBebidas.id,
    precioVenta: 3200,
    recetaItems: [
      { insumo: 'Café en grano', cantidad: 0.018 },
      { insumo: 'Leche entera', cantidad: 0.2 },
      { insumo: 'Sirope de vainilla', cantidad: 0.03 },
      { insumo: 'Vasos desechables 12oz', cantidad: 1 },
      { insumo: 'Tapas 12oz', cantidad: 1 },
    ],
  });

  const mocha = await crearProductoConReceta({
    nombre: 'Mocha',
    categoriaId: categoriaBebidas.id,
    precioVenta: 3100,
    recetaItems: [
      { insumo: 'Café en grano', cantidad: 0.018 },
      { insumo: 'Leche entera', cantidad: 0.18 },
      { insumo: 'Chocolate en polvo', cantidad: 0.02 },
      { insumo: 'Vasos desechables 12oz', cantidad: 1 },
      { insumo: 'Tapas 12oz', cantidad: 1 },
    ],
  });

  const croissant = await crearProductoConReceta({
    nombre: 'Croissant',
    categoriaId: categoriaPasteleria.id,
    precioVenta: 2200,
    recetaItems: [{ insumo: 'Masa de croissant', cantidad: 1 }],
  });

  const croissantAzucar = await crearProductoConReceta({
    nombre: 'Croissant con azúcar flor',
    categoriaId: categoriaPasteleria.id,
    precioVenta: 2400,
    recetaItems: [
      { insumo: 'Masa de croissant', cantidad: 1 },
      { insumo: 'Azúcar', cantidad: 0.01 },
    ],
  });

  const mesas = [];
  for (let numero = 1; numero <= 8; numero++) {
    mesas.push(await prisma.mesa.create({ data: { numero, capacidad: numero % 2 === 0 ? 4 : 2 } }));
  }

  // Ventas historicas de ejemplo, ya pagadas, para poblar el dashboard.
  async function crearVentaHistorica({ tipo, mesaId, usuarioId, fecha, itemsProducto }) {
    const items = itemsProducto.map(([producto, cantidad]) => ({
      productoId: producto.id,
      cantidad,
      precioUnitario: producto.precioVenta,
      subtotal: producto.precioVenta * cantidad,
    }));
    const subtotalConIva = items.reduce((acc, i) => acc + i.subtotal, 0);
    const subtotal = Math.round((subtotalConIva / 1.19) * 100) / 100;
    const impuesto = Math.round((subtotalConIva - subtotal) * 100) / 100;

    const venta = await prisma.venta.create({
      data: {
        tipo,
        mesaId,
        usuarioId,
        fecha,
        subtotal,
        impuesto,
        total: subtotalConIva,
        estado: 'PAGADA',
        items: { create: items },
      },
    });
    const ultimaBoleta = await prisma.boleta.findFirst({ orderBy: { folio: 'desc' } });
    const folio = (ultimaBoleta ? ultimaBoleta.folio : 0) + 1;
    await prisma.boleta.create({ data: { ventaId: venta.id, folio, tipo: 'BOLETA', pdfPath: '', estadoSII: 'NO_ENVIADA', fecha } });
    return venta;
  }

  const hoy = new Date();
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const anteayer = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  await crearVentaHistorica({ tipo: 'MOSTRADOR', mesaId: null, usuarioId: cajero.id, fecha: anteayer, itemsProducto: [[espresso, 2], [croissant, 1]] });
  await crearVentaHistorica({ tipo: 'MESA', mesaId: mesas[2].id, usuarioId: garzon.id, fecha: anteayer, itemsProducto: [[latte, 2], [croissantAzucar, 2]] });
  await crearVentaHistorica({ tipo: 'MOSTRADOR', mesaId: null, usuarioId: cajero.id, fecha: ayer, itemsProducto: [[cappuccino, 1], [mocha, 1]] });
  await crearVentaHistorica({ tipo: 'MESA', mesaId: mesas[4].id, usuarioId: garzon.id, fecha: ayer, itemsProducto: [[vainillaLatte, 3], [croissant, 3]] });
  await crearVentaHistorica({ tipo: 'MOSTRADOR', mesaId: null, usuarioId: cajero.id, fecha: hoy, itemsProducto: [[latte, 1], [espresso, 1]] });

  console.log('Seed completado.');
  console.log('Usuarios demo (password: demo1234):');
  console.log(' - admin@cafeteria.cl (ADMIN)');
  console.log(' - encargado@cafeteria.cl (ENCARGADO)');
  console.log(' - cajero@cafeteria.cl (CAJERO)');
  console.log(' - garzon@cafeteria.cl (GARZON)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
