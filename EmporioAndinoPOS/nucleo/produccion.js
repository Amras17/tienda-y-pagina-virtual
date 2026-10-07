/* ====================================================================
   Producción de empanadas: Panadería → Horno → Vitrina
   --------------------------------------------------------------------
   Un solo lugar para lo que comparten la Panadería, el Horno, el Control
   de Salón, la Caja y el sistema general:

   · ea_control (el de siempre): estado de la carta, unidades en vitrina
     (uni["E"+id]) y lo que está en el horno (horno[], una entrada por
     variedad con su reloj). Se reinicia cada día con la fecha LOCAL.
   · eapos_panaderia: el plan por latas, los pedidos que la Panadería manda
     al Horno (y las solicitudes del Horno por confirmar), lo que el Horno
     recibe y el precocido que queda para el día siguiente.
   · eapos_horno: las tandas del día, quién espera la próxima tanda y los
     ajustes del horno (capacidad y minutos de cocción).

   Cada operación lee lo último guardado, cambia lo suyo y guarda: así dos
   pantallas abiertas en el mismo equipo no se pisan.
   Necesita nucleo/datos.js y nucleo/nucleo.js antes.
   ==================================================================== */
(function(){
  "use strict";
  var E=window.EAPOS; if(!E) throw new Error("Falta nucleo/nucleo.js antes de nucleo/produccion.js");
  var LATA=15;
  var K={control:"ea_control", pan:"eapos_panaderia", horno:"eapos_horno"};
  /* Variedades de empanada, en el orden de la carta. */
  var EMP=(window.EA_DATOS.EMP||[]).map(function(e){ return {id:e.id, k:"E"+e.id, n:typeof e.n==="string"?e.n:(e.n&&(e.n.es||e.n.en))||e.id, p:e.p}; });
  var POR_ID={}; EMP.forEach(function(e){ POR_ID[e.id]=e; });
  function nombre(id){ return (POR_ID[id]||{}).n||id; }

  function leer(k){ return E.leer(k); }
  function guardar(k,v){ E.guardar(k,v); try{ if(E.canal) E.canal.postMessage({t:k}); }catch(e){} }
  function hoy(){ return E.hoyLocal(); }
  function diaAntes(f){ var d=new Date(f+"T12:00:00"); d.setDate(d.getDate()-1); return E.hoyLocal(d); }
  function suma(o){ var n=0; for(var k in o) n+=(+o[k]||0); return n; }
  function nid(p){ return p+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36); }

  /* ---------- vitrina y horno (ea_control) ---------- */
  function control(){
    var c=leer(K.control); if(!c||typeof c!=="object") c={};
    if(c.fecha!==hoy()){ c={fecha:hoy(), st:{}, emp:{}, uni:{}, milks:c.milks||{}, decaf:1, tocado:"", son:typeof c.son==="number"?c.son:1, horno:[]}; }
    if(!c.st||typeof c.st!=="object") c.st={};
    if(!c.uni||typeof c.uni!=="object") c.uni={};
    if(!Array.isArray(c.horno)) c.horno=[];
    return c;
  }
  function guardarControl(c){ c.tocado=new Date().toISOString(); guardar(K.control,c); }
  function vitrina(c){ c=c||control(); var o={}; EMP.forEach(function(e){ var u=c.uni[e.k]; o[e.id]=typeof u==="number"?Math.max(0,u):null; }); return o; }
  function totalVitrina(c){ var v=vitrina(c), n=0; for(var k in v) n+=v[k]||0; return n; }
  /* Corrige a mano lo que hay en la vitrina (contar y anotar). */
  function fijarVitrina(id, n){ var c=control(), e=POR_ID[id]; if(!e) return;
    c.uni[e.k]=Math.max(0, n|0); if(c.uni[e.k]>0) delete c.st[e.k]; else c.st[e.k]="off"; guardarControl(c); }

  /* ---------- registro del horno (eapos_horno) ---------- */
  function hornoLog(){
    var h=leer(K.horno); if(!h||typeof h!=="object") h={};
    if(!h.cfg||typeof h.cfg!=="object") h.cfg={};
    if(!(h.cfg.cap>0)) h.cfg.cap=4*LATA;          /* capacidad: 4 latas */
    if(!(h.cfg.min>0)) h.cfg.min=20;               /* cocción: 20 minutos */
    if(!(h.cfg.minimo>=0)) h.cfg.minimo=12;        /* mínimo en vitrina */
    if(!h.dias||typeof h.dias!=="object") h.dias={};
    return h;
  }
  function diaHorno(h,f){ f=f||hoy(); var d=h.dias[f]; if(!d){ d=h.dias[f]={tandas:[], espera:[]}; }
    if(!Array.isArray(d.tandas)) d.tandas=[]; if(!Array.isArray(d.espera)) d.espera=[]; return d; }
  function podar(o, n){ var ks=Object.keys(o).sort(); while(ks.length>n){ delete o[ks.shift()]; } }
  function guardarHorno(h){ podar(h.dias,21); guardar(K.horno,h); }
  function ajustesHorno(){ return hornoLog().cfg; }
  function fijarAjustesHorno(cfg){ var h=hornoLog(); for(var k in cfg) if(+cfg[k]>=0) h.cfg[k]=+cfg[k]; guardarHorno(h); }
  function tandas(f){ return diaHorno(hornoLog(),f).tandas; }
  function enHorno(c){ c=c||control(); var ahora=Date.now(), n=0; c.horno.forEach(function(x){ if(new Date(x.eta).getTime()>ahora) n+=x.n; }); return n; }

  /* Mete una tanda: varias variedades con el mismo reloj. items = {id: unidades}. */
  function hornear(items, min, por){
    var c=control(), h=hornoLog(), d=diaHorno(h), total=0, it={};
    for(var id in items){ var n=Math.max(0,Math.round(+items[id]||0)); if(n&&POR_ID[id]){ it[id]=n; total+=n; } }
    if(!total) return {error:"vacia"};
    if(enHorno(c)+total>h.cfg.cap) return {error:"capacidad", libre:Math.max(0,h.cfg.cap-enHorno(c))};
    min=Math.max(1,Math.min(90,Math.round(+min||h.cfg.min)));
    var ahora=new Date(), eta=new Date(ahora.getTime()+min*60000), t={id:nid("t"), n:d.tandas.length+1, items:it, total:total, min:min, desde:ahora.toISOString(), eta:eta.toISOString(), por:por||"", salio:null};
    d.tandas.push(t);
    for(var k in it) c.horno.push({id:nid("h"), emp:k, n:it[k], desde:t.desde, eta:t.eta, tanda:t.id});
    guardarHorno(h); guardarControl(c);
    return {ok:true, tanda:t};
  }
  /* Lo que cumplió su tiempo pasa a la vitrina. Devuelve las tandas que salieron. */
  function revisar(){
    var c=control(), ahora=Date.now(), listas=c.horno.filter(function(x){ return new Date(x.eta).getTime()<=ahora; });
    if(!listas.length) return [];
    listas.forEach(function(x){ var k="E"+x.emp; c.uni[k]=Math.max(0,+(c.uni[k])||0)+x.n; delete c.st[k]; });
    c.horno=c.horno.filter(function(x){ return listas.indexOf(x)<0; });
    guardarControl(c);
    var h=hornoLog(), d=diaHorno(h), salieron=[], vistas={};
    listas.forEach(function(x){ var t=d.tandas.filter(function(y){ return y.id===x.tanda; })[0];
      if(t&&!t.salio){ t.salio=new Date().toISOString(); }
      var key=x.tanda||x.id; if(!vistas[key]){ vistas[key]={tanda:t||null, items:{}}; salieron.push(vistas[key]); }
      vistas[key].items[x.emp]=(vistas[key].items[x.emp]||0)+x.n; });
    guardarHorno(h);
    return salieron;
  }
  /* Saca ya una tanda (salió antes del reloj). */
  function sacarYa(tandaId){
    var c=control(), cambio=false; c.horno.forEach(function(x){ if(x.tanda===tandaId||x.id===tandaId){ x.eta=new Date(Date.now()-1000).toISOString(); cambio=true; } });
    if(cambio){ guardarControl(c); return revisar(); } return [];
  }
  /* Quién espera la próxima tanda: {id, ts, nombre, items:{id:n}|null, n, pagado, entregado}. */
  function esperar(nombreCli, items, n, pagado){ var h=hornoLog(), d=diaHorno(h);
    var e={id:nid("w"), ts:new Date().toISOString(), nombre:String(nombreCli||"").slice(0,40), items:items||null, n:n||suma(items||{}), pagado:!!pagado, entregado:null};
    d.espera.push(e); guardarHorno(h); return e; }
  function entregar(id){ var h=hornoLog(), d=diaHorno(h); d.espera.forEach(function(e){ if(e.id===id) e.entregado=new Date().toISOString(); }); guardarHorno(h); }
  function espera(){ return diaHorno(hornoLog()).espera.filter(function(e){ return !e.entregado; }); }

  /* ---------- panadería (eapos_panaderia) ---------- */
  function pan(){
    var p=leer(K.pan); if(!p||typeof p!=="object") p={};
    if(!p.defecto||typeof p.defecto!=="object") p.defecto={};
    if(!p.dias||typeof p.dias!=="object") p.dias={};
    if(!p.esc||typeof p.esc!=="object") p.esc={};
    return p;
  }
  function diaPan(p,f){ f=f||hoy(); var d=p.dias[f]; if(!d) d=p.dias[f]={pedidos:[], precocido:null};
    if(!Array.isArray(d.pedidos)) d.pedidos=[]; return d; }
  function guardarPan(p){ podar(p.dias,30); guardar(K.pan,p); }
  /* Plan de cada día: 6 latas de pino y 2 de cada otra variedad, salvo que
     la Panadería lo cambie. */
  function planDefecto(){ var p=pan(), o={}; EMP.forEach(function(e){ var v=p.defecto[e.id]; o[e.id]=typeof v==="number"?v:(e.id==="e-pino"?6:2); }); return o; }
  function fijarPlanDefecto(o){ var p=pan(); EMP.forEach(function(e){ if(typeof o[e.id]==="number") p.defecto[e.id]=Math.max(0,Math.min(40,Math.round(o[e.id]))); }); guardarPan(p); }
  function pedidos(f){ return diaPan(pan(),f).pedidos.slice(); }
  /* tipo: "plan" (lo manda la Panadería) o "solicitud" (la pide el Horno por
     sobredemanda; queda "por_confirmar" hasta que la Panadería responde).
     items: {id: latas}. */
  function nuevoPedido(tipo, items, por, nota){
    var p=pan(), d=diaPan(p), it={}; for(var id in items){ var n=Math.max(0,Math.round(+items[id]||0)); if(n&&POR_ID[id]) it[id]=n; }
    if(!suma(it)) return null;
    var x={id:nid("p"), n:d.pedidos.length+1, tipo:tipo==="solicitud"?"solicitud":"plan", items:it, ts:new Date().toISOString(), por:por||"", nota:String(nota||"").slice(0,140),
      estado:tipo==="solicitud"?"por_confirmar":"enviado", conf:null, rec:null};
    d.pedidos.push(x); guardarPan(p); return x;
  }
  function buscar(d,id){ return d.pedidos.filter(function(x){ return x.id===id; })[0]||null; }
  /* La Panadería confirma una solicitud (puede cambiar las latas) y la manda. */
  function confirmar(id, items, por){ var p=pan(), d=diaPan(p), x=buscar(d,id); if(!x||x.estado!=="por_confirmar") return null;
    if(items){ var it={}; for(var k in items){ var n=Math.max(0,Math.round(+items[k]||0)); if(n&&POR_ID[k]) it[k]=n; } if(suma(it)) x.items=it; }
    x.estado="enviado"; x.conf={ts:new Date().toISOString(), por:por||""}; guardarPan(p); return x; }
  function rechazar(id, motivo, por){ var p=pan(), d=diaPan(p), x=buscar(d,id); if(!x||x.estado!=="por_confirmar") return null;
    x.estado="rechazado"; x.conf={ts:new Date().toISOString(), por:por||"", motivo:String(motivo||"").slice(0,140)}; guardarPan(p); return x; }
  function anular(id, por){ var p=pan(), d=diaPan(p), x=buscar(d,id); if(!x||(x.estado!=="enviado"&&x.estado!=="por_confirmar")) return null;
    x.estado="anulado"; x.conf={ts:new Date().toISOString(), por:por||""}; guardarPan(p); return x; }
  /* El Horno (cocina) registra lo que llegó, en unidades, y confirma. */
  function recibir(id, unidades, por){ var p=pan(), d=diaPan(p), x=buscar(d,id); if(!x||x.estado!=="enviado") return null;
    var u={}; for(var k in x.items) u[k]=x.items[k]*LATA; if(unidades) for(var j in unidades){ if(POR_ID[j]) u[j]=Math.max(0,Math.round(+unidades[j]||0)); }
    x.estado="recibido"; x.rec={ts:new Date().toISOString(), por:por||"", u:u}; guardarPan(p); return x; }
  /* Precocido: lo que queda armado y sin hornear al cierre; parte del día siguiente. */
  function precocido(f){ return diaPan(pan(),f).precocido; }
  function reportarPrecocido(items, por){ var p=pan(), d=diaPan(p), it={};
    EMP.forEach(function(e){ var n=Math.max(0,Math.round(+(items||{})[e.id]||0)); if(n) it[e.id]=n; });
    d.precocido={ts:new Date().toISOString(), por:por||"", items:it}; guardarPan(p); return d.precocido; }
  function precocidoAyer(){ return precocido(diaAntes(hoy())); }

  /* Por hornear hoy, por variedad: lo precocido de ayer + lo recibido hoy −
     lo que ya entró al horno. */
  function porHornear(){
    var o={}, ay=precocidoAyer(), ped=pedidos(), tt=tandas();
    EMP.forEach(function(e){ o[e.id]=0; });
    if(ay&&ay.items) for(var k in ay.items) if(k in o) o[k]+=ay.items[k];
    ped.forEach(function(x){ if(x.estado==="recibido"&&x.rec) for(var k in x.rec.u) if(k in o) o[k]+=x.rec.u[k]; });
    tt.forEach(function(t){ for(var k in t.items) if(k in o) o[k]-=t.items[k]; });
    return o;
  }
  function totalPorHornear(){ var o=porHornear(), n=0; for(var k in o) n+=Math.max(0,o[k]); return n; }
  function porRecibir(){ return pedidos().filter(function(x){ return x.estado==="enviado"; }); }
  function porConfirmar(){ return pedidos().filter(function(x){ return x.estado==="por_confirmar"; }); }

  /* ---------- vendidas hoy por variedad (Caja) ---------- */
  function vendidasHoy(){
    var pos=leer("ea_pos")||{}, vs=Array.isArray(pos.ventas)?pos.ventas:[], o={}, f=hoy();
    EMP.forEach(function(e){ o[e.id]=0; });
    vs.forEach(function(v){ if(v.anulada||E.hoyLocal(new Date(v.ts))!==f) return;
      (v.lineas||[]).forEach(function(l){ if(l.id&&l.id.charAt(0)==="E"){ var id=l.id.slice(1); if(id in o) o[id]+=(+l.q||0); } }); });
    return o;
  }
  /* Qué conviene hornear ahora, como lo haría cocina en la Prueba: primero lo
     que alguien espera, después hasta tres variedades de las que más faltan
     según lo que se vende, sin pasar la capacidad ni lo que hay por hornear. */
  function sugerencia(){
    var h=hornoLog(), c=control(), libre=Math.max(0,h.cfg.cap-enHorno(c)), vit=vitrina(c), ven=vendidasHoy(), crudo=porHornear(), pide={};
    espera().forEach(function(e){ if(e.items) for(var k in e.items) pide[k]=(pide[k]||0)+e.items[k]; });
    var sw=0; EMP.forEach(function(e){ sw+=ven[e.id]+(e.id==="e-pino"?3:1); });
    var orden=EMP.map(function(e){ var w=ven[e.id]+(e.id==="e-pino"?3:1), v=vit[e.id]||0;
      return {e:e, p:(pide[e.id]&&pide[e.id]>v?100:0)+w/(v+1)}; }).sort(function(a,b){ return b.p-a.p; });
    var items={}, n=0, total=0;
    orden.forEach(function(o){ if(n>=3) return; var id=o.e.id, disp=Math.max(0,crudo[id]); if(!disp) return;
      var u=Math.min(disp, Math.max(pide[id]||0, LATA)); if(total+u>libre) u=libre-total; if(u<=0) return;
      items[id]=u; total+=u; n++; });
    return {items:items, total:total, libre:libre};
  }

  E.prod={
    LATA:LATA, EMP:EMP, nombre:nombre, claves:K, diaAntes:diaAntes,
    control:control, guardarControl:guardarControl, vitrina:vitrina, totalVitrina:totalVitrina, fijarVitrina:fijarVitrina,
    ajustesHorno:ajustesHorno, fijarAjustesHorno:fijarAjustesHorno, tandas:tandas, enHorno:enHorno, hornear:hornear, revisar:revisar, sacarYa:sacarYa,
    esperar:esperar, entregar:entregar, espera:espera,
    planDefecto:planDefecto, fijarPlanDefecto:fijarPlanDefecto, pedidos:pedidos, nuevoPedido:nuevoPedido, confirmar:confirmar, rechazar:rechazar, anular:anular, recibir:recibir,
    precocido:precocido, reportarPrecocido:reportarPrecocido, precocidoAyer:precocidoAyer, porHornear:porHornear, totalPorHornear:totalPorHornear,
    porRecibir:porRecibir, porConfirmar:porConfirmar, vendidasHoy:vendidasHoy, sugerencia:sugerencia,
    escandalloPropio:function(){ return pan().esc; },
    fijarEscandallo:function(id, ing){ var p=pan(); if(ing) p.esc[id]=ing; else delete p.esc[id]; guardarPan(p); }
  };
})();
