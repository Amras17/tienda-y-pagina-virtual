# EmporioAndinoPOS en la nube · Google Cloud SQL (v3.3)

Esta guía explica cómo funciona la nube del sistema y qué hacer el día que se contrate el servicio
para cargar la información.

## 1. Cómo funciona

```
 Caja 1 (navegador)      Tablet garzón           Cocina / Barra
   localStorage            localStorage            localStorage
        │  nucleo/nube.js       │                       │
        └──────────┬────────────┴───────────┬───────────┘
                   │ HTTPS: clave del local + sesión con PIN
                   ▼
        Google Cloud Run  ·  servidor/servidor.js (Node.js)
        - sirve el sistema (las mismas páginas)
        - API /api/... : guarda, junta y reparte los cambios
        - revisa el cargo de quien guarda (403) y lo anota
                   │ socket /cloudsql/PROYECTO:REGION:INSTANCIA
                   ▼
        Google Cloud SQL  ·  PostgreSQL 16
        tablas: kv, kv_historia, ventas, venta_lineas, bitacora, equipos
```

- **Cada equipo sigue trabajando en su navegador**, rápido y aunque se corte internet. La nube no
  reemplaza eso: lo comparte.
- **Al cambiar un dato compartido** (por ejemplo, una venta, un pedido de la fila, una comanda lista o
  el stock), `nucleo/nube.js` lo sube al servidor junto con la versión de la que partió.
- **El servidor junta los cambios** de todos los equipos con una fusión de tres vías:
  - Compara lo que llega con lo guardado y con la versión que ambos conocían.
  - Si dos cajas venden al mismo tiempo, quedan las dos ventas: las listas con `id` se juntan
    elemento por elemento.
  - Si dos personas cambian el mismo valor simple (por ejemplo, el mismo precio), queda el último
    que llegó.
- **Cada 4 segundos** cada equipo trae lo que cambiaron los otros, o cada 20 s con la pantalla
  apagada. Los módulos abiertos se actualizan solos.
- **Sin internet** el equipo sigue funcionando. Lo que cambió queda "por subir" y se envía al
  volver la conexión. El chip del encabezado muestra el estado.
- **Ventas en tablas**: cada venta también se guarda en las tablas `ventas` y `venta_lineas` (con el
  día en hora de Chile), listas para consultar con SQL o exportar a una planilla.

### Qué se comparte y quién lo puede guardar

| Dato | Clave | Lo guardan |
|---|---|---|
| Ventas, arqueos y ajustes de la Caja | `ea_pos` | cargos con Caja (dirección, jefatura, encargados, garzones) |
| Disponibilidad, unidades y horno del día | `ea_control` | Caja, Pedidos, Salón, Cocina, Barra, Horno, Panadería |
| Fila, mesas y pedidos en rondas | `eapos_fila` | Pedidos, Fila, Caja |
| Comandas marcadas como listas | `eapos_comandas` | Cocina, Barra |
| Panadería y horno | `eapos_panaderia`, `eapos_horno` | Panadería, Horno |
| Configuración vigente y versiones | `eapos_cfg`, `eapos_versiones` | solo dirección y jefatura |
| Borrador y fichas de la Prueba | `eapos_prueba_cfg`, `eapos_prueba_fichas` | quienes entran a la Prueba |
| PIN del equipo (solo la huella cifrada) | `es_pins` | cada persona crea el suyo; cambiar o borrar uno es de dirección o jefatura |

Lo que no está en la tabla queda solo en cada equipo: la sesión abierta, el tema, los borradores,
lo reciente y lo que se ve en pantalla.

### Seguridad

1. **Clave del local** (`CLAVE_LOCAL`): se escribe una vez en cada equipo. Sin ella, el servidor
   responde 401 y lo anota.
2. **Sesión con PIN**: al ingresar con el PIN, el equipo abre también una sesión en el servidor
   (firmada, dura 14 horas). Sin sesión no se guarda nada (401).
3. **Cargo**: el servidor revisa con la misma tabla de cargos del sistema (`nucleo/nucleo.js`) si esa
   persona puede guardar ese dato. Si no puede, responde 403 y queda en la tabla `bitacora`.
4. **El PIN nunca viaja**: viaja solo su huella SHA-256, la misma que guarda cada equipo.
   Cinco PIN incorrectos bloquean un minuto.
5. La bitácora de cada equipo también se sube a la tabla `bitacora`, con el registro de qué equipo
   la envió.

## 2. Qué se contrata

| Servicio | Para qué | Elección sugerida |
|---|---|---|
| Google Cloud SQL para PostgreSQL | la base de datos | PostgreSQL 16, edición Enterprise, `db-f1-micro`, 10 GB SSD, región `southamerica-west1` (Santiago) |
| Google Cloud Run | el servidor y las páginas | región `southamerica-west1`, 512 MiB, 1 instancia como máximo |
| Secret Manager | guardar las claves | 3 secretos |

