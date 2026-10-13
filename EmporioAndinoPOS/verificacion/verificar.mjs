// Agente de verificación de EmporioAndinoPOS 3.2.
// Levanta un servidor estático sobre la carpeta del paquete, abre cada módulo
// en Chromium (escritorio y teléfono), recorre sus pantallas principales y
// prueba los flujos que cruzan módulos:
//   ingreso con PIN → venta en la Caja → comanda en Comandas,
//   borrador en la Prueba → aplicar → precio nuevo en la Caja,
//   contexto de la Prueba por día, semana y mes; pedidos a mano en mesa,
//   para llevar y en la fila; fichas y escandallos estándar, horno en vivo
//   e ingresos de mercadería (solo en la Prueba),
//   cargo de garzón → la Caja muestra solo cobro y stock.
// Falla si aparece un error de JavaScript, un recurso propio que no carga o
// desborde horizontal. Uso, desde EmporioAndinoPOS/:
//   NODE_PATH=$(npm root -g) node verificacion/verificar.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".webp": "image/webp", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml" };
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
const VISTAS = {
  escritorio: { viewport: { width: 1366, height: 860 } },
  telefono: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};
async function contexto(vista) {
  const ctx = await navegador.newContext(VISTAS[vista]);
  const errores = [], caidos = [];
  ctx.on("page", p => vigilar(p, errores, caidos));
  return { ctx, errores, caidos };
}
function vigilar(page, errores, caidos) {
  page.on("pageerror", e => errores.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|cdnjs|ERR_NAME|ERR_TUNNEL|ERR_CONNECTION|net::/.test(m.text())) errores.push(m.text()); });
  page.on("response", r => { if (r.url().startsWith(BASE) && r.status() >= 400) caidos.push(`${r.status()} ${r.url().slice(BASE.length)}`); });
}
const sinDesborde = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function cierre(M, page, errores, caidos) {
  anota(M, "sin desborde horizontal", await sinDesborde(page));
  anota(M, "sin errores de JavaScript", errores.length === 0, errores.slice(0, 3).join(" | "));
  anota(M, "recursos propios cargan", caidos.length === 0, [...new Set(caidos)].join(", "));
}
async function sesion(page, nombre) {
  // Abre sesión en el sistema general como `nombre`, creando el PIN 1234 si hace falta
  await page.goto(BASE + "index.html");
  if (await page.locator("#app").isVisible()) { await page.locator("#logoutBtn").click(); await page.locator("#logoutBtn").click(); }
  await page.locator("#peopleList .person", { hasText: nombre }).click();
  const nuevo = (await page.locator("#pinMsg").innerText()).includes("Primera vez");
  for (let v = 0; v < (nuevo ? 2 : 1); v++) for (const d of "1234") await page.locator(`#pad [data-k="${d}"]`).click();
  await page.waitForSelector("#app:not([hidden])", { timeout: 6000 }).catch(() => {});
}
// Cada capa carga la base de diseño de Emporio System 1.1
const disenoEmporio = page => page.evaluate(() => !!window.EA_UI && getComputedStyle(document.body).fontFamily.includes("Plus Jakarta Sans"));
async function navA(page, v) { const a = page.locator(`#nav a[data-v="${v}"]`); if (await a.isVisible()) await a.click(); else await a.evaluate(el => el.click()); await page.waitForTimeout(400); }

// ---------- Sistema general ----------
async function probarGeneral(vista) {
  const M = `Sistema general · ${vista}`;
  const { ctx, errores, caidos } = await contexto(vista);
  const page = await ctx.newPage();
  await page.goto(BASE + "index.html");
  anota(M, "pide ingreso antes de mostrar módulos", await page.locator("#login").isVisible() && await page.locator("#app").isHidden());
  anota(M, "equipo completo en el ingreso", await page.locator("#peopleList .person").count() === 28);
  anota(M, "diseño Emporio System 1.1", await disenoEmporio(page));
  await sesion(page, "Constanza Veliz");
  anota(M, "ingreso con PIN nuevo (crear y confirmar)", await page.locator("#app").isVisible());
  const nav = await page.locator("#nav a").evaluateAll(a => a.map(x => x.dataset.v));
  anota(M, "dirección ve todas las áreas", nav.join(",") === "inicio,pedidos,caja,fila,salon,cocina,barra,carta,horno,panaderia,reportes,prueba,verificacion,versiones,retro", nav.join(","));
  anota(M, "dashboard con áreas del local", await page.locator("#hub .acard").count() === 14);
  await navA(page, "verificacion");
  await page.locator("#btnVerificar").click();
  await page.waitForSelector("#diagEstado[data-fin]", { timeout: 90000 }).catch(() => {});
  const fallas = await page.locator("#diagLista li.falla").count(), total = await page.locator("#diagLista li:not(.grupo)").count();
  const detalle = await page.locator("#diagLista li.falla, #diagLista li.aviso").evaluateAll(ls => ls.map(l => l.innerText.replace(/\s+/g, " ")).join(" | "));
  anota(M, "autodiagnóstico interno", total > 0 && fallas === 0, `${total - fallas}/${total}` + (detalle ? " · " + detalle : ""));
  for (const m of ["pedidos", "caja", "reportes", "fila", "salon", "cocina", "barra", "horno", "panaderia", "carta", "prueba"]) {
    await navA(page, m); await page.waitForTimeout(900);
    const ok = await page.locator(`section[data-view="${m}"]`).isVisible();
    const fr = page.frameLocator(`section[data-view="${m}"] iframe`);
    const inc = await fr.locator("html").evaluate(h => h.classList.contains("incrustado") && !!window.EA_UI).catch(() => false);
    anota(M, `abre ${m} como subcapa con el diseño Emporio`, ok && inc);
    if (m === "caja") {
      // El menú de secciones de la Caja (riel o pestañas) debe quedar entero y a la vista dentro del sistema.
      const menu = await fr.locator("html").evaluate(() => {
        const n = [...document.querySelectorAll("#riel button, #pestanas button")].filter(b => b.offsetParent);
        const ok = n.length >= 2 && n.every(b => { const r = b.getBoundingClientRect(); return r.width >= 40 && r.height >= 40 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
        return { ok, n: n.length };
      }).catch(() => ({ ok: false, n: 0 }));
      anota(M, "menú de la Caja visible y usable dentro del sistema", menu.ok, menu.n + " secciones");
    }
  }
  for (const v of ["pedidos", "caja", "reportes", "fila", "salon", "cocina", "barra", "horno", "panaderia", "carta", "prueba", "verificacion", "versiones", "retro"]) {
    await navA(page, v); await page.waitForTimeout(150);
    const pn = await page.evaluate(v => { const e = document.querySelector(`[data-pn="${v}"]`); return e ? { tono: e.dataset.tono, tit: (e.querySelector(".pn-tit") || {}).textContent || "", k: e.querySelectorAll(".pn-k").length } : null; }, v);
    anota(M, `resumen arriba de ${v}`, !!pn && !!pn.tit && pn.k >= 3 && ["ok", "warn", "crit", "info"].includes(pn.tono), JSON.stringify(pn));
  }
  await page.evaluate(() => { localStorage.setItem("ea_control", JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), st: { latte: "off" }, uni: {} })); window.dispatchEvent(new StorageEvent("storage", { key: "ea_control" })); });
  await page.waitForTimeout(200);
  await page.locator("#avisosBtn").click(); await page.waitForTimeout(150);
  const av = await page.evaluate(() => ({ badge: (document.querySelector("#avisosBtn .badge-n") || {}).textContent, items: [...document.querySelectorAll(".avisos .av-item")].map(a => a.innerText.split("\n")[0]) }));
  anota(M, "avisos importantes: se acabó", av.items.some(t => /Se acabó: Latte/.test(t)) && +av.badge >= 1, JSON.stringify(av));
  await page.keyboard.press("Escape");
  // Barra colapsable: al bajar se pliega y al volver arriba se abre
  await navA(page, "inicio");
  if (vista === "escritorio") await page.mouse.move(900, 400);
  const col = await page.evaluate(async () => { const espera = ms => new Promise(r => setTimeout(r, ms)); window.scrollTo(0, 600); await espera(900);   /* la barra lateral se pliega con una transición de 0,35 s */
    const a = { on: document.documentElement.classList.contains("colapsado"), chip: document.getElementById("topPn").innerText, side: Math.round(document.querySelector(".side-in").getBoundingClientRect().width) };
    window.scrollTo(0, 0); await espera(600); a.vuelve = !document.documentElement.classList.contains("colapsado"); return a; });
  anota(M, "barra colapsable al bajar y se abre al volver arriba", col.on && col.vuelve && !!col.chip && (vista === "telefono" || col.side <= 80), JSON.stringify(col));
  await navA(page, "versiones");
  anota(M, "versiones y accesos", await page.locator("#acc tr").count() === 28);
  await navA(page, "inicio");
  await page.locator("#logoutBtn").click(); await page.locator("#logoutBtn").click();
  anota(M, "cierra sesión con doble toque", await page.locator("#login").isVisible());
  await cierre(M, page, errores, caidos);
  await ctx.close();
}

