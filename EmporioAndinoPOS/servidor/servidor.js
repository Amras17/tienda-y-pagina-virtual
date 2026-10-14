/* ====================================================================
   Servidor de EmporioAndinoPOS para Google Cloud (Cloud Run + Cloud SQL)
   --------------------------------------------------------------------
   · Sirve el sistema (los mismos archivos de EmporioAndinoPOS) y una API
     en la misma dirección, así los equipos no necesitan configurar nada
     más que la clave del local.
   · Guarda los datos compartidos en PostgreSQL (Cloud SQL), los sincroniza
     entre equipos con fusión de tres vías y vuelca las ventas a tablas
     normales para consultarlas con SQL.
   · Hace cumplir en el servidor la misma política de cargos del navegador:
     sin clave del local, 401; fuera del cargo, 403, y queda en la bitácora.

   Variables de entorno
     CLAVE_LOCAL          clave que se escribe una vez en cada equipo (obligatoria)
     SECRETO_SESION       secreto para firmar las sesiones (obligatorio en producción)
     INSTANCE_UNIX_SOCKET /cloudsql/PROYECTO:REGION:INSTANCIA  (Cloud Run)
       o DB_HOST + DB_PORT (TCP: Cloud SQL Auth Proxy, IP pública o local)
     DB_USER, DB_PASS, DB_NAME
     DB_SSL=1             TLS para conexiones TCP directas
     PORT                 lo pone Cloud Run (8080 por defecto)
   ==================================================================== */
"use strict";
const path = require("path"), fs = require("fs"), crypto = require("crypto");
const express = require("express");
const { Pool, types } = require("pg");
types.setTypeParser(1082, v => v);   // las fechas (date) como texto AAAA-MM-DD
const P = require("./politica.js");
const { fusionar, igual } = require("../nucleo/fusion.js");

const RAIZ = process.env.EAPOS_RAIZ || path.join(__dirname, "..");
const CLAVE_LOCAL = process.env.CLAVE_LOCAL || "";
const SECRETO = process.env.SECRETO_SESION || crypto.randomBytes(32).toString("hex");
const VERSION = P.E.version;
if (!CLAVE_LOCAL) console.warn("[aviso] Falta CLAVE_LOCAL: la API queda cerrada hasta definirla.");
if (!process.env.SECRETO_SESION) console.warn("[aviso] Sin SECRETO_SESION: las sesiones se pierden al reiniciar.");

/* ---------- base de datos ---------- */
const conf = { user: process.env.DB_USER || "emporio", password: process.env.DB_PASS || "", database: process.env.DB_NAME || "emporiopos", max: +process.env.DB_POOL || 5 };
if (process.env.INSTANCE_UNIX_SOCKET) conf.host = process.env.INSTANCE_UNIX_SOCKET;          // Cloud Run → Cloud SQL
else { conf.host = process.env.DB_HOST || "127.0.0.1"; conf.port = +process.env.DB_PORT || 5432; if (process.env.DB_SSL === "1") conf.ssl = { rejectUnauthorized: false }; }
const pool = new Pool(conf);
async function aplicarEsquema() { await pool.query(fs.readFileSync(path.join(__dirname, "esquema.sql"), "utf8")); }

/* ---------- sesiones firmadas (HMAC) ---------- */
const b64 = s => Buffer.from(s).toString("base64url");
function firmar(o) { const c = b64(JSON.stringify(o)); return c + "." + crypto.createHmac("sha256", SECRETO).update(c).digest("base64url"); }
function leerFirma(t) { if (!t || t.indexOf(".") < 0) return null; const [c, f] = t.split(".");
  const ok = crypto.createHmac("sha256", SECRETO).update(c).digest("base64url");
  if (f.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(f), Buffer.from(ok))) return null;
  try { const o = JSON.parse(Buffer.from(c, "base64url").toString()); return o.exp > Date.now() ? o : null; } catch (e) { return null; } }
const igualSeguro = (a, b) => { a = String(a || ""); b = String(b || ""); return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); };

/* ---------- bitácora del servidor ---------- */
async function registrar(req, tipo, recurso, detalle) {
  try { await pool.query("INSERT INTO bitacora (equipo, ts, tipo, quien, rol, recurso, detalle, lugar, huella, origen) VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, 'servidor')",
    [req.equipo || "?", tipo, req.persona ? req.persona.n : "", req.persona ? req.persona.r : "", recurso, detalle || "", req.path, crypto.randomBytes(8).toString("hex")]); } catch (e) {}
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "8mb" }));
/* CORS: permite que un equipo abierto en otra dirección (por ejemplo, el Mac
   con el sistema en localhost) suba sus datos la primera vez. No hay cookies:
   lo que protege es la clave del local y la sesión con PIN en cabeceras. */
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Clave-Local, X-Sesion, X-Equipo, X-Equipo-Nombre");
  res.setHeader("Access-Control-Max-Age", "3600");
  res.setHeader("Access-Control-Expose-Headers", "X-Emporio-Nube");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

