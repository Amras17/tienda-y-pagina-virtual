# POS Cafetería v2

Sistema interno para una cafetería de especialidad: **stock de insumos con
FIFO**, **recetas y costeo**, **punto de venta** (mostrador y mesas),
**boletas en PDF**, **comanda** para barra/cocina, **pantalla pública** para
el cliente y **dashboard** con reportes.

Es la reconstrucción desde cero de `pos-system/` (v1): mismas pantallas,
mismos roles, mismas reglas de negocio, pero con una base más simple, más
segura y probada. Ver [Qué cambió respecto a v1](#qué-cambió-respecto-a-v1).

## Inicio rápido

### Con Docker (recomendado)

```bash
cd cafeteria-pos
JWT_SECRET=$(openssl rand -hex 32) docker compose up --build
```

Abre **http://localhost:4000**. Un solo contenedor sirve la API y el
frontend. La primera vez aplica migraciones y carga datos demo; la base
SQLite vive en el volumen `pos_data`.

### Local (Node.js 22+)

```bash
cd cafeteria-pos
npm run setup          # instala server y web, crea la base y carga datos demo
npm run dev:server     # API en http://localhost:4000
npm run dev:web        # en otra terminal: app en http://localhost:5173
```

En desarrollo Vite redirige `/api` al backend (mismo origen, sin CORS).

### Credenciales demo

Contraseña para todos: `demo1234` (en el login hay botones para rellenarlas).

| Email                    | Rol       | Entra a    |
|--------------------------|-----------|------------|
| admin@cafeteria.cl       | ADMIN     | Mostrador  |
| encargado@cafeteria.cl   | ENCARGADO | Mostrador  |
| cajero@cafeteria.cl      | CAJERO    | Mostrador  |
| garzon@cafeteria.cl      | GARZON    | Mesas      |

### Tests

```bash
npm test               # 10 tests de integración de la API (base SQLite desechable)
```

Cubren: cobro con IVA incluido, descuento FIFO entre lotes, venta sin stock
suficiente, doble cobro, mesas (pedido compartido, cobro, anulación),
permisos por rol, que la comanda y la pantalla pública nunca expongan
precios/costos, órdenes de compra y costeo de recetas.

## Módulos y roles

| Sección            | ADMIN | ENCARGADO | CAJERO | GARZON |
|--------------------|:-----:|:---------:|:------:|:------:|
| Mostrador          |  ✔    |    ✔      |   ✔    |        |
| Mesas              |  ✔    |    ✔      |   ✔    |   ✔    |
| Comanda            |  ✔    |    ✔      |   ✔    |   ✔    |
| Boletas            |  ✔    |    ✔      |   ✔    |   ✔    |
| Stock              |  ✔    |    ✔      |        |        |
| Carta y recetas    |  ✔    |    ✔      |        |        |
| Proveedores / OC   |  ✔    |    ✔      |        |        |
| Dashboard          |  ✔    |    ✔      |        |        |
| Anular pedido      |  ✔    |    ✔      |        |        |
| Eliminar registros |  ✔    |           |        |        |

Los permisos se validan en el **backend** (`requireRole`); el menú del
frontend solo oculta lo que el rol no puede usar.

## Las 3 pantallas especializadas

**1. Comanda (`/comanda`)** — barra y cocina. Pedidos con ítems pendientes,
cantidad, notas de preparación («leche de avena»), nombre del cliente,
tiempo transcurrido (en rojo pasados 10 min), botón «Listo» por ítem y «Todo
listo» por pedido. Se refresca cada 5 s (y deja de consultar si la pestaña
no está visible). El endpoint usa un `select` explícito: **precios y totales
nunca salen de la base** hacia esta pantalla.

**2. Encargado de turno** — rol `ENCARGADO`: todo lo operativo (dashboard,
stock, carta, proveedores, anular pedidos) pero no las acciones de
administración global (eliminar), que el backend reserva a `ADMIN` con 403.

**3. Pantalla del cliente** — pública, sin login, para un monitor o tablet:

- `/pantalla-cliente/mesa/:mesaId` — el pedido abierto de esa mesa. Al
  cobrarse, la pantalla se limpia sola.
- `/pantalla-cliente/orden/:codigo` — un pedido de mostrador. El botón
  «Pantalla cliente» aparece tras cada cobro. Usa un **código no
  adivinable**, no el id correlativo, así nadie puede espiar pedidos ajenos
  cambiando un número en la URL.

Muestra ítems, total con IVA y estado: **«Preparando»** hasta que barra marca
todo como listo en la comanda, luego **«Listo para retirar»**. Nunca muestra
costos, márgenes, recetas, stock, folio ni datos de otros clientes.

## Reglas de negocio

- **IVA incluido**: `precioVenta` incluye IVA 19 %. La venta guarda total,
  neto e IVA en **pesos enteros** (neto + IVA = total, siempre).
- **Precio congelado**: cada ítem guarda el precio del momento; cambiar la
  carta no altera pedidos ya tomados.
- **Cobro atómico**: marcar pagada, descontar stock y emitir boleta ocurren en
  **una sola transacción**. Si algo falla no queda nada a medias. Un doble
  clic en «Cobrar» se rechaza (409) sin descontar stock dos veces.
- **FIFO**: el stock se consume del lote más antiguo. El costo de receta usa el
  costo del lote más reciente (costo de reposición) o el de referencia.
- **Sin stock no se detiene la venta**: un café no puede frenar el mostrador
  por un descuadre. Ningún lote queda negativo; el faltante se registra como
  movimiento y el insumo aparece en las alertas de stock mínimo.
- **Mesas**: una mesa está ocupada si y solo si tiene un pedido abierto (el
  estado se deriva, no se guarda). Si dos garzones abren la misma mesa a la
  vez, los ítems se suman al mismo pedido. Anular un pedido abierto libera la
  mesa; un pedido ya cobrado no se anula (requeriría nota de crédito).
- **Folio de boleta**: correlativo (máximo + 1) dentro de la transacción de
  cobro, con índice único y reintento automático ante choque.
- **Reportes en hora local** (`TZ=America/Santiago` en Docker): una venta a
  las 23:00 cuenta para ese día, no para el siguiente.

## Qué cambió respecto a v1

| Tema | v1 (`pos-system/`) | v2 (`cafeteria-pos/`) |
|---|---|---|
| **PDF de boletas** | El enlace «Ver PDF» no enviaba el token → 401. Las boletas demo no tenían PDF. | Se descarga con token y se abre en pestaña. Se genera al vuelo: siempre existe, sin carpeta ni volumen extra. |
| **Cobro** | 3 pasos separados (pagar, stock, boleta): una falla dejaba datos a medias. | Una transacción. |
| **Dinero** | `Float` con decimales en pesos. | Enteros CLP. |
| **Estado de mesa** | Guardado aparte; había que acordarse de liberarla. | Derivado de los pedidos abiertos. Dos garzones en la misma mesa comparten pedido. |
| **Pantalla cliente** | «Listo para retirar» apenas se pagaba (aunque no estuviera preparado). URL con id correlativo. | Estado según la comanda real. Código no adivinable. |
| **Validación** | Casi nula (`Number(x)` sin chequeo). | Zod en cada endpoint: 400 con mensaje claro. |
| **Rendimiento** | Dashboard y costeo con consultas N+1 y ventas completas en memoria. 5 llamadas para el dashboard. | Agregaciones en la base, una llamada, número fijo de consultas. |
| **Notas de preparación** | Soportadas por la API pero sin campo en la interfaz. | Campo por ítem en el carrito; visibles en comanda. |
| **Carta** | Sin pantalla para productos (solo recetas). | «Carta y recetas»: precio, categoría, disponibilidad y receta con costo y margen. |
| **Sesión** | Un token vencido dejaba la app mostrando errores. | Vuelve al login. Login con límite de intentos. |
| **Seguridad de config.** | Secreto JWT con valor por defecto también en producción. | En producción no arranca sin un `JWT_SECRET` de 24+ caracteres. |
| **Despliegue** | 2 contenedores, URL de API fija en el build, CORS. | 1 contenedor, mismo origen, cierre ordenado y healthcheck. |
| **Frontend** | Todo en un bundle. | Cada pantalla es un chunk: Chart.js solo se descarga en el dashboard. |
| **Tests** | Ninguno. | 10 tests de integración. |
| **Stack** | Express 4, React 18, Vite 5, Prisma 5, CommonJS. | Express 5, React 19, Vite 8, React Router 7, Prisma 6, Zod 4, ESM, Node 22. |

## Arquitectura

```
Navegador (React 19 + Vite)
   │  fetch /api/* con JWT (mismo origen)
   ▼
Express 5 ─ server/src/app.js
   ├─ routes/     HTTP: validación (Zod) + permisos (requireRole)
   ├─ services/   reglas de negocio:
   │     ventas.js     crear / agregar / cobrar (transacción) / anular
   │     stock.js      lotes, FIFO, stock actual, alertas
   │     costeo.js     costo de receta y margen (sin N+1)
   │     reportes.js   agrupación por día / semana ISO / mes en hora local
   │     boletaPdf.js  ticket 80 mm al vuelo (pdfkit)
   │     sii.js        STUB de facturación electrónica
   ├─ public/     frontend compilado (solo en la imagen Docker)
   ▼
Prisma 6 ─ SQLite (por defecto) o PostgreSQL
```

```
cafeteria-pos/
  Dockerfile, docker-compose.yml, package.json (scripts de conveniencia)
  server/
    prisma/  schema.prisma, migrations/, seed.js
    src/     app.js, index.js, config.js, db.js, auth.js, lib/, routes/, services/
    test/    helpers.js, *.test.js
  web/
    src/     App.jsx, lib/ (api, auth, hooks, format), components/, pages/
```

## Qué es un STUB (y por qué)

**Facturación electrónica (SII)** — `server/src/services/sii.js` no emite DTE
reales. Las boletas son **comprobantes internos sin validez tributaria**. Una
integración real requiere RUT y certificado digital del emisor, folios CAF,
un proveedor autorizado (OpenFactura, Haulmer, Facturación Móvil, Bsale…) o
el armado XML + firma + envío SOAP al SII, y manejo de estados asíncronos
con timbre PDF417.

**Impresora térmica** — la boleta es un PDF de 80 mm que se imprime con el
diálogo del navegador en una impresora térmica instalada como impresora del
sistema. Para ESC/POS directo (corte de papel, cajón), el punto de
integración es `server/src/services/boletaPdf.js` (p. ej. con
`node-thermal-printer`).

## Pasar a PostgreSQL

Recomendado si varias cajas cobran en paralelo.

1. `server/prisma/schema.prisma`: `provider = "postgresql"`.
2. `DATABASE_URL="postgresql://usuario:clave@host:5432/pos"`.
3. Borra `server/prisma/migrations/` y ejecuta `npx prisma migrate dev --name init`
   contra una base Postgres vacía (las migraciones son específicas del motor).
4. En `docker-compose.yml` descomenta el servicio `db` según se indica ahí.

## Configuración

Variables del backend (`server/.env`, ver `.env.example`):

| Variable         | Por defecto          | Nota |
|------------------|----------------------|------|
| `DATABASE_URL`   | `file:./dev.db`      | SQLite o PostgreSQL |
| `JWT_SECRET`     | (solo en desarrollo) | **Obligatorio en producción**, 24+ caracteres |
| `JWT_EXPIRES_IN` | `12h`                | Duración de la sesión |
| `PORT`           | `4000`               | |
| `NOMBRE_LOCAL`   | `Cafetería`          | Encabezado de la boleta |
| `CORS_ORIGIN`    | —                    | Solo si el frontend está en otro origen |
| `TZ`             | del sistema          | `America/Santiago` en Docker |

## Manual de uso rápido

**Cajero** — *Mostrador*: toca productos, ajusta cantidades con − / +,
agrega una nota para barra si hace falta, opcionalmente el nombre del
cliente, y **Cobrar**. Se emite la boleta y aparecen «Ver / imprimir PDF» y
«Pantalla cliente».

**Garzón** — *Mesas*: toca una mesa (verde = libre, amarilla = ocupada con su
total). Agrega productos y pulsa **Abrir pedido** o **Agregar al pedido**.
Cuando piden la cuenta, **Cobrar mesa**. «Pantalla de la mesa ↗» abre la
vista para la tablet de esa mesa.

**Barra / cocina** — *Comanda*: marca cada ítem como **Listo** o el pedido
completo con **Todo listo**. La pantalla del cliente cambia sola a «Listo
para retirar».

**Encargado / Admin**

- *Stock*: stock actual por insumo (rojo = bajo el mínimo), **Ingresar stock**
  (crea un lote con costo y proveedor opcional) y alta de insumos.
- *Carta y recetas*: crea o edita productos (precio, categoría,
  disponibilidad en mostrador/mesas, activo) y su receta. Al guardar se
  muestra costo y margen.
- *Proveedores*: alta de proveedores, órdenes de compra y **Marcar recibida**
  (crea los lotes de stock automáticamente, una sola vez).
- *Dashboard*: ventas de hoy, ticket promedio, alertas de stock, más vendidos,
  mostrador vs mesa, ventas por día / semana / mes, alertas y rentabilidad
  por producto.
- *Mesas*: además puede **Anular** un pedido abierto.
