/* ====================================================================
   La política de cargos del navegador, ahora en el servidor
   --------------------------------------------------------------------
   Carga nucleo/datos.js y nucleo/nucleo.js en un espacio aislado (vm) y
   toma de ahí el EQUIPO, los ROLES, los MÓDULOS y las ACCIONES. Es la misma
   tabla que usa el navegador: cambiarla en un lugar la cambia en ambos.
   ==================================================================== */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");

const RAIZ = process.env.EAPOS_RAIZ || path.join(__dirname, "..");
function cargar() {
  const memoria = {};
  const ventana = {};
  const ctx = {
    window: ventana, console, JSON, Math, Date, Promise, Object, Array, String, Number, Boolean, RegExp, Error, isNaN, parseInt, parseFloat,
    localStorage: { getItem: k => (k in memoria ? memoria[k] : null), setItem: (k, v) => { memoria[k] = String(v); }, removeItem: k => { delete memoria[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { documentElement: { classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, getAttribute() { return null; } }, addEventListener() {}, querySelector() { return null; } },
    location: { pathname: "/", search: "", href: "" },
    addEventListener() {}, setInterval() { return 0; }, setTimeout() { return 0; }, clearTimeout() {}, clearInterval() {},
    navigator: { userAgent: "servidor" }, crypto: undefined, TextEncoder
  };
  ctx.self = ctx.window;
  vm.createContext(ctx);
  for (const f of ["nucleo/datos.js", "nucleo/nucleo.js"]) vm.runInContext(fs.readFileSync(path.join(RAIZ, f), "utf8").replace(/^\s*window\./gm, "window."), ctx, { filename: f });
  const E = ventana.EAPOS || ctx.EAPOS;
  if (!E || !E.ROLES || !E.EQUIPO) throw new Error("No se pudo leer la política de nucleo/nucleo.js");
  return E;
}
const E = cargar();
const PERSONA = {}; E.EQUIPO.forEach(p => { PERSONA[p.n] = p; });

function persona(nombre) { return PERSONA[nombre] || null; }
/* ¿El cargo (o la persona, con sus acciones propias) puede esta acción? */
function permite(nombre, accion) {
  const p = persona(nombre); if (!p) return false;
  const a = E.ACCIONES[accion]; if (!a) return false;
  return a.roles.indexOf(p.r) >= 0 || (p.x || []).indexOf(accion) >= 0;
}
function puede(nombre, modulo) { const p = persona(nombre); if (!p) return false; const r = E.ROLES[p.r]; return !!r && r.m.indexOf(modulo) >= 0; }
function sistema(nombre) { const p = persona(nombre); return !!p && !!(E.ROLES[p.r] || {}).sistema; }

/* Qué se comparte entre equipos y quién puede escribirlo. "*" = cualquiera
   con sesión. Lo que no está aquí queda solo en cada equipo. */
const CLAVES = {
  "ea_pos":            { m: ["caja"], d: "Ventas, arqueos y ajustes de la Caja" },
  "ea_control":        { m: ["caja", "pedidos", "salon", "cocina", "barra", "horno", "panaderia"], d: "Disponibilidad, unidades y horno del día" },
  "eapos_fila":        { m: ["pedidos", "fila", "caja"], d: "Fila, mesas y pedidos en rondas" },
  "eapos_comandas":    { m: ["cocina", "barra"], d: "Comandas marcadas como listas" },
  "eapos_panaderia":   { m: ["panaderia", "horno"], d: "Plan, pedidos y precocido de la panadería" },
  "eapos_horno":       { m: ["horno"], d: "Tandas, espera y ajustes del horno" },
  "eapos_cfg":         { sistema: true, d: "Configuración vigente (precios, carta, metas)" },
  "eapos_versiones":   { sistema: true, d: "Historial de versiones aplicadas" },
  "eapos_prueba_cfg":  { m: ["prueba"], d: "Borrador de la Prueba" },
  "eapos_prueba_fichas": { m: ["prueba"], d: "Fichas de la Prueba" },
  "eapos_carta":       { todos: true, d: "Versión de la carta ya migrada" },
  "eapos_retro":       { todos: true, d: "Retroalimentación" },
  "es_pins":           { pins: true, d: "Huellas de los PIN del equipo" }
};
function puedeEscribir(nombre, clave) {
  const c = CLAVES[clave]; if (!c) return false;
  if (sistema(nombre)) return true;
  if (c.todos) return !!persona(nombre);
  if (c.sistema) return false;
  return (c.m || []).some(m => puede(nombre, m));
}

module.exports = { E, persona, permite, puede, sistema, CLAVES, puedeEscribir, ALIAS: E.ALIAS || {} };