**Costo estimado**:
- Cloud SQL `db-f1-micro`: del orden de **US$10–15 al mes**, más el disco y los respaldos.
- Cloud Run: con 3 a 6 equipos suele quedar dentro de la capa gratuita o en pocos dólares.
- En total, del orden de **US$15–25 al mes**. Son valores aproximados: confírmalos en la
  calculadora de Google Cloud antes de contratar.
- Las cuentas nuevas reciben crédito de prueba.

## 3. Paso a paso para mañana

Todo se puede hacer desde **Cloud Shell**, la terminal que trae la consola de Google Cloud en el
navegador. No hay que instalar nada.

### 3.1 Proyecto y servicios

1. Crear (o elegir) un proyecto en <https://console.cloud.google.com> y activar la facturación.
2. Abrir Cloud Shell (ícono `>_` arriba a la derecha) y escribir, cambiando `MI-PROYECTO`:

```bash
gcloud config set project MI-PROYECTO
gcloud services enable sqladmin.googleapis.com run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com
```

### 3.2 Base de datos Cloud SQL (PostgreSQL 16)

```bash
gcloud sql instances create emporio-db --database-version=POSTGRES_16 --edition=ENTERPRISE \
  --tier=db-f1-micro --region=southamerica-west1 --storage-size=10GB --storage-auto-increase \
  --backup-start-time=08:00
gcloud sql databases create emporiopos --instance=emporio-db
gcloud sql users create emporio --instance=emporio-db --password="UNA-CLAVE-LARGA-PARA-LA-BASE"
```

La creación tarda unos minutos. El respaldo diario queda a las 08:00 UTC, que es de madrugada en
Chile.

### 3.3 Claves (Secret Manager)

```bash
printf '%s' 'UNA-CLAVE-LARGA-PARA-LA-BASE' | gcloud secrets create emporio-db-pass --data-file=-
printf '%s' 'CLAVE-DEL-LOCAL'              | gcloud secrets create emporio-clave-local --data-file=-
openssl rand -hex 32 | tr -d '\n'          | gcloud secrets create emporio-secreto --data-file=-
```

- La **clave del local** es la que se escribe en cada equipo: que sea fácil de dictar y difícil de
  adivinar (por ejemplo, tres palabras y un número).
- El **secreto de sesión** nadie lo escribe nunca.

Permisos para que Cloud Run lea las claves y se conecte a la base:

```bash
NUM=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
for ROL in roles/cloudsql.client roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
    --member="serviceAccount:${NUM}-compute@developer.gserviceaccount.com" --role="$ROL"
done
```

### 3.4 Subir el sistema a Cloud Run

En Cloud Shell, traer el repositorio. Puede ser con `git clone` del repositorio en GitHub, o
subiendo un .zip de la carpeta con el menú ⋮ → Subir. Luego entrar a la carpeta `EmporioAndinoPOS`:

```bash
cd EmporioAndinoPOS
INST=$(gcloud sql instances describe emporio-db --format='value(connectionName)')
gcloud run deploy emporio --source . --region=southamerica-west1 --allow-unauthenticated \
  --add-cloudsql-instances="$INST" --memory=512Mi --max-instances=1 \
  --set-env-vars="INSTANCE_UNIX_SOCKET=/cloudsql/$INST,DB_USER=emporio,DB_NAME=emporiopos,ZONA=America/Santiago" \
  --set-secrets="DB_PASS=emporio-db-pass:latest,CLAVE_LOCAL=emporio-clave-local:latest,SECRETO_SESION=emporio-secreto:latest"
```

- La primera vez pregunta si crea un repositorio de imágenes: responder que sí.
- Al terminar muestra la dirección, algo como `https://emporio-xxxxx.southamerica-west1.run.app`.
- **Las tablas se crean solas al arrancar.**
- `--allow-unauthenticated` permite abrir las páginas desde los equipos del local. Los datos siguen
  protegidos por la clave del local y el PIN.
- `--max-instances=1` mantiene un solo servidor: el bloqueo por PIN incorrecto es uno solo y el
  costo queda acotado.

Para comprobarlo, abrir `https://…run.app/api/salud`. Debe responder
`{"ok":true,"sistema":"3.3","base":"PostgreSQL 16…"}`.

### 3.5 Cargar la información (la primera vez)

Los datos de hoy viven en el navegador del equipo donde se ha usado el sistema (el Mac con el
sistema local). Ese equipo los sube:

1. En el Mac, abrir el sistema como siempre e ingresar con el PIN de dirección.
2. Ir a **Versiones y accesos → Nube · Google Cloud SQL**:
   - **Dirección del servidor**: la de Cloud Run (`https://emporio-xxxxx…run.app`).
   - **Clave del local**: la que se creó en 3.3.
   - **Nombre de este equipo**: por ejemplo, "Caja 1".
   - **Tu PIN**: el de quien está conectando.
3. Tocar **Probar conexión**. Debe decir "Conexión correcta · PostgreSQL 16…".
4. Tocar **Conectar y subir lo de este equipo**. En pocos segundos el chip del encabezado dice
   **Nube al día**. Ya están arriba las ventas, la fila, el stock, la configuración, las versiones y
   los PIN.

