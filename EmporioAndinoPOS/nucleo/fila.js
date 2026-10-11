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
  /* Pedido: lineas [{id,n,q,p}], comanda "ahora" (sale ya a cocina y barra) o
     "despues" (al sentarse o al llegar al mesón). */
  function pedir(id, lineas, cuando, codigo){
    var g0=buscar(dia(leer()),id), yaEnviado=!!(g0&&g0.pedido&&g0.pedido.enviado);
    return con(function(d){ var g=buscar(d,id); if(!g) return null;
    var ya=g.pedido&&g.pedido.enviado;
    g.pedido={lineas:lineas, ts:new Date().toISOString(), cuando:cuando==="ahora"?"ahora":"despues", codigo:codigo||"", enviado:ya||null};
    if(cuando==="ahora"&&!ya) g.pedido.enviado=new Date().toISOString();
    return g; }, yaEnviado?"fila.cambiarComandado":"fila.operar", yaEnviado?"pedido ya comandado de Nº "+g0.num:"pedido"); }
  function comandar(id){ return con(function(d){ var g=buscar(d,id); if(g&&g.pedido&&!g.pedido.enviado) g.pedido.enviado=new Date().toISOString(); return g; }); }
  function marcarListo(id){ return cambiar(id,{estado:"listo", listo:new Date().toISOString()}); }
  function retirar(id, motivo){ return con(function(d){ var g=buscar(d,id); if(!g) return null;
    g.estado=motivo==="entregado"?"entregado":"se_fue"; g.fin=new Date().toISOString();
    if(d.llamado&&d.llamado.grupo===id) d.llamado=null;
    for(var m in d.mesas) if(d.mesas[m].grupo===id&&d.mesas[m].estado==="llamada") d.mesas[m]={estado:"libre", grupo:null, desde:null};
    return g; }); }
  function marcarCobrado(id, venta){ return con(function(d){ var g=buscar(d,id); if(g){ g.cobrado=new Date().toISOString(); g.venta=venta||""; } return g; }, "venta.cobrar", "cobro de la fila"); }

  /* ---------- mesas y llamados ---------- */
  /* Llama a un grupo para una mesa: la mesa queda guardada para él y la
     pantalla de llamado lo muestra. */
  function llamar(id, mesa){ return con(function(d){ var g=buscar(d,id); if(!g) return null;
    if(mesa){ if(g.mesa&&g.mesa!==mesa&&d.mesas[g.mesa]&&d.mesas[g.mesa].estado==="llamada") d.mesas[g.mesa]={estado:"libre", grupo:null, desde:null};
      g.mesa=mesa; d.mesas[mesa]={estado:"llamada", grupo:id, desde:new Date().toISOString()}; }
    g.estado=g.destino==="mesa"?"llamado":g.estado; g.llamado=new Date().toISOString(); g.llamadas=(g.llamadas||0)+1;
    d.llamado={grupo:id, num:g.num, nombre:g.nombre, mesa:g.mesa||null, destino:g.destino, ts:g.llamado, vez:g.llamadas};
    return g; }); }
  function sentar(id, mesa){ return con(function(d){ var g=buscar(d,id); if(!g) return null; mesa=mesa||g.mesa; if(!mesa) return null;
    for(var m in d.mesas) if(d.mesas[m].grupo===id&&+m!==+mesa&&d.mesas[m].estado==="llamada") d.mesas[m]={estado:"libre", grupo:null, desde:null};
    g.mesa=+mesa; g.estado="sentado"; g.sentado=new Date().toISOString();
    if(g.pedido&&!g.pedido.enviado) g.pedido.enviado=g.sentado;     /* lo pedido en la fila sale a cocina al sentarse */
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
    grupos().forEach(function(g){ if(!g.pedido||!g.pedido.enviado||!g.pedido.lineas.length) return;
      out.push({id:"F"+g.id, ts:g.pedido.enviado, modo:g.destino==="llevar"?"llevar":"local", resp:"Fila · Nº "+g.num+" "+g.nombre+(g.mesa?" · mesa "+g.mesa:""), lineas:g.pedido.lineas, fila:true}); });
    return out.sort(function(a,b){ return a.ts<b.ts?-1:1; });
  }

  /* ---------- a la Caja ----------
     El pedido pasa a la Caja para cobrarlo; la Caja lo toma apenas su cuenta
     está vacía. */
  function aCaja(id){ if(E.seguridad&&!E.seguridad.exigir("fila.operar","enviar a la Caja")) return null; var g=buscar(dia(leer()),id); if(!g||!g.pedido) return null;
    var t={ts:new Date().toISOString(), grupo:g.id, num:g.num, nombre:g.nombre, mesa:g.mesa, modo:g.destino==="llevar"?"llevar":"local",
      comandado:!!g.pedido.enviado, lineas:g.pedido.lineas.map(function(l){ return {id:l.id, q:l.q}; })};
    E.guardar("eapos_traspaso",t); try{ E.canal&&E.canal.postMessage({t:"eapos_traspaso"}); }catch(e){}
    return t; }

  /* Mensaje de WhatsApp para avisar que la mesa está lista. */
  function whatsapp(g){ var t=String(g.tel||"").replace(/[^0-9]/g,""); if(!t) return "";
    if(t.length===8) t="569"+t; else if(t.length===9&&t.charAt(0)==="9") t="56"+t;
    var m=g.destino==="llevar"? "Hola "+g.nombre+", tu pedido en Emporio Andino está listo (turno "+g.num+"). Te esperamos en el mesón."
      : "Hola "+g.nombre+", tu mesa en Emporio Andino está lista"+(g.mesa?" (mesa "+g.mesa+")":"")+". Te esperamos (turno "+g.num+").";
    return "https://wa.me/"+t+"?text="+encodeURIComponent(m); }

  E.fila={clave:K, estado:estado, grupos:grupos, esperanMesa:esperanMesa, llevar:llevar, mesas:mesas, mesasLibres:mesasLibres, siguiente:siguiente, llamado:llamado,
    anotar:anotar, cambiar:cambiar, pedir:pedir, comandar:comandar, marcarListo:marcarListo, retirar:retirar, marcarCobrado:marcarCobrado,
    llamar:llamar, sentar:sentar, ocupar:ocupar, liberar:liberar, cerrarLlamado:cerrarLlamado, ajustes:ajustes,
    comandables:comandables, aCaja:aCaja, whatsapp:whatsapp};
})();
