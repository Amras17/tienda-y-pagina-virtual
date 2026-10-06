/* ====================================================================
   Emporio · fichas técnicas y escandallos ESTÁNDAR (solo para la Prueba)
   --------------------------------------------------------------------
   Valores especulados con información pública, no medidos en el local:
   recetas tipo de cada preparación y precios de compra netos (sin IVA)
   estimados para octubre de 2026, con referencias de supermercados y
   mercados mayoristas de Chile. Sirven para simular costos, food cost y
   consumo de insumos en la Prueba; no tocan la Caja ni el sistema general.

   Referencias usadas para calibrar:
   · ODEPA, boletines de precios mayoristas de frutas y hortalizas 2026
     (palta Hass $3.000–4.000/kg en Lo Valledor, agosto 2026).
   · Centro de Políticas Públicas USS: costo de ingredientes de una
     empanada de pino casera $999 con precios de supermercado (sep 2026).
   · Precios de góndola Líder y Jumbo: queso de cabra $25.000–37.000/kg,
     bandeja de 30 huevos $6.990, leche ≈ $1.150/L, pechuga ≈ $5.900/kg.
   · Estándares de barra: espresso doble 18 g; la casa usa 12 g en el
     simple y 28 g en el V60 (receta de barra).
   Cantidades en la unidad base del insumo: g, ml o unidades.
   ==================================================================== */
