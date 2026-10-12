# EmporioAndinoPOS v3.1

Sistema gastronómico y punto de venta de Emporio Andino (San Pedro de Atacama), unificado.

## Capas

```
Sistema general (index.html) ── capa superior: ingreso con PIN, cargos, versión vigente,
│                                verificación, versiones aplicadas, accesos y retroalimentación
├── Caja            caja/index.html      punto de venta: cobro, boleta, stock, costos y fichas técnicas,
│                                         compras, mermas, metas (lectura) e informes
├── Control de Salón carta/salon.html    disponibilidad de la carta, horno y estudio de la carta
├── Comandas        cocina/index.html    ventas de la Caja repartidas por estación (cocina, barra, horno)
├── Carta Interactiva carta/index.html   la carta que usa el cliente en la mesa
└── Prueba          prueba/index.html    simulación por día, semana o mes, pedidos a mano, horno en vivo,
                                          fichas y escandallos estándar y borrador de cambios; "Aplicar al
                                          sistema general" es el único camino para cambiar precios, carta y metas
    prueba/estandar.js  insumos, precios de compra y fichas técnicas estándar (solo para la Prueba)
nucleo/datos.js   la carta única (130 productos, 10 idiomas)
nucleo/nucleo.js  catálogo, configuración general y de prueba, versiones, equipo, cargos, PIN y sesión
nucleo/emporio.css  sistema de diseño de Emporio System 1.1, común a todas las capas
nucleo/emporio.js   comportamientos de Emporio System 1.1 (resortes, indicador, mosaicos, atmósfera, avisos)
nucleo/tema.js      elige el tema (nativo o Carta Andina) en cada página
nucleo/tema-andino.css  tema #2 Carta Andina para todas las capas
```

Cómo fluye el dato:

1. En la **Prueba** se cambian precios, se sacan productos de la carta o se ajustan metas. El borrador
   se compara con el sistema general en los días del contexto (la semana o el mes elegido).
2. **Aplicar al sistema general** guarda una versión nueva (quién, cuándo, qué cambió).
3. La **Caja**, la **Carta**, el **Control de Salón** y las **Comandas** leen esa versión. La Caja vende,
   descuenta stock (`ea_control`, el mismo que marca el Salón y suma el horno) y cada venta aparece en
   Comandas.

## Tema #2: Carta Andina (v3.1)

Alternativa al tema nativo (Emporio System 1.1, noche volcánica con vidrio y turquesa) para **todas las
capas**: sistema general, Caja, Fila y pantalla de llamado, Salón, Comandas, Horno, Panadería, Carta y
Prueba.

- **Paleta:** los once colores de la foto del camino al desierto: azul noche `#102948`, azul `#204F8D`,
  cielo `#4682B9`, bruma `#7DA9C5`, arena `#D3BEA0`, trigo `#BC9670`, tierra tostada `#90603A`, ocre
  `#C07943`, óxido claro `#A75D33`, óxido `#743725` y tierra `#392418`. Donde la carta usa turquesa va el
  azul; donde usa naranjo, el ocre y el óxido. Los estados siguen siendo verde, ámbar y rojo, en tonos
  tierra, para que se lean igual que en el nativo.
- **Diseño y letra de la carta impresa:** papel claro, títulos escritos a mano, bajadas redondeadas, texto
  espaciado, precios en una mancha de color, puntadas junto a cada ítem, la guarda andina (ola, triángulos
  y puntos) y montañas al pie. La carta usa Chinchilla, Neulis Cursive y Citrine, que no se pueden
  publicar en la web; el tema usa sus equivalentes libres de Google Fonts (Gochi Hand, Grandstander y
  Lexend). Si un equipo tiene instaladas las originales, se usan esas.
- **Cómo se elige:** botón de paleta junto a la versión (columna del sistema), en la pantalla de ingreso, o *Versiones →
  Tema del sistema*. Se guarda por equipo (`eapos_tema`) y cambia al instante en todas sus ventanas y
  módulos abiertos. `?tema=andino` en la dirección (por ejemplo, el enlace de la Carta) lo deja fijo en ese
  equipo; `?tema=nativo` vuelve al de siempre.