// ---------- Caja → Comandas, y cargos ----------
async function probarCajaYComandas(vista) {
  const M = `Caja y Comandas · ${vista}`;
  const { ctx, errores, caidos } = await contexto(vista);
  const page = await ctx.newPage();
  await sesion(page, "Andrea Saray Rodríguez");
  const caja = await ctx.newPage();
  await caja.goto(BASE + "caja/index.html"); await caja.waitForTimeout(600);
  anota(M, "la Caja toma al responsable de la sesión", (await caja.locator("#selResp").inputValue()) === "Andrea Saray Rodríguez");
  anota(M, "catálogo de la carta única", await caja.evaluate(() => CAT.length) === 141);
  const precios = await caja.evaluate(() => ({ pino: CAT.find(p => p.id === "Ee-pino").p, latte: CAT.find(p => p.id === "latte").p, catarpe: (CAT.find(p => p.id === "catarpe") || {}).p, cheese: (CAT.find(p => p.sub === "cheese") || {}).p, ccl: !!CAT.find(p => p.id === "cafeconleche") }));
  anota(M, "precios de la carta de junio 2026 (pino $4.000, latte $4.000, Catarpe $9.500, cheesecake $4.800)", precios.pino === 4000 && precios.latte === 4000 && precios.catarpe === 9500 && precios.cheese === 4800 && !precios.ccl, JSON.stringify(precios));
  await caja.evaluate(() => { [CAT.find(p => p.id === "Ee-pino"), CAT.find(p => p.id === "cappuccino"), CAT.find(p => p.id === "licancabur")].forEach(agregar); });
  await caja.evaluate(() => { pagoActivo = "debito"; pintarPagos(); pintarCuenta(); });
  await caja.locator("#btnRegistrar").click(); await caja.waitForTimeout(300);
  anota(M, "registra la venta", await caja.evaluate(() => JSON.parse(localStorage.getItem("ea_pos")).ventas.length) === 1);
  await caja.locator("#hojaX").click();
  for (const s of ["panel", "stock", "gest", "inf", "ajustes"]) await caja.evaluate(id => irA(id), s);
  const com = await ctx.newPage();
  // Comandas separadas: cocina, barra y, para empanadas y pastelería, el Horno
  await com.goto(BASE + "cocina/index.html?est=barra"); await com.waitForTimeout(500);
  const barra = { n: await com.locator("#tablero .comanda").count(), t: await com.locator("#titulo").innerText(), sel: await com.locator("#estaciones").isHidden() };
  anota(M, "Comandas de barra: solo la bebida", barra.n === 1 && barra.t === "Comandas de barra" && barra.sel, JSON.stringify(barra));
  await com.goto(BASE + "horno/index.html"); await com.waitForTimeout(600);
  anota(M, "la empanada llega a las comandas del Horno", await com.locator("#comandas .cmdt").count() === 1);
  await com.goto(BASE + "cocina/index.html?est=cocina"); await com.waitForTimeout(500);
  anota(M, "Comandas de cocina: solo el plato", await com.locator("#tablero .comanda").count() === 1 && (await com.locator("#titulo").innerText()) === "Comandas de cocina");
  await com.locator("#tablero [data-listo]").first().click();
  anota(M, "marcar lista la comanda", await com.locator("#tablero .comanda").count() === 0);
  await cierre(M + " (comandas)", com, [], []);
  const enc = await caja.evaluate(() => ({ secc: SECC.map(s => s.id).join(","), gest: SUBGEST.map(s => s.id).join(","), inf: SUBINF.map(s => s.id).join(",") }));
  anota(M, "encargado: cobro, cierre e historial; sin panel, stock, compras, costos ni metas", enc.secc === "caja,inf" && enc.inf === "rep,hist", JSON.stringify(enc));
  await page.reload(); await page.waitForTimeout(400);
  anota(M, "encargado: el dashboard no muestra ventas en pesos", await page.evaluate(() => document.getElementById("dash").classList.contains("nov")));
  await sesion(page, "Constanza Veliz");
  await caja.reload(); await caja.waitForTimeout(500);
  anota(M, "dueña: la Caja completa (sus estadísticas pasaron a Reportes)", await caja.evaluate(() => SECC.map(s => s.id).join(",") === "caja,panel,stock,gest,inf,ajustes" && SUBGEST.length === 4 && SUBINF.map(s => s.id).join(",") === "rep,hist,ent"));
  await sesion(page, "Wilbert Escalona");
  await caja.reload(); await caja.waitForTimeout(500);
  const secc = await caja.evaluate(() => SECC.map(s => s.id).join(","));
  anota(M, "garzón ve solo el cobro", secc === "caja", secc);
  await page.waitForTimeout(300);
  const mods = await page.locator("#nav a").evaluateAll(b => b.map(x => x.dataset.v));
  anota(M, "garzón no ve la Prueba ni el sistema", !mods.includes("prueba") && !mods.includes("verificacion"), mods.join(","));
  anota(M, "la Caja tiene el diseño Emporio", await disenoEmporio(caja));
  anota(M, "Comandas tiene el diseño Emporio", await disenoEmporio(com));
  await cierre(M, caja, errores, caidos);
  await ctx.close();
}

// ---------- Prueba → aplicar → sistema general ----------
async function probarPruebaAplicar(vista) {
  const M = `Prueba y aplicación · ${vista}`;
  const { ctx, errores, caidos } = await contexto(vista);
  const page = await ctx.newPage();
  await sesion(page, "Gustavo Veliz");
  const pr = await ctx.newPage();
  await pr.goto(BASE + "prueba/index.html#cambios"); await pr.waitForTimeout(1500);
  anota(M, "franja de prueba visible", await pr.locator(".franja").isVisible());
  anota(M, "diseño Emporio System 1.1", await disenoEmporio(pr));
  const nav = await pr.locator("#nav a").evaluateAll(a => a.map(x => x.dataset.v));
  anota(M, "jefe: catorce vistas, sin fichas ni costos", nav.length === 14 && !nav.includes("fichas") && await pr.evaluate(() => document.documentElement.classList.contains("sin-costos")), nav.join(","));
  for (const v of nav) { const a = pr.locator(`#nav a[data-v="${v}"]`); if (await a.isVisible()) await a.click(); else await a.evaluate(el => el.click()); await pr.waitForTimeout(250); }
  await pr.evaluate(() => go("cambios")); await pr.waitForTimeout(300);
  await pr.locator('#cbGrupos [data-cg="emp"]').click();
  const inp = pr.locator('#cbPrecios input[data-pp="Ee-pino"]'); await inp.fill("3700"); await inp.press("Tab");
  await pr.locator('#cbPrecios [data-fu="Ee-napolitana"]').click();
  anota(M, "el borrador lista los cambios", await pr.locator("#cbLista li").count() === 2);
  const antes = await pr.evaluate(() => EAPOS.general().v);
  await pr.locator("#cbComparar").click(); await pr.waitForTimeout(4000);
  anota(M, "compara general contra prueba", (await pr.locator("#cbVs .lado").count()) === 2);
  await pr.locator("#cbAplicar").click(); await pr.waitForTimeout(300);
  const g = await pr.evaluate(() => ({ v: EAPOS.general().v, pino: EAPOS.precioEn(EAPOS.general(), "Ee-pino"), fuera: EAPOS.general().fuera, borrador: EAPOS.hayBorrador() }));
  anota(M, "aplicar crea una versión nueva", g.v === antes + 1 && g.pino === 3700 && g.fuera.includes("Ee-napolitana") && !g.borrador, JSON.stringify(g));
  const caja = await ctx.newPage();
  await caja.goto(BASE + "caja/index.html"); await caja.waitForTimeout(500);
  const c = await caja.evaluate(() => ({ pino: (CAT.find(p => p.id === "Ee-pino") || {}).p, napo: !!CAT.find(p => p.id === "Ee-napolitana") }));
  anota(M, "la Caja usa la versión aplicada", c.pino === 3700 && !c.napo, JSON.stringify(c));
  const carta = await ctx.newPage();
  await carta.goto(BASE + "carta/index.html"); await carta.waitForTimeout(400);
  anota(M, "la Carta marca lo que salió de la carta", await carta.evaluate(() => gone("emp", "e-napolitana") && !gone("emp", "e-pino")));
  await page.reload(); await page.waitForTimeout(300);
  anota(M, "el sistema general muestra la versión vigente", (await page.locator("#cfgTxt").innerText()) === "Configuración v" + g.v);
  await cierre(M, pr, errores, caidos);
  await ctx.close();
}

