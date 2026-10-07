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
  function aviso(msg, ms){
    var el=document.getElementById("ea-toast");
    if(!el){ el=document.createElement("div"); el.id="ea-toast"; el.className="toast"; el.setAttribute("role","status"); document.body.appendChild(el); }
    el.hidden=true; void el.offsetWidth; el.textContent=msg; el.hidden=false;
    clearTimeout(tAviso); tAviso=setTimeout(function(){ el.hidden=true; },ms||2800);
  }
  /* Íconos de las áreas, los mismos trazos de Emporio System 1.1. */
  var ICONOS={
    inicio:'<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
    caja:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    salon:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    cocina:'<path d="M6 13.9A4 4 0 0 1 7 6a5 5 0 0 1 10 0 4 4 0 0 1 1 7.9V20H6z"/><path d="M6 17h12"/>',
    barra:'<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3v2M12 3v2"/>',
    horno:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><rect x="7" y="12" width="10" height="5" rx="1"/><path d="M7 6.5h.01M10.5 6.5h.01"/>',
    panaderia:'<path d="M4 14a8 5 0 0 1 16 0v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M9 10.5l1 3M14 10.5l-1 3"/>',
    carta:'<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 9h8M8 13h6"/>',
    prueba:'<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h8M16 17h4"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="17" r="2"/>',
    verificacion:'<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    versiones:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    retro:'<path d="M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/>',
    reportes:'<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>'
  };
  function icono(id){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(ICONOS[id]||"")+"</svg>"; }

  /* ---------- resumen de una pestaña ----------
     Arriba de cada área: un estado en una frase, con color, y tres o cuatro
     cifras grandes. El detalle del área sigue debajo. Los textos llegan ya
     escapados. tono: ok · warn · crit · info. */
  var TONO_N={ok:"Todo en orden",warn:"Atención",crit:"Urgente",info:"En curso"};
  var TONO_IC={ok:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',warn:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.3"/>',
    crit:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.3v.4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.7v.3"/>'};
  /* Cuentas regresivas: todo elemento con data-cuenta="<fecha ISO>" muestra
     m:ss hasta esa hora, y se actualiza solo cada segundo. */
  function cuentaTxt(eta){ var s=Math.max(0,Math.round((new Date(eta).getTime()-Date.now())/1000)); return Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); }
  setInterval(function(){ var l=document.querySelectorAll("[data-cuenta]"); for(var i=0;i<l.length;i++) l[i].textContent=cuentaTxt(l[i].getAttribute("data-cuenta")); },1000);
  function panorama(el, d){
    if(!el||!d) return; var t=TONO_IC[d.tono]?d.tono:"info";
    var h='<div class="pn-estado"><span class="pn-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+TONO_IC[t]+'</svg></span>'+
      '<div style="min-width:0"><span class="pn-et">'+(d.etiqueta||TONO_N[t])+'</span>'+
      /* Con reloj (el Horno), la cuenta regresiva va primero y en grande. */
      (d.reloj?'<b class="pn-reloj num" data-cuenta="'+d.reloj+'">'+cuentaTxt(d.reloj)+'</b><b class="pn-tit">'+(d.detalle||d.titulo)+'</b>':'<b class="pn-tit">'+d.titulo+'</b>')+
      (d.sub?'<span class="pn-sub">'+d.sub+'</span>':'')+'</div></div>'+
      '<div class="pn-kpis">'+(d.kpis||[]).filter(Boolean).map(function(k){
        var tag=k.go?'button type="button" data-go="'+k.go+'"':'div';
        return '<'+tag+' class="pn-k" data-tono="'+(k.tono||"")+'"><b class="num">'+k.v+'</b><span>'+k.l+'</span>'+(k.s?'<small>'+k.s+'</small>':'')+'</'+(k.go?'button':'div')+'>';
      }).join("")+'</div>';
    el.setAttribute("data-tono",t); el.setAttribute("role","status");
    if(el._pn!==h){ el._pn=h; el.innerHTML=h; }
  }

  /* ---------- avisos importantes ----------
     Una campana con el resumen de lo que necesita atención ahora: se acabó,
     queda poco, hornada lista, comandas atrasadas. No es una bitácora: cada
     aviso desaparece cuando deja de ser cierto. Cada aviso: {k, tono, tit,
     det, go}. cfg.ir(go) navega; cfg.alNuevo(aviso) avisa lo urgente nuevo. */
  function avisos(btn, cfg){
    cfg=cfg||{}; if(!btn) return {render:function(){}};
    var panel=document.createElement("div"); panel.className="avisos"; panel.hidden=true;
    panel.setAttribute("role","dialog"); panel.setAttribute("aria-label","Avisos importantes"); document.body.appendChild(panel);
    var lista=[], vistos=null, html="";
    function pintar(){
      var g={crit:[],warn:[],info:[]}; lista.forEach(function(a){ (g[a.tono]||g.info).push(a); });
      var h='<div class="av-hd"><b>Avisos importantes</b><span class="num">'+lista.length+'</span></div><p class="av-nota">Lo que necesita atención ahora. Cada aviso se va cuando se resuelve.</p>';
      [["crit","Se acabó o urgente"],["warn","Queda poco o atención"],["info","Para tener en cuenta"]].forEach(function(x){
        if(!g[x[0]].length) return;
        h+='<div class="av-grupo">'+x[1]+'</div>'+g[x[0]].map(function(a){
          var tag=a.go?'button type="button" data-av-go="'+a.go+'"':'div';
          return '<'+tag+' class="av-item" data-tono="'+a.tono+'"><i aria-hidden="true"></i><span class="av-tx"><b>'+a.tit+'</b>'+(a.det?'<span>'+a.det+'</span>':'')+'</span><em>'+(a.go?'Ver →':'')+'</em></'+(a.go?'button':'div')+'>';
        }).join("");
      });
      if(!lista.length) h+='<div class="av-vacio">Sin avisos: todo en orden.</div>';
      if(h!==html){ html=h; panel.innerHTML=h; }
    }
    function render(l){
      lista=(l||[]).slice().sort(function(a,b){ var o={crit:0,warn:1,info:2}; return (o[a.tono]||2)-(o[b.tono]||2); });
      var urg=lista.filter(function(a){ return a.tono==="crit"; }), at=lista.filter(function(a){ return a.tono==="warn"; }), n=urg.length+at.length;
      var b=btn.querySelector(".badge-n"); if(!b){ b=document.createElement("span"); b.className="badge-n num"; btn.appendChild(b); }
      b.textContent=n>99?"99+":n; b.hidden=!n; btn.classList.toggle("solo-warn",!urg.length&&!!at.length);
      btn.setAttribute("aria-label","Avisos importantes: "+(n?n+" por atender":"sin avisos"));
      var claves=urg.map(function(a){ return a.k||a.tit; });
      if(vistos){ var nuevos=urg.filter(function(a){ return vistos.indexOf(a.k||a.tit)<0; });
        if(nuevos.length){ btn.classList.remove("nuevo"); void btn.offsetWidth; btn.classList.add("nuevo"); if(cfg.alNuevo) cfg.alNuevo(nuevos[0]); } }
      vistos=claves; if(!panel.hidden) pintar();
    }
    /* El panel se alinea con la campana pero nunca se sale de la pantalla. */
    function abrir(){ pintar(); panel.hidden=false; var r=btn.getBoundingClientRect(), w=panel.offsetWidth;
      panel.style.top=Math.round(Math.min(innerHeight-120,r.bottom+10))+"px"; panel.style.right="auto";
      panel.style.left=Math.round(Math.max(12,Math.min(innerWidth-w-12,r.right-w)))+"px"; btn.setAttribute("aria-expanded","true"); }
    function cerrar(){ panel.hidden=true; btn.setAttribute("aria-expanded","false"); }
    btn.setAttribute("aria-haspopup","dialog"); btn.setAttribute("aria-expanded","false");
    btn.addEventListener("click",function(e){ e.stopPropagation(); if(panel.hidden) abrir(); else cerrar(); });
    panel.addEventListener("click",function(e){ e.stopPropagation(); var x=e.target.closest("[data-av-go]"); if(x){ cerrar(); if(cfg.ir) cfg.ir(x.getAttribute("data-av-go")); } });
    document.addEventListener("click",function(){ if(!panel.hidden) cerrar(); });
    document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&!panel.hidden){ cerrar(); btn.focus(); } });
    return {render:render, abrir:abrir, cerrar:cerrar, panel:panel};
  }
  var CAMPANA='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V10.5a6 6 0 0 1 12 0V16l1.6 2.4H4.4L6 16z"/><path d="M10 19.5a2.2 2.2 0 0 0 4 0"/></svg>';

  /* ---------- barra colapsable ----------
     Al bajar, la columna izquierda queda en íconos y el encabezado se achica
     a una barra con el resumen de la pestaña; al volver arriba, todo se abre.
     Cada fuente (la página, el módulo incrustado) informa cuánto bajó; con
     margen para que no parpadee: se pliega pasando 64 px y se abre bajo 8 px. */
  var COL={on:false, fuentes:{}, cb:null, t:0};
  function evaluarColapso(){ var y=0; for(var k in COL.fuentes) y=Math.max(y,COL.fuentes[k]||0);
    var on=COL.on? y>8 : y>64;
    if(on!==COL.on){ COL.on=on; COL.t=Date.now(); COL.por=COL.ultima; document.documentElement.classList.toggle("colapsado",on); if(COL.cb) COL.cb(on); } }
  function desplazo(fuente,y){ y=Math.max(0,+y||0);
    /* Al plegarse o abrirse, el módulo cambia de tamaño y su contenido se reordena
       (su desplazamiento puede volver a 0 solo). Durante ese reacomodo no cuentan
       los avisos que revertirían el estado: así no entra en un vaivén. */
    if(Date.now()-COL.t<700 && (COL.on? y<=8 : y>64)){
      /* El desplazo de la propia página sí es del usuario: al terminar la pausa
         se vuelve a mirar dónde quedó, para no quedar plegado tras subir rápido. */
      if(fuente==="pagina" && COL.por==="pagina"){ clearTimeout(COL.re); COL.re=setTimeout(function(){ desplazo("pagina",scrollY||document.documentElement.scrollTop); },720-(Date.now()-COL.t)); }
      return; }
    COL.fuentes[fuente]=y; COL.ultima=fuente;
    /* Volver la página arriba es pedir la barra abierta, aunque el módulo siga abajo. */
    if(fuente==="pagina" && y<=8) COL.fuentes.modulo=0;
    evaluarColapso(); }
  function colapsable(cb){
    COL.cb=cb||null; var raf=0;
    addEventListener("scroll",function(){ if(raf) return; raf=requestAnimationFrame(function(){ raf=0; desplazo("pagina",scrollY||document.documentElement.scrollTop); }); },{passive:true});
    /* Al terminar de plegarse o abrirse la columna, se vuelve a medir el indicador del menú. */
    var si=document.querySelector(".side-in"); if(si&&cb) si.addEventListener("transitionend",function(e){ if(e.target===si&&e.propertyName==="width") cb(COL.on,true); });
    evaluarColapso();
  }
  /* Un módulo dentro del sistema general avisa hacia arriba cuánto se desplazó,
     sea la página o un panel con su propio scroll. */
  if(incrustado){ var rafM=0;
    document.addEventListener("scroll",function(e){ if(rafM) return; var t=e.target;
      rafM=requestAnimationFrame(function(){ rafM=0;
        var y=(!t||t===document||t===document.documentElement||t===document.body)?(scrollY||document.documentElement.scrollTop):t.scrollTop;
        try{ var S=window.parent.EAPOS_SISTEMA; if(S&&S.desplazo) S.desplazo(y); }catch(x){} }); },{capture:true,passive:true}); }

  /* ---------- menús que se deslizan de lado ---------- */
  function esFilaX(el){ if(!el||el.nodeType!==1) return false; var c=getComputedStyle(el); return /(auto|scroll)/.test(c.overflowX) && el.scrollWidth>el.clientWidth+2 && el.scrollHeight<=el.clientHeight+2; }
  function marcarBordes(el){ var d=el.scrollWidth>el.clientWidth+2; el.classList.toggle("desborda-x",d);
    el.classList.toggle("al-inicio",d&&el.scrollLeft<=2); el.classList.toggle("al-final",d&&el.scrollLeft+el.clientWidth>=el.scrollWidth-2); }
  /* La rueda vertical mueve de lado una fila que no cabe (con mouse no hay otra forma de verla entera). */
  addEventListener("wheel",function(e){ if(e.ctrlKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)) return;
    var el=e.target; while(el&&el!==document.body&&!esFilaX(el)) el=el.parentElement;
    if(!el||el===document.body) return; var antes=el.scrollLeft; el.scrollLeft+=e.deltaY;
    if(el.scrollLeft!==antes) e.preventDefault(); },{passive:false});
  addEventListener("scroll",function(e){ var t=e.target; if(t&&t.nodeType===1&&t.classList.contains("desborda-x")) marcarBordes(t); },true);
  function filasX(raiz){ (raiz||document).querySelectorAll(".nav,.grupos,.fchips,.subtabs,.pestanas").forEach(marcarBordes); }
  /* Centra el área activa de un menú horizontal sin mover la página. */
  function centrarActivo(nav,el){ if(!nav||!el||nav.scrollWidth<=nav.clientWidth+2) return;
    nav.scrollLeft=Math.max(0,el.offsetLeft-(nav.clientWidth-el.offsetWidth)/2); marcarBordes(nav); }
  var roX=null; try{ roX=new ResizeObserver(function(){ filasX(); }); }catch(e){}

  function listo(fn){ if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",fn); else fn(); }
  listo(function(){ atmosfera(); mosaicos(document); if(roX) roX.observe(document.body); setTimeout(filasX,300); });

  window.EA_UI={REDUCE:REDUCE, Spring:Spring, tween:tween, numero:numero, deslizador:deslizador, mosaicos:mosaicos, revelar:revelar,
    atmosfera:atmosfera, reloj:reloj, hhmm:hhmm, aviso:aviso, icono:icono, ICONOS:ICONOS, incrustado:incrustado,
    panorama:panorama, avisos:avisos, CAMPANA:CAMPANA, colapsable:colapsable, desplazo:desplazo, filasX:filasX, centrarActivo:centrarActivo};
})();
