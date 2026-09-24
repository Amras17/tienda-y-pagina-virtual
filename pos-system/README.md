# POS Cafetería — Sistema interno de gestión

Sistema interno para una cafetería de especialidad: stock e insumos con
trazabilidad FIFO, recetas y costeo, punto de venta (mostrador y mesas),
boletas internas en PDF, pantalla de comanda para cocina/barra, pantalla
pública para el cliente, y un dashboard con reportes.

Es un **MVP funcional**, no un sistema de producción completo. Todo el flujo
de negocio (stock, recetas, ventas, boletas, dashboard) funciona de verdad
contra una base de datos real. Dos piezas quedan **explícitamente como
stub** documentado (ver sección "Qué es un STUB" más abajo):
facturación electrónica ante el SII, e impresión térmica ESC/POS directa.

## Módulos

1. **Stock e insumos**: insumos (materia prima), lotes de ingreso (FIFO),
   movimientos de stock, proveedores y órdenes de compra.
2. **Recetas y costeo**: cada producto vendible tiene una receta (lista de
   insumos + cantidad). El costo y margen se calculan a partir del costo
   real de los lotes o del costo de referencia.
3. **POS**: venta en mostrador y venta por mesa (pedido abierto, se puede
   seguir agregando ítems antes de cobrar).
4. **Boletas**: comprobante interno en PDF por cada venta cobrada.
5. **Dashboard y reportes**: KPIs del día, productos más vendidos, ventas
   por modalidad, ventas por período, rentabilidad por producto, alertas de
   stock mínimo.
6. **Comanda** (cocina/barra): pedidos pendientes en tiempo casi real.
7. **Pantalla de cliente**: monitor/tablet orientado al cliente, sin login.

## Arquitectura

```
                    ┌───────────────────────────┐
                    │   Frontend (React + Vite) │
                    │  Login / POS / Stock /    │
                    │  Recetas / Dashboard /    │
                    │  Comanda / Pantalla       │
                    │  cliente (publica)        │
                    └─────────────┬─────────────┘
                                  │ REST (fetch, JWT en header)
                                  ▼
                    ┌───────────────────────────┐
                    │  Backend (Express)        │
                    │  routes/  -> controllers  │
                    │  services/ -> logica de   │
                    │    negocio (stock FIFO,   │
                    │    costeo, ventas, PDF)   │
                    │  middleware/auth (JWT+rol)│
                    └─────────────┬─────────────┘
                                  │ Prisma ORM
                                  ▼
                    ┌───────────────────────────┐
                    │  SQLite (dev) /            │
                    │  PostgreSQL (produccion)   │
                    └───────────────────────────┘

  Boleta PDF -----> backend/storage/boletas/boleta-<folio>.pdf
  siiAdapter.js ---> STUB (sin integracion real al SII)
```

## Roles y jerarquía de permisos

| Rol        | Puede...                                                                 |
|------------|---------------------------------------------------------------------------|
| ADMIN      | Todo: usuarios, configuración global, y todo lo de ENCARGADO.             |
| ENCARGADO  | Todo el acceso operativo del día (dashboard, reportes, stock, recetas, proveedores, mesas, ventas), **sin** gestión de usuarios ni configuración global. |
| CAJERO     | Operar el POS (mostrador y mesas), ver comanda y boletas.                 |
| GARZON     | Operar el POS de mesas, ver comanda y boletas.                            |

## Las 3 pantallas especializadas

Además del POS "normal" (mostrador/mesas/stock/dashboard), el sistema tiene
tres pantallas con información deliberadamente acotada según a quién se le
muestra:

### 1. Pantalla de comanda (cocina/barra) — `/comanda`

- **Quién la usa**: cualquier usuario interno logueado (barista, cocina,
  garzón, cajero, encargado o admin comparten esta vista operativa).
- **Cómo se accede**: dentro de la app, con sesión iniciada, en el menú
  "Comanda". Se refresca sola cada 5 segundos (polling; no usa websockets).
- **Qué muestra**: mesa/mostrador + número de orden, ítems a preparar con
  cantidad y notas, tiempo transcurrido desde que se creó la venta, y un
  botón para marcar cada ítem como "listo".
- **Qué NO muestra, por diseño**: precios unitarios, subtotales, totales,
  ni ningún dato de costeo. El endpoint `/api/comanda/pendientes` no incluye
  esos campos en absoluto (no es solo un filtro visual: el backend nunca los
  envía).

### 2. Pantalla de encargado de turno — rol `ENCARGADO`