// ---------- Prueba: contextos de día, semana y mes; pedidos a mano ----------
async function probarPruebaContexto(vista) {
  const M = `Prueba · contexto y pedidos · ${vista}`;
  const { ctx, errores, caidos } = await contexto(vista);
  await sesion(await ctx.newPage(), "Constanza Veliz");
  const pr = await ctx.newPage();
  await pr.goto(BASE + "prueba/index.html#contexto"); await pr.waitForTimeout(1500);
  await pr.evaluate(() => { const i = document.getElementById("cxFecha"); i.value = "2026-10-06"; i.dispatchEvent(new Event("change")); });
  await pr.waitForTimeout(900);
  await pr.locator('#cxHor [data-hor="semana"]').click(); await pr.waitForTimeout(700);
  anota(M, "semana: siete días simulados", (await pr.locator("#perOut .pbar").count()) === 7);
  await pr.locator('#cxHor [data-hor="mes"]').click(); await pr.waitForTimeout(900);
  const mes = await pr.evaluate(() => ({ barras: document.querySelectorAll("#perOut .pbar").length, stats: document.querySelectorAll("#perOut > .kv .stat").length }));
  anota(M, "mes: el mes calendario completo, con costo y food cost", mes.barras === 31 && mes.stats === 8, JSON.stringify(mes));
  const antes = await pr.evaluate(() => PER.dias.find(d => d.iso === "2026-10-16").rev);
  await pr.locator('#perOut .pbar[data-dia="2026-10-16"]').dispatchEvent("click"); await pr.waitForTimeout(150);
  await pr.locator('#perDia [data-ev="evento"]').click(); await pr.waitForTimeout(900);
  const ev = await pr.evaluate(() => ({ ev: CTX.dias["2026-10-16"], rev: PER.dias.find(d => d.iso === "2026-10-16").rev }));
  anota(M, "un evento en un día sube su demanda", ev.ev === "evento" && ev.rev > antes, JSON.stringify({ antes, ...ev }));
  await pr.locator('#perDia [data-per="abrir"]').click(); await pr.waitForTimeout(1500);
  const dia = await pr.evaluate(() => ({ h: CTX.h, fecha: CTX.fecha, cur, sub: document.getElementById("vSub").textContent }));
  anota(M, "abre ese día en vivo en el Dashboard", dia.h === "dia" && dia.fecha === "2026-10-16" && dia.cur === "inicio" && /16 de octubre/.test(dia.sub), JSON.stringify(dia));
  // Tomar pedido: mesa
  await pr.evaluate(() => go("pedido")); await pr.waitForTimeout(400);
  const mesa = await pr.locator("#pdDestino [data-mesa]").first().getAttribute("data-mesa");
  await pr.locator(`#pdDestino [data-mesa="${mesa}"]`).click();
  await pr.locator("#pdCarta [data-add]:not([disabled])").nth(0).click(); await pr.locator("#pdCarta [data-add]:not([disabled])").nth(2).click();
  await pr.locator("#pdEnviar").click(); await pr.waitForTimeout(200);
  anota(M, "pedido a mano en una mesa", await pr.evaluate(n => { const t = S.tables.find(x => x.n === +n); return t.state === "ocupada" && t.items.length === 2; }, mesa));
  // Para llevar con la vitrina vacía: paga y espera la tanda
  await pr.locator('#pdDest [data-dest="llevar"]').click();
  await pr.evaluate(() => { playing = false; setPlay(); Object.keys(S.vit).forEach(k => S.vit[k] = 0); S.horno = []; renderPedido(); });
  await pr.locator('#pdCats [data-pc="emp"]').click();
  await pr.locator("#pdCarta [data-add]:not([disabled])").first().click(); await pr.locator("#pdCarta [data-add]:not([disabled])").first().click();
  const kAntes = await pr.evaluate(() => S.kinds.llevar.n);
  await pr.locator("#pdEnviar").click(); await pr.waitForTimeout(200);
  const ll = await pr.evaluate(() => ({ esp: S.espEmp.filter(e => e.pagado).map(e => e.n), horno: S.horno.length > 0, n: S.kinds.llevar.n }));
  anota(M, "para llevar sin vitrina: cobra y espera la tanda", ll.esp.includes(2) && ll.horno && ll.n === kAntes + 1, JSON.stringify(ll));
  // Fila: un grupo espera mesa y compra mientras espera
  await pr.locator('#pdDest [data-dest="fila"]').click(); await pr.waitForTimeout(100);
  await pr.locator('#pdDestino [data-afila="mesa"]').click(); await pr.waitForTimeout(100);
  await pr.locator('#pdCats [data-pc="cc"]').click();
  await pr.locator("#pdCarta [data-add]:not([disabled])").first().click();
  await pr.locator("#pdEnviar").click(); await pr.waitForTimeout(200);
  const fila = await pr.evaluate(() => ({ n: S.kinds.fila.n, manual: S.manual.length, cola: S.queue.length }));
  anota(M, "venta en la fila a quien espera mesa", fila.n >= 1 && fila.manual === 3, JSON.stringify(fila));
  await pr.evaluate(() => go("clientes")); await pr.waitForTimeout(300);
  anota(M, "la fila aparece como canal en Clientes", /Fila \(mientras espera\)/.test(await pr.locator("#clCanales").innerText()));
  await cierre(M, pr, errores, caidos);
  await ctx.close();
}

// ---------- Prueba: fichas estándar, horno en vivo e ingresos ----------
async function probarPruebaFichas(vista) {
  const M = `Prueba · fichas, horno e ingresos · ${vista}`;
  const { ctx, errores, caidos } = await contexto(vista);
  await sesion(await ctx.newPage(), "Constanza Veliz");
  const pr = await ctx.newPage();
  await pr.goto(BASE + "prueba/index.html#fichas"); await pr.waitForTimeout(1500);
  const base = await pr.evaluate(() => ({ fichas: EAPOS.base.filter(x => fichaDe(x.id)).length, total: EAPOS.base.length, pino: costoDe("Ee-pino"), insumos: Object.keys(INS).length, filas: document.querySelectorAll("#fxBody tr").length }));
  anota(M, "todos los productos con ficha y escandallo estándar", base.fichas === base.total && base.filas === base.total && base.pino > 300 && base.pino < 1500, JSON.stringify(base));
  const stock = await pr.evaluate(() => { const g = S; DEMAND = SEASONS.alta * DOW_F[5]; seed = 7; S = newState(); while (S.t < CLOSE) step(); const sin = MENU.filter(it => it.c !== "emp" && !avail(it)).length, fc = S.costoVentas / (S.revenue / 1.19); S = g; return { sin, fc }; });
  anota(M, "el stock estándar alcanza un día de temporada alta", stock.sin === 0 && stock.fc > 0.15 && stock.fc < 0.4, JSON.stringify(stock));
  // Editar una cantidad cambia el costo y queda solo en la prueba
  await pr.locator('#fxBody tr[data-fx="Ee-pino"]').click();
  const antes = await pr.evaluate(() => costoDe("Ee-pino"));
  const q = pr.locator('#fxFicha [data-fq="4"]'); await q.fill("60"); await q.press("Tab"); await pr.waitForTimeout(200);
  const ed = await pr.evaluate(() => ({ costo: costoDe("Ee-pino"), menu: MENU.find(m => m.key === "Ee-pino").costo, guardado: !!(JSON.parse(localStorage.getItem("eapos_prueba_fichas")) || { fichas: {} }).fichas["Ee-pino"] }));
  anota(M, "editar el escandallo recalcula el costo", ed.costo > antes && ed.menu === ed.costo && ed.guardado, JSON.stringify({ antes, ...ed }));
  // Horno en vivo: hornada personalizada
  await pr.evaluate(() => go("horno")); await pr.waitForTimeout(300);
  await pr.evaluate(() => { playing = false; setPlay(); S.horno = []; renderHorno(); });
  await pr.locator('#hnSel [data-hs="Ee-pollo"]').click(); await pr.locator('#hnSel [data-hs="Ee-caprese"]').click();
  await pr.locator('#hnMins [data-hmin="10"]').click();
  const h0 = await pr.evaluate(() => ({ pollo: S.stock.pollo, vit: S.vit["Ee-pollo"] || 0 }));
  await pr.locator("#hnBtn").click(); await pr.waitForTimeout(150);
  const h1 = await pr.evaluate(() => { const h = S.horno.find(x => x.by !== "Automático"); return { total: h && h.total, fin: h && h.end - h.start, pollo: S.stock.pollo }; });
  anota(M, "hornada personalizada gasta los insumos de las fichas", h1.total === 30 && h1.fin === 10 && h1.pollo < h0.pollo, JSON.stringify({ h0, h1 }));
  const h2 = await pr.evaluate(() => { const fin = S.horno.find(x => x.by !== "Automático").end; while (S.t <= fin) step(); return { vit: S.vit["Ee-pollo"], horno: S.horno.filter(h => h.by !== "Automático").length }; });
  anota(M, "al salir del horno las unidades pasan a la vitrina", h2.vit >= h0.vit + 15 - 5 && h2.horno === 0, JSON.stringify(h2));
  // Ingreso de mercadería
  await pr.evaluate(() => go("inventario")); await pr.waitForTimeout(300);
  await pr.locator("#igIns").selectOption("palta"); await pr.locator("#igN").fill("2"); await pr.locator("#igP").fill("5000");
  const p0 = await pr.evaluate(() => S.stock.palta);
  await pr.locator("#igBtn").click(); await pr.waitForTimeout(150);
  const ig = await pr.evaluate(p => ({ sube: Math.round(S.stock.palta - p), compras: S.compras.length, total: S.compras[0] && S.compras[0].total }), p0);
  anota(M, "ingreso de mercadería personalizado", ig.sube === 2000 && ig.compras === 1 && ig.total === 10000, JSON.stringify(ig));
  anota(M, "nada de esto toca la Caja", await pr.evaluate(() => localStorage.getItem("ea_pos") === null));
  const tortas = await pr.evaluate(() => { const ing = id => fichaDe(id).ing.map(x => x[0]); return { pakari: ing("Pto-pakari").includes("amapola") && ing("Pto-pakari").includes("berries"), inti: ing("Pto-inti").includes("nueces") && ing("Pto-inti").includes("manjar"), nusta: ing("Pto-nusta").includes("berries"), killa: ing("Pto-killa").includes("cacao") && ing("Pto-killa").includes("vainilla"), amor: ing("Pto-amor").includes("manjar") && ing("Pto-amor").includes("crema") }; });
  anota(M, "tortas de la casa con sus capas", Object.values(tortas).every(Boolean), JSON.stringify(tortas));
  const vistas = ["contexto", "salon", "pedido", "cocina", "horno", "barra", "inventario", "caja", "clientes", "reportes", "carta", "fichas", "cambios", "datos"], sinPn = [];
  for (const v of vistas) { await pr.evaluate(v => go(v), v); await pr.waitForTimeout(120); const ok = await pr.evaluate(v => { const e = document.querySelector(`[data-pn="${v}"]`); return !!e && !!e.querySelector(".pn-tit") && e.querySelectorAll(".pn-k").length >= 3; }, v); if (!ok) sinPn.push(v); }
  anota(M, "resumen arriba de las catorce pestañas", sinPn.length === 0, sinPn.join(","));
  await pr.evaluate(() => { S.stock.palta = 0; renderAll(); });
  const avp = await pr.evaluate(() => avisosPrueba().map(a => a.tono + ":" + a.tit.replace(/<[^>]+>/g, "")));
  anota(M, "avisos de la Prueba: se acabó la palta", avp.some(t => /^crit:Se acabó: palta/.test(t)), avp.slice(0, 4).join(" | "));
  await cierre(M, pr, errores, caidos);
  await ctx.close();
}