- **Archivos:** `nucleo/tema.js` (en el `<head>` de cada página: aplica el tema antes de pintar y carga las
  fuentes solo si hace falta) y `nucleo/tema-andino.css` (todo el tema, activo solo con
  `<html data-tema="andino">`). El tema nativo no cambió.

## Equipo, pantalla de inicio y seguridad (v3.0)

### Pantalla de inicio

Mosaico por áreas (Dirección, Jefatura, Encargados de turno, Barra y café, Salón y atención, Cocina,
Panadería y pastelería) con las 28 personas de la lista oficial. Al tocar a alguien pide su PIN de 4
dígitos (la primera vez lo crea) y entra **directo a su área**: barra a Comandas de barra, cocina a
Comandas de cocina, panadería a Panadería, garzones a Fila y mesas; dirección, jefatura y encargados al
Inicio. 5 PIN equivocados bloquean a esa persona un minuto. La sesión de Caja, Fila y gestión se cierra
tras 10 minutos sin uso; las pantallas de cocina, barra y panadería quedan abiertas.

Los PIN creados con el nombre anterior (Jona, Daline, Mariela, Wilbert, Andrea Rodriguez y los demás nombres cortos) siguen sirviendo y
pasan al nombre nuevo en el primer ingreso. Salieron Magda y el usuario genérico *Panadería*, que no están
en la lista oficial.

### Cargos (RBAC + área)

| Cargo (clave) | Entra a | Áreas | Puede además |
|---|---|---|---|
| Dirección (`DUENO`) | Inicio | todas, Prueba, verificación, versiones | cifras, costos, PIN ajenos |
| Jefatura (`JEFE_AREA`) | Inicio | todas, Prueba, verificación, versiones | stock, compras, mermas, informes, anular sin pedir clave |
| Encargados (`ENCARGADO_TURNO`) | Inicio | Caja, Fila, Salón, Comandas, Horno, Panadería, Carta | cobro, cierre e informes de la Caja (sin stock ni compras); anulan y autorizan con su PIN |
| Garzones (`GARZON`) | Fila y mesas | Fila, Caja (solo cobro), Salón (consulta), Carta | sus ventas y sus propinas |
| Barra (`BARISTA`) | Comandas de barra | Comandas de barra | disponibilidad de lo suyo |
| Cocina (`COCINA`) | Comandas de cocina | Comandas de cocina, Horno | María Torrez recibe, solicita y reporta precocido; Daisy Pérez recibe |
| Panadería (`PANADERIA`) | Panadería | Panadería | Eva Galarza y Claudia Garcías envían al horno y confirman solicitudes |

Los costos y las cifras en pesos siguen solo para dirección. Las acciones que piden la **clave de un
encargado** (o de jefatura/dirección): anular una venta, volver una comanda lista a pendiente y cambiar un
pedido de la fila que ya salió a comandas. El encargado elige su nombre y da su PIN en la misma pantalla;
la autorización vale una sola vez y por 60 segundos.

### Cómo se hace cumplir

- **`EAPOS.seguridad.guardia(modulo)`** al comienzo de cada módulo (Caja, Fila, pantalla de llamado,
  Salón, Comandas, Horno, Panadería, Prueba): sin sesión, con la sesión vencida (14 h) o fuera del área
  del cargo, la página se detiene, muestra **403** y anota el intento. Vale también al abrir el módulo
  por su dirección.
- **`EAPOS.seguridad.exigir(accion, recurso)`** dentro de las funciones que escriben datos
  (`nucleo/produccion.js`, `nucleo/fila.js`, Caja, Salón, Comandas): aunque el botón se esconda, la
  escritura se vuelve a revisar contra el cargo, las acciones propias de la persona y, si corresponde, la
  autorización de un encargado.
- **Bitácora** (`eapos_bitacora`, últimos 1.500 registros): ingresos, salidas, PIN fallidos, bloqueos, 403 y
  autorizaciones. Cada registro lleva la huella del anterior, así que borrar o cambiar uno rompe la
  cadena; *Versiones → Bitácora de seguridad* lo muestra y avisa. Ahí mismo está el perímetro de cada cargo.
