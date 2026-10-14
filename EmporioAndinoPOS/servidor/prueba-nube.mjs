/* ====================================================================
   Prueba de la nube con dos equipos (dos navegadores separados)
   --------------------------------------------------------------------
   Requiere el servidor corriendo con una base vacía, por ejemplo:
     CLAVE_LOCAL=local-123 SECRETO_SESION=x DB_HOST=localhost DB_USER=… \
       DB_PASS=… DB_NAME=… PORT=8901 node servidor.js
   y luego:  NUBE_URL=http://localhost:8901 CLAVE=local-123 node prueba-nube.mjs
   Equipo A: Caja 1 con la dueña (sube lo suyo). Equipo B: tablet de una
   garzona (trae de la nube). Comprueba PIN y sesión en la nube, pedidos de
   la fila de un equipo al otro, dos ventas a la vez sin perder ninguna,
   cambios hechos dentro de un módulo, el 403 por cargo y sin conexión.
   ==================================================================== */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

const URL0 = (process.env.NUBE_URL || "http://localhost:8901").replace(/\/+$/, "") + "/";
const CLAVE = process.env.CLAVE || "local-123";
// ORIGEN_A=http://localhost:8000/ abre el equipo A en otra dirección (como el Mac con el sistema local) y sube a NUBE_URL.
const ORIGEN_A = process.env.ORIGEN_A ? process.env.ORIGEN_A.replace(/\/+$/, "") + "/" : URL0;
const res = [];
const anota = (p, ok, d = "") => { res.push(ok); console.log(`${ok ? "OK  " : "FALLA"} ${p}${d ? " · " + d : ""}`); };
const nav = await chromium.launch();

async function equipo(nombre, origen = URL0) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage(); const errores = [];
  page.on("pageerror", e => errores.push(e.message));
  page.on("dialog", d => d.accept());
  await page.goto(origen + "index.html");
  return { ctx, page, errores, nombre, origen };
}
async function entrar(page, persona) {
  await page.goto(page.url().replace(/[^/]*$/, "") .replace(/#.*$/, "") + "index.html");
  if (await page.locator("#app").isVisible()) { await page.locator("#logoutBtn").click(); await page.locator("#logoutBtn").click(); }
  await page.locator("#peopleList .person", { hasText: persona }).click();
  const nuevo = (await page.locator("#pinMsg").innerText()).includes("Primera vez");
  for (let v = 0; v < (nuevo ? 2 : 1); v++) for (const d of "1234") await page.locator(`#pad [data-k="${d}"]`).click();
  await page.waitForSelector("#app:not([hidden])", { timeout: 6000 });
}
async function conectar(page, nombre, modo) {
  await page.evaluate(() => EAPOS_SISTEMA.abrir("versiones"));
  await page.waitForTimeout(300);
  await page.fill("#nubeUrl", page.url().startsWith(URL0) ? "" : URL0); await page.fill("#nubeClave", CLAVE); await page.fill("#nubeNombre", nombre); await page.fill("#nubePin", "1234");
  await page.click("#nubeProbar"); await page.waitForFunction(() => /Conexión correcta|No se|clave/.test(document.querySelector("#nubeMsg").textContent), null, { timeout: 8000 });
  const msg = await page.locator("#nubeMsg").innerText();
  await page.click(modo === "traer" ? "#nubeTraer" : "#nubeSubir");
  await page.waitForFunction(() => /Listo/.test(document.querySelector("#nubeMsg").textContent), null, { timeout: 8000 });
  return msg;
}
const alDia = page => page.waitForFunction(() => { const s = EA_NUBE.estado(); return s.modo === "al día" && !s.pendientes; }, null, { timeout: 15000 }).then(() => true, () => false);
const leer = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "null"), k);
const api = async (ruta, sesion) => (await fetch(URL0.replace(/\/$/, "") + ruta, { headers: { "X-Clave-Local": CLAVE, ...(sesion ? { "X-Sesion": sesion } : {}) } })).json();