// ---------- Carta Interactiva ----------
async function probarCarta(vista) {
  const M = `Carta · ${vista}`;
  const { ctx, errores, caidos } = await contexto(vista);
  const page = await ctx.newPage();
  await page.goto(BASE + "carta/index.html");
  await page.waitForSelector("#splash.off", { state: "attached", timeout: 12000 }).catch(() => {});
  anota(M, "termina la bienvenida", await page.locator("#splash.off").count() === 1);
  anota(M, "diseño Emporio System 1.1", await disenoEmporio(page));
  const n = await page.locator(".langgrid button").count();
  anota(M, "selector de idioma", n > 0, `${n} idiomas directos`);
  const indefinidos = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => { try { localStorage.removeItem("ea_viva_lang"); localStorage.removeItem("ea_viva_cfg"); } catch (e) {} });
    await page.goto(BASE + "carta/index.html"); await page.waitForSelector("#splash.off", { state: "attached", timeout: 12000 }).catch(() => {});
    await page.locator(".langgrid button").nth(i).click(); await page.waitForTimeout(350);
    for (let k = 0; k < 5; k++) { const b = page.locator(".layer .bigbtn:visible, .layer .opt:visible").first(); if (!(await b.count())) break; await b.click().catch(() => {}); await page.waitForTimeout(300); }
    const t = await page.evaluate(() => document.body.innerText);
    if (/undefined|\bnull\b|NaN/.test(t)) indefinidos.push(i);
  }
  anota(M, "sin textos indefinidos en ningún idioma directo", indefinidos.length === 0, indefinidos.join(","));
  anota(M, "sin servicios, galería ni redes", await page.evaluate(() => typeof capaServicios === "undefined" && typeof capaGaleria === "undefined" && typeof bloqueInsta === "undefined"));
  const imgs = await page.evaluate(() => [...document.images].filter(i => i.complete && i.src.startsWith(location.origin) && i.naturalWidth === 0).map(i => i.getAttribute("src")));
  anota(M, "imágenes visibles cargadas", imgs.length === 0, imgs.join(", "));
  await cierre(M, page, errores, caidos);
  await ctx.close();
}

// ---------- Seguridad: inicio por área, perímetros, 403, autorizaciones y bitácora ----------
async function probarSeguridad(vista) {
  const M = `Seguridad · ${vista}`;
  const { ctx, errores, caidos } = await contexto(vista);
  const page = await ctx.newPage();
  await page.goto(BASE + "index.html"); await page.waitForTimeout(400);
  const bento = await page.evaluate(() => ({ grupos: document.querySelectorAll(".bento .bt").length, personas: document.querySelectorAll(".bento .person").length }));
  anota(M, "selector en mosaico: 7 áreas y 28 personas", bento.grupos === 7 && bento.personas === 28, JSON.stringify(bento));
  await sesion(page, "Andrea Saray Rodríguez");          // deja creado su PIN para autorizar después
  // Barista: entra directo a Comandas de barra y no ve nada más
  await sesion(page, "Joanne Daline Rodas"); await page.waitForTimeout(500);
  const bar = await page.evaluate(() => ({ en: (document.querySelector("#nav a.on") || {}).dataset?.v, nav: [...document.querySelectorAll("#nav a")].map(a => a.dataset.v).join(",") }));
  anota(M, "barista entra directo a Comandas de barra y solo la ve a ella", bar.en === "barra" && bar.nav === "barra,retro", JSON.stringify(bar));
  await page.evaluate(() => { location.hash = "#caja"; window.dispatchEvent(new HashChangeEvent("hashchange")); document.querySelector('#nav a[data-v="barra"]').click(); });
  const ruta = await page.evaluate(() => { EAPOS_SISTEMA.abrir("caja"); const b = EAPOS.seguridad.bitacora(); return { vista: document.querySelector('.view[data-view="caja"]').hidden, ultimo: b[b.length - 1] }; });
  anota(M, "403 al pedir la Caja desde el sistema, y queda en la bitácora", ruta.vista && ruta.ultimo.tipo === "denegado" && /caja/.test(ruta.ultimo.recurso), JSON.stringify(ruta.ultimo));
  const dir = await ctx.newPage(); await dir.goto(BASE + "caja/index.html", { waitUntil: "commit" }); await dir.waitForTimeout(800);
  anota(M, "403 al abrir la Caja por su dirección (URL directa)", (await dir.evaluate(() => document.documentElement.getAttribute("data-403"))) === "caja" && /403/.test(await dir.title()));
  await dir.goto(BASE + "cocina/index.html?est=cocina", { waitUntil: "commit" }); await dir.waitForTimeout(800);
  anota(M, "403 a Comandas de cocina para barra", (await dir.evaluate(() => document.documentElement.getAttribute("data-403"))) === "cocina");
  // Garzón: Pedidos primero, cobra a su nombre y anular pide a un encargado
  await sesion(page, "Wilbert Escalona"); await page.waitForTimeout(500);
  const gzNav = await page.evaluate(() => ({ en: (document.querySelector("#nav a.on") || {}).dataset?.v, nav: [...document.querySelectorAll("#nav a")].map(a => a.dataset.v).join(",") }));
  anota(M, "garzón entra directo a Pedidos; no ve Reportes", gzNav.en === "pedidos" && !/reportes/.test(gzNav.nav), JSON.stringify(gzNav));
  await dir.goto(BASE + "caja/index.html"); await dir.waitForTimeout(700);
  const gz = await dir.evaluate(() => { agregar(CAT.find(p => p.id === "Ee-pino")); pagoActivo = "debito"; pintarPagos(); pintarCuenta(); document.getElementById("btnRegistrar").click();
    const v = POS.ventas[POS.ventas.length - 1]; return { resp: v.resp, fijo: document.getElementById("selResp").disabled, secc: SECC.map(s => s.id).join(","), propinas: document.getElementById("barFecha").textContent }; });
  anota(M, "garzón: la venta queda a su nombre y ve sus propinas", gz.resp === "Wilbert Escalona" && gz.fijo && gz.secc === "caja" && /tus propinas de hoy/.test(gz.propinas), JSON.stringify(gz));
  await dir.evaluate(() => { document.querySelectorAll(".hoja,#hoja").forEach(h => h.hidden = true); window.__ok = 0; EA_UI.conPermiso("venta.anular", "prueba", () => { window.__ok = 1; }); });
  await dir.waitForTimeout(200);
  anota(M, "anular pide la autorización de un encargado", await dir.locator(".ea-modal").count() === 1);
  await dir.locator('.ea-modal [data-q]', { hasText: "Andrea Saray Rodríguez" }).click(); await dir.locator(".ea-pin").fill("0000"); await dir.locator(".ea-si").click(); await dir.waitForTimeout(300);
  const malo = await dir.locator(".ea-err").innerText();
  await dir.locator(".ea-pin").fill("1234"); await dir.locator(".ea-si").click(); await dir.waitForTimeout(400);
  const aut = await dir.evaluate(() => ({ ok: window.__ok, modal: document.querySelectorAll(".ea-modal").length, tipos: EAPOS.seguridad.bitacora().slice(-3).map(b => b.tipo).join(",") }));
  anota(M, "PIN equivocado se rechaza; con el de Andrea queda autorizado y registrado", /incorrecto/.test(malo) && aut.ok === 1 && aut.modal === 0 && /autorizado/.test(aut.tipos), JSON.stringify(aut));
  await dir.goto(BASE + "carta/salon.html"); await dir.waitForTimeout(900);
  const sal = await dir.evaluate(() => { cfg.st["latte"] = "off"; save(); const c = JSON.parse(localStorage.getItem("ea_control") || "{}"); return { latte: (c.st || {}).latte || "ok", log: EAPOS.seguridad.bitacora().slice(-1)[0].recurso }; });
  anota(M, "garzón: el Salón es de consulta (el cambio se deshace y queda registrado)", sal.latte !== "off" && sal.log === "stock.disponibilidad", JSON.stringify(sal));
  // Cocina sin la encargada: no recibe ni solicita a la panadería
  await sesion(page, "Alexmay Ramirez"); await page.waitForTimeout(400);
  const cnav = await page.evaluate(() => [...document.querySelectorAll("#nav a")].map(a => a.dataset.v).join(","));
  await dir.goto(BASE + "horno/index.html"); await dir.waitForTimeout(700);
  const hc = await dir.evaluate(() => ({ solicitar: !document.getElementById("btnSolicitar").hidden, recibir: EAPOS.prod.recibir("x", null, "x"), tanda: EAPOS.permite("horno.operar") }));
  anota(M, "cocina: comandas y horno; recibir y solicitar quedan para la encargada", cnav === "cocina,horno,retro" && !hc.solicitar && hc.recibir === null && hc.tanda, cnav + " " + JSON.stringify(hc));
  // Pastelería: ve la panadería pero no envía al horno
  await sesion(page, "Yarella Aguilar"); await dir.goto(BASE + "panaderia/index.html"); await dir.waitForTimeout(700);
  const pa = await dir.evaluate(() => ({ boton: !!document.getElementById("enviar"), envia: EAPOS.prod.nuevoPedido("plan", { "e-pino": 1 }, "x") }));
  anota(M, "panadería: solo Eva Galarza y Claudia Garcías envían al horno", !pa.boton && pa.envia === null, JSON.stringify(pa));
  // PIN con el nombre anterior: sigue sirviendo y pasa al nombre oficial
  await page.evaluate(async () => { const h = await EAPOS.hashPin("Daniela", "4321"); const p = EAPOS.pins(); p["Daniela"] = h; localStorage.setItem("es_pins", JSON.stringify(p)); });
  await page.locator("#logoutBtn").click(); await page.locator("#logoutBtn").click();
  await page.locator("#peopleList .person", { hasText: "Daniela Flores" }).click();
  for (const d of "4321") await page.locator(`#pad [data-k="${d}"]`).click();
  await page.waitForSelector("#app:not([hidden])", { timeout: 6000 }).catch(() => {});
  const mig = await page.evaluate(() => ({ app: !document.getElementById("app").hidden, nuevo: !!EAPOS.pins()["Daniela Flores"], viejo: !!EAPOS.pins()["Daniela"] }));
  anota(M, "el PIN creado con el nombre anterior sigue sirviendo", mig.app && mig.nuevo && !mig.viejo, JSON.stringify(mig));
  // 5 PIN equivocados bloquean un minuto
  await page.locator("#logoutBtn").click(); await page.locator("#logoutBtn").click();
  await page.locator("#peopleList .person", { hasText: "Andrea Saray Rodríguez" }).click();
  for (let k = 0; k < 5; k++) { for (const d of "9999") await page.locator(`#pad [data-k="${d}"]`).click(); await page.waitForTimeout(350); }
  const blq = await page.evaluate(() => ({ msg: document.getElementById("pinMsg").textContent, log: EAPOS.seguridad.bitacora().some(b => b.tipo === "bloqueo") }));
  anota(M, "5 PIN equivocados bloquean a esa persona y queda registrado", /bloquead/i.test(blq.msg) && blq.log, JSON.stringify(blq));
  await page.locator("#pinBack").click();
  // Dirección ve la bitácora íntegra y el perímetro de cada cargo
  await sesion(page, "Constanza Veliz"); await navA(page, "versiones"); await page.waitForTimeout(400);
  const bit = await page.evaluate(() => ({ filas: document.querySelectorAll("#bitacora tr").length, sub: document.getElementById("bitSub").innerText, cargos: document.querySelectorAll("#perimetro tr").length, rota: EAPOS.seguridad.revisarBitacora() }));
  anota(M, "bitácora íntegra a la vista de dirección y perímetro de los 7 cargos", bit.filas > 8 && /íntegra/.test(bit.sub) && bit.cargos === 7 && bit.rota === -1, JSON.stringify(bit));
  await cierre(M, page, errores, caidos);
  await ctx.close();
}

