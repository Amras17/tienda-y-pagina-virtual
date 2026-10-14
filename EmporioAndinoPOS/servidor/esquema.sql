-- ====================================================================
-- EmporioAndinoPOS · esquema para Google Cloud SQL (PostgreSQL 14 o más)
-- --------------------------------------------------------------------
-- El servidor lo aplica solo al arrancar (todo es IF NOT EXISTS).
--   kv            un dato compartido por clave (ventas, fila, stock…), en
--                 JSONB, con versión global para sincronizar los equipos
--   kv_historia   versiones anteriores de cada clave (para fusionar sin
--                 perder cambios y para volver atrás)
--   ventas, venta_lineas
--                 las ventas de la Caja en tablas normales, para consultar
--                 con SQL, Looker Studio o una planilla
--   bitacora      la bitácora de seguridad de todos los equipos
--   equipos       qué equipos sincronizan y cuándo se vieron por última vez
-- ====================================================================
CREATE SEQUENCE IF NOT EXISTS kv_version_seq;

CREATE TABLE IF NOT EXISTS kv (
  clave        text PRIMARY KEY,
  valor        jsonb NOT NULL,
  version      bigint NOT NULL,
  actualizado  timestamptz NOT NULL DEFAULT now(),
  por          text,
  equipo       text
);
CREATE INDEX IF NOT EXISTS kv_version_idx ON kv (version);

CREATE TABLE IF NOT EXISTS kv_historia (
  clave        text NOT NULL,
  version      bigint NOT NULL,
  valor        jsonb NOT NULL,
  actualizado  timestamptz NOT NULL DEFAULT now(),
  por          text,
  equipo       text,
  PRIMARY KEY (clave, version)
);

CREATE TABLE IF NOT EXISTS ventas (
  id           text PRIMARY KEY,
  ts           timestamptz NOT NULL,
  dia          date NOT NULL,
  responsable  text,
  modo         text,
  pago         text,
  total        integer NOT NULL DEFAULT 0,
  neto         integer,
  iva          integer,
  propina      integer NOT NULL DEFAULT 0,
  anulada      timestamptz,
  mesa         integer,
  grupo        text,
  folio        text,
  datos        jsonb NOT NULL,
  actualizado  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ventas_dia_idx ON ventas (dia);

CREATE TABLE IF NOT EXISTS venta_lineas (
  venta_id     text NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  n            integer NOT NULL,
  producto_id  text,
  nombre       text,
  cantidad     integer NOT NULL,
  precio       integer,
  agregados    jsonb,
  total        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (venta_id, n)
);
CREATE INDEX IF NOT EXISTS venta_lineas_producto_idx ON venta_lineas (producto_id);

CREATE TABLE IF NOT EXISTS bitacora (
  id           bigserial PRIMARY KEY,
  equipo       text NOT NULL,
  ts           timestamptz NOT NULL,
  tipo         text,
  quien        text,
  rol          text,
  recurso      text,
  detalle      text,
  lugar        text,
  huella       text,
  origen       text NOT NULL DEFAULT 'equipo',
  UNIQUE (equipo, huella)
);
CREATE INDEX IF NOT EXISTS bitacora_ts_idx ON bitacora (ts);

CREATE TABLE IF NOT EXISTS equipos (
  id           text PRIMARY KEY,
  nombre       text,
  creado       timestamptz NOT NULL DEFAULT now(),
  visto        timestamptz NOT NULL DEFAULT now()
);

-- Vista lista para reportes: ventas por día (sin anuladas).
CREATE OR REPLACE VIEW ventas_por_dia AS
  SELECT dia, count(*) AS tickets, sum(total) AS ventas, sum(propina) AS propinas,
         round(avg(total)) AS ticket_promedio
  FROM ventas WHERE anulada IS NULL GROUP BY dia;
