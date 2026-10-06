// Agente de verificación de EmporioAndinoPOS.
// Levanta un servidor estático sobre la carpeta del release, abre cada módulo
// en Chromium (escritorio y teléfono), recorre sus pantallas principales y
// falla si aparece un error de JavaScript, un recurso propio que no carga o
// desborde horizontal. Uso: node verificacion/verificar.mjs  (desde EmporioAndinoPOS/)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.execPath, "../../lib/node_modules/playwright"))); }

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".webp": "image/webp", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.writeHead(404); return res.end("no existe"); }
  res.writeHead(200, { "content-type": TIPOS[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => servidor.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${servidor.address().port}/`;

const resultados = [];
function anota(modulo, prueba, ok, detalle = "") {
  resultados.push({ modulo, prueba, ok, detalle });
  console.log(`${ok ? "OK  " : "FALLA"} [${modulo}] ${prueba}${detalle ? " · " + detalle : ""}`);
}

const navegador = await chromium.launch();

async function abrir(ruta, vista) {
  const ctx = await navegador.newContext(vista);
  const page = await ctx.newPage();
  const errores = [], caidos = [];
  page.on("pageerror", e => errores.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|cdnjs|ERR_NAME|ERR_TUNNEL|ERR_CONNECTION|net::/.test(m.text())) errores.push(m.text()); });
  page.on("response", r => { if (r.url().startsWith(BASE) && r.status() >= 400) caidos.push(`${r.status()} ${r.url().slice(BASE.length)}`); });
  await page.goto(BASE + ruta, { waitUntil: "load" });
  return { ctx, page, errores, caidos };
}

async function sinDesborde(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

const VISTAS = {
  escritorio: { viewport: { width: 1366, height: 860 } },
  telefono: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};

// ---------- Emporio System 1.1 ----------
async function probarSistema(nombreVista) {
  const M = `Sistema 1.1 · ${nombreVista}`;
  const { ctx, page, errores, caidos } = await abrir("sistema/index.html", VISTAS[nombreVista]);
  anota(M, "carga la pantalla de ingreso", await page.locator("#login").isVisible());
  const personas = await page.locator("#peopleList .person").count();
  anota(M, "lista de personas", personas > 0, `${personas} personas`);
  await page.locator("#peopleList .person").first().click();
  for (let vuelta = 0; vuelta < 2; vuelta++) for (const d of "1234") await page.locator(`#pad [data-k="${d}"]`).click();
  await page.waitForSelector("#app:not([hidden])", { timeout: 8000 }).catch(() => {});
  anota(M, "ingreso con PIN nuevo (crear y confirmar)", await page.locator("#app").isVisible());
  await page.waitForTimeout(1200);
  const enlaces = await page.locator("#nav a").evaluateAll(as => as.map(a => ({ href: a.getAttribute("href"), t: a.textContent.trim() })));
  anota(M, "menú de áreas", enlaces.length > 0, enlaces.map(e => e.t).join(", "));
  for (let i = 0; i < enlaces.length; i++) {
    const antes = errores.length;
    const a = page.locator("#nav a").nth(i);
    if (await a.isVisible()) await a.click(); else await a.evaluate(el => el.click());
    await page.waitForTimeout(500);
    const visible = await page.locator("section.view:not([hidden])").count();
    anota(M, `abre ${enlaces[i].t}`, visible === 1 && errores.length === antes, errores.slice(antes).join(" | "));
  }
  anota(M, "sin desborde horizontal", await sinDesborde(page));
  anota(M, "sin errores de JavaScript", errores.length === 0, errores.slice(0, 3).join(" | "));
  anota(M, "recursos propios cargan", caidos.length === 0, caidos.join(", "));
  await ctx.close();
}

// ---------- Carta Interactiva ----------
async function probarCarta(nombreVista) {
  const M = `Carta · ${nombreVista}`;
  const { ctx, page, errores, caidos } = await abrir("carta/index.html", VISTAS[nombreVista]);
  await page.waitForSelector("#splash.off", { state: "attached", timeout: 12000 }).catch(() => {});
  anota(M, "termina la bienvenida", await page.locator("#splash.off").count() === 1);
  const idiomas = page.locator(".langgrid button");
  const nIdiomas = await idiomas.count();
  anota(M, "selector de idioma", nIdiomas > 0, `${nIdiomas} idiomas directos`);
  if (nIdiomas) { await idiomas.first().click(); await page.waitForTimeout(600); }
  // recorre algunas capas: toca la primera opción visible tres veces y vuelve
  let pasos = 0;
  for (let i = 0; i < 4; i++) {
    const boton = page.locator(".layer .bigbtn:visible, .layer .opt:visible").first();
    if (!(await boton.count())) break;
    await boton.click().catch(() => {});
    await page.waitForTimeout(500);
    pasos++;
  }
  anota(M, "navega capas de la carta", pasos > 0, `${pasos} toques`);
  const imgs = await page.evaluate(() => [...document.images].filter(i => i.complete && i.src.startsWith(location.origin) && i.naturalWidth === 0).map(i => i.getAttribute("src")));
  anota(M, "imágenes visibles cargadas", imgs.length === 0, imgs.join(", "));
  anota(M, "sin desborde horizontal", await sinDesborde(page));
  anota(M, "sin errores de JavaScript", errores.length === 0, errores.slice(0, 3).join(" | "));
  anota(M, "recursos propios cargan", caidos.length === 0, caidos.join(", "));
  await ctx.close();
}

// ---------- Control de Salón ----------
async function probarSalon(nombreVista) {
  const M = `Salón · ${nombreVista}`;
  const { ctx, page, errores, caidos } = await abrir("carta/salon.html", VISTAS[nombreVista]);
  await page.waitForTimeout(1500);
  anota(M, "título", (await page.title()) === "Control de Salón");
  anota(M, "dibuja contenido", await page.evaluate(() => document.body.innerText.trim().length > 50));
  anota(M, "sin desborde horizontal", await sinDesborde(page));
  anota(M, "sin errores de JavaScript", errores.length === 0, errores.slice(0, 3).join(" | "));
  anota(M, "recursos propios cargan", caidos.length === 0, caidos.join(", "));
  await ctx.close();
}

// ---------- Lanzador ----------
async function probarLanzador(nombreVista) {
  const M = `Lanzador · ${nombreVista}`;
  const { ctx, page, errores, caidos } = await abrir("index.html", VISTAS[nombreVista]);
  anota(M, "tres módulos", await page.locator("[data-modulo]").count() === 3);
  await page.locator("#btnVerificar").click();
  await page.waitForSelector("#diagEstado[data-fin]", { timeout: 60000 }).catch(() => {});
  const fallas = await page.locator("#diagLista li.falla").count();
  const detalle = await page.locator("#diagLista li:not(.grupo)").evaluateAll(ls => ls.map(l => l.className + ": " + l.innerText.replace(/\s+/g, " ")).join(" | "));
  const total = await page.locator("#diagLista li:not(.grupo)").count();
  anota(M, "autodiagnóstico interno", total > 0 && fallas === 0, `${total - fallas}/${total} pruebas` + (fallas ? " · " + detalle : ""));
  await page.locator('[data-modulo="sistema"]').click();
  await page.waitForTimeout(800);
  anota(M, "abre el Sistema dentro del lanzador", await page.locator("#visor:not([hidden])").count() === 1);
  await page.locator("#visorVolver").click();
  anota(M, "vuelve al lanzador", await page.locator("#visor[hidden]").count() === 1);
  anota(M, "sin desborde horizontal", await sinDesborde(page));
  anota(M, "sin errores de JavaScript", errores.length === 0, errores.slice(0, 3).join(" | "));
  anota(M, "recursos propios cargan", caidos.length === 0, caidos.join(", "));
  await ctx.close();
}

for (const v of Object.keys(VISTAS)) {
  await probarSistema(v);
  await probarCarta(v);
  await probarSalon(v);
  if (fs.existsSync(path.join(RAIZ, "index.html"))) await probarLanzador(v);
}

await navegador.close();
servidor.close();
const fallas = resultados.filter(r => !r.ok);
const informe = { version: "1.0", fecha: new Date().toISOString(), total: resultados.length, fallas: fallas.length, resultados };
fs.writeFileSync(path.join(RAIZ, "verificacion", "informe.json"), JSON.stringify(informe, null, 2));
console.log(`\n${resultados.length - fallas.length}/${resultados.length} pruebas OK`);
process.exit(fallas.length ? 1 : 0);
