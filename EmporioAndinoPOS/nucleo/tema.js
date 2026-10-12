/* ====================================================================
   Tema del sistema
   --------------------------------------------------------------------
   Dos temas para todas las capas:
   · nativo  Emporio System 1.1: noche volcánica, vidrio y turquesa.
   · andino  Carta Andina: la paleta de la foto del camino al desierto
             (azul noche, cielo, arena, ocre, óxido y tierra) con el diseño
             y la letra de la carta impresa: papel claro, títulos a mano,
             precios en mancha, puntadas y guardas andinas.
   Se elige por equipo (eapos_tema) y cambia en vivo en todas las ventanas
   y módulos abiertos. ?tema=andino en la dirección lo fija en ese equipo.
   Se carga en el <head> de cada página, antes de pintar, para no parpadear.
   ==================================================================== */
(function(){
  "use strict";
  var K="eapos_tema", ID_CSS="ea-tema-css", ID_FUENTES="ea-tema-fuentes";
  var TEMAS=[
    {id:"nativo", n:"Nativo", d:"Noche volcánica con vidrio y acento turquesa (Emporio System 1.1)",
      muestra:["#0A1012","#18262A","#40E0D0","#FF7F50","#F2F7F6"]},
    {id:"andino", n:"Carta Andina", d:"Papel claro, títulos a mano y guardas andinas, con los colores del camino al desierto",
      muestra:["#102948","#204F8D","#7DA9C5","#D3BEA0","#C07943","#A75D33","#392418"]}
  ];
  var FUENTES="https://fonts.googleapis.com/css2?family=Gochi+Hand&family=Grandstander:wght@500;600;700&family=Lexend:wght@300;400;500;600;700;800&display=swap";
  var base=""; try{ base=(document.currentScript&&document.currentScript.src||"").replace(/[^\/]*$/,""); }catch(e){}

  function valido(t){ return t==="andino"?"andino":"nativo"; }
  function leer(){ try{ return localStorage.getItem(K)||""; }catch(e){ return ""; } }
  function css(){
    if(document.getElementById(ID_CSS)||!base) return;
    var l=document.createElement("link"); l.id=ID_CSS; l.rel="stylesheet"; l.href=base+"tema-andino.css";
    (document.head||document.documentElement).appendChild(l);
  }
  function fuentes(){
    if(document.getElementById(ID_FUENTES)) return;
    var l=document.createElement("link"); l.id=ID_FUENTES; l.rel="stylesheet"; l.href=FUENTES;
    (document.head||document.documentElement).appendChild(l);
  }
  function aplicar(t){
    t=valido(t); var h=document.documentElement;
    if(t==="andino"){ fuentes(); h.setAttribute("data-tema","andino"); } else h.removeAttribute("data-tema");
    try{ window.dispatchEvent(new CustomEvent("ea-tema",{detail:{tema:t}})); }catch(e){}
    return t;
  }
  function actual(){ return document.documentElement.getAttribute("data-tema")==="andino"?"andino":"nativo"; }
  function poner(t){ t=valido(t); try{ localStorage.setItem(K,t); }catch(e){} return aplicar(t); }

  /* ?tema=andino o ?tema=nativo en la dirección: queda fijo en este equipo. */
  var deUrl=null; try{ var m=/[?&]tema=(nativo|andino)\b/.exec(location.search); deUrl=m&&m[1]; }catch(e){}
  css();
  if(deUrl) poner(deUrl); else aplicar(leer());
  /* Otra ventana o el sistema general lo cambió: se sigue al instante. */
  addEventListener("storage",function(ev){ if(ev.key===K) aplicar(ev.newValue); });

  window.EA_TEMA={actual:actual, poner:poner, lista:TEMAS};
})();