- La política (cargos, áreas y acciones) es una tabla en `nucleo/nucleo.js`, pensada para que un
  servidor use la misma.

**Límite honesto:** EmporioAndinoPOS no tiene servidor: son páginas estáticas que guardan en el
navegador. Toda esta seguridad corre en el mismo navegador, así que ordena el trabajo y deja rastro, pero
alguien con conocimientos técnicos y acceso al equipo podría saltársela con las herramientas del
navegador. Un *middleware* de verdad (token firmado y 403 en cada ruta de una API) necesita un servidor
con base de datos; es el paso siguiente y también resuelve compartir datos entre varios equipos.

## Fila de espera y mesas (v2.8)

Área **Fila y mesas** (`fila/index.html`, datos en `nucleo/fila.js`, clave `eapos_fila`, por día):

- **Anotar en la fila:** nombre, personas, *para comer aquí* (espera mesa) o *para llevar*, y teléfono
  opcional. Cada grupo recibe su número de turno.
- **Comandar en la fila:** el pedido se toma mientras esperan, a mano (carta por grupos y buscador, con
  los bloqueos de horario) o con el **código de la Carta**. Se elige *preparar ya* o *al sentarse / al
  llegar al mesón*. Lo comandado sale a Comandas de cocina y de barra y a las comandas del Horno como
  cualquier venta (`EAPOS.fila.comandables()`).
- **Mesas:** tablero con las mesas libres, llamadas y ocupadas (12 por defecto, se ajusta). Al liberar una
  mesa el sistema propone **llamar al siguiente**; la mesa queda guardada para ese grupo.
- **Llamar:** la **pantalla de llamado** (`fila/llamado.html`, para una tele o un segundo monitor) muestra
  el turno, el nombre y la mesa, y suena. Si dejó teléfono, un botón abre WhatsApp con el aviso. Si no
  llega en el tiempo de espera (6 min por defecto), *No llegó* le hace perder el turno y llama al
  siguiente para esa mesa. Para llevar: *Listo: llamar* y *Entregado*.
- **Cobrar:** *Cobrar en Caja* deja el pedido en `eapos_traspaso`; la Caja lo toma apenas su cuenta está
  vacía, con el modo del grupo. La venta guarda `fila` y, si el pedido ya se había comandado, no se vuelve
  a comandar.
- **Avisos:** la campana avisa *Mesa N libre: llama a Nº …* y cuando un llamado no llega. Después de las
  21:30 solo se anota para llevar.

### Código de la Carta (`nucleo/codigo-fila.js`)

Al confirmar su pedido en la Carta, el cliente ve un **código para la fila** (por ejemplo
`M20G 10W3 1C1M 5`). Lleva el destino, las personas y cada producto con su cantidad, y dos letras de
control. No necesita internet ni servidor. Se escribe en *Anotar en la fila* o en *Comandar*; si una
letra está mal, o el código viene de otra versión de la carta, el sistema lo dice en vez de leerlo mal.
Las opciones (leche, sirope) no viajan en el código: se leen en el ticket del teléfono.

La **copia de la Carta digital** (artifact *Carta Interactiva (Copy)*) es la carta para los clientes en la
fila: tiene la galería, los servicios del pueblo e Instagram, y ahora los mismos productos, precios y
código que el sistema.

## Carta de junio de 2026 (v2.8)

`nucleo/datos.js` lleva los precios de la carta física (`CARTAEMPORIOANDINO_COMPLETA.pdf`): 142
productos.

- **Nuevos:** Sandwiches (Catarpe, Solor, Checar, Poconche, Quitor, Condeduque), Bowl Asaí, Espresso
  doble, Cappuccino vainilla y caramelo, Tetera de infusiones locales y Alfajor.
- **Renombrados:** Bowl Tropical y Bowl Detox (ahora sobre yoghurt), Espresso simple, Latte vainilla y
  caramelo, Latte caramel y chañar fríos, Café helado.
- **Pastelería:** el precio de su tipo (torta $5.500, cheesecake $4.800, kuchen, pie o tarta $4.500,
  alfajor $2.500). Muffins, galletones, mil hojas, tres leches y la mini torta no están en la carta: siguen
  con el precio que se les dé en la Prueba.
