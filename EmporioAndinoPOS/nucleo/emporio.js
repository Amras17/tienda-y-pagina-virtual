/* ====================================================================
   Emporio · comportamientos de Emporio System 1.1 para todas las capas
   --------------------------------------------------------------------
   · resortes: curvas linear() calculadas con un resorte físico, para que
     botones, tarjetas y paneles respondan igual en todo el sistema;
   · Spring: valores que se animan con resorte (números, indicadores);
   · indicador deslizante (el "pill" del menú y de los segmentados);
   · mosaicos: brillo que sigue al puntero y leve inclinación;
   · atmósfera (manchas de luz y patrón andino), reloj y aviso flotante;
   · modo incrustado: dentro del sistema general el módulo se vuelve
     transparente y comparte la atmósfera de la capa superior.
   ==================================================================== */
(function(){
  "use strict";
  var REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- resortes como curvas CSS ---------- */
  function springCurve(k,c,m){
    var x=0,v=0,t=0,dt=1/1000,pts=[0],next=1/60;
    while(t<2.5){ var a=(-k*(x-1)-c*v)/m; v+=a*dt; x+=v*dt; t+=dt;
      if(t>=next){ pts.push(+x.toFixed(4)); next+=1/60; }
      if(t>.12&&Math.abs(1-x)<.002&&Math.abs(v)<.02) break; }
    pts.push(1); return {easing:"linear("+pts.join(",")+")", duration:t};
  }
  (function(){
    try{ if(!CSS.supports("transition-timing-function","linear(0, 1)")) return; }catch(e){ return; }
    var a=springCurve(260,15,1), b=springCurve(170,20,1), r=document.documentElement.style;
    r.setProperty("--spring",a.easing); r.setProperty("--spring-dur",a.duration.toFixed(2)+"s");
    r.setProperty("--spring-soft",b.easing); r.setProperty("--spring-soft-dur",b.duration.toFixed(2)+"s");
  })();

  /* ---------- valores con resorte ---------- */
  var ANIM=new Set(), corriendo=false, ultimo=0;
  function Spring(x,k,c){ this.x=x; this.t=x; this.v=0; this.k=k||180; this.c=c||22; }
  Spring.prototype.set=function(t){ this.t=t; if(REDUCE){ this.x=t; this.v=0; this.on&&this.on(t); return; } ANIM.add(this); arrancar(); };
  Spring.prototype.jump=function(t){ this.x=this.t=t; this.v=0; ANIM.delete(this); this.on&&this.on(t); };
  Spring.prototype.step=function(dt){
    var n=Math.max(1,Math.ceil(dt*240)), h=dt/n;
    for(var i=0;i<n;i++){ var a=-this.k*(this.x-this.t)-this.c*this.v; this.v+=a*h; this.x+=this.v*h; }
    var tol=Math.max(1e-3,Math.abs(this.t)*1e-4);
    if(Math.abs(this.x-this.t)<tol&&Math.abs(this.v)<tol*4){ this.x=this.t; this.v=0; return false; }
    return true;
  };
  function cuadro(now){
    var dt=ultimo?Math.min(.05,(now-ultimo)/1000):0; ultimo=now;
    ANIM.forEach(function(s){ var vivo=s.step(dt); s.on&&s.on(s.x); if(!vivo) ANIM.delete(s); });
    if(ANIM.size) requestAnimationFrame(cuadro); else { corriendo=false; ultimo=0; }
  }
  function arrancar(){ if(!corriendo){ corriendo=true; requestAnimationFrame(cuadro); } }
  function tween(sp,fn){ sp.on=fn; fn(sp.x); return sp; }

  /* Un número que llega con resorte (ventas, conteos). */
  var NUMS=new WeakMap();
  function numero(el,val,fmt){
    if(!el) return; var s=NUMS.get(el);
    if(!s){ s=tween(new Spring(val,140,24),function(x){ el.textContent=fmt(x); }); NUMS.set(el,s); }
    s.set(val);
  }

  /* ---------- indicador deslizante ---------- */
  function deslizador(ind){
    if(!ind) return {to:function(){}};
    var sp={x:new Spring(0,260,24), y:new Spring(0,260,24), w:new Spring(0,260,24), h:new Spring(0,260,24)};
    var aplicar=function(){ ind.style.transform="translate("+sp.x.x+"px,"+sp.y.x+"px)"; ind.style.width=Math.max(0,sp.w.x)+"px"; ind.style.height=Math.max(0,sp.h.x)+"px"; };
    Object.keys(sp).forEach(function(k){ sp[k].on=aplicar; });
    return {to:function(el,salto){ if(!el){ ind.style.width="0px"; return; }
      var v={x:el.offsetLeft, y:el.offsetTop, w:el.offsetWidth, h:el.offsetHeight};
      for(var k in v){ salto? sp[k].jump(v[k]) : sp[k].set(v[k]); } }};
  }

  /* ---------- mosaicos ---------- */
  function mosaicos(raiz){
    (raiz||document).querySelectorAll(".tile").forEach(function(t){
      if(t._ea) return; t._ea=1;
      t.addEventListener("pointermove",function(e){ var r=t.getBoundingClientRect(); t.style.setProperty("--mx",(e.clientX-r.left)+"px"); t.style.setProperty("--my",(e.clientY-r.top)+"px"); });
      if(!t.classList.contains("tilt")||REDUCE) return;
      var rx=tween(new Spring(0,170,14),function(v){ t.style.setProperty("--rx",v.toFixed(2)+"deg"); }),
          ry=tween(new Spring(0,170,14),function(v){ t.style.setProperty("--ry",v.toFixed(2)+"deg"); }),
          ty=tween(new Spring(0,200,16),function(v){ t.style.setProperty("--ty",v.toFixed(2)+"px"); });
      t.addEventListener("pointermove",function(e){ if(e.pointerType!=="mouse") return; var r=t.getBoundingClientRect(), px=(e.clientX-r.left)/r.width-.5, py=(e.clientY-r.top)/r.height-.5; rx.set(-py*7); ry.set(px*7); ty.set(-3); });
      t.addEventListener("pointerleave",function(){ rx.set(0); ry.set(0); ty.set(0); });
    });
  }
  /* Las tarjetas de una vista entran escalonadas, como en 1.1. */
  function revelar(raiz){
    if(REDUCE||!raiz) return;
    raiz.querySelectorAll(".tc").forEach(function(el,i){ el.style.setProperty("--d",(i*50)+"ms"); el.style.animation="none"; void el.offsetWidth; el.style.animation=""; });
  }

  /* ---------- atmósfera, reloj y avisos ---------- */
  var incrustado=false;
  try{ incrustado = window.parent!==window && !!window.parent.EAPOS_SISTEMA; }catch(e){ incrustado=false; }
  if(incrustado) document.documentElement.classList.add("incrustado");
  function atmosfera(){
    if(document.querySelector(".atmo")) return;
    var a=document.createElement("div"); a.className="atmo"; a.setAttribute("aria-hidden","true");
    a.innerHTML='<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="pattern"></div>';
    document.body.insertBefore(a, document.body.firstChild);
  }
  function hhmm(d){ d=d||new Date(); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }
  function reloj(el){ if(!el) return; var f=function(){ el.textContent=hhmm(); }; f(); setInterval(f,5000); }
  var tAviso=null;
  function aviso(msg){
    var el=document.getElementById("ea-toast");
    if(!el){ el=document.createElement("div"); el.id="ea-toast"; el.className="toast"; el.setAttribute("role","status"); document.body.appendChild(el); }
    el.hidden=true; void el.offsetWidth; el.textContent=msg; el.hidden=false;
    clearTimeout(tAviso); tAviso=setTimeout(function(){ el.hidden=true; },2800);
  }
  /* Íconos de las áreas, los mismos trazos de Emporio System 1.1. */
  var ICONOS={
    inicio:'<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
    caja:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    salon:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    cocina:'<path d="M6 13.9A4 4 0 0 1 7 6a5 5 0 0 1 10 0 4 4 0 0 1 1 7.9V20H6z"/><path d="M6 17h12"/>',
    carta:'<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 9h8M8 13h6"/>',
    prueba:'<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h8M16 17h4"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="17" r="2"/>',
    verificacion:'<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    versiones:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    retro:'<path d="M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/>',
    reportes:'<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>'
  };
  function icono(id){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(ICONOS[id]||"")+"</svg>"; }

  function listo(fn){ if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",fn); else fn(); }
  listo(function(){ atmosfera(); mosaicos(document); });

  window.EA_UI={REDUCE:REDUCE, Spring:Spring, tween:tween, numero:numero, deslizador:deslizador, mosaicos:mosaicos, revelar:revelar,
    atmosfera:atmosfera, reloj:reloj, hhmm:hhmm, aviso:aviso, icono:icono, ICONOS:ICONOS, incrustado:incrustado};
})();