Si otro equipo también tiene ventas propias que no están en el Mac, se conecta igual, con
**Conectar y subir lo de este equipo**. Sus ventas se juntan con las del Mac, sin reemplazarlas.

### 3.6 Sumar los demás equipos

En cada tablet, teléfono o pantalla de cocina:

1. Abrir la dirección de Cloud Run (conviene guardarla como ícono en la pantalla de inicio).
2. En la pantalla de ingreso aparece **"Este sistema tiene nube"**. Escribir la clave del local y
   el nombre del equipo, y tocar **Conectar este equipo**. Trae todo, incluidos los PIN.
3. Cada persona ingresa con **su PIN de siempre**. Quien no tenga PIN lo crea, y queda en la nube
   para todos los equipos.

### 3.7 Consultar las ventas

En la consola: **Cloud SQL → emporio-db → Cloud SQL Studio** (editor de consultas). Usuario
`emporio`, base `emporiopos`.

```sql
-- Ventas por día (sin anuladas)
SELECT * FROM ventas_por_dia ORDER BY dia DESC;

-- Lo más vendido del mes
SELECT nombre, sum(cantidad) AS unidades, sum(total) AS pesos
FROM venta_lineas JOIN ventas ON ventas.id = venta_id
WHERE dia >= date_trunc('month', current_date) AND anulada IS NULL
GROUP BY nombre ORDER BY pesos DESC LIMIT 20;

-- Por medio de pago y por garzón
SELECT pago, count(*), sum(total) FROM ventas WHERE anulada IS NULL GROUP BY pago;
SELECT responsable, count(*), sum(total), sum(propina) FROM ventas WHERE anulada IS NULL GROUP BY responsable;

-- Bitácora: intentos denegados de hoy
SELECT ts, quien, recurso, detalle, equipo FROM bitacora WHERE tipo = 'denegado' AND ts::date = current_date ORDER BY ts DESC;
```

Desde Cloud SQL Studio el resultado se descarga como CSV para una planilla. El informe
`ventas por día` también está en la API (`/api/ventas-por-dia`, solo dirección y jefatura).

## 4. Problemas comunes

| Se ve | Qué pasa | Qué hacer |
|---|---|---|
| "Nube · clave del local incorrecta" | la clave del equipo no coincide con `CLAVE_LOCAL` | Versiones → Nube → Desconectar y conectar con la clave correcta |
| "Nube · ingresa con tu PIN para subir" | el equipo no tiene sesión en la nube | salir e ingresar con el PIN, o tocar "Abrir mi sesión en la nube" en Versiones |
| "Nube · tu cargo no sube ese dato" | alguien cambió algo que su cargo no guarda (403) | queda solo en ese equipo; está en la bitácora |
| "Sin conexión con la nube" | sin internet o servidor detenido | se sigue trabajando; se sube al volver |
| `/api/salud` dice "Sin conexión con la base de datos" | Cloud Run no llega a Cloud SQL | revisar `--add-cloudsql-instances`, el rol `cloudsql.client` y la clave de la base |

## 5. Límites conocidos

- **La página publicada como artefacto en claude.ai no se conecta a la nube**: ese sitio no puede
  hablar con servidores externos. Para la nube se usa la dirección de Cloud Run, o el Mac con el
  sistema local conectado en Versiones.
- Si dos personas cambian **el mismo valor** en el mismo segundo (por ejemplo, el mismo precio), queda
  el último. Las ventas, los grupos de la fila, las rondas y los pedidos nunca se pisan.
- Los números de turno de la fila los asigna cada equipo. Si dos equipos anotan a alguien en el
  mismo instante, pueden repetir el número; los grupos quedan los dos.
- Los PIN creados en un equipo abierto por `http://` desde otra máquina de la red local (sin HTTPS)
  usan otra huella. Con la dirección de Cloud Run (HTTPS) o `localhost` no pasa.

## 6. Archivos

| Archivo | Qué hace |
|---|---|
| `servidor/servidor.js` | API, sesión, fusión, volcado de ventas, bitácora y páginas del sistema |
| `servidor/politica.js` | lee la política de cargos de `nucleo/nucleo.js` (la misma del navegador) |
| `servidor/esquema.sql` | tablas y vista de PostgreSQL (se aplican solas al arrancar) |
| `nucleo/nube.js` | sincronización en cada equipo |
| `nucleo/fusion.js` | fusión de tres vías |
| `Dockerfile`, `.gcloudignore` | imagen y archivos que se suben a Cloud Run |
| `servidor/prueba-api.mjs`, `servidor/prueba-nube.mjs` | pruebas de la API y de dos equipos |

Probar en un computador con PostgreSQL propio:

```bash
cd servidor && npm install
CLAVE_LOCAL=local-123 SECRETO_SESION=algo DB_HOST=localhost DB_USER=emporio DB_PASS=… DB_NAME=emporiopos PORT=8901 npm start
NUBE_URL=http://localhost:8901 CLAVE=local-123 npm run prueba        # API (base vacía)
NUBE_URL=http://localhost:8901 CLAVE=local-123 npm run prueba-nube   # dos equipos (base vacía)
```