// ---------- Fila de espera y mesas ----------
async function probarFila(vista) {
  const M = `Pedidos, fila y cuentas · ${vista}`;
  const { ctx, errores, caidos } = await contexto(vista);
  const page = await ctx.newPage();
  await sesion(page, "Andrea Saray Rodríguez");
  // La Carta ya no muestra código para la fila; la Fila no lo pide ni abre pantalla de llamado
  const carta = await ctx.newPage(); await carta.goto(BASE + "carta/index.html"); await carta.waitForTimeout(900);
  const sinCod = await carta.evaluate(() => { lang = "es"; pedido = [{ k: "emp", id: "e-pino", q: 2 }]; cfg.modo = "local"; cfg.personas = 2; cfg.hecho = 1; entrar("ticket", null, "Pedido");
    return { cod: !!document.getElementById("codigoFila"), lib: typeof window.EA_CODIGO }; });
  anota(M, "la Carta ya no genera código para la fila", !sinCod.cod && sinCod.lib === "undefined", JSON.stringify(sinCod));
  const fila = await ctx.newPage(); await fila.goto(BASE + "fila/index.html"); await fila.waitForTimeout(700);
  anota(M, "Fila sin código ni pantalla de llamado", !(await fila.locator("#nCodigo").count()) && !(await fila.locator("#abrirPantalla").count()) && !(await fila.locator("#tComandar").count()));
  anota(M, "la pantalla de llamado ya no existe", (await ctx.request.get(BASE + "fila/llamado.html")).status() === 404);
  await fila.locator("#nNombre").fill("Juan"); await fila.locator("#nAnotar").click(); await fila.waitForTimeout(250);
  await fila.locator('[data-dest="llevar"]').click(); await fila.locator("#nNombre").fill("Leo"); await fila.locator("#nAnotar").click(); await fila.waitForTimeout(250);
  // Pedidos: Leo para llevar, un cappuccino que sale al tiro
  const ped = await ctx.newPage(); await ped.goto(BASE + "pedidos/index.html"); await ped.waitForTimeout(700);
  await ped.locator('[data-tipo="llevar"]').click(); await ped.locator("#destinos [data-g]").first().click();
  await ped.locator('[data-cat="cafe"]').click(); await ped.locator('[data-add="cappuccino"]').click(); await ped.locator("#enviar").click(); await ped.waitForTimeout(250);
  const bar = await ctx.newPage(); await bar.goto(BASE + "cocina/index.html?est=barra"); await bar.waitForTimeout(600);
  anota(M, "la ronda para llevar llega a Comandas de barra", await bar.locator("#tablero .comanda").count() === 1 && /Para llevar · Nº 2 Leo/.test(await bar.locator("#tablero").innerText()));
  // Juan espera mesa: su primera ronda queda guardada y sale al sentarse
  await ped.locator('[data-tipo="fila"]').click(); await ped.locator('#destinos [data-g]').first().click();
  await ped.locator('[data-cat="emp"]').click(); await ped.locator('[data-add="Ee-pino"]').click(); await ped.locator('[data-add="Ee-pino"]').click();
  await ped.locator('[data-cat="cafe"]').click(); await ped.locator('[data-add="latte"]').click(); await ped.waitForTimeout(100);
  anota(M, "a quien espera mesa, la ronda sale al sentarse", /sale al sentarse/i.test(await ped.locator("#enviar").innerText()));
  await ped.locator("#enviar").click(); await ped.waitForTimeout(250);
  const g1 = await ped.evaluate(() => { const g = EAPOS.fila.grupos()[0]; return { n: g.nombre, rondas: g.pedido.rondas.length, enviado: !!g.pedido.enviado, total: EAPOS.fila.total(EAPOS.fila.porCobrar(g)) }; });
  anota(M, "ronda 1 de Juan guardada sin comandar: 2 pino y un latte", g1.n === "Juan" && g1.rondas === 1 && !g1.enviado && g1.total === 12000, JSON.stringify(g1));
  // Ana espera mesa; todas las mesas ocupadas menos una
  await fila.evaluate(() => { const F = EAPOS.fila; F.anotar({ nombre: "Ana", pax: 4, destino: "mesa" }); const n = F.estado().cfg.mesas; for (let i = 2; i <= n; i++) F.ocupar(i, 2); pintar(true); });
  await fila.locator('#espera [data-llamar]').first().click(); await fila.waitForTimeout(250);
  const lla = await fila.evaluate(() => EAPOS.fila.llamado());
  anota(M, "llama al siguiente (Juan) a la mesa libre", !!lla && lla.nombre === "Juan" && lla.mesa === 1, JSON.stringify(lla));
  await fila.locator('#tLlamado [data-sentar]').click(); await fila.waitForTimeout(250);
  await bar.reload(); await bar.waitForTimeout(500);
  const hor = await ctx.newPage(); await hor.goto(BASE + "horno/index.html"); await hor.waitForTimeout(600);
  anota(M, "al sentarse, su ronda sale a Comandas (barra y horno)", await bar.locator("#tablero .comanda").count() === 2 && await hor.locator("#comandas .cmdt").count() === 1);
  // Ronda 2 en la mesa 1: un desayuno con su bebida incluida y una nota
  await ped.reload(); await ped.waitForTimeout(600);
  await ped.locator('[data-mesa="1"]').click(); await ped.locator('[data-cat="desayunos"]').click();
  const hayDes = await ped.locator('[data-add="chileno"]:not([disabled])').count();
  if (hayDes) { await ped.locator('[data-add="chileno"]').click(); await ped.locator('[data-beb="0"]').first().click(); await ped.locator('[data-nota="0"]').fill("sin mantequilla"); }
  else { await ped.locator('[data-cat="coc"]').click(); await ped.locator("#prods .prod:not([disabled])").first().click(); }
  await ped.waitForTimeout(150); await ped.locator("#enviar").click(); await ped.waitForTimeout(300);
  const g2 = await ped.evaluate(() => { const g = EAPOS.fila.grupos()[0]; return { rondas: g.pedido.rondas.length, enviadas: g.pedido.rondas.filter(r => r.enviado).length, coms: EAPOS.fila.comandables().filter(c => c.id.indexOf("F" + g.id) === 0).length }; });
  anota(M, "la mesa sigue pidiendo: ronda 2 sale como otra comanda", g2.rondas === 2 && g2.enviadas === 2 && g2.coms === 2, JSON.stringify(g2));
  const coc = await ctx.newPage(); await coc.goto(BASE + "cocina/index.html?est=cocina"); await coc.waitForTimeout(600);
  const cocTxt = await coc.locator("#tablero").innerText();
  anota(M, "la ronda 2 llega a cocina con la nota", await coc.locator("#tablero .comanda").count() === 1 && (!hayDes || /sin mantequilla/.test(cocTxt)), cocTxt.replace(/\s+/g, " ").slice(0, 120));
  // Quitar algo ya enviado: una encargada puede; queda registrado
  const q = await ped.evaluate(() => { const g = EAPOS.fila.grupos()[0], antes = EAPOS.fila.total(EAPOS.fila.porCobrar(g)); const r = EAPOS.fila.quitar(g.id, 1, 0); return { ok: !!r, antes, despues: EAPOS.fila.total(EAPOS.fila.porCobrar(EAPOS.fila.grupos()[0])) }; });
  anota(M, "quitar 1 pino ya enviado (encargada) baja la cuenta", q.ok && q.antes - q.despues === 4000, JSON.stringify(q));
  // La Caja muestra la cuenta por cobrar y la cobra sin volver a comandar
  const caja = await ctx.newPage(); await caja.goto(BASE + "caja/index.html"); await caja.waitForTimeout(800);
  const pc = await caja.locator("#porCobrar").innerText();
  anota(M, "la Caja lista las cuentas por cobrar (mesa 1 y Leo)", /Mesa 1/.test(pc) && /Llevar Nº 2/.test(pc), pc.replace(/\s+/g, " "));
  await caja.locator('#porCobrar [data-cobrar]').first().click(); await caja.waitForTimeout(400);
  const cj = await caja.evaluate(() => ({ n: carro.length, total: totalCarro(), ref: filaRef && filaRef.nombre, mesa: filaRef && filaRef.mesa }));
  anota(M, "toca la cuenta de la mesa y la Caja la carga entera", cj.ref === "Juan" && cj.mesa === 1 && cj.n >= 2 && cj.total === q.despues, JSON.stringify(cj));
  const nCom = await caja.evaluate(() => EAPOS.fila.comandables().length);
  await caja.evaluate(() => { pagoActivo = "debito"; pintarPagos(); pintarCuenta(); }); await caja.locator("#btnRegistrar").click(); await caja.waitForTimeout(300);
  const v = await caja.evaluate(() => { const v = POS.ventas[POS.ventas.length - 1], g = EAPOS.fila.grupos()[0]; return { fila: v.fila, cobrado: !!g.cobrado, porCobrar: EAPOS.fila.porCobrar(g).length, comandas: EAPOS.fila.comandables().length }; });
  anota(M, "venta registrada a la mesa 1, cuenta cerrada y sin duplicar comandas", !!v.fila && v.fila.mesa === 1 && v.cobrado && v.porCobrar === 0 && v.comandas === nCom, JSON.stringify(v));
  // Reportes: la venta aparece separada por área, producto y canal
  const rep = await ctx.newPage(); await rep.goto(BASE + "reportes/index.html"); await rep.waitForTimeout(700);
  const r = await rep.evaluate(() => ({ kpis: [...document.querySelectorAll("#kpis .kp")].map(k => k.innerText.replace(/\s+/g, " ")), top: document.getElementById("top").innerText, canal: document.getElementById("canales").innerText, pesos: PESOS }));
  anota(M, "Reportes: 1 ticket, latte entre los más vendidos y la mesa como canal; sin pesos para encargados", r.kpis.some(k => /Tickets 1/i.test(k)) && /Latte/.test(r.top) && /Mesa/.test(r.canal) && !r.pesos, JSON.stringify(r).slice(0, 220));
  // Se levantan de la mesa 1: el sistema propone llamar a Ana
  await fila.reload(); await fila.waitForTimeout(500);
  await fila.evaluate(() => { MESA = 1; pintarMesas(); }); await fila.locator('[data-liberar="1"]').click(); await fila.waitForTimeout(250);
  const sig = await fila.evaluate(() => ({ sig: (EAPOS.fila.siguiente() || {}).nombre, boton: !!document.querySelector('#mesaAcc [data-llamar]'), libre: EAPOS.fila.mesasLibres().map(m => m.n) }));
  anota(M, "al liberar la mesa propone llamar al siguiente", sig.sig === "Ana" && sig.boton && sig.libre.includes(1), JSON.stringify(sig));
  // Recientes: los avisos de las acciones quedan en la campana y llevan a donde ocurrieron
  await navA(page, "fila"); await page.waitForTimeout(900);
  await page.locator("#avisosBtn").click(); await page.waitForTimeout(200);
  const av = await page.evaluate(() => ({ urg: [...document.querySelectorAll(".avisos .av-item:not(.av-rec)")].map(a => a.innerText.split("\n")[0]), rec: [...document.querySelectorAll(".avisos .av-rec")].map(a => a.dataset.avGo + "|" + a.innerText.split("\n")[0]) }));
  anota(M, "aviso: mesa libre, llama a Nº 3 Ana", av.urg.some(t => /Mesa 1 libre: llama a Nº 3 Ana/.test(t)), JSON.stringify(av.urg));
  anota(M, "Recientes: las acciones quedan en la campana con su destino", av.rec.some(t => /^pedidos\|Ronda/.test(t)) && av.rec.some(t => /^caja/.test(t)), JSON.stringify(av.rec.slice(0, 4)));
  await page.locator('.avisos .av-rec[data-av-go="pedidos"]').first().click(); await page.waitForTimeout(700);
  anota(M, "tocar un reciente lleva a esa área", (await page.evaluate(() => (document.querySelector("#nav a.on") || {}).dataset?.v)) === "pedidos");
  // El aviso flotante también lleva a la acción
  await page.evaluate(() => { EA_UI.aviso("Prueba de destino", { ir: "reportes" }); }); await page.locator("#ea-toast").click(); await page.waitForTimeout(700);
  anota(M, "tocar el aviso flotante lleva a su destino", (await page.evaluate(() => (document.querySelector("#nav a.on") || {}).dataset?.v)) === "reportes");
  // Números completos: una cifra larga se achica, no se corta
  const enc = await page.evaluate(async () => { const k = document.querySelector('.view[data-view="reportes"] .pn-k b'); if (!k) return { ok: false };
    k.textContent = "$123.456.789.000"; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); EA_UI.encajar(k);
    return { ok: k.scrollWidth <= k.clientWidth + 1, fs: k.style.fontSize, elipsis: getComputedStyle(k).textOverflow }; });
  anota(M, "una cifra larga se ve completa (se achica, sin «…»)", enc.ok && enc.elipsis !== "ellipsis", JSON.stringify(enc));
  await cierre(M + " (fila)", fila, [], []);
  await cierre(M + " (pedidos)", ped, [], []);
  await cierre(M, page, errores, caidos);
  await ctx.close();
}

