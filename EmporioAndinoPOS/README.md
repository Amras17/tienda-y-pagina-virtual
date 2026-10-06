# EmporioAndinoPOS v2.4

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
```

Cómo fluye el dato:

1. En la **Prueba** se cambian precios, se sacan productos de la carta o se ajustan metas. El borrador
   se compara con el sistema general en los días del contexto (la semana o el mes elegido).
2. **Aplicar al sistema general** guarda una versión nueva (quién, cuándo, qué cambió).
3. La **Caja**, la **Carta**, el **Control de Salón** y las **Comandas** leen esa versión. La Caja vende,
   descuenta stock (`ea_control`, el mismo que marca el Salón y suma el horno) y cada venta aparece en
   Comandas.

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

| Cargo | Módulos | Caja | Cifras y costos |
|---|---|---|---|
| Dueños | todos, incluida la Prueba, más verificación y accesos | completa | sí |
| Jefes de operación | todos, incluida la Prueba, más verificación y accesos | cobro, stock, compras, mermas, cierre e historial | no |
| Encargados de turno | Caja, Salón, Comandas, Carta | cobro, stock, compras, mermas, cierre e historial | no |
| Garzones | Caja, Salón, Comandas, Carta | solo cobro y stock | no |
| Barra, cocina | Comandas, Salón, Carta | — | no |

"Cifras y costos" son las ventas en pesos del dashboard, el panel del día de la Caja, costos, metas,
estadísticas, la entrega al contador y, en la Prueba, las fichas, precios de compra, valor del stock y
food cost. Un módulo abierto suelto, sin sesión, muestra todo como antes del sistema general.

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
```

Prueba cada módulo a 1366 px y a 390 px, y los flujos que cruzan módulos: ingreso con PIN → venta en la
Caja → comanda en Comandas; borrador en la Prueba → aplicar → precio nuevo en la Caja y producto fuera
en la Carta; garzón → Caja con solo cobro y stock; la Carta en cada idioma directo sin textos
indefinidos; y en cada capa, que cargue el diseño de Emporio System 1.1. Resultado en
`verificacion/informe.json`. En la Prueba revisa además la semana y el mes del contexto, un evento que
sube la demanda de un día, abrir ese día en vivo, los pedidos a mano en mesa, para llevar y en la fila, las
fichas estándar de todos los productos, que el stock estándar alcance un día de temporada alta, editar un
escandallo, una hornada personalizada, un ingreso de mercadería y que nada de eso toque la Caja.

El sistema general incluye además una verificación que corre en el navegador de cada equipo (sección
para dirección). Cada módulo lleva en su `<head>` una línea que avisa al sistema general cuando se abre
dentro de él, para escuchar errores desde el primer instante; fuera del sistema no hace nada.

Con el Apache del repo se abre en `/EmporioAndinoPOS/`. Todo es HTML estático, sin compilación.
