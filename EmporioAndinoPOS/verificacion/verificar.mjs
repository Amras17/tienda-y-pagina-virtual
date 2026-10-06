// Agente de verificación de EmporioAndinoPOS 2.4.
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
  anota(M, "equipo completo en el ingreso", await page.locator("#peopleList .person").count() === 16);
  anota(M, "diseño Emporio System 1.1", await disenoEmporio(page));
  await sesion(page, "Constanza Veliz");
  anota(M, "ingreso con PIN nuevo (crear y confirmar)", await page.locator("#app").isVisible());
  const nav = await page.locator("#nav a").evaluateAll(a => a.map(x => x.dataset.v));
  anota(M, "dirección ve todas las áreas", nav.join(",") === "inicio,caja,salon,cocina,carta,prueba,verificacion,versiones,retro", nav.join(","));
  anota(M, "dashboard con áreas del local", await page.locator("#hub .acard").count() === 8);
  await navA(page, "verificacion");
  await page.locator("#btnVerificar").click();
  await page.waitForSelector("#diagEstado[data-fin]", { timeout: 90000 }).catch(() => {});
  const fallas = await page.locator("#diagLista li.falla").count(), total = await page.locator("#diagLista li:not(.grupo)").count();
  const detalle = await page.locator("#diagLista li.falla, #diagLista li.aviso").evaluateAll(ls => ls.map(l => l.innerText.replace(/\s+/g, " ")).join(" | "));
  anota(M, "autodiagnóstico interno", total > 0 && fallas === 0, `${total - fallas}/${total}` + (detalle ? " · " + detalle : ""));
  for (const m of ["caja", "salon", "cocina", "carta", "prueba"]) {
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
  for (const v of ["caja", "salon", "cocina", "carta", "prueba", "verificacion", "versiones", "retro"]) {
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
  await navA(page, "versiones");
  anota(M, "versiones y accesos", await page.locator("#acc tr").count() === 16);
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
  await sesion(page, "Andrea Rodriguez");
  const caja = await ctx.newPage();
  await caja.goto(BASE + "caja/index.html"); await caja.waitForTimeout(600);
  anota(M, "la Caja toma al responsable de la sesión", (await caja.locator("#selResp").inputValue()) === "Andrea Rodriguez");
  anota(M, "catálogo de la carta única", await caja.evaluate(() => CAT.length) === 130);
  await caja.evaluate(() => { [CAT.find(p => p.id === "Ee-pino"), CAT.find(p => p.id === "cappuccino"), CAT.find(p => p.id === "licancabur")].forEach(agregar); });
  await caja.evaluate(() => { pagoActivo = "debito"; pintarPagos(); pintarCuenta(); });
  await caja.locator("#btnRegistrar").click(); await caja.waitForTimeout(300);
  anota(M, "registra la venta", await caja.evaluate(() => JSON.parse(localStorage.getItem("ea_pos")).ventas.length) === 1);
  await caja.locator("#hojaX").click();
  for (const s of ["panel", "stock", "gest", "inf", "ajustes"]) await caja.evaluate(id => irA(id), s);
  const com = await ctx.newPage();
  await com.goto(BASE + "cocina/index.html"); await com.waitForTimeout(500);
  await com.locator('[data-est="todo"]').click();
  anota(M, "la venta llega a Comandas por estación", await com.locator("#tablero .comanda").count() === 3);
  await com.locator('[data-est="cocina"]').click();
  anota(M, "filtro de cocina", await com.locator("#tablero .comanda").count() === 1);
  await com.locator("#tablero [data-listo]").first().click();
  anota(M, "marcar lista la comanda", await com.locator("#tablero .comanda").count() === 0);
  await cierre(M + " (comandas)", com, [], []);
  const enc = await caja.evaluate(() => ({ secc: SECC.map(s => s.id).join(","), gest: SUBGEST.map(s => s.id).join(","), inf: SUBINF.map(s => s.id).join(",") }));
  anota(M, "encargado: sin panel, costos, metas ni estadísticas", enc.secc === "caja,stock,gest,inf,ajustes" && enc.gest === "compras,mermas" && enc.inf === "rep,hist", JSON.stringify(enc));
  await page.reload(); await page.waitForTimeout(400);
  anota(M, "encargado: el dashboard no muestra ventas en pesos", await page.evaluate(() => document.getElementById("dash").classList.contains("nov")));
  await sesion(page, "Constanza Veliz");
  await caja.reload(); await caja.waitForTimeout(500);
  anota(M, "dueña: la Caja completa", await caja.evaluate(() => SECC.map(s => s.id).join(",") === "caja,panel,stock,gest,inf,ajustes" && SUBGEST.length === 4 && SUBINF.length === 4));
  await sesion(page, "Wilbert");
  await caja.reload(); await caja.waitForTimeout(500);
  const secc = await caja.evaluate(() => SECC.map(s => s.id).join(","));
  anota(M, "garzón ve solo cobro y stock", secc === "caja,stock", secc);
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

// ---------- Control de Salón ----------
async function probarSalon(vista) {
  const M = `Salón · ${vista}`;
  const { ctx, errores, caidos } = await contexto(vista);
  const page = await ctx.newPage();
  await page.goto(BASE + "carta/salon.html"); await page.waitForTimeout(1200);
  anota(M, "título", (await page.title()) === "Control de Salón");
  anota(M, "dibuja contenido", await page.evaluate(() => document.body.innerText.trim().length > 50));
  anota(M, "diseño Emporio System 1.1", await disenoEmporio(page));
  anota(M, "sin acceso a la Caja desde el Salón", await page.evaluate(() => !document.querySelector('a[href*="caja"], .acaja') && !/Abrir la caja/i.test(document.body.innerText)));
  await cierre(M, page, errores, caidos);
  await ctx.close();
}

for (const v of Object.keys(VISTAS)) {
  await probarGeneral(v);
  await probarCajaYComandas(v);
  await probarPruebaAplicar(v);
  await probarPruebaContexto(v);
  await probarPruebaFichas(v);
  await probarCarta(v);
  await probarSalon(v);
}
await navegador.close();
servidor.close();
const fallas = resultados.filter(r => !r.ok);
const informe = { version: "2.4", fecha: new Date().toISOString(), total: resultados.length, fallas: fallas.length, resultados };
fs.writeFileSync(path.join(RAIZ, "verificacion", "informe.json"), JSON.stringify(informe, null, 2));
console.log(`\n${resultados.length - fallas.length}/${resultados.length} pruebas OK`);
process.exit(fallas.length ? 1 : 0);