- **Extras en la Caja:** leche vegetal $300, café descafeinado $300 y miel $600, para bebidas y
  desayunos (el sirope sigue con el precio de Ajustes).
- **Una vez por equipo,** el sistema general pasa a una versión nueva, *Precios de la carta física de
  junio de 2026*: quita los precios propios que tapaban a los nuevos, saca de la carta el café con leche y
  deja cada cambio en el historial (`EAPOS.general`, clave `eapos_carta`).
- Fichas estándar para todo lo nuevo (pan de sandwich, asaí, mantequilla de maní, lactonesa, hierbas de
  infusión). En la Prueba, todo insumo de la carta parte con al menos un formato de compra.

## Horno, Panadería y comandas separadas (v2.7)

**Instalar en Mac:** `INSTALAR-MAC.md` (doble clic en `Iniciar EmporioAndinoPOS.command`).
**Prueba nº 1:** `PRUEBA-1.md`, el recorrido de un turno real.

### Panadería → Horno → Vitrina

Vive en `nucleo/produccion.js` (`EAPOS.prod`), compartido por el Horno, la Panadería, el Salón y el
sistema general. Cada operación lee lo último guardado y guarda solo lo suyo.

1. **Panadería** (`panaderia/index.html`): plan del día por latas de 15. Por defecto 6 de pino y 2 de cada
   otra variedad (22 latas, 330 empanadas), editable en *Plan de cada día*. El sugerido descuenta las
   latas completas que el Horno reportó precocidas ayer. *Enviar al horno* crea el pedido.
2. **Horno** (`horno/index.html`): cocina cuenta lo que llegó (por unidad), corrige y *Confirma la
   recepción*; pasa a *por hornear*. *Comenzar producción* carga la primera tanda: 20 minutos, hasta 4
   latas, varias variedades con el mismo reloj (capacidad, cocción y mínimo en vitrina se ajustan).
3. Al llegar a cero (o *Salió ya*), la tanda pasa a la vitrina (`ea_control.uni`) que descuenta la Caja.
   El sistema general la saca aunque el Horno no esté abierto.
4. **Sobredemanda:** *Solicitar empanadas* deja una solicitud *por confirmar*; la Panadería la confirma
   (puede cambiar las latas) o responde que no se puede, con motivo.
5. **Cierre:** *Precocido para mañana* reporta lo armado sin hornear (parte de lo que calcula el sistema:
   precocido de ayer + recibido − horneado). Es el punto de partida de la Panadería al día siguiente.

Además, del horno en vivo probado en la Prueba: sugerencia de qué hornear (lo que alguien espera y las
variedades que más faltan según lo vendido), *Esperan la tanda* con aviso de entregar, comandas de
empanadas y pastelería, y el historial de tandas del día.

**Resumen del Horno:** la cuenta regresiva de la tanda que sale va en grande (también en la barra
plegada); *En vitrina · Revisar* baja a la vitrina para contar y corregir.

**Escandallos:** por unidad y por lata, con la masa común y el relleno de cada variedad (fichas
estándar de `prueba/estandar.js`, ajustables por dirección), e insumos del plan de hoy con formato de
compra. Los costos y el food cost solo los ven los dueños.

**Datos:** `eapos_panaderia` (plan, pedidos, solicitudes, precocido; 30 días) y `eapos_horno` (tandas,
espera y ajustes; 21 días).

### Cargos (v2.7; desde la v3.0 rige la tabla de arriba)

| Cargo | Áreas |
|---|---|
| Dirección | Todas |
| Encargados | Caja, Fila y mesas, Salón, Comandas de cocina y de barra, Horno, Carta |
| Garzones | Caja, Fila y mesas, Salón, Comandas de cocina y de barra, Carta |
| Barra | Comandas de barra, Salón, Carta |
| Cocina y horno | Comandas de cocina, Horno, Salón, Carta |
| Panadería (nuevo usuario) | Panadería, Carta |

### Otros cambios

- **Comandas separadas:** `cocina/index.html?est=cocina` y `?est=barra`, cada una en su área. Las
  empanadas y la pastelería van a las comandas del Horno.