const A = await equipo("Caja 1", ORIGEN_A), B = await equipo("Tablet garzona");
try {
  // 1. Equipo A: la dueña entra, conecta y sube lo suyo
  await entrar(A.page, "Constanza Veliz");
  const prueba = await conectar(A.page, "Caja 1", "subir");
  anota("Probar conexión muestra PostgreSQL", /PostgreSQL/.test(prueba), prueba);
  anota("A queda al día con la nube", await alDia(A.page), JSON.stringify(await A.page.evaluate(() => EA_NUBE.estado())));
  anota("A tiene sesión en la nube", !!(await leer(A.page, "eapos_nube_tk"))?.tk);
  anota("Chip de red dice Nube al día", /Nube al día/.test(await A.page.locator("#netTxt").innerText()), await A.page.locator("#netTxt").innerText());

  // 2. Equipo B: se suma trayendo de la nube; una garzona entra con su PIN nuevo
  // Abierto desde el servidor, la pantalla de ingreso ofrece unir el equipo con la clave del local
  await B.page.goto(URL0 + "index.html");
  const ofrece = await B.page.waitForSelector("#nubeLogin:not([hidden])", { timeout: 6000 }).then(() => true, () => false);
  anota("La pantalla de ingreso ofrece unirse a la nube", ofrece);
  await B.page.fill("#nubeLoginClave", CLAVE); await B.page.fill("#nubeLoginNombre", "Tablet garzona");
  await B.page.click("#nubeLogin button[type=submit]");
  await B.page.waitForSelector("#nubeLogin[hidden]", { timeout: 8000 }).catch(() => {});
  anota("B trajo los PIN de la nube", !!(await leer(B.page, "es_pins"))?.["Constanza Veliz"]);
  await B.page.locator("#peopleList .person", { hasText: "Constanza Veliz" }).click();
  anota("La dueña entra en B con su PIN de siempre", !/Primera vez/.test(await B.page.locator("#pinMsg").innerText()));
  await entrar(B.page, "Constanza Veliz");
  await B.page.waitForTimeout(600);
  anota("…y abre su sesión en la nube", (await leer(B.page, "eapos_nube_tk"))?.n === "Constanza Veliz");
  await entrar(B.page, "Claudia Inostroza");
  await B.page.waitForTimeout(800);
  anota("Garzona con PIN nuevo abre sesión en la nube", (await leer(B.page, "eapos_nube_tk"))?.n === "Claudia Inostroza");

  // 3. Un pedido de la garzona (equipo B) aparece en la Caja 1 (equipo A)
  const gid = await B.page.evaluate(() => { const g = EAPOS.fila.anotar({ nombre: "Familia Nube", pax: 4, destino: "mesa" }, "Claudia Inostroza");
    EAPOS.fila.pedir(g.id, [{ id: "Ee-pino", n: 2 }], "ahora"); return g.id; });
  anota("B sube el pedido", await alDia(B.page));
  const llego = await A.page.waitForFunction(id => EAPOS.fila.grupos().some(g => g.id === id && g.nombre === "Familia Nube"), gid, { timeout: 12000 }).then(() => true, () => false);
  anota("El pedido de B llega a A", llego);
  await A.page.evaluate(() => EAPOS_SISTEMA.abrir("fila")); await A.page.waitForTimeout(1200);
  const fr = A.page.frame({ url: /fila\/index\.html/ });
  anota("La Fila de A lo muestra en pantalla", !!fr && /Familia Nube/.test(await fr.locator("body").innerText()));

  // 4. Dos ventas a la vez: A sin internet y B en línea; al volver A, no se pierde ninguna
  const venta = (id, total) => ({ id, ts: new Date().toISOString(), lineas: [{ id: "Ee-pino", n: "Empanada de pino", q: 1, p: total }], total, pago: "efectivo", modo: "local", resp: "prueba" });
  const vender = (page, v) => page.evaluate(v => { const p = JSON.parse(localStorage.getItem("ea_pos") || "{}"); p.ventas = (p.ventas || []).concat([v]); localStorage.setItem("ea_pos", JSON.stringify(p)); }, v);
  await A.ctx.setOffline(true);
  await vender(A.page, venta("VA-1", 4500));
  await A.page.waitForTimeout(1500);
  const offA = await A.page.evaluate(() => EA_NUBE.estado());
  anota("A sin internet deja la venta pendiente", offA.pendientes > 0 && offA.modo === "sin conexión", JSON.stringify(offA));
  await vender(B.page, venta("VB-1", 3900));
  anota("B (garzona, cobra en Caja) sube su venta", await alDia(B.page));
  await A.ctx.setOffline(false); await A.page.evaluate(() => dispatchEvent(new Event("online")));
  anota("A vuelve a quedar al día", await alDia(A.page));
  await A.page.waitForFunction(() => (JSON.parse(localStorage.getItem("ea_pos") || "{}").ventas || []).some(v => v.id === "VB-1"), null, { timeout: 12000 }).catch(() => {});
  const ventasA = ((await leer(A.page, "ea_pos"))?.ventas || []).map(v => v.id);
  await B.page.waitForFunction(() => (JSON.parse(localStorage.getItem("ea_pos") || "{}").ventas || []).some(v => v.id === "VA-1"), null, { timeout: 12000 }).catch(() => {});
  const ventasB = ((await leer(B.page, "ea_pos"))?.ventas || []).map(v => v.id);
  anota("A tiene las dos ventas", ventasA.includes("VA-1") && ventasA.includes("VB-1"), ventasA.join(","));
  anota("B tiene las dos ventas", ventasB.includes("VA-1") && ventasB.includes("VB-1"), ventasB.join(","));
  const tk = (await leer(A.page, "eapos_nube_tk"))?.tk;
  const sql = await api("/api/ventas-por-dia", tk);
  anota("Cloud SQL suma las dos ventas en la tabla ventas", Array.isArray(sql) && sql.some(d => +d.tickets >= 2 && +d.ventas >= 8400), JSON.stringify(sql).slice(0, 160));
  const tkB = (await leer(B.page, "eapos_nube_tk"))?.tk;
  const sqlB = await api("/api/ventas-por-dia", tkB);
  anota("La garzona no ve ventas en pesos (403)", !Array.isArray(sqlB) && /dirección/i.test(sqlB.error || ""), JSON.stringify(sqlB));

  // La garzona no puede cambiar la configuración: el servidor responde 403 y queda solo en su equipo
  await B.page.evaluate(() => { const c = JSON.parse(localStorage.getItem("eapos_cfg") || "{}"); c.nubeIntruso = 1; localStorage.setItem("eapos_cfg", JSON.stringify(c)); });
  await B.page.waitForFunction(() => EA_NUBE.estado().modo === "sin permiso", null, { timeout: 8000 }).then(() => anota("Configuración desde la garzona: 403 por cargo", true), () => anota("Configuración desde la garzona: 403 por cargo", false));
  anota("…y no llega a la Caja 1", !(await leer(A.page, "eapos_cfg") || {}).nubeIntruso);

  // 5. Cambio hecho dentro de un módulo (iframe) sube igual
  await A.page.evaluate(() => EAPOS_SISTEMA.abrir("caja")); await A.page.waitForTimeout(1200);
  const caja = A.page.frame({ url: /caja\/index\.html/ });
  await caja.evaluate(() => { const c = JSON.parse(localStorage.getItem("ea_control") || "{}"); c.nubePrueba = "desde la Caja"; localStorage.setItem("ea_control", JSON.stringify(c)); });
  anota("Cambio dentro de un módulo sube", await alDia(A.page));
  await B.page.waitForFunction(() => (JSON.parse(localStorage.getItem("ea_control") || "{}")).nubePrueba === "desde la Caja", null, { timeout: 12000 }).then(() => anota("…y llega al otro equipo", true), () => anota("…y llega al otro equipo", false));

  anota("Sin errores de JavaScript en A", !A.errores.length, A.errores.slice(0, 3).join(" | "));
  anota("Sin errores de JavaScript en B", !B.errores.length, B.errores.slice(0, 3).join(" | "));
} catch (e) { anota("La prueba terminó sin excepción", false, e.message.split("\n").slice(0,3).join(" ")); if (process.env.FOTO) { await A.page.screenshot({ path: process.env.FOTO + "-a.png" }); await B.page.screenshot({ path: process.env.FOTO + "-b.png" }); } }
await nav.close();
const ok = res.filter(Boolean).length;
console.log(`\n${ok}/${res.length} pruebas de la nube OK`);
process.exit(ok === res.length ? 0 : 1);