window.EA_ESTANDAR = (function(){
  "use strict";
  var I = {};
  /* insumo: nombre, unidad base, cantidad del formato de compra (en unidad base),
     nombre del formato, precio neto del formato, área, referencia */
  function ins(id, n, u, fmt, fmtN, precio, area, ref){ I[id] = {n:n, u:u, fmt:fmt, fmtN:fmtN, precio:precio, area:area, ref:ref||"Estimado de góndola y mayorista"}; }

  /* ---------- horno y cocina ---------- */
  ins("harina","Harina sin polvos","g",25000,"saco 25 kg",19500,"horno","Mayorista panadero");
  ins("manteca","Manteca","g",10000,"caja 10 kg",24000,"horno","Mayorista panadero");
  ins("sal","Sal fina","g",1000,"bolsa 1 kg",450,"cocina");
  ins("aceite","Aceite vegetal","ml",5000,"bidón 5 L",9900,"cocina");
  ins("oliva","Aceite de oliva","ml",1000,"botella 1 L",7900,"cocina");
  ins("huevo","Huevo","u",180,"caja 180 u",30600,"cocina","Bandeja de 30 a $6.990 en góndola (abr 2026)");
  ins("carne","Posta negra picada","g",1000,"kg",9200,"horno","Carne de pino, precio de carnicería");
  ins("pollo","Pechuga de pollo","g",1000,"kg",5000,"cocina","≈ $5.900/kg en góndola");
  ins("cebolla","Cebolla","g",1000,"kg",900,"cocina","ODEPA mayorista");
  ins("tomate","Tomate","g",1000,"kg",1500,"cocina","ODEPA mayorista");
  ins("cherry","Tomate cherry","g",1000,"kg",3200,"cocina","ODEPA mayorista");
  ins("champinon","Champiñón","g",1000,"kg",4200,"cocina");
  ins("espinaca","Espinaca","g",1000,"kg",3500,"cocina");
  ins("choclo","Choclo congelado","g",1000,"kg",2600,"cocina");
  ins("pimenton","Pimentón rojo","g",1000,"kg",2200,"cocina");
  ins("cebollin","Cebollín","g",1000,"kg",3000,"cocina");
  ins("albahaca","Albahaca fresca","g",100,"atado 100 g",900,"cocina");
  ins("alinos","Aliños (comino, ají de color, orégano)","g",1000,"kg",9000,"cocina");
  ins("ajo","Ajo","g",1000,"kg",4500,"cocina");
  ins("aceituna","Aceituna","g",1000,"kg",5600,"cocina");
  ins("mozzarella","Queso mozzarella","g",1000,"kg",8400,"cocina","Góndola Líder y Jumbo, formato horeca");
  ins("qcabra","Queso de cabra","g",1000,"kg",21000,"cocina","$25.000–37.000/kg en góndola; neto mayorista");
  ins("mantecoso","Queso mantecoso","g",1000,"kg",8200,"cocina");
  ins("qcrema","Queso crema","g",1000,"kg",7500,"cocina");
  ins("qvegano","Queso vegano","g",1000,"kg",14000,"cocina");
  ins("jamon","Jamón pierna","g",1000,"kg",8900,"cocina");
  ins("serrano","Jamón serrano","g",1000,"kg",22000,"cocina");
  ins("soya","Carne de soya texturizada","g",1000,"kg",4800,"horno");
  ins("salsasoya","Salsa de soya","ml",1000,"botella 1 L",2900,"cocina");
  ins("pan","Pan de masa madre (rebanada)","u",30,"2 hogazas · 30 rebanadas",5400,"cocina","Panadería artesanal");
  ins("bagel","Bagel","u",6,"bolsa 6 u",4200,"cocina");
  ins("palta","Palta Hass","g",1000,"kg",4500,"cocina","ODEPA: $3.000–4.000/kg mayorista + flete");
  ins("mantequilla","Mantequilla","g",1000,"kg",9500,"cocina");
  ins("membrillo","Dulce de membrillo","g",1000,"kg",4200,"cocina");
  ins("yoghurt","Yoghurt natural","g",1000,"balde 1 kg",2600,"cocina");
  ins("granola","Granola casera","g",1000,"kg",6500,"cocina");
  ins("frutossecos","Mix de frutos secos","g",1000,"kg",14000,"cocina");
  ins("nueces","Nueces","g",1000,"kg",13000,"pasteleria");
  ins("almendras","Almendras","g",1000,"kg",14000,"pasteleria");
  ins("pistacho","Pistacho","g",1000,"kg",28000,"pasteleria");
  ins("sesamo","Sésamo negro","g",1000,"kg",6000,"cocina");
  ins("garbanzo","Garbanzo","g",1000,"kg",2100,"cocina");
  ins("tahini","Tahini","g",1000,"kg",9000,"cocina");
  ins("betarraga","Betarraga","g",1000,"kg",1500,"cocina");
  ins("hojas","Hojas verdes (mix, rúcula, berros)","g",1000,"kg",6000,"cocina");
  ins("pepino","Pepino","g",1000,"kg",1300,"cocina");
  ins("pepinillos","Pepinillos encurtidos","g",1000,"frasco 1 kg",4500,"cocina");
  ins("quinoa","Quinoa multicolor","g",1000,"kg",4800,"cocina");
  ins("mermelada","Mermelada de berries","g",1000,"kg",4500,"cocina");
  ins("miel","Miel","g",1000,"kg",9000,"cocina");

  /* ---------- frutas ---------- */
  ins("frutilla","Frutilla","g",1000,"kg",3200,"barra","ODEPA mayorista");
  ins("berries","Frambuesa y arándano (congelado)","g",1000,"kg",5200,"barra");
  ins("uva","Uva","g",1000,"kg",2400,"barra");
  ins("mango","Mango (pulpa congelada)","g",1000,"kg",3500,"barra");
  ins("durazno","Durazno","g",1000,"kg",2200,"barra");
  ins("maracuya","Pulpa de maracuyá","g",1000,"kg",4500,"barra");
  ins("pina","Piña","g",1000,"kg",2200,"barra");
  ins("manzana","Manzana verde","g",1000,"kg",1300,"barra");
  ins("melon","Melón tuna","g",1000,"kg",1500,"barra");
  ins("kiwi","Kiwi","g",1000,"kg",2200,"barra");
  ins("naranja","Naranja","g",1000,"kg",1100,"barra","ODEPA mayorista");
  ins("limon","Limón","g",1000,"kg",1600,"barra");
  ins("platano","Plátano","g",1000,"kg",1300,"pasteleria");
  ins("pera","Pera","g",1000,"kg",1500,"pasteleria");

  /* ---------- barra ---------- */
  ins("cafe","Café de especialidad en grano","g",1000,"kg",24000,"barra","Tostador de especialidad, precio por kilo");
  ins("leche","Leche entera","ml",1000,"L",980,"barra","≈ $1.150/L en góndola");
  ins("lveg","Leche vegetal","ml",1000,"L",2900,"barra");
  ins("choco","Chocolate en polvo","g",1000,"kg",9800,"barra","2 scoops por taza (receta de barra)");
  ins("sirope","Sirope (caramelo o vainilla)","ml",1000,"botella 1 L",8500,"barra");
  ins("chanar","Arrope de chañar","ml",1000,"botella 1 L",12000,"barra","20 ml por bebida (receta de barra)");
  ins("chai","Chai en polvo","g",1000,"kg",18000,"barra");
  ins("matcha","Matcha","g",100,"lata 100 g",9500,"barra","4 g por bebida");
  ins("golden","Mezcla golden milk","g",1000,"kg",22000,"barra");
  ins("tenegro","Té negro en hoja","g",1000,"kg",26000,"barra");
  ins("tesabores","Té de sabores e infusiones","g",1000,"kg",30000,"barra");
  ins("marshmallow","Marshmallow","g",1000,"kg",7000,"barra");
  ins("helado","Helado de vainilla","g",5000,"balde 5 L",21000,"barra");
  ins("crema","Crema de leche","ml",1000,"L",4200,"pasteleria");
  ins("tonica","Agua tónica (lata)","u",24,"pack 24",14400,"barra");
  ins("ginger","Ginger ale (lata)","u",24,"pack 24",15600,"barra");
  ins("kombucha","Kombucha (botella)","u",12,"caja 12",15600,"barra");
  ins("gaseosa","Gaseosa (lata)","u",24,"pack 24",12000,"barra");
  ins("agua","Agua mineral (botella)","u",24,"pack 24",9600,"barra");
  ins("azucar","Azúcar","g",1000,"kg",1100,"barra");
  ins("basefrappe","Base de frappé","g",1000,"kg",9000,"barra");
  ins("hielo","Hielo","g",10000,"bolsas 10 kg",6000,"barra");
  ins("filtro","Filtro de papel","u",100,"caja 100",6500,"barra");

  /* ---------- pastelería ---------- */
  ins("harinasg","Harina sin gluten","g",1000,"kg",4800,"pasteleria");
  ins("avena","Avena","g",1000,"kg",2400,"pasteleria");
  ins("zanahoria","Zanahoria","g",1000,"kg",900,"pasteleria");
  ins("chocolatecob","Chocolate de cobertura","g",1000,"kg",12000,"pasteleria");
  ins("manjar","Manjar","g",1000,"kg",3900,"pasteleria");
  ins("nutella","Crema de avellanas","g",1000,"kg",13000,"pasteleria");
  ins("oreo","Galleta de chocolate rellena","g",1000,"kg",9000,"pasteleria");
  ins("galleta","Galleta molida para base","g",1000,"kg",4000,"pasteleria");
  ins("coco","Coco rallado","g",1000,"kg",6500,"pasteleria");
  ins("canela","Canela molida","g",100,"bolsa 100 g",1500,"pasteleria");
  ins("mani","Mantequilla de maní","g",1000,"kg",7500,"pasteleria");
  ins("ricarica","Rica-rica","g",100,"atado seco 100 g",4000,"pasteleria","Hierba del altiplano, proveedor local");
  ins("hojaldre","Masa de hojaldre","g",1000,"kg",5200,"pasteleria");
  ins("lechecond","Leche condensada","g",1000,"kg",4200,"pasteleria");
  ins("castana","Castaña de cajú (base vegana)","g",1000,"kg",16000,"pasteleria");

  /* ===================== operativa por familia ===================== */
  var OP = {
    emp:{vaj:"Plato de pan o bolsa kraft para llevar · servilleta",ute:"Uslero, cortador de 16 cm, latas perforadas, pincel, termómetro",
      prep:"Masa: harina, sal y manteca tibia; amasar sin trabajar de más y reposar 30 min tapada. Estirar a 3 mm y cortar discos de 16 cm. Relleno frío, porcionado con cuchara medida.",
      coc:"Horno a 220 °C. La lata de 15 de la casa está calibrada en 5 min (horno del Control de Salón); revisar dorado parejo.",
      mont:"Pintar con huevo antes del horno. Servir caliente sobre papel; para llevar, bolsa abierta 1 min para que no sude.",
      crit:"Relleno a más de 74 °C en el centro\nPino reposado en frío al menos 12 h\nRepulgue sellado: si se abre, se pierde el relleno\nNo recalentar más de una vez"},
    des:{vaj:"Plato llano 28 cm, bowl pequeño, vaso de jugo y taza",ute:"Sartén antiadherente, tostadora, espátula, jarra de leche",
      prep:"Mise en place antes del servicio: frutas cortadas, porciones de queso pesadas, tostadas al momento.",
      coc:"Huevos a fuego medio-bajo, retirar cremosos. Tostadas 2 min por lado.",
      mont:"Plato principal al centro, acompañamientos a la izquierda, bebidas al servir.",
      crit:"Todo sale junto: plato, jugo y café\nHuevos sin dorar\nJugo exprimido en el momento"},
    brus:{vaj:"Tabla de madera o plato llano",ute:"Plancha, cuchillo de pan, espátula",
      prep:"Rebanadas de masa madre de 1,5 cm. Palta laminada al momento con limón.",
      coc:"Pan a la plancha con aceite de oliva, 1 a 2 min por lado.",
      mont:"Base, crema o queso, topping y hojas al final para que no se marchiten.",
      crit:"Pan crocante por fuera\nPalta sin oxidar\nHojas lavadas y secas"},
    ens:{vaj:"Bowl hondo de cerámica",ute:"Centrífuga de hojas, cuchillo de verduras, balanza",
      prep:"Hojas lavadas, secas y frías. Quinoa cocida y enfriada. Pesar cada componente.",
      coc:"Quinoa 15 min en agua hirviendo con sal, reposo 5 min.",
      mont:"Base verde, componentes en sectores, aliño aparte.",
      crit:"Cadena de frío bajo 5 °C\nAliño aparte para llevar"},
    bowl:{vaj:"Bowl de coco o cerámica",ute:"Balanza, cuchillo de frutas, cuchara de servicio",
      prep:"Frutas lavadas y cortadas en cubos de 1 cm; granola en porciones de 40 g.",
      coc:"Sin cocción.",
      mont:"Base al fondo, frutas en sectores, granola y frutos secos al final para que no se ablanden.",
      crit:"Fruta del día\nGranola crocante, agregar al servir"},
    cafe:{vaj:"Taza precalentada con plato y cuchara",ute:"Molino, portafiltro, tamper, balanza, jarra de leche",
      prep:"Moler al momento. Dosis pesada en balanza.",
      coc:"Extracción de 25 a 30 s. Leche vaporizada a 60–65 °C.",
      mont:"Crema intacta; arte latte en las bebidas con leche.",
      crit:"Dosis y tiempo de extracción\nLeche sin hervir (bajo 70 °C)\nPurgar y limpiar la lanceta después de cada uso"},
    frio:{vaj:"Vaso alto con hielo y bombilla",ute:"Portafiltro, jigger, cuchara bailarina, licuadora",
      prep:"Hielo en el vaso antes que el líquido.",
      coc:"Espresso extraído al momento y vertido sobre el hielo.",
      mont:"Capas visibles cuando la bebida lo permita.",
      crit:"Hielo seco y en buen estado\nServir de inmediato"},
    te:{vaj:"Taza o tetera con plato",ute:"Balanza, hervidor con temperatura, colador",
      prep:"Pesar hoja o mezcla.",
      coc:"Té negro a 95 °C por 4 min; té verde y matcha a 80 °C.",
      mont:"Tetera con colador aparte; latte con espuma fina.",
      crit:"Temperatura del agua\nTiempo de infusión"},
    jugo:{vaj:"Vaso de 420 cc con bombilla",ute:"Licuadora, exprimidor, colador",
      prep:"Fruta lavada y porcionada en bolsas por vaso.",
      coc:"Sin cocción. Licuar 30 s.",
      mont:"Servir sin espuma excesiva.",
      crit:"Preparado al momento\nFruta sin golpes"},
    envasado:{vaj:"Vaso con hielo o envase original",ute:"Abridor",
      prep:"Mantener refrigerado.",coc:"Sin preparación.",mont:"Servir frío.",crit:"Rotación por fecha de vencimiento"},
    past:{vaj:"Plato de postre con tenedor",ute:"Cuchillo caliente para porcionar, espátula, balanza",
      prep:"Producción del día anterior; porcionar en frío.",
      coc:"Según receta de pastelería; horneados a 170–180 °C.",
      mont:"Porción al centro, limpia, con el corte a la vista.",
      crit:"Porcionado parejo (12 porciones por torta)\nCadena de frío bajo 5 °C para cremas y cheesecakes\nRotular fecha de elaboración"}
  };

  var F = {};
  function ficha(id, fam, ing, merma, extra){
    var f = {ing:ing, merma:merma, rinde:1};
    var o = OP[fam]; for(var k in o) f[k]=o[k];
    if(extra) for(var j in extra) f[j]=extra[j];
    F[id]=f;
  }

  /* ---------- empanadas (por unidad; la masa es común) ---------- */
  var MASA = [["harina",55],["manteca",12],["sal",1],["huevo",0.05]];
  function emp(id, relleno, prep){ ficha(id,"emp",MASA.concat(relleno),3,prep?{prep:OP.emp.prep+" "+prep}:null); }
  emp("Ee-pino",[["carne",45],["cebolla",60],["huevo",0.17],["aceituna",5],["alinos",1],["aceite",3]],"Pino: cebolla en pluma sudada con aliños, carne sellada aparte; unir y enfriar. Un trozo de huevo duro y una aceituna por empanada.");
  emp("Ee-pollo",[["pollo",45],["pimenton",15],["mozzarella",25],["alinos",0.5]],"Pollo cocido y desmenuzado con pimentón salteado; mozzarella al armar.");
  emp("Ee-napolitana",[["mozzarella",35],["tomate",20],["jamon",15],["alinos",0.3]],"Tomate en cubos sin semillas y bien estilado.");
  emp("Ee-oriental",[["pollo",40],["mozzarella",25],["cebollin",10],["salsasoya",5]],"Cebollín salteado en soya y enfriado antes de armar.");
  emp("Ee-caprese",[["mozzarella",40],["tomate",25],["albahaca",2]]);
  emp("Ee-rustica",[["qcabra",35],["tomate",20],["albahaca",2]]);
  emp("Ee-champinon",[["champinon",40],["choclo",20],["mozzarella",30]],"Champiñón laminado salteado y estilado.");
  emp("Ee-redvegan",[["soya",15],["champinon",25],["cebolla",30],["aceituna",5],["alinos",1]],"Soya hidratada 20 min en caldo de verduras y salteada con la cebolla.");
  emp("Ee-greenvegan",[["espinaca",35],["choclo",20],["qvegano",30]],"Espinaca salteada y muy estilada.");

  /* ---------- desayunos y brunch (incluyen jugo y café) ---------- */
  var JC = [["naranja",350],["cafe",12]];
  ficha("atacamena","des",[["pan",3],["qcabra",50],["membrillo",40],["aceituna",20],["yoghurt",120],["chanar",15],["granola",30]].concat(JC),5);
  ficha("chileno","des",[["huevo",3],["mantequilla",10],["pan",3],["sal",1]].concat(JC),5);
  ficha("sanpedrino","des",[["bagel",1],["jamon",60],["tomate",40],["hojas",25],["yoghurt",120],["granola",30]].concat(JC),5);
  ficha("nortino","des",[["harina",120],["manteca",20],["mantecoso",70],["sal",1]].concat(JC),5);
  ficha("altiplano","des",[["cherry",100],["qcabra",50],["albahaca",8],["oliva",15],["pan",2]].concat(JC),5);
  ficha("andino","des",[["huevo",3],["mantecoso",40],["champinon",60],["pepinillos",20],["hojas",25],["pan",2]].concat(JC),5);
  ficha("atacama","des",[["pan",2],["palta",120],["huevo",1],["hojas",25],["limon",5]].concat(JC),5);

  /* ---------- bruschettas y tostadas ---------- */
  ficha("caspana","brus",[["pan",2],["palta",100],["mozzarella",40],["cherry",50],["hojas",15],["sesamo",2],["oliva",8]],5);
  ficha("sanpedro","brus",[["pan",2],["palta",90],["garbanzo",30],["betarraga",30],["tahini",8],["hojas",15],["pistacho",10],["oliva",8]],5);
  ficha("guatin","brus",[["pan",2],["qcrema",50],["champinon",70],["ajo",3],["cebollin",5],["oliva",8]],5);
  ficha("andes","brus",[["pan",2],["qcrema",40],["membrillo",30],["serrano",30],["hojas",15],["nueces",10]],5);
  ficha("t-palta","brus",[["pan",3],["palta",100],["sesamo",2],["limon",5]],5);
  ficha("t-huevos","brus",[["pan",3],["huevo",2],["mantequilla",8],["sal",1]],5);
  ficha("t-hummus","brus",[["pan",3],["garbanzo",40],["tahini",10],["oliva",8],["limon",8],["sesamo",2]],5);
  ficha("t-mantequilla","brus",[["pan",3],["mantequilla",20],["aceituna",25],["oliva",5]],5);
  ficha("t-quesocrema","brus",[["pan",3],["qcrema",50],["mermelada",30]],5);

  /* ---------- ensaladas y bowls ---------- */
  ficha("licancabur","ens",[["mozzarella",70],["cherry",100],["albahaca",8],["oliva",15],["aceituna",25],["nueces",15],["hojas",40]],5);
  ficha("quimal","ens",[["quinoa",60],["cherry",80],["pepino",60],["palta",80],["almendras",15],["serrano",40],["hojas",30],["oliva",10]],5);
  ficha("bowl-antioxidante","bowl",[["yoghurt",200],["frutilla",40],["berries",60],["uva",30],["granola",40],["frutossecos",15],["miel",10]],6);
  ficha("bowl-energizante","bowl",[["mango",70],["durazno",60],["maracuya",30],["pina",70],["granola",40],["frutossecos",15]],6);
  ficha("bowl-desintoxicante","bowl",[["manzana",60],["melon",60],["espinaca",20],["pina",60],["kiwi",50],["granola",40],["frutossecos",15]],6);

  /* ---------- café caliente ---------- */
  ficha("espresso","cafe",[["cafe",12]],2);
  ficha("americano","cafe",[["cafe",18]],2);
  ficha("flatwhite","cafe",[["cafe",18],["leche",150]],3);
  ficha("cappuccino","cafe",[["cafe",12],["leche",150]],3);
  ficha("latte","cafe",[["cafe",18],["leche",220]],3);
  ficha("cafeconleche","cafe",[["cafe",12],["leche",200]],3);
  ficha("caramel","cafe",[["cafe",18],["leche",220],["sirope",20]],3);
  ficha("vainilla","cafe",[["cafe",18],["leche",220],["sirope",20]],3);
  ficha("mocaccino","cafe",[["cafe",12],["leche",180],["choco",25]],3);
  ficha("v60","cafe",[["cafe",28],["filtro",1]],2,{coc:"Agua a 93 °C, relación 1:16 (28 g por 440 ml), 3 min 30 s.",ute:"V60, hervidor de cuello de cisne, balanza, molino"});
  ficha("chemex","cafe",[["cafe",22],["filtro",1]],2,{coc:"Agua a 94 °C, relación 1:16, 4 min.",ute:"Chemex, hervidor de cuello de cisne, balanza, molino"});

  /* ---------- té, chocolate ---------- */
  ficha("chai","te",[["chai",25],["leche",220]],3);
  ficha("matcha","te",[["matcha",4],["leche",220],["azucar",8]],3);
  ficha("golden","te",[["golden",10],["leche",220]],3);
  ficha("tenegro","te",[["tenegro",8]],2);
  ficha("tesabores","te",[["tesabores",8]],2);
  ficha("chococaliente","te",[["choco",40],["leche",220]],3,{crit:"2 scoops de chocolate por taza\nLeche bajo 70 °C"});
  ficha("chocomarsh","te",[["choco",40],["leche",220],["marshmallow",15]],3);

  /* ---------- fríos ---------- */
  ficha("f-americano","frio",[["cafe",18],["hielo",150]],2);
  ficha("f-latte","frio",[["cafe",18],["leche",200],["hielo",120]],3);
  ficha("f-caramel","frio",[["cafe",18],["leche",200],["hielo",120],["sirope",20]],3);
  ficha("f-chanar","frio",[["cafe",18],["leche",200],["hielo",120],["chanar",20]],3);
  ficha("f-tonic","frio",[["cafe",18],["tonica",1],["hielo",100],["limon",5]],2);
  ficha("f-ginger","frio",[["cafe",18],["ginger",1],["hielo",100]],2);
  ficha("f-frappe","frio",[["cafe",18],["leche",150],["hielo",150],["basefrappe",20]],3);
  ficha("f-frappe-caramel","frio",[["cafe",18],["leche",150],["hielo",150],["basefrappe",20],["sirope",20]],3);
  ficha("f-frappe-moca","frio",[["cafe",18],["leche",150],["hielo",150],["basefrappe",20],["choco",20]],3);
  ficha("f-helado","frio",[["cafe",18],["helado",80],["crema",30],["leche",100],["hielo",80]],3);
  ficha("f-affogato","frio",[["cafe",12],["helado",100]],2);
  ficha("f-chai","frio",[["chai",25],["leche",200],["hielo",120]],3);
  ficha("f-matcha","frio",[["matcha",4],["leche",200],["hielo",120],["azucar",8]],3);
  ficha("f-icedtea","frio",[["tesabores",6],["berries",30],["azucar",15],["hielo",150]],3);

  /* ---------- jugos, smoothies y envasados ---------- */
  ficha("f-jugo-pina","jugo",[["pina",300],["azucar",15],["hielo",100]],5);
  ficha("f-jugo-frutilla","jugo",[["frutilla",250],["azucar",15],["hielo",100]],5);
  ficha("f-jugo-arandano","jugo",[["berries",200],["azucar",15],["hielo",100]],5);
  ficha("f-limonada","jugo",[["limon",120],["azucar",25],["hielo",120]],5);
  ficha("f-naranja","jugo",[["naranja",700]],5,{crit:"Sin azúcar añadida\nExprimida al momento"});
  ficha("f-smoothie-antiox","jugo",[["frutilla",60],["berries",80],["uva",50],["leche",150],["azucar",10]],5);
  ficha("f-smoothie-energ","jugo",[["mango",80],["durazno",60],["maracuya",30],["pina",60],["leche",150]],5);
  ficha("f-smoothie-detox","jugo",[["manzana",70],["melon",60],["espinaca",20],["pina",50],["kiwi",50],["leche",150]],5);
  ficha("f-kombucha","envasado",[["kombucha",1]],0);
  ficha("f-gaseosas","envasado",[["gaseosa",1],["hielo",80]],0);
  ficha("f-agua","envasado",[["agua",1]],0);

  /* ---------- pastelería (por porción): base según tipo + sabor según el nombre ---------- */
  var SABOR = [[/maracuy/i,"maracuya",30],[/frutilla/i,"frutilla",35],[/manzana/i,"manzana",50],[/berries|frambuesa|ar[aá]ndano|frutos rojos|con frutos/i,"berries",35],
    [/cha[ñn]ar/i,"chanar",15],[/nutella/i,"nutella",25],[/oreo/i,"oreo",20],[/manjar/i,"manjar",30],[/lim[oó]n/i,"limon",15],[/membrillo/i,"membrillo",30],
    [/mango/i,"mango",35],[/coco/i,"coco",12],[/matcha/i,"matcha",3],[/almendra/i,"almendras",12],[/pistacho/i,"pistacho",10],[/pl[aá]tano/i,"platano",40],
    [/nuez/i,"nueces",20],[/rica-rica/i,"ricarica",1],[/durazno/i,"durazno",40],[/perita/i,"pera",45],[/man[ií]/i,"mani",15],[/snickers/i,"manjar",20],
    [/chocolate|snickers|chip/i,"chocolatecob",20],[/zanahoria/i,"zanahoria",30],[/avena/i,"avena",25],[/cinnamon|canela/i,"canela",1],[/naranja/i,"naranja",40],
    [/yoghurt/i,"yoghurt",30],[/albahaca/i,"albahaca",1]];
  var BASE = {
    tarta:[["harina",40],["mantequilla",25],["azucar",22],["huevo",0.4],["leche",40],["crema",20]],
    tartav:[["harina",40],["aceite",18],["azucar",22],["castana",35],["lveg",30]],
    treslech:[["harina",30],["azucar",30],["huevo",1],["lechecond",60],["leche",60],["crema",50]],
    galleton:[["harina",40],["mantequilla",18],["azucar",22],["huevo",0.2]],
    paquete:[["harina",60],["mantequilla",25],["azucar",25],["huevo",0.2]],
    galleta:[["harinasg",35],["mantequilla",15],["azucar",18],["huevo",0.2]],
    kuchen:[["harina",45],["mantequilla",25],["azucar",25],["huevo",0.4],["leche",20]],
    cheese:[["galleta",20],["mantequilla",8],["qcrema",70],["crema",20],["azucar",18],["huevo",0.3]],
    cheesev:[["galleta",20],["aceite",6],["castana",45],["lveg",30],["azucar",18]],
    muffin:[["harina",45],["azucar",25],["aceite",15],["huevo",0.5],["leche",25]],
    milhojas:[["hojaldre",60],["manjar",50],["azucar",5]],
    torta:[["harina",35],["azucar",35],["huevo",1],["mantequilla",15],["crema",60],["manjar",40]],
    tortav:[["harina",35],["azucar",32],["aceite",20],["lveg",50],["chocolatecob",30],["castana",20]],
    panqueque:[["harina",30],["huevo",0.8],["leche",70],["crema",60],["azucar",25],["manjar",25]]
  };
  function pastel(id, nombre, sub){
    var veg = /vegan/i.test(nombre), b = sub;
    if(sub==="minitorta") b="torta";
    if(veg && (b==="tarta"||b==="cheese"||b==="torta")) b+= "v";
    var ing = BASE[b] ? BASE[b].map(function(x){ return [x[0],x[1]]; }) : BASE.torta.slice();
    var usados = {};
    SABOR.forEach(function(s){ if(s[0].test(nombre) && !usados[s[1]]){ usados[s[1]]=1; ing.push([s[1],s[2]]); } });
    var extra = {};
    if(!Object.keys(usados).length) extra.prep = OP.past.prep+" Relleno y cobertura de la casa: completar en la planilla de pastelería.";
    ficha(id,"past",ing,6,extra);
  }
  var PAST = [["Pt-maracuya-pistacho","Tarta maracuyá y pistacho","tarta"],["Pt-frutilla","Tarta de frutilla","tarta"],["Pt-manzana","Tarta de manzana","tarta"],
    ["Pt-berries-chanar","Tarta vegana de berries y chañar","tarta"],["Pt-snickers","Tarta vegana Snickers","tarta"],["Pt-maracuya-ricarica","Tarta vegana maracuyá y rica-rica","tarta"],
    ["Pt-migas","Tarta de migas con frutos","tarta"],["Ptreslech","Tres leches Emporio","treslech"],["Pg-zanahoria","Galletón de zanahoria","galleton"],
    ["Pg-chocolate","Galletón de chocolate","galleton"],["Pg-paquete","Paquete de galletas","paquete"],["Pg-singluten","Galleta sin gluten","galleta"],
    ["Pg-avena","Galletón de avena Emporio","galleton"],["Pk-manzana-canela","Kuchen de manzana y canela","kuchen"],["Pk-nuez","Kuchen de nuez","kuchen"],
    ["Pk-frutosrojos","Kuchen de frutos rojos","kuchen"],["Pk-sureno","Kuchen sureño Emporio","kuchen"],["Pk-yoghurt-mango","Kuchen de yoghurt y mango","kuchen"],
    ["Pk-durazno-ricarica","Kuchen de durazno y rica-rica","kuchen"],["Pk-yoghurt-frutilla","Kuchen de yoghurt, frutilla y rica-rica","kuchen"],["Pk-perita","Kuchen de perita","kuchen"],
    ["Pk-oreo-mani","Kuchen de Oreo y mantequilla de maní","kuchen"],["Pc-frambuesa","Cheesecake de frambuesa","cheese"],["Pc-maracuya","Cheesecake de maracuyá","cheese"],
    ["Pc-nutella","Cheesecake de Nutella","cheese"],["Pc-oreo-manjar","Cheesecake de Oreo y manjar","cheese"],["Pc-arandano-limon","Cheesecake de arándano y limón Emporio","cheese"],
    ["Pc-ricarica-limon","Cheesecake de rica-rica y limón Emporio","cheese"],["Pc-chanar","Cheesecake de chañar","cheese"],["Pc-platano-manjar","Cheesecake de plátano y manjar","cheese"],
    ["Pc-frambuesa-albahaca","Cheesecake de frambuesa y albahaca","cheese"],["Pc-membrillo","Cheesecake de membrillo","cheese"],["Pc-frutilla-limon","Cheesecake de frutilla y limón","cheese"],
    ["Pc-cinnamon","Cheesecake cinnamon","cheese"],["Pc-mango-coco","Cheesecake de mango y coco","cheese"],["Pc-matcha","Cheesecake de matcha","cheese"],
    ["Pc-frambuesa-almendra","Cheesecake de frambuesa y almendra","cheese"],["Pc-pistacho-albahaca","Cheesecake de pistacho y albahaca","cheese"],
    ["Pc-berries-vegano","Cheesecake de berries vegano","cheese"],["Pc-maracuya-vegano","Cheesecake de maracuyá vegano","cheese"],["Pc-frutilla-ricarica","Cheesecake de frutilla y rica-rica","cheese"],
    ["Pm-arandano","Muffin de arándano Emporio","muffin"],["Pm-frambuesa-blanco","Muffin de frambuesa y chocolate blanco","muffin"],["Pm-chip","Muffin chip chocolate","muffin"],
    ["Pm-chocolate","Muffin de chocolate","muffin"],["Pmilhojas","Mil hojas","milhojas"],["Pto-chocolate","Torta de chocolate Emporio","torta"],["Pto-pakari","Torta Pakari","torta"],
    ["Pto-inti","Torta Inti","torta"],["Pto-nusta","Torta Ñusta","torta"],["Pto-killa","Torta Killa","torta"],["Pto-amor-mini","Mini torta Amor","minitorta"],
    ["Pto-choco-maracuya","Torta vegana de chocolate y maracuyá","torta"],["Pto-choco-naranja","Torta vegana de chocolate y naranja","torta"],
    ["Pto-panqueque-berries","Torta panqueque de berries","panqueque"],["Pto-amor","Torta Amor","torta"],["Pto-panqueque-naranja","Torta panqueque de naranja Emporio","panqueque"]];
  PAST.forEach(function(p){ pastel(p[0],p[1],p[2]); });

  return {
    fecha:"octubre de 2026",
    nota:"Valores especulados con referencias públicas (ODEPA, góndola Líder y Jumbo, estudio USS de la empanada de pino 2026 y estándares de barra). Solo para la Prueba.",
    fuentes:["ODEPA · boletines de precios mayoristas de frutas y hortalizas 2026","USS · costo de la empanada de pino, Fiestas Patrias 2026","Líder y Jumbo · precios de góndola de quesos, huevos y lácteos 2026","Estándares de barra: espresso doble 18 g; receta de la casa: simple 12 g, V60 28 g"],
    INS:I, FICHAS:F
  };
})();