- **Control de Salón:** sin pantalla de horno (lleva al área Horno), sin el botón *Carta* dentro del
  sistema y sin la barrita de estado (su *Revisar* está en el resumen de arriba). Se actualiza cuando la
  Caja o el Horno cambian la vitrina, y al guardar ya no pisa lo que cambió otra pantalla.
- **Fecha local:** Salón, Carta, Caja y Horno reinician el día con la fecha de Chile. Antes usaban la
  fecha UTC, que en Chile cambia a las 21:00 y reiniciaba la vitrina en pleno servicio.

## Horario del local (v2.6)

Tres hitos del día, definidos una sola vez en `nucleo/nucleo.js` (`EAPOS.HORARIO`):

| Hito | Hora | Avisos | Desde esa hora |
|---|---|---|---|
| Término del desayuno | 12:00 | 15 y 5 min antes | La Caja no vende desayunos; sigue el brunch |
| Cierre de mesas y cocina | 21:30 | 15 y 5 min antes | No se abren mesas (Para el local) ni se piden platos de cocina; queda para llevar |
| Cierre del local | 22:00 | 5 min antes | Se cierra la caja y el local |

- **Sistema general:** un chip en el encabezado dice el próximo hito y, en los últimos 15 minutos, cuenta
  los minutos (ámbar a los 15, rojo a los 5). La campana lo muestra y cada cambio de fase sale como aviso
  en pantalla, para todos los cargos.
- **Caja:** franja de aviso arriba de la venta; los desayunos y la cocina quedan marcados y no se agregan
  fuera de hora; a las 21:30 el botón *Para el local* se desactiva y la cuenta pasa sola a *Para llevar*.
- **Carta:** desayunos y brunch salen de horario con el mismo reloj (el brunch, a las 21:30).
- **Prueba:** usa la hora simulada. A las 21:30 las mesas ocupadas pasan a cuenta, no se sienta a nadie
  más y la cocina deja de vender; los avisos y la línea del encabezado cuentan los minutos.

Para probar otra hora sin tocar el reloj del equipo: en la consola, `sessionStorage.setItem("eapos_hora","21:20")`
y recargar (vale solo para esa pestaña).

## Navegación sin capas encima (v2.6)

- El módulo abierto dentro del sistema general mide lo que queda bajo el encabezado (`ajustarMarco`), así
  cabe entero también cuando el encabezado ocupa dos filas en tablet.
- Las filas de pestañas que no caben se desplazan con la rueda del mouse, muestran un degradado donde
  sigue el contenido y centran la pestaña activa (`EA_UI.filasX`, `EA_UI.centrarActivo`). Dentro del
  sistema general, el menú de la Prueba se acomoda en varias filas.
- En teléfono la columna de la Prueba queda fija solo con la barra plegada, para no tapar el encabezado.
- La barra plegada ya no rebota: cuando un módulo cambia de tamaño al plegarse, la barra espera 0,7 s
  antes de volver a abrirse.
- Auditado en 1366, 1024 y 390 px: en las 144 áreas, cada botón visible es lo que está en su centro.

## Barra colapsable (v2.5)

Al desplazarse hacia abajo (pasados 64 px; se vuelve a abrir bajo 8 px, para que no parpadee):

- **Columna izquierda:** en computador pasa de 248 px a una franja de íconos de 84 px. Con el cursor
  encima (o al navegar con el teclado) se abre sobre el contenido sin moverlo.
- **Encabezado:** se achica a una barra fija con el título y el resumen de la pestaña en una línea, con su
  color. Tocarlo vuelve arriba. En la Prueba quedan reloj, avisos, velocidad y pausa, y la franja PRUEBA
  se reduce a su sello.
- **Módulos dentro del sistema general:** el resumen se pliega dentro de la barra y el módulo crece casi a
  pantalla completa. El desplazamiento dentro de un módulo también pliega la barra (cada módulo lo avisa
  hacia arriba con `EAPOS_SISTEMA.desplazo`).
- **Teléfono:** queda fija arriba solo la fila del menú.