/* ---------- salud (sin clave: para que Cloud Run y el equipo prueben) ---------- */
app.get("/api/salud", async (req, res) => {
  try { const r = await pool.query("SELECT version() AS v, now() AS ahora, (SELECT count(*) FROM kv) AS claves, (SELECT count(*) FROM ventas) AS ventas");
    res.json({ ok: true, sistema: VERSION, base: r.rows[0].v.split(" on ")[0], hora: r.rows[0].ahora, claves: +r.rows[0].claves, ventas: +r.rows[0].ventas, clave: !!CLAVE_LOCAL }); }
  catch (e) { res.status(503).json({ ok: false, error: "Sin conexión con la base de datos: " + e.message }); }
});

/* ---------- middleware: clave del local y sesión ---------- */
app.use("/api", async (req, res, next) => {
  req.equipo = String(req.get("X-Equipo-Nombre") || req.get("X-Equipo") || "?").slice(0, 60);
  if (!igualSeguro(req.get("X-Clave-Local"), CLAVE_LOCAL)) { await registrar(req, "denegado", req.path, "401 · clave del local incorrecta"); return res.status(401).json({ error: "Clave del local incorrecta" }); }
  req.persona = null; const s = leerFirma(req.get("X-Sesion"));
  if (s && P.persona(s.n)) req.persona = { n: s.n, r: P.persona(s.n).r };
  if (req.get("X-Equipo")) pool.query("INSERT INTO equipos (id, nombre) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET visto = now(), nombre = EXCLUDED.nombre", [String(req.get("X-Equipo") || "?").slice(0, 60), req.equipo]).catch(() => {});
  next();
});

/* ---------- sesión: nombre + huella del PIN (la misma que guarda el equipo) ---------- */
const INTENTOS = {};
app.post("/api/sesion", async (req, res) => {
  const nombre = String(req.body.nombre || ""), huella = String(req.body.huella || "");
  const p = P.persona(nombre); if (!p) return res.status(404).json({ error: "No está en el equipo" });
  const x = INTENTOS[nombre] || { n: 0, hasta: 0 };
  if (x.hasta > Date.now()) return res.status(429).json({ error: "Bloqueado un minuto por PIN incorrecto" });
  const r = await pool.query("SELECT valor FROM kv WHERE clave = 'es_pins'"), pins = r.rows[0] ? r.rows[0].valor : {};
  const guardada = pins[nombre] || (P.ALIAS[nombre] && pins[P.ALIAS[nombre]]);
  if (!guardada || !igualSeguro(guardada, huella)) {
    if (guardada) { x.n++; if (x.n >= 5) { x.hasta = Date.now() + 60e3; x.n = 0; } INTENTOS[nombre] = x; }
    req.persona = { n: nombre, r: p.r }; if (guardada) await registrar(req, "pin_fallido", "sesión", "huella distinta");
    return res.status(403).json({ error: guardada ? "PIN incorrecto" : "Esta persona aún no tiene PIN en la nube" });
  }
  delete INTENTOS[nombre];
  req.persona = { n: nombre, r: p.r }; await registrar(req, "ingreso", "sesión", "");
  res.json({ sesion: firmar({ n: nombre, exp: Date.now() + 14 * 3600e3 }), nombre, rol: p.r });
});

/* ---------- leer: lo que cambió desde la última versión que vio el equipo ---------- */
app.get("/api/cambios", async (req, res) => {
  const desde = Math.max(0, parseInt(req.query.desde, 10) || 0);
  const r = await pool.query("SELECT clave, valor, version FROM kv WHERE version > $1 AND clave = ANY($2) ORDER BY version", [desde, Object.keys(P.CLAVES)]);
  const u = await pool.query("SELECT COALESCE(max(version), 0) AS v FROM kv");
  res.json({ ultimo: +u.rows[0].v, cambios: r.rows.map(x => ({ clave: x.clave, valor: x.valor, version: +x.version })) });
});

