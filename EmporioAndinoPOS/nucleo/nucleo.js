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
  var VERSION = "3.0";
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
  function general(){ var c=leer(K.cfg); return cartaNueva(normal(c||migrar())); }
  /* Carta física nueva (junio de 2026): una sola vez por equipo, se crea una
     versión del sistema general que deja regir los precios de la carta (se
     quitan los precios propios que tapaban a los nuevos) y saca de la carta
     lo que ya no está en ella. Queda en el historial con cada cambio. */
  var SALEN_2026_06=["cafeconleche"];
  function cartaNueva(c){
    var CT=D.CARTA; if(!CT||leer("eapos_carta")===CT.v) return c;
    var antes=CT.antes||{}, n=normal(JSON.parse(JSON.stringify(c))), ch=[];
    BASE.forEach(function(p){
      var viejo=c.precios[p.id]!=null?c.precios[p.id]:(p.id in antes?antes[p.id]:p.p);
      if(p.p!=null) delete n.precios[p.id];
      var nuevo=precioEn(n,p.id);
      if(viejo!==nuevo) ch.push({tipo:"precio", id:p.id, nombre:p.n, antes:viejo, despues:nuevo,
        texto:p.n+": "+(viejo==null?(p.id in antes?"sin precio":"nuevo en la carta"):plata(viejo))+" → "+(nuevo==null?"sin precio":plata(nuevo))});
    });
    SALEN_2026_06.forEach(function(id){ if(POR_ID[id]&&n.fuera.indexOf(id)<0){ n.fuera.push(id); ch.push({tipo:"carta", id:id, nombre:POR_ID[id].n, antes:false, despues:true, texto:POR_ID[id].n+": sale de la carta"}); } });
    if(ch.length){
      n.v=c.v+1; n.ts=new Date().toISOString(); n.por="Sistema"; n.nota="Precios de la carta física de junio de 2026";
      if(!guardar(K.cfg,n)) return c;
      var h=leer(K.versiones)||[]; h.push({v:n.v, ts:n.ts, por:n.por, nota:n.nota, cambios:ch}); if(h.length>80) h=h.slice(-80); guardar(K.versiones,h);
    }
    guardar("eapos_carta",CT.v);
    return ch.length?n:c;
  }
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
    if(!exigir("sistema","aplicar la Prueba al sistema general")) return null;
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

  /* ---------- horario del local ----------
     Tres hitos del día, en minutos desde medianoche. Cada uno avisa cuando
     faltan 15 y 5 minutos (el cierre solo a los 5) y desde su hora bloquea lo
     que corresponde: los desayunos a las 12:00; las mesas y la cocina a las
     21:30; el local entero a las 22:00. Para probar, la hora se puede fijar
     en la pestaña con sessionStorage "eapos_hora" = "21:20". */
  var HORARIO = [
    {id:"desayuno", fin:720,  avisos:[15,5], n:"Desayunos",        hasta:"Desayunos hasta las 12:00",      txt:"Terminan los desayunos",        hecho:"Terminó el desayuno",     efecto:"Desde las 12:00 la Caja no vende desayunos; sigue el brunch"},
    {id:"mesas",    fin:1290, avisos:[15,5], n:"Mesas y cocina",   hasta:"Mesas y cocina hasta las 21:30", txt:"Cierran las mesas y la cocina", hecho:"Mesas y cocina cerradas", efecto:"Desde las 21:30 no se abren mesas ni se piden platos de cocina; queda para llevar"},
    {id:"cierre",   fin:1320, avisos:[5],    n:"Cierre del local", hasta:"Abierto hasta las 22:00",        txt:"Cierra el local",               hecho:"Local cerrado",           efecto:"A las 22:00 se cierra la caja y el local"}
  ];
  function hhmm(m){ m=Math.max(0,Math.round(m)); return String(Math.floor(m/60)%24).padStart(2,"0")+":"+String(m%60).padStart(2,"0"); }
  function minutoDe(d){
    if(!d){ try{ var f=sessionStorage.getItem("eapos_hora"); if(f&&/^\d{1,2}:\d{2}$/.test(f)){ var q=f.split(":"); return +q[0]*60+(+q[1]); } }catch(e){} d=new Date(); }
    return d.getHours()*60+d.getMinutes()+d.getSeconds()/60;
  }
  /* Fase de cada hito: "antes", "aviso" (faltan 15 o menos), "ultimo" (5 o
     menos) o "terminado". La lista viene ordenada por hora. */
  function horario(min){
    min=min==null?minutoDe():min;
    return HORARIO.map(function(h){
      var falta=h.fin-min, primero=h.avisos[0];
      var fase=falta<=0?"terminado":falta<=5?"ultimo":falta<=primero?"aviso":"antes";
      return {id:h.id, n:h.n, hasta:h.hasta, txt:h.txt, hecho:h.hecho, efecto:h.efecto, fin:h.fin, hora:hhmm(h.fin), falta:falta, fase:fase};
    });
  }
  /* El próximo hito que todavía no termina (o null pasadas las 22:00). */
  function proximoHito(min){ return horario(min).filter(function(h){ return h.fase!=="terminado"; })[0]||null; }
  /* ¿Se puede vender este producto a esta hora? Devuelve el motivo o "". */
  function porHorario(id, min){
    var p=typeof id==="object"?id:POR_ID[id]; if(!p) return "";
    min=min==null?minutoDe():min;
    if(min>=1320) return "Local cerrado (22:00)";
    if(p.g==="coc" && min>=1290) return "Cocina cerrada (21:30)";
    if(p.sub==="desayunos" && min>=720) return "Terminó el desayuno (12:00)";
    return "";
  }
  /* Las mesas (consumo en el local) se cierran con la cocina. */
  function mesasAbiertas(min){ min=min==null?minutoDe():min; return min<1290; }

  /* ====================================================================
     PERSONAL, CARGOS Y SEGURIDAD (RBAC + perímetro por área)
     --------------------------------------------------------------------
     Una sola política, declarativa, que leen el sistema general y todos los
     módulos. Cada cargo tiene:
       · m: las áreas (módulos) que puede abrir; fuera de ellas no hay ruta;
       · inicio: la pantalla a la que entra directo al identificarse;
       · caja: el nivel dentro de la Caja;
       · sistema / numeros: administración y cifras del negocio.
     Las acciones sensibles (anular, pedir entre panadería y cocina, cambiar
     una comanda ya enviada…) se piden por nombre con exigir(): si el cargo o
     la persona no la tiene, se niega (403) y queda en la bitácora.
     Esto corre en el navegador: protege del error y del curioso, pero quien
     controla el equipo puede saltárselo. La misma política sirve tal cual
     para el servidor que la haga cumplir de verdad (ver README).
     ==================================================================== */
  var MODULOS = {
    caja:   {n:"Caja", d:"Cobro, boleta, stock, costos, compras, mermas e informes", ruta:"caja/index.html"},
    fila:   {n:"Fila y mesas", d:"Quién espera, su pedido en la fila y a quién llamar cuando se libera una mesa", ruta:"fila/index.html"},
    salon:  {n:"Control de Salón", d:"Disponibilidad de la carta y estudio de la carta", ruta:"carta/salon.html"},
    cocina: {n:"Comandas de cocina", d:"Los platos cobrados en la Caja, para cocina", ruta:"cocina/index.html?est=cocina"},
    barra:  {n:"Comandas de barra", d:"Las bebidas cobradas en la Caja, para barra", ruta:"cocina/index.html?est=barra"},
    horno:  {n:"Horno", d:"Temporizador de las tandas, pedido de la panadería, vitrina y precocido", ruta:"horno/index.html"},
    panaderia:{n:"Panadería", d:"Plan por latas, pedidos al horno, solicitudes y escandallos", ruta:"panaderia/index.html"},
    carta:  {n:"Carta Interactiva", d:"La carta que usa el cliente en la mesa", ruta:"carta/index.html"},
    prueba: {n:"Prueba y simulación", d:"Simulación por día, semana o mes, pedidos a mano y cambios antes de aplicarlos", ruta:"prueba/index.html"}
  };
  /* caja: "todo" (dueños: todo), "jefe" (cobro, stock, compras, mermas, cierre
     e historial), "encargado" (cobro, ventas, cierre e historial) o "cobro"
     (solo cobrar y sus propinas). inicio: "inicio" es el Dashboard. */
  var ROLES = {
    dueno:     {n:"Dirección", clave:"DUENO", m:["caja","fila","salon","cocina","barra","horno","panaderia","carta","prueba"], inicio:"inicio", caja:"todo", sistema:1, numeros:1, dash:1,
                d:"Acceso total y transversal"},
    jefe:      {n:"Jefatura de operaciones", clave:"JEFE_AREA", m:["caja","fila","salon","cocina","barra","horno","panaderia","carta","prueba"], inicio:"inicio", caja:"jefe", sistema:1, dash:1,
                d:"Control total de la operación: modificación, stock e informes"},
    encargado: {n:"Encargados de turno", clave:"ENCARGADO_TURNO", m:["caja","fila","salon","cocina","barra","horno","panaderia","carta"], inicio:"inicio", caja:"encargado", dash:1,
                d:"Visión operativa de todas las áreas; modifica mesas, mostrador y ventas"},
    garzon:    {n:"Salón y atención", clave:"GARZON", m:["fila","caja","salon","carta"], inicio:"fila", caja:"cobro",
                d:"Fila, pedidos, carta, cobro y sus propinas"},
    barista:   {n:"Barra y café", clave:"BARISTA", m:["barra"], inicio:"barra", area:"bar",
                d:"Comandas de barra y disponibilidad de la barra"},
    cocina:    {n:"Cocina", clave:"COCINA", m:["cocina","horno"], inicio:"cocina", area:"coc",
                d:"Comandas de cocina, horno y disponibilidad de la cocina"},
    panaderia: {n:"Panadería y pastelería", clave:"PANADERIA", m:["panaderia"], inicio:"panaderia", area:"pan",
                d:"Plan por latas, escandallos e insumos"}
  };
  /* Lista oficial del personal. x: acciones que la persona tiene además de
     las de su cargo (los encargados designados de cada canal entre áreas). */
  var EQUIPO = [
    ["Constanza Veliz","dueno","Dueña"],["Edgardo Morales","dueno","Dueño"],
    ["Marbelis Colmenares","jefe","Jefa de operaciones · resolución de problemas"],["Gustavo Veliz","jefe","Jefe de operaciones · resolución de problemas"],
    ["José Ignacio Argandoña","encargado","Encargado de turno · jefe directo de todas las áreas"],
    ["Andrea Saray Rodríguez","encargado","Encargada de turno · jefa directa de todas las áreas"],
    ["María Eugenia Mamani","encargado","Encargada de turno · jefa directa de todas las áreas"],
    ["Jonathan Constanzo","barista","Encargado de barra de café · barista"],["Joanne Daline Rodas","barista","Barista"],
    ["Inés Mariela Narváez","garzon","Garzona"],["Claudia Inostroza","garzon","Garzona"],["Juan Ignacio Díaz","garzon","Garzón"],
    ["Daniela Flores","garzon","Garzona"],["Cindel Mamani","garzon","Garzona · postulante barista"],["Wilbert Escalona","garzon","Garzón · postulante barista"],
    ["María Torrez","cocina","Encargada de cocina",["horno.recibir","horno.solicitar","horno.precocido","horno.ajustes"]],
    ["Alexmay Ramirez","cocina","Cocina"],["Andrea Vela","cocina","Cocina"],["Pamela Rio","cocina","Cocina"],["Máxima Patty","cocina","Cocina"],
    ["Pamela Sulema Condori","cocina","Picados y preparación"],["Nancy Salguero","cocina","Picados y preparación"],["Celia Negretty","cocina","Picados y preparación"],
    ["Karina Mamani","cocina","Picados y preparación"],["Daisy Pérez","cocina","Picados, preparación y transporte panadería → cocina",["horno.recibir"]],
    ["Eva Galarza","panaderia","Encargada de panadería · armado",["pan.pedidos"]],["Claudia Garcías","panaderia","Encargada de panadería · armado",["pan.pedidos"]],
    ["Yarella Aguilar","panaderia","Pastelería"]
  ].map(function(x,i){ return {i:i, n:x[0], r:x[1], c:x[2], x:x[3]||[]}; });
  var COLOR_ROL = {dueno:"#40E0D0", jefe:"#3ABCFC", encargado:"#D9A93A", garzon:"#FF7F50", barista:"#1AA89B", cocina:"#9A80D6", panaderia:"#E8674A"};
  /* Nombres que tenía el personal antes de la lista oficial: su PIN sigue
     sirviendo (se comprueba con el nombre anterior y se pasa al nuevo). */
  var ALIAS = {"José Ignacio Argandoña":"Jose Ignacio Argadoña","Andrea Saray Rodríguez":"Andrea Rodriguez","María Eugenia Mamani":"Maria Eugenia Mamami",
    "Jonathan Constanzo":"Jona","Joanne Daline Rodas":"Daline","Juan Ignacio Díaz":"Juan Ignacio","Daniela Flores":"Daniela","Cindel Mamani":"Cindel",
    "Claudia Inostroza":"Claudia","Wilbert Escalona":"Wilbert","Inés Mariela Narváez":"Mariela"};

  /* Acciones sensibles: qué cargos las tienen y si un encargado puede
     autorizarlas con su PIN a quien no las tiene. */
  var ACCIONES = {
    "venta.cobrar":        {n:"Cobrar en la Caja", roles:["dueno","jefe","encargado","garzon"]},
    "venta.anular":        {n:"Anular una venta", roles:["dueno","jefe","encargado"], autoriza:true},
    "venta.responsable":   {n:"Registrar una venta a nombre de otra persona", roles:["dueno","jefe","encargado"]},
    "comanda.listo":       {n:"Marcar una comanda lista", roles:["dueno","jefe","encargado","barista","cocina"]},
    "comanda.reabrir":     {n:"Reabrir una comanda cerrada", roles:["dueno","jefe","encargado"], autoriza:true},
    "fila.operar":         {n:"Anotar, llamar y sentar en la fila", roles:["dueno","jefe","encargado","garzon"]},
    "fila.cambiarComandado":{n:"Cambiar un pedido ya enviado a cocina", roles:["dueno","jefe","encargado"], autoriza:true},
    "fila.ajustes":        {n:"Ajustes de la fila (mesas y espera)", roles:["dueno","jefe","encargado"]},
    "stock.disponibilidad":{n:"Marcar disponibilidad de la carta", roles:["dueno","jefe","encargado"]},
    "stock.area":          {n:"Marcar disponibilidad de su área", roles:["dueno","jefe","encargado","barista","cocina"]},
    "stock.unidades":      {n:"Stock, compras y mermas", roles:["dueno","jefe"]},
    "horno.operar":        {n:"Cargar y sacar tandas, vitrina", roles:["dueno","jefe","encargado","cocina"]},
    "horno.recibir":       {n:"Recibir el pedido de la panadería", roles:["dueno","jefe","encargado"]},
    "horno.solicitar":     {n:"Solicitar empanadas a la panadería", roles:["dueno","jefe","encargado"]},
    "horno.precocido":     {n:"Reportar el precocido", roles:["dueno","jefe","encargado"]},
    "horno.ajustes":       {n:"Ajustes del horno", roles:["dueno","jefe"]},
    "pan.pedidos":         {n:"Enviar al horno y responder solicitudes", roles:["dueno","jefe"]},
    "pan.escandallo":      {n:"Ajustar escandallos", roles:["dueno","jefe"]},
    "sistema":             {n:"Administración del sistema", roles:["dueno","jefe"]},
    "numeros":             {n:"Cifras del negocio y costos", roles:["dueno"]}
  };

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
  /* Crear el PIN propio la primera vez no pide permiso; cambiar o borrar el
     de otra persona es administración. */
  function guardarPin(nombre, huella){ var p=pins(), s=sesion();
    /* Cambiar un PIN existente, o crear el de otra persona estando con sesión, es administración. */
    if((p[nombre]||(s&&s.n!==nombre))&&!exigir("sistema","PIN de "+nombre)) return false;
    p[nombre]=huella; guardar(K.pins,p); return true; }
  function borrarPin(nombre){ if(!exigir("sistema","PIN de "+nombre)) return false; var p=pins(); delete p[nombre]; guardar(K.pins,p); registrar({tipo:"pin_borrado", recurso:nombre}); return true; }
  /* Comprueba un PIN: con el nombre actual o, si la persona venía con otro
     nombre, con el anterior (y lo pasa al nombre nuevo). */
  function verificarPin(nombre, pin){
    var p=pins(), viejo=ALIAS[nombre];
    if(p[nombre]) return hashPin(nombre,pin).then(function(h){ return h===p[nombre]; });
    if(viejo&&p[viejo]) return hashPin(viejo,pin).then(function(h){
      if(h!==p[viejo]) return false;
      return hashPin(nombre,pin).then(function(hn){ var q=pins(); q[nombre]=hn; delete q[viejo]; guardar(K.pins,q); return true; }); });
    return Promise.resolve(null);
  }
  function tienePin(nombre){ var p=pins(); return !!(p[nombre]||(ALIAS[nombre]&&p[ALIAS[nombre]])); }

  function hoy(d){ d=d||new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function persona(n){ return EQUIPO.filter(function(x){ return x.n===n; })[0]||null; }
  /* La sesión dura el día y a lo más 14 horas; lleva un token al azar. El
     cargo nunca se lee de lo guardado: sale siempre de la lista oficial. */
  var DURA=14*3600e3;
  function sesion(){ var s=leer(K.sesion); if(!s||s.dia!==hoy()||!s.tk) return null;
    if(Date.now()-new Date(s.ts).getTime()>DURA) return null;
    var p=persona(s.n); return p?{n:p.n, r:p.r, c:p.c, x:p.x, dia:s.dia, tk:s.tk}:null; }
  function token(){ try{ var a=new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a).map(function(b){ return b.toString(16).padStart(2,"0"); }).join(""); }catch(e){ return Date.now().toString(36)+Math.random().toString(36).slice(2); } }
  function abrirSesion(p){ guardar(K.sesion,{n:p.n, dia:hoy(), ts:new Date().toISOString(), tk:token()}); registrar({tipo:"ingreso", quien:p.n, rol:p.r}); avisarCambio("sesion"); }
  function cerrarSesion(motivo){ var s=sesion(); if(s) registrar({tipo:"salida", quien:s.n, rol:s.r, detalle:motivo||""}); borrar(K.sesion); avisarCambio("sesion"); }
  function puede(modulo, s){ s=s||sesion(); return !!(s && ROLES[s.r] && ROLES[s.r].m.indexOf(modulo)>=0); }
  /* ¿Esta sesión puede hacer esta acción? */
  function permite(accion, s){ s=s===undefined?sesion():s; if(!s) return false; var a=ACCIONES[accion];
    return !!(a && (a.roles.indexOf(s.r)>=0 || (s.x||[]).indexOf(accion)>=0)); }
  /* Cifras del negocio y costos: solo dueños. Sin sesión no se ve nada. */
  function verNumeros(s){ s=s===undefined?sesion():s; return !!(s && ROLES[s.r] && ROLES[s.r].numeros); }

  /* ---------- bitácora de seguridad ----------
     Solo agrega. Cada entrada lleva la huella de la anterior: si alguien
     borra o cambia una, la cadena se rompe y la verificación lo muestra. */
  var KB="eapos_bitacora";
  function huella(txt){ var h=0x811c9dc5; for(var i=0;i<txt.length;i++){ h^=txt.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; } return ("0000000"+h.toString(16)).slice(-8); }
  function bitacora(){ var b=leer(KB); return Array.isArray(b)?b:[]; }
  function registrar(e){
    var b=bitacora(), s=e.quien?null:sesion(), prev=b.length?b[b.length-1].h:"inicio";
    var x={ts:new Date().toISOString(), tipo:e.tipo, quien:e.quien||(s?s.n:"sin sesión"), rol:e.rol||(s?s.r:""), recurso:e.recurso||"", detalle:e.detalle||"",
      lugar:(function(){ try{ return location.pathname.split("/").slice(-2).join("/"); }catch(z){ return ""; } })()};
    x.h=huella(prev+"|"+x.ts+"|"+x.tipo+"|"+x.quien+"|"+x.recurso+"|"+x.detalle);
    b.push(x); if(b.length>1500) b=b.slice(-1500); guardar(KB,b); return x;
  }
  /* Revisa la cadena: devuelve el índice de la primera entrada alterada o -1. */
  function revisarBitacora(){ var b=bitacora(); for(var i=1;i<b.length;i++){ var x=b[i];
      if(x.h!==huella(b[i-1].h+"|"+x.ts+"|"+x.tipo+"|"+x.quien+"|"+x.recurso+"|"+x.detalle)) return i; } return -1; }

  /* ---------- exigir una acción (el "middleware" de cada operación) ----------
     Devuelve true si la sesión la tiene, o si un encargado la autorizó con su
     PIN hace menos de un minuto. Si no, registra el intento y devuelve false. */
  var AUT={};
  function autorizar(accion, por){ AUT[accion]={por:por, hasta:Date.now()+60e3}; registrar({tipo:"autorizado", recurso:accion, detalle:"autoriza "+por}); }
  function exigir(accion, recurso){
    var s=sesion();
    if(permite(accion,s)) return true;
    var a=AUT[accion]; if(a&&a.hasta>Date.now()){ delete AUT[accion]; registrar({tipo:"con_autorizacion", recurso:accion, detalle:(recurso||"")+" · autorizó "+a.por}); return true; }
    registrar({tipo:"denegado", recurso:accion, detalle:(recurso||"")+(s?"":" · sin sesión")});
    return false;
  }
  /* Personas que pueden autorizar una acción con su PIN. */
  function autorizadores(accion){ var a=ACCIONES[accion]; if(!a||!a.autoriza) return [];
    return EQUIPO.filter(function(p){ return a.roles.indexOf(p.r)>=0||(p.x||[]).indexOf(accion)>=0; }); }
  function validarAutorizacion(accion, nombre, pin){
    var p=persona(nombre); if(!p||autorizadores(accion).indexOf(p)<0) return Promise.resolve(false);
    return verificarPin(nombre,pin).then(function(ok){ if(ok){ autorizar(accion,nombre); return true; }
      registrar({tipo:"pin_fallido", recurso:accion, detalle:"autorización de "+nombre}); return false; }); }

  /* ---------- guardia de un módulo ----------
     Cada módulo la llama al cargar. Sin sesión o fuera del área del cargo,
     la página no se muestra: queda "403 · Acceso denegado" y el intento en la
     bitácora. Lanza un error marcado para que el resto del módulo no corra. */
  function guardia(modulo){
    var s=sesion();
    if(s&&puede(modulo,s)) return s;
    registrar({tipo:"denegado", recurso:"módulo "+modulo, detalle:s?"fuera del área de "+ROLES[s.r].n:"sin sesión"});
    var raiz=location.pathname.indexOf("/fila/")>=0||location.pathname.indexOf("/caja/")>=0||/\/(cocina|horno|panaderia|prueba|carta)\//.test(location.pathname)?"../":"";
    var html='<div style="min-height:100vh;display:grid;place-items:center;background:#0B1A1C;color:#F2F7F6;font:16px/1.5 system-ui,sans-serif;padding:24px;text-align:center">'+
      '<div style="max-width:420px"><div style="font:800 64px/1 system-ui;color:#FF6B5B">403</div><h1 style="margin:10px 0 6px;font-size:22px">Acceso denegado</h1>'+
      '<p style="margin:0 0 18px;color:#98ABA8">'+(s?esc(s.n)+", esta área no es parte de tu cargo ("+esc(ROLES[s.r].n)+"). El intento quedó registrado.":"Primero identifícate en el sistema con tu nombre y tu PIN.")+'</p>'+
      '<a href="'+raiz+'index.html" style="display:inline-block;padding:11px 18px;border-radius:12px;background:#40E0D0;color:#06201d;font-weight:800;text-decoration:none">Ir al inicio</a></div></div>';
    /* Se corta la carga: el resto de la página (y sus scripts) no se lee. */
    try{ window.stop(); }catch(e){}
    try{ document.body.innerHTML=html; document.title="403 · Acceso denegado"; document.documentElement.setAttribute("data-403",modulo); }catch(e){}
    var err=new Error("EAPOS 403: "+modulo); err.ea403=true;
    try{ window.addEventListener("error",function(ev){ if(ev.error&&ev.error.ea403) ev.preventDefault(); }); }catch(e){}
    throw err;
  }
  function esc(t){ return String(t==null?"":t).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

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
    MODULOS:MODULOS, ROLES:ROLES, EQUIPO:EQUIPO, COLOR_ROL:COLOR_ROL, ACCIONES:ACCIONES, ALIAS:ALIAS,
    hashPin:hashPin, pins:pins, guardarPin:guardarPin, borrarPin:borrarPin, verificarPin:verificarPin, tienePin:tienePin,
    hoyLocal:hoy, sesion:sesion, abrirSesion:abrirSesion, cerrarSesion:cerrarSesion, puede:puede, permite:permite, verNumeros:verNumeros, persona:persona,
    seguridad:{exigir:exigir, autorizadores:autorizadores, validarAutorizacion:validarAutorizacion, guardia:guardia, registrar:registrar, bitacora:bitacora, revisarBitacora:revisarBitacora},
    abrirEnSistema:abrirEnSistema, irA:irA,
    HORARIO:HORARIO, horario:horario, proximoHito:proximoHito, porHorario:porHorario, mesasAbiertas:mesasAbiertas, minutoDe:minutoDe, hhmm:hhmm
  };
})();