Vive en `nucleo/emporio.css` y `EA_UI.colapsable` (`nucleo/emporio.js`), compartido por el sistema
general y la Prueba.

## Resumen por pestaña y avisos importantes (v2.4)

Cada pestaña del sistema general (Caja, Control de Salón, Comandas, Carta, Prueba, Verificación,
Versiones y Retroalimentación) y cada una de las catorce de la Prueba abre con un **resumen**: un estado
en una frase con su color (en orden, atención, urgente o en curso) y tres o cuatro cifras grandes. Si hay
un problema, el titular lo nombra. El detalle de cada área sigue debajo. Las tiras de cifras que se
repetían (Cocina, Barra, Caja simulada y vitrina del horno) pasaron al resumen.

La **campana** del encabezado junta los avisos importantes, no una bitácora: cada aviso se va cuando deja
de ser cierto. En el sistema general salen de los datos reales del equipo: productos agotados y que quedan
pocos (Control de Salón y Caja), hornadas listas para sacar, comandas que esperan más de 15 minutos,
ventas sin folio, cambios sin aplicar, reportes de prioridad alta y fallas de la verificación, según el
cargo. En la Prueba salen de la simulación: insumos que se acabaron o quedan pocos, variedades de empanada
agotadas, vitrina baja, hornadas, mesas esperando la cuenta, filas largas y cortes de internet. Lo urgente
nuevo hace sonar la campana y deja un aviso en pantalla.

Las tortas de la casa tienen sus capas en la ficha: Pakari (bizcocho de amapola y crema de arándano), Inti
(hojarasca, manjar, nueces y crema), Ñusta (hojarasca, manjar, crema y frambuesa), Killa (bizcocho de
chocolate y de vainilla con un poco de hojarasca, manjar y crema) y Amor (hojarasca, frambuesa, crema y
manjar; la mini torta es una porción y media).

## Prueba: fichas estándar, horno en vivo e ingresos (v2.3)

Todo esto vive solo en la Prueba: se guarda en `eapos_prueba_fichas` y en el estado del día simulado,
y no toca la Caja (`ea_pos`) ni el sistema general.

**Fichas técnicas y escandallos estándar** (`prueba/estandar.js`). Los 130 productos de la carta tienen
ficha con el mismo formato de la ficha de la Caja: ingredientes con cantidad por porción, merma,
rendimiento y estandarización operativa (vajilla, utensilios, preparación, cocción, montaje y puntos
críticos). Los 102 insumos tienen formato de compra y precio neto **estimado** para octubre de 2026 con
referencias públicas: boletines mayoristas de ODEPA (palta Hass $3.000–4.000/kg en Lo Valledor), precios de
góndola de Líder y Jumbo (queso de cabra, huevos, lácteos), el estudio de la USS sobre el costo de la
empanada de pino de 2026 y estándares de barra (espresso doble 18 g; la casa usa 12 g en el simple y 28 g
en el V60). Se suma un flete a San Pedro de Atacama (8 % por defecto). La pastelería, que no tiene
precio en la carta, trae su precio sugerido.

**Fichas y escandallos (vista nueva).** Costo por porción, precio de prueba, food cost, margen y precio
sugerido según la meta de food cost. Se editan cantidades, merma, rendimiento y precios de compra; todo
se recalcula. Un precio sugerido se puede pasar al borrador de Cambios. "Rellenar con el estándar"
devuelve fichas, precios y stock a los valores estándar.

**Inventario desde las fichas.** Cada venta saca del stock los insumos de su ficha (con merma); las
empanadas salen de la vitrina y sus insumos se gastan al hornear. El stock inicial se estima con el
mayor consumo de tres viernes de temporada alta, por 1,6, redondeado al formato de compra; el punto de
pedido es el 35 % de ese consumo. Cada día del período parte con ese stock.

**Horno en vivo** (como el del Control de Salón). Vitrina por variedad y hornadas con varias variedades,
unidades por variedad (la lata trae 15), tiempo propio y capacidad de 4 latas. El horno automático entra
cuando la vitrina baja de 12 o se agotan tres variedades, y deja de hornear 45 minutos antes del cierre.
Quien paga empanadas que no hay espera la hornada de esa variedad.

