/* ====================================================================
   Nube: sincronización con el servidor (Google Cloud Run + Cloud SQL)
   --------------------------------------------------------------------
   Sin configurar, no hace nada: el sistema sigue guardando todo en este
   equipo como siempre. Configurada (Versiones → Nube), hace esto:
   · Cada vez que cambia un dato compartido (ventas, fila y pedidos, stock,
     comandas, horno, panadería, configuración, PIN…), lo sube al servidor
     junto con la versión de la que partió. El servidor junta los cambios
     de todos los equipos (fusión de tres vías, nucleo/fusion.js), así dos
     cajas que venden a la vez no se pisan.
   · Cada pocos segundos trae lo que cambiaron los otros equipos y lo deja
     en este equipo; los módulos abiertos se actualizan solos.
   · Sin internet sigue funcionando: los cambios quedan pendientes y se
     suben al volver la conexión.
   · La sesión del sistema (PIN) abre también una sesión en el servidor,
     que vuelve a revisar el cargo de quien guarda (403 si no corresponde).
   Solo sincroniza la ventana de arriba; los módulos incrustados reciben
   los cambios por el evento "storage" del navegador.
   ==================================================================== */
(function(){
  "use strict";
  if(window.EA_NUBE) return;
  var arriba=true; try{ arriba=window.top===window; }catch(e){}
  var ls; try{ ls=window.localStorage; }catch(e){ return; }
  /* Claves que se comparten entre equipos (las mismas del servidor, servidor/politica.js). */
  var CLAVES={ea_pos:1, ea_control:1, eapos_fila:1, eapos_comandas:1, eapos_panaderia:1, eapos_horno:1, eapos_cfg:1, eapos_versiones:1,
    eapos_prueba_cfg:1, eapos_prueba_fichas:1, eapos_carta:1, eapos_retro:1, es_pins:1};
  var KC="eapos_nube", KV="eapos_nube_v", KT="eapos_nube_tk", KP="eapos_nube_pend", KB="eapos_nube_bit";
  var setOrig=Storage.prototype.setItem;
  function leer(k,d){ try{ var r=ls.getItem(k); return r?JSON.parse(r):d; }catch(e){ return d; } }
  function poner(k,v){ try{ setOrig.call(ls,k,JSON.stringify(v)); }catch(e){} }
  function huella(t){ t=t==null?"":String(t); var h=0x811c9dc5; for(var i=0;i<t.length;i++){ h^=t.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; } return h.toString(16)+":"+t.length; }
  function esObj(x){ return x!==null&&typeof x==="object"&&!Array.isArray(x); }
  function igual(a,b){ if(a===b) return true; if(a==null||b==null) return a===b;
    if(Array.isArray(a)){ if(!Array.isArray(b)||a.length!==b.length) return false; for(var i=0;i<a.length;i++) if(!igual(a[i],b[i])) return false; return true; }
    if(esObj(a)){ if(!esObj(b)) return false; var ka=Object.keys(a), kb=Object.keys(b); if(ka.length!==kb.length) return false; for(var j=0;j<ka.length;j++) if(!(ka[j] in b)||!igual(a[ka[j]],b[ka[j]])) return false; return true; }
    return false; }

  function cfg(){ var c=leer(KC,null); return c&&c.activa&&c.clave?c:null; }
  var EST={modo:"apagada", pendientes:0, error:"", visto:null};
  function avisar(){ var p=leer(KP,{}); EST.pendientes=Object.keys(p).length;
    try{ window.dispatchEvent(new CustomEvent("ea-nube",{detail:estado()})); }catch(e){} }
  function estado(){ var c=leer(KC,null); return {configurada:!!(c&&c.clave), activa:!!cfg(), modo:cfg()?EST.modo:"apagada", pendientes:EST.pendientes, error:EST.error, visto:EST.visto,
    url:c&&c.url||"", equipo:c&&c.nombre||"", id:c&&c.id||""}; }
  function base(){ var c=cfg(); return c&&c.url?c.url.replace(/\/+$/,""):""; }
  function sesionLocal(){ var s=leer("eapos_sesion",null); return s&&s.n?s.n:""; }
  function cabeceras(){ var c=cfg()||leer(KC,{})||{}, h={"Content-Type":"application/json","X-Clave-Local":c.clave||"","X-Equipo":c.id||"","X-Equipo-Nombre":c.nombre||""};
    var t=leer(KT,null); if(t&&t.tk&&t.n===sesionLocal()&&t.exp>Date.now()) h["X-Sesion"]=t.tk; return h; }
  function pedir(met, ruta, cuerpo, conf){
    var c=conf||cfg(); var u=(c&&c.url?c.url.replace(/\/+$/,""):"")+ruta, h=conf?{"Content-Type":"application/json","X-Clave-Local":conf.clave||"","X-Equipo":conf.id||"","X-Equipo-Nombre":conf.nombre||""}:cabeceras();
    return fetch(u,{method:met, headers:h, body:cuerpo?JSON.stringify(cuerpo):undefined, cache:"no-store"}).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){ if(!r.ok){ var e=new Error(j.error||("HTTP "+r.status)); e.status=r.status; throw e; } return j; }); }); }

  /* ---------- subir ---------- */
  var tSubir=0, subiendo=false;
  function marcar(k){ if(!CLAVES[k]||!cfg()) return; var p=leer(KP,{}); if(!p[k]){ p[k]=1; poner(KP,p); } avisar(); programar(400); }
  function programar(ms){ clearTimeout(tSubir); tSubir=setTimeout(subir, ms); }
  function versiones(){ return leer(KV,{}); }
  function subir(){
    if(subiendo||!cfg()) return; var p=leer(KP,{}), ks=Object.keys(p); if(!ks.length){ if(EST.modo!=="sin conexión") EST.modo="al día"; avisar(); return; }
    subiendo=true; var k=ks[0], raw=ls.getItem(k), vv=versiones()[k]||{v:0,h:""};
    var fin=function(siguiente){ subiendo=false; avisar(); if(siguiente!=null) programar(siguiente); };
    if(raw==null||huella(raw)===vv.h){ delete p[k]; poner(KP,p); return fin(0); }
    var valor; try{ valor=JSON.parse(raw); }catch(e){ delete p[k]; poner(KP,p); return fin(0); }
    pedir("PUT","/api/kv/"+encodeURIComponent(k),{valor:valor, base:vv.v}).then(function(r){
      var ahora=ls.getItem(k), V=versiones();
      if(ahora===raw){ aplicar(k, r.valor, r.version); var q=leer(KP,{}); delete q[k]; poner(KP,q); }
      else if(!r.fusionado){ V[k]={v:r.version, h:huella(raw)}; poner(KV,V); }   /* cambió mientras subía: se vuelve a subir */
      EST.modo="al día"; EST.error=""; EST.visto=new Date().toISOString(); fin(0);
    }).catch(function(e){
      if(e.status===401||e.status===403){ EST.modo=e.status===403?"sin permiso":/clave del local/i.test(e.message)?"clave incorrecta":"falta ingresar"; EST.error=e.message;
        /* Lo que este cargo no puede guardar queda en el equipo; no se reintenta en bucle. */
        if(e.status===403){ var q=leer(KP,{}); delete q[k]; poner(KP,q); return fin(1000); }
        return fin(null); }
      EST.modo="sin conexión"; EST.error=e.message; fin(10000); });
  }
  /* Deja en este equipo lo que respondió el servidor sin volver a subirlo. */
  function aplicar(k, valor, version){
    var antes=ls.getItem(k), V=versiones(), actual=null; try{ actual=antes==null?null:JSON.parse(antes); }catch(e){}
    if(!igual(actual,valor)){ var nuevo=JSON.stringify(valor); try{ setOrig.call(ls,k,nuevo); }catch(e){}
      V[k]={v:version, h:huella(nuevo)}; poner(KV,V);
      try{ window.dispatchEvent(new StorageEvent("storage",{key:k, oldValue:antes, newValue:nuevo, storageArea:ls, url:location.href})); }catch(e){}
      try{ if(window.EAPOS&&EAPOS.canal) EAPOS.canal.postMessage({t:k, nube:1}); }catch(e){} }
    else { V[k]={v:version, h:huella(antes)}; poner(KV,V); }
  }

  /* ---------- traer ---------- */
  var tTraer=0;
  function traer(){
    clearTimeout(tTraer); if(!cfg()) return;
    var V=versiones(), desde=V._ultimo||0;
    pedir("GET","/api/cambios?desde="+desde).then(function(r){
      var V2=versiones(), pend=leer(KP,{});
      (r.cambios||[]).forEach(function(c){ var vv=V2[c.clave]||{v:0,h:""};
        if(c.version<=vv.v) return;
        var raw=ls.getItem(c.clave);
        if(raw==null||huella(raw)===vv.h){ aplicar(c.clave, c.valor, c.version); V2=versiones(); }
        else pend[c.clave]=1;   /* hay cambios locales sin subir: se suben fusionando */ });
      V2=versiones(); V2._ultimo=Math.max(V2._ultimo||0, r.ultimo||0); poner(KV,V2); poner(KP,pend);
      if(["sin permiso","clave incorrecta","falta ingresar"].indexOf(EST.modo)<0) EST.modo=Object.keys(pend).length?"pendiente":"al día";
      EST.error=""; EST.visto=new Date().toISOString(); avisar();
      if(Object.keys(pend).length) programar(200);
      subirBitacora();
    }).catch(function(e){ EST.modo=e.status===401?"clave incorrecta":"sin conexión"; EST.error=e.message; avisar(); })
    .then(function(){ tTraer=setTimeout(traer, document.hidden?20000:4000); });
  }

  /* ---------- bitácora: se agrega en la tabla del servidor ---------- */
  var subiendoBit=false;
  function subirBitacora(){ if(subiendoBit||!cfg()) return; var b=leer("eapos_bitacora",[]); if(!Array.isArray(b)||!b.length) return;
    var u=leer(KB,""), i=u?b.map(function(x){ return x.h; }).lastIndexOf(u):-1, nuevas=b.slice(i+1).slice(0,300); if(!nuevas.length) return;
    subiendoBit=true; pedir("POST","/api/bitacora",{entradas:nuevas}).then(function(){ poner(KB,nuevas[nuevas.length-1].h); }).catch(function(){}).then(function(){ subiendoBit=false; }); }

  /* ---------- sesión en el servidor (la abre el ingreso con PIN) ---------- */
  function ingresar(nombre, huellaPin){
    if(!cfg()) return Promise.resolve(null);
    var intento=function(){ return pedir("POST","/api/sesion",{nombre:nombre, huella:huellaPin}).then(function(r){ poner(KT,{n:nombre, tk:r.sesion, exp:Date.now()+14*3600e3}); programar(0); return r; }); };
    return intento().catch(function(e){
      /* Primera vez en la nube: se sube su PIN y se vuelve a intentar. */
      if(e.status===403&&/aún no tiene PIN/i.test(e.message)){ var p=leer("es_pins",{}), V=versiones();
        return pedir("PUT","/api/kv/es_pins",{valor:p, base:(V.es_pins||{}).v||0}).then(function(r){ aplicar("es_pins", r.valor, r.version); return intento(); }); }
      throw e; }).catch(function(e){ EST.error="Sesión en la nube: "+e.message; avisar(); return null; });
  }

  /* ---------- configurar ---------- */
  function nid(){ return "eq-"+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
  /* Cada equipo tiene un id fijo (se crea una vez y no cambia al reconectar). */
  function idEquipo(){ var c=leer(KC,{})||{}; if(!c.id){ c.id=nid(); poner(KC,c); } return c.id; }
  function probar(conf){ conf=Object.assign({}, leer(KC,{})||{}, conf||{}); if(!conf.id) conf.id=idEquipo();
    var u=(conf.url||"").replace(/\/+$/,"");
    return fetch(u+"/api/salud",{cache:"no-store"}).then(function(r){ return r.json(); }).then(function(s){
      if(!s.ok) throw new Error(s.error||"El servidor no responde bien");
      return pedir("GET","/api/cambios?desde=999999999",null,conf).then(function(){ return s; }); }); }
  /* modo "subir": junta lo de este equipo con la nube (primer equipo).
     modo "traer": este equipo parte de lo que hay en la nube (equipos que se suman). */
  function conectar(conf, modo, sesion){
    conf=Object.assign({}, leer(KC,{})||{}, conf||{}); if(!conf.id) conf.id=idEquipo(); conf.activa=true; conf.desde=new Date().toISOString();
    return probar(conf).then(function(s){
      poner(KC,conf); poner(KV,{}); poner(KB,"");
      /* Con el PIN de quien conecta se abre su sesión antes de subir nada. */
      return (sesion?ingresar(sesion.nombre, sesion.huella):Promise.resolve()).then(function(){ return s; }); }).then(function(s){
      var p={}; if(modo!=="traer") Object.keys(CLAVES).forEach(function(k){ if(ls.getItem(k)!=null) p[k]=1; });
      poner(KP,p);
      if(modo==="traer") return pedir("GET","/api/cambios?desde=0").then(function(r){
          (r.cambios||[]).forEach(function(c){ aplicar(c.clave, c.valor, c.version); });
          var V=versiones(); V._ultimo=r.ultimo||0; poner(KV,V); arrancar(); return s; });
      arrancar(); programar(0); return s; });
  }
  /* ¿El sistema se abrió desde el mismo servidor (Cloud Run)? Entonces basta
     la clave del local para unirse, sin escribir la dirección. */
  function detectar(){ if(cfg()||!/^https?:$/.test(location.protocol)) return Promise.resolve(null);
    /* El servidor marca sus páginas con la cabecera X-Emporio-Nube; así no se
       pregunta por la API a un sitio que no la tiene. */
    return fetch(location.pathname,{method:"HEAD", cache:"no-store"}).then(function(r){
      if(!r.headers.get("X-Emporio-Nube")) return null;
      return fetch("/api/salud",{cache:"no-store"}).then(function(r){ return r.ok?r.json():null; }).then(function(s){ return s&&s.ok?s:null; }); })
      .catch(function(){ return null; }); }
  function salir(){ try{ ls.removeItem(KT); }catch(e){} }
  function desconectar(){ var c=leer(KC,{})||{}; c.activa=false; poner(KC,c); clearTimeout(tTraer); clearTimeout(tSubir); EST.modo="apagada"; avisar(); }

  var corriendo=false;
  function arrancar(){ if(!arriba||!cfg()) return; EST.modo="conectando"; avisar(); if(!corriendo){ corriendo=true;
      /* Cambios hechos en esta ventana… */
      Storage.prototype.setItem=function(k,v){ setOrig.call(this,k,v); if(this===ls){ if(CLAVES[k]) marcar(k); else if(k==="eapos_bitacora") setTimeout(subirBitacora,300); } };
      /* …y en los módulos incrustados o en otras ventanas de este equipo. */
      addEventListener("storage",function(ev){ if(!ev.isTrusted) return;   /* los eventos que arma esta misma nube no se vuelven a subir */
        if(ev.storageArea&&ev.storageArea!==ls) return;
        if(ev.key&&CLAVES[ev.key]) marcar(ev.key); else if(ev.key==="eapos_bitacora") setTimeout(subirBitacora,300); });
      addEventListener("online",function(){ programar(0); traer(); });
      document.addEventListener("visibilitychange",function(){ if(!document.hidden) traer(); }); }
    traer(); programar(300); }

  window.EA_NUBE={estado:estado, probar:probar, conectar:conectar, desconectar:desconectar, ingresar:ingresar, salir:salir, detectar:detectar, sincronizar:function(){ traer(); programar(0); },
    claves:Object.keys(CLAVES), activa:function(){ return !!cfg(); }};
  if(arriba&&cfg()){ if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",arrancar); else arrancar(); }
})();