- **Quién la usa**: un usuario con rol `ENCARGADO` (ej. `encargado@cafeteria.cl`).
- **Cómo se accede**: iniciando sesión con ese usuario; el menú muestra las
  mismas secciones que ve un `ADMIN` (Dashboard, Stock, Recetas,
  Proveedores) más el POS y la comanda.
- **Limitación explícita**: no existe en el sistema ninguna pantalla de
  "gestión de usuarios" ni de "configuración global"; esas quedan
  reservadas al rol `ADMIN` a nivel de rutas backend (`requireRole('ADMIN')`),
  de modo que aunque se intente llamar a esos endpoints directamente con un
  token de `ENCARGADO`, el backend responde 403.

### 3. Pantalla pública para el cliente — `/pantalla-cliente/mesa/:mesaId` o `/pantalla-cliente/orden/:ventaId`

- **Quién la usa**: nadie con sesión; es una URL pública pensada para un
  monitor o tablet mirando hacia el cliente, en el mostrador o en la mesa.
- **Cómo se accede**: abriendo esa URL directamente en un navegador/tablet
  (ej. `http://localhost:5173/pantalla-cliente/mesa/3`), sin login. Se
  refresca sola cada 5 segundos.
- **Qué muestra**: los ítems y cantidades del pedido en curso de esa mesa u
  orden, el total a pagar con IVA incluido, y un estado simple
  ("Preparando" / "Listo para retirar").
- **Qué NO muestra, por diseño**: costos internos, márgenes, insumos o
  receta, stock, ni datos de otras mesas u otros clientes. El backend expone
  esto mediante rutas **públicas y separadas** (`/api/publico/mesa/:mesaId`,
  `/api/publico/venta/:ventaId`, sin JWT) que arman una respuesta reducida
  a mano (`proyeccionCliente` en `backend/src/routes/publico.js`): nunca
  reutilizan el objeto completo de Venta, así que no hay forma de que costo,
  margen o folio de boleta se filtren por accidente a esta pantalla.

## Decisiones de diseño

- **Venta con stock insuficiente**: si al cobrar no hay stock suficiente en
  ningún lote de un insumo, la venta **igual se completa**. Un café real no
  puede detener el mostrador por un descuadre de stock. El faltante se
  registra igual como movimiento de salida (dejando el insumo en 0, nunca
  negativo a nivel de lote) para que aparezca en las alertas de stock
  mínimo y el encargado pueda reponer. Ver `backend/src/services/stockService.js`.
- **IVA incluido en el precio**: el `precioVenta` de un producto se asume
  con IVA (19%) incluido, como es habitual en boletas a consumidor final en
  Chile; el sistema desglosa `subtotal` e `impuesto` a partir del total.
- **Folio de boleta**: se calcula manualmente (máximo folio existente + 1)
  en vez de usar autoincrement nativo, porque SQLite solo permite una
  columna autoincrement por tabla (ya usada por `id`).

## Qué es un STUB (y por qué)

### Integración con el SII (facturación electrónica, Chile)

`backend/src/services/siiAdapter.js` expone `emitirDTE(boleta)` pero
**no emite documentos tributarios reales**. El sistema genera boletas
internas en PDF que sirven como comprobante interno, pero no tienen validez
tributaria ante el SII. Para una integración real se necesita:

- RUT y razón social de la empresa emisora, y certificado digital (`.pfx`)
  vigente ante el SII para firmar los DTE.
- Folios CAF (Código de Autorización de Folios) autorizados y descargados
  desde el sitio del SII, para el tipo de documento correspondiente
  (Boleta Electrónica 39, Factura Electrónica 33, etc).
- Un proveedor de facturación electrónica autorizado (alternativas usadas
  en Chile: OpenFactura, Haulmer/Simple API, Facturación Móvil, Bsale) o
  implementar el armado XML + firma + envío SOAP directo contra los
  webservices del SII (mucho más complejo).
- Manejo de estados asíncronos (aceptado/rechazado/reparo) y timbre PDF417.

### Impresora térmica física

No hay driver ESC/POS integrado. La vía práctica para este MVP es:
**imprimir el PDF de la boleta con el diálogo de impresión del
navegador/sistema operativo**, apuntando a una impresora térmica
configurada como impresora de sistema con su driver del fabricante (la
mayoría de impresoras térmicas de 80mm soportan esto). El botón "Ver /
imprimir PDF" del POS abre el PDF y desde ahí se puede imprimir
normalmente.