/* ---------- escribir: fusión de tres vías contra la versión que el equipo conocía ---------- */
app.put("/api/kv/:clave", async (req, res) => {
  const clave = req.params.clave, def = P.CLAVES[clave];
  if (!def) return res.status(404).json({ error: "Esa clave no se comparte" });
  const nuestro = req.body.valor, base = parseInt(req.body.base, 10) || 0;
  if (nuestro === undefined) return res.status(400).json({ error: "Falta el valor" });
  const cli = await pool.connect();
  try {
    await cli.query("BEGIN");
    const act = await cli.query("SELECT valor, version FROM kv WHERE clave = $1 FOR UPDATE", [clave]);
    const suyo = act.rows[0] ? act.rows[0].valor : undefined, vSuyo = act.rows[0] ? +act.rows[0].version : 0;
    let vBase;
    if (base && base === vSuyo) vBase = suyo;
    else if (base) { const h = await cli.query("SELECT valor FROM kv_historia WHERE clave = $1 AND version = $2", [clave, base]); vBase = h.rows[0] ? h.rows[0].valor : undefined; }
    /* Permisos: PIN nuevos se aceptan sin sesión (cada persona crea el suyo);
       cambiar uno existente es de dirección o jefatura. Lo demás, por cargo. */
    let valorNuestro = nuestro;
    if (def.pins) {
      const antes = suyo || {}, dir = !!(req.persona && P.sistema(req.persona.n)), cambia = Object.keys(nuestro || {}).filter(n => antes[n] && antes[n] !== nuestro[n]);
      /* Borrar (restablecer) un PIN también es de dirección o jefatura: sin ese
         cargo, lo que falta se conserva como estaba en la nube. */
      if (!dir) { valorNuestro = Object.assign({}, nuestro); Object.keys(antes).forEach(n => { if (!(n in valorNuestro)) valorNuestro[n] = antes[n]; }); }
      if (cambia.length && !dir) { await cli.query("ROLLBACK"); await registrar(req, "denegado", clave, "403 · cambiar PIN ajeno: " + cambia.join(", ")); return res.status(403).json({ error: "Cambiar un PIN existente es de dirección o jefatura" }); }
    } else if (!req.persona) { await cli.query("ROLLBACK"); await registrar(req, "denegado", clave, "401 · sin sesión"); return res.status(401).json({ error: "Ingresa con tu PIN para guardar en la nube" }); }
    else if (!P.puedeEscribir(req.persona.n, clave)) { await cli.query("ROLLBACK"); await registrar(req, "denegado", clave, "403 · fuera del cargo"); return res.status(403).json({ error: "Tu cargo no guarda " + def.d.toLowerCase() }); }
    const fusion = suyo === undefined ? valorNuestro : fusionar(vBase, valorNuestro, suyo);
    if (suyo !== undefined && igual(fusion, suyo)) { await cli.query("COMMIT"); return res.json({ valor: suyo, version: vSuyo, igual: true }); }
    const v = +(await cli.query("SELECT nextval('kv_version_seq') AS v")).rows[0].v, quien = req.persona ? req.persona.n : "";
    await cli.query("INSERT INTO kv (clave, valor, version, actualizado, por, equipo) VALUES ($1, $2, $3, now(), $4, $5) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, version = EXCLUDED.version, actualizado = now(), por = EXCLUDED.por, equipo = EXCLUDED.equipo",
      [clave, JSON.stringify(fusion), v, quien, req.equipo]);
    await cli.query("INSERT INTO kv_historia (clave, version, valor, por, equipo) VALUES ($1, $2, $3, $4, $5)", [clave, v, JSON.stringify(fusion), quien, req.equipo]);
    await cli.query("DELETE FROM kv_historia WHERE clave = $1 AND version < (SELECT min(version) FROM (SELECT version FROM kv_historia WHERE clave = $1 ORDER BY version DESC LIMIT 300) t)", [clave]);
    if (clave === "ea_pos") await volcarVentas(cli, suyo, fusion);
    await cli.query("COMMIT");
    res.json({ valor: fusion, version: v, fusionado: !igual(fusion, nuestro) });
  } catch (e) { await cli.query("ROLLBACK").catch(() => {}); console.error(e); res.status(500).json({ error: e.message }); }
  finally { cli.release(); }
});

/* Las ventas de ea_pos también quedan en tablas normales (solo las que cambiaron).
   El día es el de Chile (America/Santiago, con su horario de verano). */
