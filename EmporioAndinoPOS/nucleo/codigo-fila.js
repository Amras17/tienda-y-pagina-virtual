/* ====================================================================
   Código de pedido para la fila
   --------------------------------------------------------------------
   El cliente arma su pedido en la Carta (en su teléfono) y, si está en la
   fila, le muestra al equipo un código corto. El sistema lo lee y el
   pedido queda anotado sin dictarlo. No necesita internet ni servidor:
   el código lleva el pedido adentro.

   Formato (alfabeto Crockford, sin I, L, O ni U para no confundir):
     destino (B bolsa, para llevar · M mesa) · personas · por producto 2 letras del
     producto + 1 de cantidad · 2 de control. Se muestra en grupos de 4.
   El control incluye la lista de productos de la carta: un código armado
   con otra versión de la carta se reconoce y no se lee mal.
   Solo necesita la carta (EA_DATOS o el DATOS de la Carta).
   ==================================================================== */
(function(){
  "use strict";
  var A="0123456789ABCDEFGHJKMNPQRSTVWXYZ", N=A.length;
  function ids(d){ var l=[];
    (d.COMIDA||[]).forEach(function(x){ l.push(x.id); });
    (d.EMP||[]).forEach(function(x){ l.push("E"+x.id); });
    (d.BEB||[]).forEach(function(x){ l.push(x.id); });
    (d.PAST||[]).forEach(function(x){ l.push("P"+x.id); });
    return l; }
  function hashLista(l){ var h=7; l.join("|").split("").forEach(function(c){ h=(h*31+c.charCodeAt(0))%1000003; }); return h; }
  function control(cuerpo, l){ var h=hashLista(l); for(var i=0;i<cuerpo.length;i++) h=(h*37+A.indexOf(cuerpo.charAt(i))*(i+3))%1000003; return A.charAt(h%N)+A.charAt(Math.floor(h/N)%N); }
  /* lineas: [{id (id del catálogo: "Ee-pino", "latte", "Palfajor"…), q}] */
  function crear(d, destino, personas, lineas){
    var l=ids(d), c=(destino==="llevar"?"B":"M")+A.charAt(Math.max(0,Math.min(N-1,personas|0))), por={};
    (lineas||[]).forEach(function(x){ var i=l.indexOf(x.id); if(i>=0) por[i]=(por[i]||0)+(x.q|0); });
    Object.keys(por).forEach(function(i){ var q=por[i]; i=+i;
      while(q>0){ var t=Math.min(q,N-1); c+=A.charAt(Math.floor(i/N))+A.charAt(i%N)+A.charAt(t); q-=t; } });
    c+=control(c,l);
    return c.replace(/(.{4})(?=.)/g,"$1-");
  }
  function limpiar(code){ return String(code||"").toUpperCase().replace(/[^0-9A-Z]/g,"").replace(/O/g,"0").replace(/[IL]/g,"1").replace(/U/g,"V"); }
  /* Devuelve {destino, personas, lineas:[{id,q}]} o {error} */
  function leer(d, code){
    var c=limpiar(code), l=ids(d);
    if(c.length<4||(c.length-4)%3) return {error:"El código no está completo"};
    var cuerpo=c.slice(0,-2);
    if(control(cuerpo,l)!==c.slice(-2)) return {error:"El código no coincide: revisa las letras o pide al cliente que vuelva a abrir su pedido"};
    var dest=cuerpo.charAt(0)==="B"?"llevar":cuerpo.charAt(0)==="M"?"mesa":null; if(!dest) return {error:"El código no es de un pedido"};
    var out=[], por={};
    for(var i=2;i<cuerpo.length;i+=3){ var idx=A.indexOf(cuerpo.charAt(i))*N+A.indexOf(cuerpo.charAt(i+1)), q=A.indexOf(cuerpo.charAt(i+2));
      if(idx<0||idx>=l.length||q<1) return {error:"El código trae un producto que no está en la carta"}; por[l[idx]]=(por[l[idx]]||0)+q; }
    for(var k in por) out.push({id:k, q:por[k]});
    return {destino:dest, personas:A.indexOf(cuerpo.charAt(1)), lineas:out};
  }
  window.EA_CODIGO={crear:crear, leer:leer, ids:ids};
})();