Si más adelante se necesita impresión ESC/POS directa (sin PDF, más
rápida, con corte de papel y apertura de cajón monedas), el punto de
integración es `backend/src/services/invoiceService.js`: se reemplazaría
o complementaría `generarPDF` con una llamada a una librería como
[`node-thermal-printer`](https://www.npmjs.com/package/node-thermal-printer),
construyendo el ticket con sus propios comandos en vez del PDF.

## Instalación y ejecución local (sin Docker)

Requisitos: Node.js 18+.

### Backend

```bash
cd pos-system/backend
npm install
cp .env.example .env
npx prisma migrate dev --name init   # crea la base SQLite y aplica el schema
npm run seed                          # datos demo (o ya se ejecuta con migrate dev)
npm run dev                           # http://localhost:4000
```

### Frontend

```bash
cd pos-system/frontend
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:4000/api
npm run dev                # http://localhost:5173
```

## Ejecución con Docker

```bash
cd pos-system
docker compose up --build
```

- Backend: http://localhost:4000
- Frontend: http://localhost:5173

El contenedor del backend aplica migraciones y siembra datos demo
automáticamente la primera vez que arranca (ver `Dockerfile.backend`).

## Credenciales demo

Contraseña para todos: `demo1234`

| Email                     | Rol       |
|---------------------------|-----------|
| admin@cafeteria.cl        | ADMIN     |
| encargado@cafeteria.cl    | ENCARGADO |
| cajero@cafeteria.cl       | CAJERO    |
| garzon@cafeteria.cl       | GARZON    |

## Migrar de SQLite a PostgreSQL

1. En `backend/prisma/schema.prisma`, cambia:
   ```prisma
   datasource db {
     provider = "sqlite"      // cambiar a:
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Define `DATABASE_URL` con una cadena `postgresql://usuario:password@host:5432/basededatos`.
3. Corre `npx prisma migrate dev --name init_postgres` para generar la
   migración correspondiente al nuevo motor.
4. En `docker-compose.yml`, descomenta el servicio `postgres` (al final del
   archivo) y actualiza `DATABASE_URL` del servicio `backend` según se
   indica ahí mismo.

## Manual de uso rápido

### Administrador / Encargado

- **Insumos y stock** (`/stock`): crear insumos, ver stock actual (suma de
  lotes) con alerta visual roja si está bajo el mínimo, e ingresar stock
  nuevo (crea un lote con su costo).
- **Recetas** (`/recetas`): elegir un producto, agregar/quitar insumos y su
  cantidad necesaria, guardar. Se muestra el costo y margen calculado al
  instante.
- **Proveedores y órdenes de compra** (`/proveedores`): crear proveedores,
  crear una orden de compra con sus ítems, y marcarla "recibida" cuando
  llega la mercadería (esto genera automáticamente los lotes de stock).
- **Dashboard** (`/dashboard`): tarjetas de KPIs del día (ventas, ticket
  promedio, alertas de stock) y gráficos de productos más vendidos, ventas
  por modalidad y ventas por día.

### Cajero / Garzón

- **Tomar un pedido en mostrador** (`/mostrador`): tocar los productos para
  agregarlos al carrito, ajustar cantidades, y presionar "Cobrar". Se
  genera la boleta en PDF automáticamente.
- **Tomar un pedido en mesa** (`/mesas`): tocar una mesa para abrirla,
  agregar productos (crea el pedido si es nuevo, o los suma si la mesa ya
  tenía un pedido abierto), y presionar "Cobrar mesa" cuando el cliente
  pide la cuenta.
- **Comanda** (`/comanda`): ver los pedidos pendientes de preparar y marcar
  cada ítem como "listo" a medida que se prepara.
- **Boletas** (`/boletas`): ver el historial de boletas emitidas y volver a
  abrir su PDF.

## Estructura de carpetas

```
pos-system/
  backend/
    prisma/schema.prisma, seed.js, migrations/
    src/
      index.js
      middleware/auth.js
      routes/ (auth, insumos, recetas, productos, proveedores,
                ordenesCompra, mesas, ventas, boletas, dashboard,
                reportes, comanda, publico)
      services/ (stockService, costingService, saleService,
                  invoiceService, siiAdapter)
      utils/
    storage/boletas/ (PDFs generados)
  frontend/
    src/
      pages/ (Login, POSMostrador, POSMesas, Stock, Recetas, Proveedores,
              Dashboard, Boletas, Comanda, PantallaCliente)
      components/ (Navbar, ProtectedRoute)
      api/ (client.js, auth.js)
  docker-compose.yml
  Dockerfile.backend
  Dockerfile.frontend
```