// ---------- Producción: Panadería → Horno → Vitrina ----------
async function probarProduccion(vista) {
  const M = `Producción · ${vista}`;
  const { ctx, errores, caidos } = await contexto(vista);
  const page = await ctx.newPage();
  await sesion(page, "Eva Galarza");
  const navP = await page.locator("#nav a").evaluateAll(a => a.map(x => x.dataset.v).join(","));
  anota(M, "panadería entra solo a lo suyo", navP === "panaderia,retro", navP);
  // Ayer el Horno reportó 32 de pino precocidas: el punto de partida de hoy
  await page.evaluate(() => { const P = EAPOS.prod, p = EAPOS.leer("eapos_panaderia") || {}; p.dias = p.dias || {};
    p.dias[P.diaAntes(EAPOS.hoyLocal())] = { pedidos: [], precocido: { ts: new Date().toISOString(), por: "Magda", items: { "e-pino": 32 } } }; EAPOS.guardar("eapos_panaderia", p); });
  const pan = await ctx.newPage(); await pan.goto(BASE + "panaderia/index.html"); await pan.waitForTimeout(700);
  const plan = await pan.evaluate(() => ({ cards: document.querySelectorAll("#plan .vcard").length, total: Object.values(ENV).reduce((a, b) => a + b, 0), pino: ENV["e-pino"], prec: document.getElementById("prec").innerText }));
  anota(M, "plan de 6 latas de pino y 2 de cada otra, menos el precocido de ayer", plan.cards === 9 && plan.pino === 4 && plan.total === 20 && /32/.test(plan.prec), JSON.stringify(plan));
  const esc = await pan.evaluate(() => ({ filas: document.querySelectorAll("#esc tbody tr").length, costos: [...document.querySelectorAll("#esc .solo-dueno")].some(e => e.offsetParent), ins: document.querySelectorAll("#ins tr").length }));
  anota(M, "escandallo por unidad y por lata, sin costos para panadería", esc.filas >= 8 && !esc.costos && esc.ins > 10, JSON.stringify(esc));
  await pan.locator("#enviar").click(); await pan.waitForTimeout(200);
  anota(M, "envía el pedido al horno", await pan.evaluate(() => EAPOS.prod.porRecibir().length === 1 && EAPOS.prod.porRecibir()[0].items["e-pino"] === 4));

  await sesion(page, "María Torrez");
  const navM = await page.locator("#nav a").evaluateAll(a => a.map(x => x.dataset.v).join(","));
  anota(M, "cocina ve el Horno y no la Panadería", navM.includes("horno") && !navM.includes("panaderia"), navM);
  const hor = await ctx.newPage(); await hor.goto(BASE + "horno/index.html"); await hor.waitForTimeout(700);
  anota(M, "el horno recibe el pedido por confirmar", await hor.locator("[data-recibir]").count() === 1);
  await hor.locator('[data-rec$="|e-pino"][data-d="-1"]').click();
  await hor.locator("[data-recibir]").click(); await hor.waitForTimeout(200);
  const rec = await hor.evaluate(() => ({ crudo: EAPOS.prod.totalPorHornear(), pino: EAPOS.prod.porHornear()["e-pino"], t: document.getElementById("cargaT").textContent, sel: Object.keys(SEL).length }));
  anota(M, "registra lo que llegó (59 de pino) y propone la primera tanda", rec.crudo === 331 && rec.pino === 91 && rec.t === "Comenzar producción" && rec.sel > 0, JSON.stringify(rec));
  await hor.locator("#alHorno").click(); await hor.waitForTimeout(200);
  const t1 = await hor.evaluate(() => { const t = EAPOS.prod.tandas()[0]; return { min: Math.round((new Date(t.eta) - new Date(t.desde)) / 60000), total: t.total, cap: EAPOS.prod.hornear({ "e-pollo": 30 }, 20, "x").error }; });
  anota(M, "primera tanda: 20 minutos y tope de 4 latas", t1.min === 20 && t1.total === 45 && t1.cap === "capacidad", JSON.stringify(t1));
  // El sistema general muestra el reloj primero
  const sis = await ctx.newPage(); await sis.goto(BASE + "index.html"); await sis.waitForTimeout(900);
  await navA(sis, "horno"); await sis.waitForTimeout(1200);
  const pn = await sis.evaluate(() => { const e = document.querySelector('[data-pn="horno"]'), r = e.querySelector(".pn-reloj"); return { reloj: r && r.textContent, grande: r && parseFloat(getComputedStyle(r).fontSize), revisar: !!e.querySelector('[data-go="horno:vitrina"]') }; });
  anota(M, "resumen del Horno: el temporizador en grande y Revisar vitrina", /^(19|20):\d\d$/.test(pn.reloj || "") && pn.grande >= 48 && pn.revisar, JSON.stringify(pn));
  await sis.locator('[data-go="horno:vitrina"]').click(); await sis.waitForTimeout(900);
  const vis = await sis.frameLocator('section[data-view="horno"] iframe').locator("#vitrina").evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight; });
  anota(M, "Revisar baja a la vitrina dentro del Horno", vis);
  await hor.locator("[data-ya]").first().click(); await hor.waitForTimeout(300);
  const vit = await hor.evaluate(() => { const c = JSON.parse(localStorage.getItem("ea_control")); return { pino: c.uni["Ee-pino"], fecha: c.fecha === EAPOS.hoyLocal(), horno: c.horno.length }; });
  anota(M, "al salir, la tanda pasa a la vitrina que ve la Caja (fecha local)", vit.pino === 15 && vit.fecha && vit.horno === 0, JSON.stringify(vit));
  // Sobredemanda: solicitud por confirmar → la panadería confirma → el horno recibe
  await hor.locator("#btnSolicitar").click();
  await hor.locator('[data-sol="e-pino"][data-d="1"]').click(); await hor.locator('[data-sol="e-pino"][data-d="1"]').click();
  await hor.locator("#solNota").fill("Grupo de turistas");
  await hor.locator("#solEnviar").click(); await hor.waitForTimeout(200);
  anota(M, "solicitud de empanadas queda por confirmar", await hor.evaluate(() => EAPOS.prod.porConfirmar().length === 1 && EAPOS.prod.porConfirmar()[0].nota === "Grupo de turistas"));
  await sesion(page, "Eva Galarza");
  await pan.reload(); await pan.waitForTimeout(600);
  await pan.locator("[data-conf]").click(); await pan.waitForTimeout(200);
  await sesion(page, "María Torrez");
  await hor.waitForTimeout(400);
  anota(M, "la panadería confirma y el horno la ve por recibir", await hor.locator("[data-recibir]").count() === 1);
  // Esperan la tanda
  await hor.locator("#btnEspera").click(); await hor.locator("#espNombre").fill("Juan");
  await hor.locator('[data-esp="e-pino"][data-d="1"]').click(); await hor.locator('[data-esp="e-pino"][data-d="1"]').click();
  await hor.locator("#espGuardar").click(); await hor.waitForTimeout(200);
  anota(M, "anota a quien espera y avisa que ya hay en vitrina", await hor.locator("#espera .estd.ok").count() === 1);
  // Precocido para mañana
  await hor.locator("#reportar").click(); await hor.waitForTimeout(200);
  const pr = await hor.evaluate(() => EAPOS.prod.precocido());
  anota(M, "reporta el precocido para mañana", !!pr && pr.items["e-pino"] === 76 && pr.por === "María Torrez", JSON.stringify(pr && pr.items));
  // Salón dentro del sistema: sin horno propio, sin botón a la Carta, sin la barrita
  await sesion(sis, "Andrea Saray Rodríguez"); await navA(sis, "salon"); await sis.waitForTimeout(1200);
  const sal = await sis.frameLocator('section[data-view="salon"] iframe').locator("html").evaluate(() => ({ carta: !document.getElementById("volverCarta").hidden, barra: !!document.getElementById("alertBar").offsetParent, horno: typeof capaHorno }));
  anota(M, "Salón: sin acceso a la Carta ni barrita, el horno vive en su área", !sal.carta && !sal.barra && sal.horno === "undefined", JSON.stringify(sal));
  await cierre(M + " (horno)", hor, [], []);
  await cierre(M + " (panadería)", pan, [], []);
  await cierre(M, sis, errores, caidos);
  await ctx.close();
}

