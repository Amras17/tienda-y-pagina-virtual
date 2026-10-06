/* ====================================================================
   Núcleo de EmporioAndinoPOS
   --------------------------------------------------------------------
   Un solo lugar para lo que antes cada módulo tenía por su cuenta:
   · la carta (EA_DATOS, en datos.js) y el catálogo de venta que sale de ella;
   · la configuración del SISTEMA GENERAL (precios, productos fuera de carta
     y metas), que solo cambia cuando se aplica desde la PRUEBA;
   · el borrador de la PRUEBA, donde se hacen los cambios y se simulan;
   · el historial de versiones aplicadas;
   · el equipo, sus cargos, sus PIN y la sesión abierta en este equipo.
   Todo vive en el almacenamiento del navegador, con las mismas claves que
   ya usaban la Caja (ea_pos), el Control de Salón (ea_control) y el
   ingreso con PIN (es_pins), para no perder lo que ya estaba guardado.
   ==================================================================== */
(function(){
  "use strict";
  var VERSION = "2.5";
  var K = {cfg:"eapos_cfg", prueba:"eapos_prueba_cfg", versiones:"eapos_versiones", sesion:"eapos_sesion", pins:"es_pins"};

  function leer(k){ try{ var r=localStorage.getItem(k); return r ? JSON.parse(r) : null; }catch(e){ return null; } }
  function guardar(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }
  function borrar(k){ try{ localStorage.removeItem(k); }catch(e){} }
  var canal=null; try{ canal=new BroadcastChannel("emporio-andino"); }catch(e){}
  function avisarCambio(t){ if(canal) try{ canal.postMessage({t:t}); }catch(e){} }

  /* ---------- carta y catálogo ---------- */
  var D = window.EA_DATOS;
  if(!D) throw new Error("Falta nucleo/datos.js antes de nucleo/nucleo.js");
  function nEs(n){ return typeof n==="string" ? n : (n && (n.es||n.en)) || ""; }
  var LOCAL_COMIDA = {desayunos:1, brunch:1, bruschettas:1, tostadas:1};
  var LOCAL_BEB = {v60:1, chemex:1};

  /* El catálogo base: mismas claves que usa el control de stock (E… empanadas,
     P… pastelería, el id tal cual para cocina y barra). */
  var BASE = [];
  D.EMP.forEach(function(e){ BASE.push({id:"E"+e.id, n:nEs(e.n), p:e.p, g:"emp", sub:"Empanadas", loc:0}); });
  D.COMIDA.forEach(function(c){ BASE.push({id:c.id, n:nEs(c.n), p:c.p, g:"coc", sub:c.s, loc:LOCAL_COMIDA[c.s]?1:0}); });
  D.BEB.forEach(function(b){ BASE.push({id:b.id, n:nEs(b.n), p:b.p, g:"bar", sub:b.g, loc:LOCAL_BEB[b.id]?1:0, leche:!!b.m, cof:!!b.cof, t:b.t}); });
  D.PAST.forEach(function(p){ BASE.push({id:"P"+p.id, n:nEs(p.n), p:(typeof p.p==="number"?p.p:null), g:"past", sub:p.cat, loc:0}); });
  var POR_ID = {}; BASE.forEach(function(p){ POR_ID[p.id]=p; });

  /* ---------- configuración ---------- */
  var METAS_BASE = {dia:0, mes:0, food:32, merma:3};
  function vacia(){ return {v:0, precios:{}, fuera:[], metas:Object.assign({},METAS_BASE), ts:"", por:"", nota:""}; }
  function normal(c){
    var o=vacia(); c=(c&&typeof c==="object")?c:{};
    o.v=+c.v||0; o.ts=c.ts||""; o.por=c.por||""; o.nota=c.nota||"";
    if(c.precios&&typeof c.precios==="object") for(var id in c.precios){ var v=Math.round(+c.precios[id]); if(v>0&&POR_ID[id]) o.precios[id]=v; }
    if(Array.isArray(c.fuera)) o.fuera=c.fuera.filter(function(id){ return !!POR_ID[id]; });
    if(c.metas&&typeof c.metas==="object") for(var m in METAS_BASE){ if(c.metas[m]!=null&&!isNaN(+c.metas[m])) o.metas[m]=+c.metas[m]; }
    return o;
  }
  /* La primera vez que se abre la versión 2.0 en un equipo, la configuración
     general se arma con lo que la Caja ya tenía: precios de pastelería y metas. */
  function migrar(){
    var c=vacia(), pos=leer("ea_pos");
    if(pos&&pos.precios) for(var id in pos.precios){ if(+pos.precios[id]>0) c.precios[id]=Math.round(+pos.precios[id]); }
    if(pos&&pos.cfg&&pos.cfg.metas) c.metas=Object.assign({},METAS_BASE,pos.cfg.metas);
    c=normal(c); c.v=1; c.ts=new Date().toISOString(); c.por="Sistema"; c.nota="Configuración inicial de la versión "+VERSION;
    guardar(K.cfg,c);
    var h=leer(K.versiones)||[]; if(!h.length){ h.push({v:1, ts:c.ts, por:c.por, nota:c.nota, cambios:[]}); guardar(K.versiones,h); }
    return c;
  }
  function general(){ var c=leer(K.cfg); return normal(c||migrar()); }
  function hayBorrador(){ return !!leer(K.prueba); }
  function prueba(){ var c=leer(K.prueba); return c ? normal(c) : general(); }
  function guardarPrueba(c){ c=normal(c); c.v=general().v; guardar(K.prueba,c); avisarCambio("prueba"); return c; }
  function descartarPrueba(){ borrar(K.prueba); avisarCambio("prueba"); }
  function entorno(){ return document.documentElement.getAttribute("data-entorno")==="prueba" ? "prueba" : "general"; }
  function activa(){ return entorno()==="prueba" ? prueba() : general(); }

  var NOMBRE_META={dia:"Meta de venta por día", mes:"Meta de venta del mes", food:"Food cost máximo (%)", merma:"Merma máxima (%)"};
  function precioBase(id){ var p=POR_ID[id]; return p ? p.p : null; }
  function precioEn(c,id){ return c.precios[id]!=null ? c.precios[id] : precioBase(id); }
  function plata(n){ return "$"+Math.round(n||0).toLocaleString("es-CL"); }
  /* Lo que cambia entre dos configuraciones, en palabras. */
  function cambios(a,b){
    var out=[];
    BASE.forEach(function(p){
      var x=precioEn(a,p.id), y=precioEn(b,p.id);
      if(x!==y) out.push({tipo:"precio", id:p.id, nombre:p.n, antes:x, despues:y,
        texto:p.n+": "+(x==null?"sin precio":plata(x))+" → "+(y==null?"sin precio":plata(y))});
      var fa=a.fuera.indexOf(p.id)>=0, fb=b.fuera.indexOf(p.id)>=0;
      if(fa!==fb) out.push({tipo:"carta", id:p.id, nombre:p.n, antes:fa, despues:fb,
        texto:p.n+(fb?": sale de la carta":": vuelve a la carta")});
    });
    for(var m in METAS_BASE){ if(a.metas[m]!==b.metas[m]) out.push({tipo:"meta", id:m, nombre:NOMBRE_META[m], antes:a.metas[m], despues:b.metas[m],
      texto:NOMBRE_META[m]+": "+(m==="dia"||m==="mes"?plata(a.metas[m]):a.metas[m]+"%")+" → "+(m==="dia"||m==="mes"?plata(b.metas[m]):b.metas[m]+"%")}); }
    return out;
  }
  function pendientes(){ return hayBorrador() ? cambios(general(), prueba()) : []; }
  /* El único camino para cambiar el sistema general: aplicar el borrador de la prueba. */
  function aplicar(por, nota){
    var g=general(), p=prueba(), ch=cambios(g,p);
    if(!ch.length) return null;
    var n=normal(p); n.v=g.v+1; n.ts=new Date().toISOString(); n.por=por||"Sin nombre"; n.nota=nota||"";
    if(!guardar(K.cfg,n)) return null;
    var h=leer(K.versiones)||[]; h.push({v:n.v, ts:n.ts, por:n.por, nota:n.nota, cambios:ch});
    if(h.length>80) h=h.slice(-80);
    guardar(K.versiones,h); borrar(K.prueba); avisarCambio("cfg");
    return {version:n.v, cambios:ch};
  }
  function versiones(){ return leer(K.versiones)||[]; }

  /* Catálogo listo para vender con una configuración: precio vigente y
     sin los productos que salieron de la carta. */
  function catalogo(c){
    c=c||activa();
    return BASE.filter(function(p){ return c.fuera.indexOf(p.id)<0; })
      .map(function(p){ var o=Object.assign({},p); o.p=precioEn(c,p.id); return o; });
  }
  /* La carta completa (con descripciones e idiomas) con los precios vigentes,
     para la Carta del cliente y el Control de Salón. */
  function datos(c){
    c=c||activa();
    var d=JSON.parse(JSON.stringify(D));
    d.EMP.forEach(function(e){ var v=c.precios["E"+e.id]; if(v!=null) e.p=v; });
    d.COMIDA.forEach(function(x){ var v=c.precios[x.id]; if(v!=null) x.p=v; });
    d.BEB.forEach(function(x){ var v=c.precios[x.id]; if(v!=null) x.p=v; });
    d.PAST.forEach(function(x){ var v=c.precios["P"+x.id]; if(v!=null) x.p=v; });
    return d;
  }
  function fueraDeCarta(id, c){ c=c||activa(); return c.fuera.indexOf(id)>=0; }

  /* ---------- equipo, cargos y acceso ---------- */
  var MODULOS = {
    caja:   {n:"Caja", d:"Cobro, boleta, stock, costos, compras, mermas e informes", ruta:"caja/index.html"},
    salon:  {n:"Control de Salón", d:"Disponibilidad de la carta, horno y estudio de la carta", ruta:"carta/salon.html"},
    cocina: {n:"Comandas", d:"Lo que se vendió en la caja, por estación: cocina, barra y horno", ruta:"cocina/index.html"},
    carta:  {n:"Carta Interactiva", d:"La carta que usa el cliente en la mesa", ruta:"carta/index.html"},
    prueba: {n:"Prueba y simulación", d:"Simulación por día, semana o mes, pedidos a mano y cambios antes de aplicarlos", ruta:"prueba/index.html"}
  };
  /* caja: "todo" (dueños), "turno" (cobro, stock, compras, mermas, cierre e
     historial) o "cobro" (cobro y stock). numeros: ventas en pesos, costos,
     metas, estadísticas y fichas; solo los dueños. */
  var ROLES = {
    dueno:      {n:"Dirección",      m:["caja","salon","cocina","carta","prueba"], caja:"todo", sistema:1, numeros:1},
    jefe:       {n:"Dirección",      m:["caja","salon","cocina","carta","prueba"], caja:"turno", sistema:1},
    encargado:  {n:"Caja y salón",   m:["caja","salon","cocina","carta"], caja:"turno"},
    garzon:     {n:"Garzones",       m:["caja","salon","cocina","carta"], caja:"cobro"},
    barista_enc:{n:"Barra",          m:["cocina","salon","carta"]},
    barista:    {n:"Barra",          m:["cocina","salon","carta"]},
    cocina:     {n:"Cocina y horno", m:["cocina","salon","carta"]}
  };
  var EQUIPO = [
    ["Constanza Veliz","dueno","Dueña"],["Edgardo Morales","dueno","Dueño"],
    ["Gustavo Veliz","jefe","Jefe de operaciones · turno 1"],["Marbelis Colmenares","jefe","Jefa de operaciones · turno 2"],
    ["Jose Ignacio Argadoña","encargado","Encargado de turno"],["Andrea Rodriguez","encargado","Encargada de turno"],["Maria Eugenia Mamami","encargado","Encargada de turno"],
    ["Magda","cocina","Encargada de cocina"],["Jona","barista_enc","Encargado barista"],["Daline","barista","Barista"],
    ["Juan Ignacio","garzon","Garzón"],["Daniela","garzon","Garzona"],["Cindel","garzon","Garzona"],["Claudia","garzon","Garzona"],["Wilbert","garzon","Garzón"],["Mariela","garzon","Garzona"]
  ].map(function(x,i){ return {i:i, n:x[0], r:x[1], c:x[2]}; });
  var COLOR_ROL = {dueno:"#40E0D0", jefe:"#40E0D0", encargado:"#D9A93A", garzon:"#FF7F50", barista_enc:"#1AA89B", barista:"#1AA89B", cocina:"#9A80D6"};

  /* El PIN se guarda como huella SHA-256, igual que en Emporio System 1.1:
     los PIN ya creados en este equipo siguen sirviendo. */
  function hashPin(nombre, pin){
    var txt="emporio|"+nombre+"|"+pin;
    try{
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt)).then(function(b){
        return Array.from(new Uint8Array(b)).map(function(x){ return x.toString(16).padStart(2,"0"); }).join("");
      }).catch(function(){ return respaldo(txt); });
    }catch(e){ return Promise.resolve(respaldo(txt)); }
  }
  function respaldo(txt){ var h=5381; for(var i=0;i<txt.length;i++) h=((h<<5)+h+txt.charCodeAt(i))|0; return "d"+(h>>>0).toString(16); }
  function pins(){ return leer(K.pins)||{}; }
  function guardarPin(nombre, huella){ var p=pins(); p[nombre]=huella; guardar(K.pins,p); }
  function borrarPin(nombre){ var p=pins(); delete p[nombre]; guardar(K.pins,p); }

  function hoy(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  /* La sesión dura el día: al día siguiente se vuelve a pedir el PIN. */
  function sesion(){ var s=leer(K.sesion); if(!s||s.dia!==hoy()) return null; var p=EQUIPO.filter(function(x){ return x.n===s.n; })[0]; return p?{n:p.n, r:p.r, c:p.c, dia:s.dia}:null; }
  function abrirSesion(p){ guardar(K.sesion,{n:p.n, dia:hoy(), ts:new Date().toISOString()}); avisarCambio("sesion"); }
  function cerrarSesion(){ borrar(K.sesion); avisarCambio("sesion"); }
  function puede(modulo, s){ s=s||sesion(); return !!(s && ROLES[s.r] && ROLES[s.r].m.indexOf(modulo)>=0); }
  /* Cifras del negocio y costos: solo dueños. Sin sesión (un módulo abierto
     suelto en el equipo del local) se muestra todo, como antes del sistema general. */
  function verNumeros(s){ s=s===undefined?sesion():s; return !s || !!(ROLES[s.r] && ROLES[s.r].numeros); }

  /* Pide al sistema general (la capa superior) que abra un módulo. Busca hacia
     arriba entre los marcos del mismo origen; si no hay sistema general,
     devuelve false y el módulo navega solo. */
  function abrirEnSistema(modulo){
    var w=window;
    try{ while(w.parent && w.parent!==w){ w=w.parent; if(w.EAPOS_SISTEMA && w.EAPOS_SISTEMA.abrir){ w.EAPOS_SISTEMA.abrir(modulo); return true; } } }catch(e){}
    return false;
  }
  function irA(modulo, desde){
    if(abrirEnSistema(modulo)) return;
    var m=MODULOS[modulo]; if(!m) return;
    location.href=(desde||"../")+m.ruta;
  }

  window.EAPOS = {
    version:VERSION, claves:K, leer:leer, guardar:guardar, canal:canal,
    base:BASE, producto:function(id){ return POR_ID[id]||null; },
    general:general, prueba:prueba, hayBorrador:hayBorrador, guardarPrueba:guardarPrueba, descartarPrueba:descartarPrueba,
    entorno:entorno, activa:activa, cambios:cambios, pendientes:pendientes, aplicar:aplicar, versiones:versiones,
    catalogo:catalogo, datos:datos, fueraDeCarta:fueraDeCarta, precioEn:precioEn,
    MODULOS:MODULOS, ROLES:ROLES, EQUIPO:EQUIPO, COLOR_ROL:COLOR_ROL,
    hashPin:hashPin, pins:pins, guardarPin:guardarPin, borrarPin:borrarPin,
    sesion:sesion, abrirSesion:abrirSesion, cerrarSesion:cerrarSesion, puede:puede, verNumeros:verNumeros,
    abrirEnSistema:abrirEnSistema, irA:irA
  };
})();