const DIA_LOCAL = new Intl.DateTimeFormat("en-CA", { timeZone: process.env.ZONA || "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });
async function volcarVentas(cli, antes, ahora) {
  const viejas = {}; ((antes && antes.ventas) || []).forEach(v => { viejas[v.id] = JSON.stringify(v); });
  for (const v of (ahora && ahora.ventas) || []) {
    if (!v || !v.id || viejas[v.id] === JSON.stringify(v)) continue;
    const ts = new Date(v.ts), dia = DIA_LOCAL.format(ts);
    await cli.query(`INSERT INTO ventas (id, ts, dia, responsable, modo, pago, total, neto, iva, propina, anulada, mesa, grupo, folio, datos, actualizado)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
      ON CONFLICT (id) DO UPDATE SET responsable=EXCLUDED.responsable, modo=EXCLUDED.modo, pago=EXCLUDED.pago, total=EXCLUDED.total, neto=EXCLUDED.neto, iva=EXCLUDED.iva,
        propina=EXCLUDED.propina, anulada=EXCLUDED.anulada, mesa=EXCLUDED.mesa, grupo=EXCLUDED.grupo, folio=EXCLUDED.folio, datos=EXCLUDED.datos, actualizado=now()`,
      [v.id, ts, dia, v.resp || null, v.modo || null, v.pago || null, Math.round(v.total || 0), v.neto != null ? Math.round(v.neto) : null, v.iva != null ? Math.round(v.iva) : null,
        Math.round(v.propina || 0), v.anulada ? new Date(v.anulada.ts || v.ts) : null, v.fila && v.fila.mesa ? +v.fila.mesa : null, v.fila ? v.fila.grupo : null, v.doc ? String(v.doc.folio || "") : null, JSON.stringify(v)]);
    await cli.query("DELETE FROM venta_lineas WHERE venta_id = $1", [v.id]);
    let n = 0;
    for (const l of v.lineas || []) { n++; const ag = (l.mod || []).reduce((a, m) => a + (m.p || 0), 0);
      await cli.query("INSERT INTO venta_lineas (venta_id, n, producto_id, nombre, cantidad, precio, agregados, total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [v.id, n, l.id || null, l.n || null, Math.round(l.q || 0), l.p != null ? Math.round(l.p) : null, JSON.stringify(l.mod || []), Math.round(((l.p || 0) + ag) * (l.q || 0))]); }
  }
}

/* ---------- bitácora de los equipos (solo se agrega) ---------- */
app.post("/api/bitacora", async (req, res) => {
  const ls = Array.isArray(req.body.entradas) ? req.body.entradas.slice(0, 500) : []; let n = 0;
  for (const e of ls) { try { const r = await pool.query("INSERT INTO bitacora (equipo, ts, tipo, quien, rol, recurso, detalle, lugar, huella) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (equipo, huella) DO NOTHING",
    [req.equipo, new Date(e.ts || Date.now()), e.tipo || "", e.quien || "", e.rol || "", e.recurso || "", e.detalle || "", e.lugar || "", e.h || crypto.randomBytes(8).toString("hex")]); n += r.rowCount; } catch (x) {} }
  res.json({ recibidas: n });
});

/* ---------- reportes desde SQL (dirección y jefatura) ---------- */
app.get("/api/ventas-por-dia", async (req, res) => {
  if (!req.persona || !P.permite(req.persona.n, "reportes.pesos")) { await registrar(req, "denegado", "ventas-por-dia", "403"); return res.status(403).json({ error: "Solo dirección y jefatura" }); }
  const r = await pool.query("SELECT dia, tickets, ventas, propinas, ticket_promedio FROM ventas_por_dia ORDER BY dia DESC LIMIT 400");
  res.json(r.rows);
});

/* ---------- el sistema, en la misma dirección ---------- */
app.use((req, res, next) => { if (/^\/(servidor|verificacion|node_modules|\.git)(\/|$)/.test(req.path) || /\.(md|command|sql)$/.test(req.path)) return res.status(404).end(); next(); });
app.use(express.static(RAIZ, { index: "index.html", dotfiles: "deny", setHeaders: (r, f) => { r.setHeader("X-Emporio-Nube", "1"); if (/\.(html|js|css)$/.test(f)) r.setHeader("Cache-Control", "no-cache"); } }));

const PORT = +process.env.PORT || 8080;
if (require.main === module) {
  aplicarEsquema().then(() => app.listen(PORT, () => console.log("EmporioAndinoPOS " + VERSION + " · servidor en el puerto " + PORT)))
    .catch(e => { console.error("No se pudo preparar la base de datos:", e.message); process.exit(1); });
}
module.exports = { app, pool, aplicarEsquema };