// ---------- Horario: desayunos 12:00, mesas y cocina 21:30, cierre 22:00 ----------
async function conHora(vista, hora) {
  const c = await contexto(vista);
  await c.ctx.addInitScript(h => { try { sessionStorage.setItem("eapos_hora", h); } catch (e) {} }, hora);
  return c;
}
async function probarHorario(vista) {
  const M = `Horario · ${vista}`;
  let { ctx, errores, caidos } = await conHora(vista, "21:27");
  let page = await ctx.newPage();
  await sesion(page, "Constanza Veliz"); await page.waitForTimeout(600);
  const fases = await page.evaluate(() => { const f = m => EAPOS.horario(m).map(h => h.fase).join(","); return {
    a705: f(705), a716: f(716), a720: f(720), a1275: f(1275), a1286: f(1286), a1310: f(1310), a1316: f(1316), a1320: f(1320),
    desayuno: [EAPOS.porHorario({ g: "coc", sub: "desayunos" }, 719), EAPOS.porHorario({ g: "coc", sub: "desayunos" }, 720)],
    cocina: [EAPOS.porHorario({ g: "coc", sub: "brunch" }, 1289), EAPOS.porHorario({ g: "coc", sub: "brunch" }, 1290)],
    barra: [EAPOS.porHorario({ g: "bar", sub: "cafe" }, 1300), EAPOS.porHorario({ g: "bar", sub: "cafe" }, 1320)] }; });
  anota(M, "fases a los 15 y 5 minutos de cada hito", fases.a705 === "aviso,antes,antes" && fases.a716 === "ultimo,antes,antes" && fases.a720 === "terminado,antes,antes"
    && fases.a1275 === "terminado,aviso,antes" && fases.a1286 === "terminado,ultimo,antes" && fases.a1310 === "terminado,terminado,antes" && fases.a1316 === "terminado,terminado,ultimo" && fases.a1320 === "terminado,terminado,terminado", JSON.stringify(fases));
  anota(M, "bloqueos: desayuno 12:00, cocina 21:30, local 22:00", !fases.desayuno[0] && !!fases.desayuno[1] && !fases.cocina[0] && !!fases.cocina[1] && !fases.barra[0] && !!fases.barra[1], JSON.stringify(fases));
  const chip = await page.evaluate(() => { const c = document.getElementById("horaChip"); return { t: c.innerText, tono: c.dataset.tono, ve: !c.hidden && c.getBoundingClientRect().width > 0 }; });
  anota(M, "chip del encabezado cuenta los minutos (21:27)", chip.ve && /mesas y la cocina en 3 min/.test(chip.t) && chip.tono === "crit", JSON.stringify(chip));
  await page.locator("#avisosBtn").click(); await page.waitForTimeout(200);
  const av = await page.evaluate(() => [...document.querySelectorAll(".avisos .av-item")].map(a => a.innerText.split("\n")[0]));
  anota(M, "aviso en la campana antes del cierre de mesas", av.some(t => /Cierran las mesas y la cocina a las 21:30/.test(t)), JSON.stringify(av));
  await page.keyboard.press("Escape");
  await navA(page, "caja"); await page.waitForTimeout(1500);
  // El módulo cabe entero bajo el encabezado, sin capas encima
  const marco = await page.evaluate(() => { const f = document.querySelector('section[data-view="caja"] iframe'); scrollTo(0, 1e5); const r = f.getBoundingClientRect(), top = [...document.querySelectorAll(".top,.side")].filter(e => getComputedStyle(e).position === "sticky" && e.getBoundingClientRect().width > innerWidth * .6).reduce((a, e) => Math.max(a, e.getBoundingClientRect().bottom), 0);
    const a = { arriba: Math.round(r.top), abajo: Math.round(r.bottom), vh: innerHeight, cabecera: Math.round(top) }; scrollTo(0, 0); return a; });
  anota(M, "la Caja cabe bajo el encabezado sin quedar tapada", marco.abajo <= marco.vh + 1 && marco.arriba >= marco.cabecera - 1, JSON.stringify(marco));
  let fr = page.frames().find(f => f.url().includes("caja/index"));
  const c1 = await fr.evaluate(() => { const d = CAT.filter(p => p.sub === "desayunos")[0], b = CAT.filter(p => p.g === "coc" && p.sub !== "desayunos")[0]; const n0 = carro.length; agregar(d); const n1 = carro.length; agregar(b); const n2 = carro.length; carro = []; pintarCuenta();
    return { franja: !document.querySelector("#horaAviso").hidden && document.querySelector("#horaAviso").innerText, desayuno: n1 > n0, cocina: n2 > n1, local: !document.querySelector("#modoVenta [data-modo=local]").disabled }; });
  anota(M, "Caja 21:27: franja de aviso, sin desayunos, cocina y mesas aún abiertas", !!c1.franja && /21:30/.test(c1.franja) && !c1.desayuno && c1.cocina && c1.local, JSON.stringify(c1));
  await cierre(M, page, errores, caidos);
  await ctx.close();

  ({ ctx, errores, caidos } = await conHora(vista, "21:40"));
  page = await ctx.newPage(); await sesion(page, "Constanza Veliz"); await page.goto(BASE + "caja/index.html"); await page.waitForTimeout(1200);
  const c2 = await page.evaluate(() => { const b = CAT.filter(p => p.g === "coc")[0], e = CAT.filter(p => p.g === "emp")[0]; agregar(b); const coc = carro.length; agregar(e); const emp = carro.length; carro = []; pintarCuenta();
    return { cocina: coc > 0, emp: emp > coc, modo: modoActivo, local: document.querySelector("#modoVenta [data-modo=local]").disabled, marcados: document.querySelectorAll(".prod.fuerahora").length + (grupoActivo !== "coc" ? 1 : 0) }; });
  anota(M, "Caja 21:40: mesas cerradas, pasa a Para llevar y no vende cocina", !c2.cocina && c2.emp && c2.modo === "llevar" && c2.local, JSON.stringify(c2));
  await page.goto(BASE + "carta/index.html"); await page.waitForTimeout(900);
  const ct = await page.evaluate(() => ({ des: enHorario(secDe("desayunos")), brunch: enHorario(secDe("brunch")) }));
  anota(M, "Carta 21:40: desayuno y brunch fuera de horario", !ct.des && !ct.brunch, JSON.stringify(ct));
  await ctx.close();

  // La Prueba usa el mismo horario con la hora simulada
  ({ ctx, errores, caidos } = await contexto(vista));
  page = await ctx.newPage(); await sesion(page, "Constanza Veliz"); await page.goto(BASE + "prueba/index.html"); await page.waitForTimeout(1400);
  const pr = await page.evaluate(() => { while (S.t < 1278) step(); renderAll(); const sub = document.querySelector("#vSub").textContent, av = avisosPrueba().some(a => /^hora\|mesas/.test(a.k));
    const coc = () => Object.keys(S.sold).reduce((a, id) => a + (MENU[id] && CATS[MENU[id].c].a === "cocina" ? S.sold[id] : 0), 0);
    while (S.t < 1291) step(); const c0 = coc(), oc = S.tables.filter(x => x.state === "ocupada").length; while (S.t < 1318) step();
    return { sub, av, ocupadas: oc, cocinaDespues: coc() - c0, fila: S.queue.length }; });
  anota(M, "Prueba: aviso a los 12 min y a las 21:30 cierra mesas y cocina", /mesas y la cocina en 12 min/.test(pr.sub) && pr.av && pr.ocupadas === 0 && pr.cocinaDespues === 0, JSON.stringify(pr));
  await ctx.close();
}