**Ingresos personalizados.** Hornadas a mano y compras de mercadería con la cantidad y el precio que se
indiquen (opcionalmente, ese precio pasa a las fichas). El período suma costo de lo vendido y food cost.

## Prueba: contextos y pedidos a mano (v2.2)

**Contexto y período.** Se elige un horizonte (día, semana o mes), una fecha, la temporada, la afluencia
(50 a 150 %) y el evento de cada día (normal, feriado, evento en el pueblo, día lento). La demanda de un día
es temporada × día de la semana × evento × afluencia; el sábado y el domingo venden más que el martes. Cada
fecha tiene su propia semilla, así que el mismo día da siempre el mismo resultado.

- **Día:** corre en vivo en el Dashboard y en cada área, con la fecha elegida.
- **Semana y mes:** simula los siete días desde la fecha o el mes calendario completo. Muestra venta,
  promedio, avance contra la meta, días sobre la meta diaria, ventas por semana, canales y más vendidos.
  Al tocar un día se ve su detalle, se le marca un evento o se abre en vivo.
- **Comparar** en Cambios usa los mismos días del contexto para el sistema general y la prueba.
- La proyección fija de 30 días de Reportes salió: la reemplaza el mes del contexto.

**Tomar pedido.** Con la carta de la prueba se ingresan ventas a mano en el día en vivo:

- **Mesa:** se elige una mesa libre y las personas; el pedido sale a cocina, barra y horno y la mesa se
  cobra en el Salón.
- **Para llevar:** se cobra en el mostrador. Si la vitrina no alcanza, el cliente paga y espera la
  próxima tanda.
- **Fila:** a quien espera mesa o la salida de empanadas se le vende desde una carta de fila (cafés,
  bebidas, pastelería y empanadas). Se puede formar la fila a mano: un grupo que espera mesa (pasa en unos
  5 minutos) o un cliente que espera la próxima tanda.

El motor también forma filas solo: en días de alta demanda los grupos esperan mesa, algunos compran en la
fila y otros se van. La fila es un canal propio en Clientes y en el período. El catálogo dejó de tener su
botón de venta suelta: ahora se vende desde Tomar pedido.

## Diseño base: Emporio System 1.1

Desde la v2.1, el diseño y la forma de interactuar de Emporio System 1.1 son la base de todas las capas y
subcapas: noche volcánica con manchas de luz y patrón andino, paneles de vidrio, Sora y Plus Jakarta Sans,
acento turquesa con tinta oscura, menú lateral con indicador deslizante, tarjetas que siguen al puntero y
movimientos con resorte calculados desde un resorte físico.

- **Sistema general:** reconstruido sobre la estructura de 1.1 (ingreso por persona y PIN, menú agrupado,
  dashboard con ventas reales, áreas del local). Cada módulo se abre dentro de él.
- **Comandas:** reescrita con las piezas de 1.1 (segmentado de estaciones, tarjetas, conteos con resorte).
- **Caja y Prueba:** usan `emporio.css` y `emporio.js`, con la Caja remapeada a los tokens de 1.1.
- **Carta y Control de Salón:** mantienen su recorrido por capas y toman una piel de 1.1 (tokens, vidrio,
  tipografía, resortes). No cargan `emporio.css` porque sus clases propias chocan con las del sistema.
- **Modo incrustado:** dentro del sistema general, cada módulo se vuelve transparente, comparte la
  atmósfera de la capa superior y cambia su menú lateral por uno horizontal compacto.

Correcciones de la v2.1: la Carta y el Salón incrustados ya no muestran fondo blanco (esquema de color
oscuro declarado), la Caja en celular ya no se sale por la derecha y las iniciales del usuario se leen en
el menú. En pantalla ancha, el menú de secciones de la Caja (Caja, Panel, Stock, Gestión, Informes,
Ajustes) quedaba aplastado en una franja turquesa dentro del sistema general: una regla pensada para el
menú de la Prueba también tocaba la Caja. Ahora esa regla solo aplica a la Prueba.

## Cargos

