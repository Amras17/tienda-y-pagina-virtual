import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import '../src/config.js'; // carga server/.env y valida DATABASE_URL
import { calcularTotales } from '../src/services/totales.js';

const DIA = 86_400_000;

// Datos demo de una cafetería de especialidad. Idempotente: si ya hay
// usuarios no hace nada, así se puede ejecutar en cada arranque del contenedor.
export async function sembrar(prisma, { ventasDemo = true } = {}) {
  if (await prisma.usuario.count()) {
    console.log('La base ya tiene datos: seed omitido.');
    return false;
  }

  const passwordHash = await bcrypt.hash('demo1234', 10);
  const usuarios = {};
  for (const [nombre, email, rol] of [
    ['Ana Administradora', 'admin@cafeteria.cl', 'ADMIN'],
    ['Eduardo Encargado', 'encargado@cafeteria.cl', 'ENCARGADO'],
    ['Carla Cajera', 'cajero@cafeteria.cl', 'CAJERO'],
    ['Gabriel Garzón', 'garzon@cafeteria.cl', 'GARZON'],
  ]) {
    usuarios[rol] = await prisma.usuario.create({ data: { nombre, email, rol, passwordHash } });
  }

  const [cafe, lacteos, panaderia] = await Promise.all([
    prisma.proveedor.create({ data: { nombre: 'Café del Valle Ltda.', contacto: 'Marcos Díaz', telefono: '+56911111111', email: 'ventas@cafedelvalle.cl' } }),
    prisma.proveedor.create({ data: { nombre: 'Lácteos Sur', contacto: 'Paula Rojas', telefono: '+56922222222', email: 'contacto@lacteossur.cl' } }),
    prisma.proveedor.create({ data: { nombre: 'Insumos Panaderos SpA', contacto: 'Jorge Lira', telefono: '+56933333333', email: 'pedidos@insumospanaderos.cl' } }),
  ]);

  // [nombre, unidad, stock mínimo, costo referencia, proveedor]
  const insumosData = [
    ['Café en grano', 'kg', 3, 9000, cafe],
    ['Leche entera', 'lt', 10, 1200, lacteos],
    ['Azúcar', 'kg', 5, 1100, panaderia],
    ['Vasos desechables 12oz', 'un', 100, 60, panaderia],
    ['Tapas 12oz', 'un', 100, 30, panaderia],
    ['Canela molida', 'kg', 0.5, 6000, panaderia],
    ['Sirope de vainilla', 'lt', 1, 8500, cafe],
    ['Masa de croissant', 'un', 20, 700, panaderia],
    ['Chocolate en polvo', 'kg', 1, 7200, panaderia],
  ];
  const insumos = {};
  for (const [nombre, unidadMedida, stockMinimo, costo, proveedor] of insumosData) {
    const cantidad = stockMinimo * 4;
    insumos[nombre] = await prisma.insumo.create({
      data: {
        nombre,
        unidadMedida,
        stockMinimo,
        costoUnitarioReferencia: costo,
        // Primer lote FIFO de cada insumo, con su movimiento de ingreso.
        lotes: {
          create: {
            cantidadInicial: cantidad,
            cantidadRestante: cantidad,
            costoUnitario: costo,
            proveedorId: proveedor.id,
            fechaIngreso: new Date(Date.now() - 5 * DIA),
          },
        },
      },
      include: { lotes: true },
    });
    await prisma.movimientoStock.create({
      data: { insumoId: insumos[nombre].id, loteId: insumos[nombre].lotes[0].id, tipo: 'INGRESO', cantidad, referencia: 'Stock inicial' },
    });
  }

  const bebidas = await prisma.categoriaProducto.create({ data: { nombre: 'Bebidas calientes' } });
  const pasteleria = await prisma.categoriaProducto.create({ data: { nombre: 'Pastelería' } });
  const vaso = [['Vasos desechables 12oz', 1], ['Tapas 12oz', 1]];

  // [nombre, categoría, precio, receta]
  const productosData = [
    ['Espresso', bebidas, 1800, [['Café en grano', 0.018], ...vaso]],
    ['Latte', bebidas, 2800, [['Café en grano', 0.018], ['Leche entera', 0.2], ...vaso]],
    ['Cappuccino', bebidas, 2900, [['Café en grano', 0.018], ['Leche entera', 0.15], ['Canela molida', 0.003], ...vaso]],
    ['Latte de vainilla', bebidas, 3200, [['Café en grano', 0.018], ['Leche entera', 0.2], ['Sirope de vainilla', 0.03], ...vaso]],
    ['Mocha', bebidas, 3100, [['Café en grano', 0.018], ['Leche entera', 0.18], ['Chocolate en polvo', 0.02], ...vaso]],
    ['Croissant', pasteleria, 2200, [['Masa de croissant', 1]]],
    ['Croissant con azúcar flor', pasteleria, 2400, [['Masa de croissant', 1], ['Azúcar', 0.01]]],
  ];
  const productos = {};
  for (const [nombre, categoria, precioVenta, receta] of productosData) {
    productos[nombre] = await prisma.producto.create({
      data: {
        nombre,
        categoriaId: categoria.id,
        precioVenta,
        receta: { create: receta.map(([insumo, cantidadNecesaria]) => ({ insumoId: insumos[insumo].id, cantidadNecesaria })) },
      },
    });
  }

  const mesas = [];
  for (let numero = 1; numero <= 8; numero++) {
    mesas.push(await prisma.mesa.create({ data: { numero, capacidad: numero % 2 === 0 ? 4 : 2 } }));
  }

  if (ventasDemo) {
    // Ventas históricas ya pagadas y preparadas, para poblar el dashboard.
    const historicas = [
      [2, 'MOSTRADOR', null, 'CAJERO', [['Espresso', 2], ['Croissant', 1]]],
      [2, 'MESA', mesas[2], 'GARZON', [['Latte', 2], ['Croissant con azúcar flor', 2]]],
      [1, 'MOSTRADOR', null, 'CAJERO', [['Cappuccino', 1], ['Mocha', 1]]],
      [1, 'MESA', mesas[4], 'GARZON', [['Latte de vainilla', 3], ['Croissant', 3]]],
      [0, 'MOSTRADOR', null, 'CAJERO', [['Latte', 1], ['Espresso', 1]]],
    ];
    let folio = 0;
    for (const [diasAtras, tipo, mesa, rol, lineas] of historicas) {
      const fecha = new Date(Date.now() - diasAtras * DIA);
      const items = lineas.map(([nombre, cantidad]) => ({
        productoId: productos[nombre].id,
        cantidad,
        precioUnitario: productos[nombre].precioVenta,
        subtotal: productos[nombre].precioVenta * cantidad,
        preparado: true,
        preparadoEn: fecha,
        creadoEn: fecha,
      }));
      await prisma.venta.create({
        data: {
          tipo,
          mesaId: mesa?.id ?? null,
          usuarioId: usuarios[rol].id,
          fecha,
          estado: 'PAGADA',
          ...calcularTotales(items),
          items: { create: items },
          boleta: { create: { folio: ++folio, fecha } },
        },
      });
    }
  }

  console.log('Seed completado. Usuarios demo (contraseña demo1234):');
  for (const u of Object.values(usuarios)) console.log(`  - ${u.email} (${u.rol})`);
  return true;
}

// Ejecución directa: `node prisma/seed.js`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prisma = new PrismaClient();
  sembrar(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