// ---------- Control de Salón ----------
async function probarSalon(vista) {
  const M = `Salón · ${vista}`;
  const { ctx, errores, caidos } = await contexto(vista);
  const page = await ctx.newPage();
  await sesion(page, "Andrea Saray Rodríguez");
  await page.goto(BASE + "carta/salon.html"); await page.waitForTimeout(1200);
  anota(M, "título", (await page.title()) === "Control de Salón");
  anota(M, "dibuja contenido", await page.evaluate(() => document.body.innerText.trim().length > 50));
  anota(M, "diseño Emporio System 1.1", await disenoEmporio(page));
  anota(M, "sin acceso a la Caja desde el Salón", await page.evaluate(() => !document.querySelector('a[href*="caja"], .acaja') && !/Abrir la caja/i.test(document.body.innerText)));
  await cierre(M, page, errores, caidos);
  await ctx.close();
}

async function probarTema(vista) {
  const M = `Tema Carta Andina · ${vista}`;
  const { ctx, errores, caidos } = await contexto(vista);
  const page = await ctx.newPage();
  await page.goto(BASE + "index.html"); await page.waitForTimeout(400);
  const ini = await page.evaluate(() => ({ tema: EA_TEMA.actual(), attr: document.documentElement.getAttribute("data-tema"), fuentes: !!document.getElementById("ea-tema-fuentes"), css: !!document.getElementById("ea-tema-css") }));
  anota(M, "el tema nativo es el de siempre y no carga las fuentes de la carta", ini.tema === "nativo" && ini.attr === null && !ini.fuentes && ini.css, JSON.stringify(ini));
  await sesion(page, "Constanza Veliz");
  await page.locator('#nav a[data-v="caja"]').click(); await page.waitForTimeout(1500);
  await page.locator("#temaBtn").click(); await page.waitForTimeout(700);
  const cambio = await page.evaluate(() => { const f = document.querySelector('.view[data-view="caja"] iframe'), d = f && f.contentDocument;
    const bg = getComputedStyle(document.body).backgroundColor, glass = getComputedStyle(document.querySelector(".top.glass")).backgroundColor;
    return { tema: document.documentElement.dataset.tema, guardado: localStorage.getItem("eapos_tema"), modulo: d && d.documentElement.dataset.tema, fuentes: !!document.getElementById("ea-tema-fuentes"),
      bg, glass, titulo: getComputedStyle(document.getElementById("vTitle")).fontFamily, aviso: ([...document.querySelectorAll(".toast")].pop() || {}).textContent || "" }; });
  anota(M, "el botón cambia a Carta Andina el sistema y el módulo abierto, al instante", cambio.tema === "andino" && cambio.guardado === "andino" && cambio.modulo === "andino" && /Carta Andina/.test(cambio.aviso), JSON.stringify(cambio));
  anota(M, "papel claro, tarjetas de papel y títulos con la letra de la carta", cambio.bg === "rgb(246, 238, 226)" && cambio.glass === "rgb(255, 252, 247)" && /Gochi Hand/.test(cambio.titulo) && cambio.fuentes, cambio.bg + " · " + cambio.glass + " · " + cambio.titulo);
  for (const v of ["inicio", "pedidos", "caja", "reportes", "fila", "salon", "cocina", "barra", "horno", "panaderia", "carta", "prueba", "versiones"]) {
    await navA(page, v); await page.waitForTimeout(v === "prueba" || v === "carta" ? 1200 : 500);
    const r = await page.evaluate(v => { const f = document.querySelector(`.view[data-view="${v}"] iframe`); let mod = "—", desb = false;
      if (f && f.contentDocument) { mod = f.contentDocument.documentElement.dataset.tema || "nativo"; desb = f.contentDocument.documentElement.scrollWidth > f.clientWidth + 1; }
      return { mod, desb, pagina: document.documentElement.scrollWidth > innerWidth + 1 }; }, v);
    anota(M, `${v} con el tema y sin desborde`, (r.mod === "andino" || r.mod === "—") && !r.desb && !r.pagina, JSON.stringify(r));
  }
  const temas = await page.evaluate(() => ({ n: document.querySelectorAll("#temas [data-tema-op]").length, on: (document.querySelector('#temas [aria-pressed="true"]') || {}).dataset?.temaOp }));
  anota(M, "Versiones muestra los dos temas y marca el elegido", temas.n === 2 && temas.on === "andino", JSON.stringify(temas));
  const otra = await ctx.newPage(); await otra.goto(BASE + "carta/index.html"); await otra.waitForTimeout(800);
  anota(M, "la Carta abierta aparte también sigue el tema del equipo", (await otra.evaluate(() => document.documentElement.dataset.tema)) === "andino");
  await page.locator('#temas [data-tema-op="nativo"]').click(); await page.waitForTimeout(600);
  const vuelta = await otra.evaluate(() => document.documentElement.getAttribute("data-tema"));
  anota(M, "volver al nativo desde Versiones también cambia las otras ventanas", (await page.evaluate(() => EA_TEMA.actual())) === "nativo" && vuelta === null, String(vuelta));
  await otra.goto(BASE + "carta/index.html?tema=andino"); await otra.waitForTimeout(600);
  anota(M, "?tema=andino en la dirección deja el tema fijo en el equipo", (await otra.evaluate(() => localStorage.getItem("eapos_tema"))) === "andino");
  await otra.evaluate(() => EA_TEMA.poner("nativo")); await otra.close();
  await cierre(M, page, errores, caidos);
  await ctx.close();
}

// SOLO=probarTema,probarFila node verificacion/verificar.mjs corre solo esas pruebas.
const SOLO = (process.env.SOLO || "").split(",").filter(Boolean);
const PRUEBAS = { probarGeneral, probarCajaYComandas, probarPruebaAplicar, probarPruebaContexto, probarPruebaFichas, probarCarta, probarSalon, probarHorario, probarProduccion, probarFila, probarSeguridad, probarTema };
for (const v of Object.keys(VISTAS)) {
  for (const [nombre, prueba] of Object.entries(PRUEBAS)) if (!SOLO.length || SOLO.includes(nombre)) await prueba(v);
}
await navegador.close();
servidor.close();
const fallas = resultados.filter(r => !r.ok);
const informe = { version: "3.2", fecha: new Date().toISOString(), total: resultados.length, fallas: fallas.length, resultados };
fs.writeFileSync(path.join(RAIZ, "verificacion", "informe.json"), JSON.stringify(informe, null, 2));
console.log(`\n${resultados.length - fallas.length}/${resultados.length} pruebas OK`);
process.exit(fallas.length ? 1 : 0);
