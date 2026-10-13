/* ====================================================================
   Fila de espera y mesas
   --------------------------------------------------------------------
   La fila del local en un solo lugar (eapos_fila), por día:
   · grupos que esperan: para comer en el local (esperan mesa) o para
     llevar; cada uno con su número de turno, su pedido y su estado;
   · las mesas del salón: libres, ocupadas o llamadas (reservadas para el
     grupo al que se llamó);
   · el llamado en curso, que muestra la pantalla de llamado.
   El pedido de la fila se puede comandar antes de sentarse (sale a cocina,
   barra y horno como cualquier comanda) y se cobra en la Caja.
   Necesita nucleo/datos.js y nucleo/nucleo.js antes.
   ==================================================================== */
(function(){
  "use strict";
  var E=window.EAPOS; if(!E) throw new Error("Falta nucleo/nucleo.js antes de nucleo/fila.js");
  var K="eapos_fila";
  function hoy(){ return E.hoyLocal(); }
  function nid(p){ return p+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36); }
  function leer(){
    var f=E.leer(K); if(!f||typeof f!=="object") f={};
    if(!f.cfg||typeof f.cfg!=="object") f.cfg={};
    if(!(f.cfg.mesas>0)) f.cfg.mesas=12;          /* mesas del salón */
    if(!(f.cfg.espera>0)) f.cfg.espera=6;         /* minutos que se da al llamado antes de pasar al siguiente */
    if(!f.dias||typeof f.dias!=="object") f.dias={};
    return f;
  }
  function dia(f){ var d=f.dias[hoy()];
    if(!d) d=f.dias[hoy()]={seq:0, grupos:[], mesas:{}, llamado:null};
    if(!Array.isArray(d.grupos)) d.grupos=[]; if(!d.mesas||typeof d.mesas!=="object") d.mesas={};
    for(var i=1;i<=f.cfg.mesas;i++) if(!d.mesas[i]) d.mesas[i]={estado:"libre", grupo:null, desde:null};
    return d; }
  function guardar(f){ var ks=Object.keys(f.dias).sort(); while(ks.length>14) delete f.dias[ks.shift()];
    E.guardar(K,f); try{ E.canal&&E.canal.postMessage({t:K}); }catch(e){} }
  /* Toda operación sobre la fila exige su acción (nucleo.js); sin ella, 403 y
     queda en la bitácora. */
  function con(fn, accion, recurso){ if(E.seguridad&&!E.seguridad.exigir(accion||"fila.operar", recurso||"fila")) return null; var f=leer(), d=dia(f), r=fn(d,f); guardar(f); return r; }
  function buscar(d,id){ return d.grupos.filter(function(g){ return g.id===id; })[0]||null; }

  /* ---------- lectura ---------- */
  function estado(){ var f=leer(); return {cfg:f.cfg, dia:dia(f)}; }
  function grupos(){ return estado().dia.grupos.slice(); }
  /* Esperan mesa, en orden de llegada (los llamados primero). */
  function esperanMesa(){ return grupos().filter(function(g){ return g.destino==="mesa"&&(g.estado==="esperando"||g.estado==="llamado"); })
    .sort(function(a,b){ return (a.estado==="llamado"?0:1)-(b.estado==="llamado"?0:1)||(a.post||0)-(b.post||0)||a.num-b.num; }); }
  function llevar(){ return grupos().filter(function(g){ return g.destino==="llevar"&&(g.estado==="esperando"||g.estado==="listo"); }); }
  function mesas(){ var e=estado(), o=[]; for(var i=1;i<=e.cfg.mesas;i++) o.push(Object.assign({n:i},e.dia.mesas[i])); return o; }
  function mesasLibres(){ return mesas().filter(function(m){ return m.estado==="libre"; }); }
  function siguiente(){ return esperanMesa().filter(function(g){ return g.estado==="esperando"; })[0]||null; }
  function llamado(){ return estado().dia.llamado; }

  /* ---------- grupos ---------- */
  function anotar(o, por){ return con(function(d){
    d.seq++; var g={id:nid("g"), num:d.seq, nombre:String(o.nombre||"").trim().slice(0,40)||("Turno "+d.seq), pax:Math.max(1,Math.min(30,o.pax|0||1)),
      tel:String(o.tel||"").replace(/[^0-9+]/g,"").slice(0,16), destino:o.destino==="llevar"?"llevar":"mesa", ts:new Date().toISOString(), por:por||"",
      estado:"esperando", pedido:null, mesa:null, llamado:null, llamadas:0, sentado:null, cobrado:null};
    d.grupos.push(g); return g; }); }
  function cambiar(id, cambios){ return con(function(d){ var g=buscar(d,id); if(g) Object.assign(g,cambios); return g; }); }
  /* ---------- pedido en rondas ----------
     El pedido de un grupo (mesa, para llevar o fila) se arma en rondas: cada
     ronda sale a Comandas como una comanda propia, y la mesa puede seguir
     pidiendo. pedido.lineas es la suma de todas las rondas (lo que se cobra);
     pedido.enviado, la hora de la primera ronda que salió.
     Línea: {id, n, q, p, mod:[{id,n,p}], nota}. */
  function clave(l){ return l.id+"|"+(l.mod||[]).map(function(m){ return m.id+":"+m.n; }).join(",")+"|"+(l.nota||""); }
  function sumar(rondas){ var por={}, out=[];
    rondas.forEach(function(r){ (r.lineas||[]).forEach(function(l){ var k=clave(l);
      if(por[k]) por[k].q+=l.q; else { por[k]=Object.assign({},l,{mod:(l.mod||[]).slice()}); out.push(por[k]); } }); });
    return out; }
  function rehacer(g){ var p=g.pedido; if(!p) return;
    if(!Array.isArray(p.rondas)) p.rondas=[{n:1, lineas:p.lineas||[], ts:p.ts, cuando:p.cuando, enviado:p.enviado||null, por:""}];
    p.rondas=p.rondas.filter(function(r){ return r.lineas&&r.lineas.length; });
    p.rondas.forEach(function(r,i){ r.n=i+1; });
    p.lineas=sumar(p.rondas);
    var env=p.rondas.filter(function(r){ return r.enviado; }).map(function(r){ return r.enviado; }).sort();
    p.enviado=env[0]||null;
    if(!p.rondas.length) g.pedido=null; }
  /* Reemplaza todo el pedido (una sola ronda). Cambiar lo ya enviado lo hace
     o lo autoriza un encargado. */
  function pedir(id, lineas, cuando, codigo){
    var g0=buscar(dia(leer()),id), yaEnviado=!!(g0&&g0.pedido&&g0.pedido.enviado);
    return con(function(d){ var g=buscar(d,id); if(!g) return null;
    var ya=g.pedido&&g.pedido.enviado, ts=new Date().toISOString();
    g.pedido={lineas:lineas, ts:ts, cuando:cuando==="ahora"?"ahora":"despues", codigo:codigo||"", enviado:null,
      rondas:[{n:1, lineas:lineas, ts:ts, cuando:cuando==="ahora"?"ahora":"despues", enviado:ya||(cuando==="ahora"?ts:null), por:""}]};
    rehacer(g); return g; }, yaEnviado?"fila.cambiarComandado":"fila.operar", yaEnviado?"pedido ya comandado de Nº "+g0.num:"pedido"); }
  /* Agrega una ronda. Sale ya a Comandas si es "ahora" o si el grupo ya está
     sentado o es para llevar; si espera mesa, sale al sentarse. */
  function ronda(id, lineas, cuando, por){
    if(!lineas||!lineas.length) return null;
    return con(function(d){ var g=buscar(d,id); if(!g) return null;
      var ts=new Date().toISOString(), sale=cuando==="ahora"||g.estado==="sentado"||(g.destino==="llevar"&&cuando!=="despues");
      if(!g.pedido) g.pedido={lineas:[], ts:ts, cuando:"ahora", codigo:"", enviado:null, rondas:[]};
      rehacer(g); if(!g.pedido) g.pedido={lineas:[], ts:ts, cuando:"ahora", codigo:"", enviado:null, rondas:[]};
      g.pedido.rondas.push({n:g.pedido.rondas.length+1, lineas:lineas.map(function(l){ return {id:l.id, n:l.n, q:l.q, p:l.p, mod:(l.mod||[]).slice(), nota:l.nota||""}; }),
        ts:ts, cuando:sale?"ahora":"despues", enviado:sale?ts:null, por:por||""});
      g.cobrado=null; rehacer(g); return g; }, "pedido.tomar", "ronda"); }
  /* Quita una línea de una ronda: si la ronda ya salió a cocina, lo hace o lo
     autoriza un encargado. */
  function quitar(id, n, i){
    var g0=buscar(dia(leer()),id), r0=g0&&g0.pedido&&(rehacer(g0),g0.pedido)&&g0.pedido.rondas[n-1], enviada=!!(r0&&r0.enviado);
    return con(function(d){ var g=buscar(d,id); if(!g||!g.pedido) return null; rehacer(g);
      var r=g.pedido.rondas[n-1]; if(!r||!r.lineas[i]) return null;
      if(r.lineas[i].q>1) r.lineas[i].q--; else r.lineas.splice(i,1);
      rehacer(g); return g; }, enviada?"fila.cambiarComandado":"pedido.tomar", enviada?"quitar de una ronda ya enviada":"ronda"); }
  /* Manda a Comandas las rondas que esperaban. */
  function comandar(id){ return con(function(d){ var g=buscar(d,id); if(!g||!g.pedido) return g; rehacer(g); var ts=new Date().toISOString();
    g.pedido.rondas.forEach(function(r){ if(!r.enviado) r.enviado=ts; }); rehacer(g); return g; }); }
  /* Lo que falta cobrar: las rondas que todavía no pasaron por la Caja. */
  function porCobrar(g){ if(!g||!g.pedido) return []; var p=g.pedido, rs=Array.isArray(p.rondas)?p.rondas:[{lineas:p.lineas, cobrado:g.cobrado}];
    return sumar(rs.filter(function(r){ return !r.cobrado&&!(g.cobrado&&!Array.isArray(p.rondas)); })); }
  function totalLineas(ls){ return (ls||[]).reduce(function(a,l){ return a+((l.p||0)+(l.mod||[]).reduce(function(b,m){ return b+(m.p||0); },0))*l.q; },0); }
  /* Cuentas abiertas: grupos con algo por cobrar (mesas, para llevar y fila). */
  function cuentas(){ return grupos().filter(function(g){ return g.estado!=="se_fue"&&porCobrar(g).length; })
    .map(function(g){ var ls=porCobrar(g); return {grupo:g, lineas:ls, total:totalLineas(ls)}; }); }
  function marcarListo(id){ return cambiar(id,{estado:"listo", listo:new Date().toISOString()}); }
  function retirar(id, motivo){ return con(function(d){ var g=buscar(d,id); if(!g) return null;
    g.estado=motivo==="entregado"?"entregado":"se_fue"; g.fin=new Date().toISOString();
    if(d.llamado&&d.llamado.grupo===id) d.llamado=null;
    for(var m in d.mesas) if(d.mesas[m].grupo===id&&d.mesas[m].estado==="llamada") d.mesas[m]={estado:"libre", grupo:null, desde:null};
    return g; }); }
  function marcarCobrado(id, venta){ return con(function(d){ var g=buscar(d,id); if(g){ var ts=new Date().toISOString(); g.cobrado=ts; g.venta=venta||"";
    if(g.pedido&&Array.isArray(g.pedido.rondas)) g.pedido.rondas.forEach(function(r){ if(!r.cobrado){ r.cobrado=ts; r.venta=venta||""; } }); } return g; }, "venta.cobrar", "cobro de la fila"); }

  /* ---------- mesas y llamados ---------- */
  /* Llama a un grupo para una mesa: la mesa queda guardada para él y la
     campana del sistema lo avisa (y WhatsApp, si dejó teléfono). */
  function llamar(id, mesa){ return con(function(d){ var g=buscar(d,id); if(!g) return null;
    if(mesa){ if(g.mesa&&g.mesa!==mesa&&d.mesas[g.mesa]&&d.mesas[g.mesa].estado==="llamada") d.mesas[g.mesa]={estado:"libre", grupo:null, desde:null};
      g.mesa=mesa; d.mesas[mesa]={estado:"llamada", grupo:id, desde:new Date().toISOString()}; }
    g.estado=g.destino==="mesa"?"llamado":g.estado; g.llamado=new Date().toISOString(); g.llamadas=(g.llamadas||0)+1;
    d.llamado={grupo:id, num:g.num, nombre:g.nombre, mesa:g.mesa||null, destino:g.destino, ts:g.llamado, vez:g.llamadas};
    return g; }); }
  function sentar(id, mesa){ return con(function(d){ var g=buscar(d,id); if(!g) return null; mesa=mesa||g.mesa; if(!mesa) return null;
    for(var m in d.mesas) if(d.mesas[m].grupo===id&&+m!==+mesa&&d.mesas[m].estado==="llamada") d.mesas[m]={estado:"libre", grupo:null, desde:null};
    g.mesa=+mesa; g.estado="sentado"; g.sentado=new Date().toISOString();
    if(g.pedido){ rehacer(g); g.pedido.rondas.forEach(function(r){ if(!r.enviado) r.enviado=g.sentado; }); rehacer(g); }     /* lo pedido en la fila sale a cocina al sentarse */
    d.mesas[mesa]={estado:"ocupada", grupo:id, desde:g.sentado};
    if(d.llamado&&d.llamado.grupo===id) d.llamado=null;
    return g; }); }
  /* Sienta a alguien que llegó sin pasar por la fila. */
  function ocupar(mesa, pax){ var g=anotar({nombre:"Mesa "+mesa, pax:pax||2, destino:"mesa"}); return g?sentar(g.id, mesa):null; }
  /* Libera la mesa; el grupo que estaba termina. Devuelve el siguiente en la fila, si hay. */
  function liberar(mesa){ con(function(d){ var x=d.mesas[mesa]; if(!x) return;
      if(x.grupo){ var g=buscar(d,x.grupo); if(g&&g.estado==="sentado"){ g.estado="termino"; g.fin=new Date().toISOString(); }
        if(g&&x.estado==="llamada"){ g.estado="esperando"; g.mesa=null; } }
      d.mesas[mesa]={estado:"libre", grupo:null, desde:null}; });
    return siguiente(); }
  function cerrarLlamado(){ return con(function(d){ d.llamado=null; }); }
  function ajustes(c){ if(E.seguridad&&!E.seguridad.exigir("fila.ajustes")) return null; var f=leer(); if(c.mesas>0) f.cfg.mesas=Math.min(40,Math.max(1,c.mesas|0)); if(c.espera>0) f.cfg.espera=Math.min(30,c.espera|0); dia(f); guardar(f); return f.cfg; }

  /* ---------- comandas ----------
     Las comandas del día: ventas de la Caja más los pedidos de la fila ya
     comandados. Una venta que cobra un pedido de la fila ya comandado no se
     vuelve a comandar. */
  function comandables(){
    var pos=E.leer("ea_pos")||{}, vs=Array.isArray(pos.ventas)?pos.ventas:[], f=hoy(), out=[];
    vs.forEach(function(v){ if(v.anulada||E.hoyLocal(new Date(v.ts))!==f) return; if(v.fila&&v.fila.comandado) return; out.push(v); });
    grupos().forEach(function(g){ if(!g.pedido) return; var p=g.pedido, rs=Array.isArray(p.rondas)?p.rondas:[{n:1, lineas:p.lineas, enviado:p.enviado}];
      var resp=(g.destino==="llevar"?"Para llevar":g.estado==="sentado"&&/^Mesa /.test(g.nombre)?"Mesa":"Fila")+" · Nº "+g.num+" "+g.nombre+(g.mesa?" · mesa "+g.mesa:"");
      rs.forEach(function(r){ if(!r.enviado||!r.lineas||!r.lineas.length) return;
        out.push({id:"F"+g.id+(r.n>1?"-"+r.n:""), ts:r.enviado, modo:g.destino==="llevar"?"llevar":"local", resp:resp+(rs.length>1?" · ronda "+r.n:""), lineas:r.lineas, fila:true}); }); });
    return out.sort(function(a,b){ return a.ts<b.ts?-1:1; });
  }

  /* ---------- a la Caja ----------
     El pedido pasa a la Caja para cobrarlo; la Caja lo toma apenas su cuenta
     está vacía. */
  function aCaja(id){ if(E.seguridad&&!E.seguridad.exigir("fila.operar","enviar a la Caja")) return null; var g=buscar(dia(leer()),id); if(!g||!g.pedido) return null;
    /* Lo que se cobra ya se prepara: las rondas que esperaban salen a Comandas. */
    if(g.pedido.rondas&&g.pedido.rondas.some(function(r){ return !r.enviado; })) g=comandar(id)||g;
    var ls=porCobrar(g); if(!ls.length) return null;
    var t={ts:new Date().toISOString(), grupo:g.id, num:g.num, nombre:g.nombre, mesa:g.mesa, modo:g.destino==="llevar"?"llevar":"local",
      comandado:true, lineas:ls.map(function(l){ return {id:l.id, q:l.q, mod:(l.mod||[]).slice(), nota:l.nota||""}; })};
    E.guardar("eapos_traspaso",t); try{ E.canal&&E.canal.postMessage({t:"eapos_traspaso"}); }catch(e){}
    return t; }

  /* Mensaje de WhatsApp para avisar que la mesa está lista. */
  function whatsapp(g){ var t=String(g.tel||"").replace(/[^0-9]/g,""); if(!t) return "";
    if(t.length===8) t="569"+t; else if(t.length===9&&t.charAt(0)==="9") t="56"+t;
    var m=g.destino==="llevar"? "Hola "+g.nombre+", tu pedido en Emporio Andino está listo (turno "+g.num+"). Te esperamos en el mesón."
      : "Hola "+g.nombre+", tu mesa en Emporio Andino está lista"+(g.mesa?" (mesa "+g.mesa+")":"")+". Te esperamos (turno "+g.num+").";
    return "https://wa.me/"+t+"?text="+encodeURIComponent(m); }

  E.fila={clave:K, estado:estado, grupos:grupos, esperanMesa:esperanMesa, llevar:llevar, mesas:mesas, mesasLibres:mesasLibres, siguiente:siguiente, llamado:llamado,
    anotar:anotar, cambiar:cambiar, pedir:pedir, ronda:ronda, quitar:quitar, comandar:comandar, porCobrar:porCobrar, cuentas:cuentas, total:totalLineas, marcarListo:marcarListo, retirar:retirar, marcarCobrado:marcarCobrado,
    llamar:llamar, sentar:sentar, ocupar:ocupar, liberar:liberar, cerrarLlamado:cerrarLlamado, ajustes:ajustes,
    comandables:comandables, aCaja:aCaja, whatsapp:whatsapp};
})();
