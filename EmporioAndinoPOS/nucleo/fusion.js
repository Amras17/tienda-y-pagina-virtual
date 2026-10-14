/* ====================================================================
   Fusión de tres vías (la usan el servidor y las pruebas)
   --------------------------------------------------------------------
   Cuando dos equipos cambian el mismo dato (por ejemplo, ea_pos con las
   ventas de dos cajas), no gana el último que guardó: se juntan los dos
   cambios contra la versión que ambos conocían (base).
     · Si solo uno cambió algo, queda ese cambio.
     · Objetos: se fusiona clave por clave (y se respeta lo que se borró).
     · Listas cuyos elementos tienen "id" (ventas, grupos de la fila,
       rondas, pedidos de la panadería, tandas): se juntan por id; cada
       elemento que ambos tocaron se fusiona a su vez.
     · Si los dos cambiaron el mismo valor simple, gana el que llega ahora.
   ==================================================================== */
(function(raiz){
  "use strict";
  var NADA=undefined;
  function esObj(x){ return x!==null&&typeof x==="object"&&!Array.isArray(x); }
  function igual(a,b){
    if(a===b) return true;
    if(a===NADA||b===NADA||a===null||b===null) return false;
    if(Array.isArray(a)){ if(!Array.isArray(b)||a.length!==b.length) return false; for(var i=0;i<a.length;i++) if(!igual(a[i],b[i])) return false; return true; }
    if(esObj(a)){ if(!esObj(b)) return false; var ka=Object.keys(a), kb=Object.keys(b); if(ka.length!==kb.length) return false;
      for(var j=0;j<ka.length;j++){ if(!Object.prototype.hasOwnProperty.call(b,ka[j])||!igual(a[ka[j]],b[ka[j]])) return false; } return true; }
    return false;
  }
  function conIds(l){ return Array.isArray(l)&&l.length>0&&l.every(function(x){ return esObj(x)&&x.id!=null; }); }
  function porId(l){ var m={}; (l||[]).forEach(function(x){ m[String(x.id)]=x; }); return m; }

  /* base: lo que ambos conocían · nuestro: lo que llega ahora · suyo: lo que hay guardado */
  function fusionar(base, nuestro, suyo){
    if(igual(nuestro,suyo)) return nuestro;
    if(igual(base,nuestro)) return suyo;
    if(igual(base,suyo)) return nuestro;
    if(esObj(nuestro)&&esObj(suyo)){
      var b=esObj(base)?base:{}, out={}, claves={};
      Object.keys(nuestro).concat(Object.keys(suyo)).forEach(function(k){ claves[k]=1; });
      Object.keys(claves).forEach(function(k){
        var r=fusionar(b[k], nuestro[k], suyo[k]);
        if(r!==NADA) out[k]=r; });
      return out;
    }
    if(Array.isArray(nuestro)&&Array.isArray(suyo)&&(conIds(nuestro)||conIds(suyo))&&(nuestro.length===0||conIds(nuestro))&&(suyo.length===0||conIds(suyo))){
      var mb=porId(Array.isArray(base)?base:[]), mn=porId(nuestro), ms=porId(suyo), res=[], visto={};
      function agregar(id){ if(visto[id]) return; visto[id]=1;
        var r=fusionar(mb[id], mn[id], ms[id]); if(r!==NADA) res.push(r); }
      nuestro.forEach(function(x){ agregar(String(x.id)); });
      suyo.forEach(function(x){ agregar(String(x.id)); });
      return res;
    }
    /* Mismo valor simple cambiado por ambos (o tipos distintos): gana el que llega. */
    return nuestro;
  }
  /* Huella corta para saber si un valor cambió (FNV-1a sobre el JSON). */
  function huella(v){ var t=typeof v==="string"?v:JSON.stringify(v===NADA?null:v), h=0x811c9dc5;
    for(var i=0;i<t.length;i++){ h^=t.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; } return ("0000000"+h.toString(16)).slice(-8)+":"+t.length; }

  var API={fusionar:fusionar, igual:igual, huella:huella};
  if(typeof module!=="undefined"&&module.exports) module.exports=API; else raiz.EA_FUSION=API;
})(typeof window!=="undefined"?window:this);