La tabla vigente está en *Equipo, pantalla de inicio y seguridad (v3.0)*. "Cifras y costos" son las
ventas en pesos del dashboard, el panel del día de la Caja, costos, metas, estadísticas, la entrega al
contador y, en la Prueba, las fichas, precios de compra, valor del stock y food cost: solo para dirección.
Desde la v3.0 un módulo abierto suelto, sin sesión, responde 403; solo la Carta del cliente es pública.

## Qué se fusionó, qué salió

- **Carta:** antes había tres copias (Carta y Salón con 130 productos; Emporio System con 79 sacados de
  fotos, 31 con otro precio). Queda una sola, la de la Carta y la Caja.
- **Emporio System 1.1:** su simulación pasó entera a la Prueba. El ingreso con PIN y los cargos pasaron
  al sistema general. Su escandallo se fusionó con la ficha de costo de la Caja (ahora una ficha técnica
  completa con paso a paso, puntos críticos y copia en Markdown). Salieron las 4 fotos de la carta física
  (250 KB) y la tabla de "arquitectura sugerida".
- **Caja:** dejó de editar precios y metas (vienen del sistema general) y salió el traspaso manual de
  disponibilidad, que ya no hace falta porque todo comparte memoria.
- **Carta:** salieron servicios del pueblo, números de emergencia, reseñas de Google y TripAdvisor,
  Instagram, galería, banda de fotos y avisos de altura, junto con sus 49 textos en 10 idiomas y 11 fotos.
  Queda el enlace a DesertGo, que es un canal de venta.
- **Control de Salón:** salieron los enlaces a la Caja y a la Pizarra de Empanadas. Desde la v2.1 el
  Salón no tiene acceso a la Caja: la Caja se abre solo desde el menú del sistema general, que revisa el
  cargo de quien está en sesión.
- **Nuevo:** Comandas por estación, alimentadas por las ventas reales de la Caja.

Correcciones encontradas al probar: los dígitos del PIN tecleados mientras se valida ya no se pierden;
en la ficha de la Caja, lo escrito en un ingrediente ya no se borra al pasar al campo siguiente, y la hoja
larga ahora se desplaza dentro de la pantalla.

## Verificación

```bash
cd EmporioAndinoPOS
NODE_PATH=$(npm root -g) node verificacion/verificar.mjs
# solo algunas pruebas, por ejemplo el tema:
SOLO=probarTema NODE_PATH=$(npm root -g) node verificacion/verificar.mjs
```

Prueba cada módulo a 1366 px y a 390 px, y los flujos que cruzan módulos: ingreso con PIN → venta en la
Caja → comanda en Comandas; borrador en la Prueba → aplicar → precio nuevo en la Caja y producto fuera
en la Carta; garzón → Caja con solo cobro y stock; la Carta en cada idioma directo sin textos
indefinidos; y en cada capa, que cargue el diseño de Emporio System 1.1. Resultado en
`verificacion/informe.json`. En la Prueba revisa además la semana y el mes del contexto, un evento que
sube la demanda de un día, abrir ese día en vivo, los pedidos a mano en mesa, para llevar y en la fila, las
fichas estándar de todos los productos, que el stock estándar alcance un día de temporada alta, editar un
escandallo, una hornada personalizada, un ingreso de mercadería y que nada de eso toque la Caja. Desde la
v2.6 revisa también el horario a horas fijadas (fases a los 15 y 5 minutos, chip, campana, Caja a las
21:27 y 21:40, Carta y la Prueba a las 21:30) y que la Caja quepa bajo el encabezado sin capas encima. Desde
la v2.7, el recorrido Panadería → Horno → Vitrina completo, las comandas separadas y el Salón sin horno. Desde la
v2.8, la fila completa (código de la Carta, llamado, sentar, comandas y cobro sin duplicar) y los precios nuevos.

El sistema general incluye además una verificación que corre en el navegador de cada equipo (sección
para dirección). Cada módulo lleva en su `<head>` una línea que avisa al sistema general cuando se abre
dentro de él, para escuchar errores desde el primer instante; fuera del sistema no hace nada.

Con el Apache del repo se abre en `/EmporioAndinoPOS/`. Todo es HTML estático, sin compilación.
