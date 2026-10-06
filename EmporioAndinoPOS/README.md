# EmporioAndinoPOS v2.1

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
└── Prueba          prueba/index.html    simulación del día y borrador de cambios; "Aplicar al sistema
                                          general" es el único camino para cambiar precios, carta y metas
nucleo/datos.js   la carta única (130 productos, 10 idiomas)
nucleo/nucleo.js  catálogo, configuración general y de prueba, versiones, equipo, cargos, PIN y sesión
nucleo/emporio.css  sistema de diseño de Emporio System 1.1, común a todas las capas
nucleo/emporio.js   comportamientos de Emporio System 1.1 (resortes, indicador, mosaicos, atmósfera, avisos)
```

Cómo fluye el dato:

1. En la **Prueba** se cambian precios, se sacan productos de la carta o se ajustan metas. El borrador
   se compara con el sistema general en siete días simulados y se proyecta a 30 días.
2. **Aplicar al sistema general** guarda una versión nueva (quién, cuándo, qué cambió).
3. La **Caja**, la **Carta**, el **Control de Salón** y las **Comandas** leen esa versión. La Caja vende,
   descuenta stock (`ea_control`, el mismo que marca el Salón y suma el horno) y cada venta aparece en
   Comandas.

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

| Cargo | Módulos | Caja |
|---|---|---|
| Dirección (dueños, jefes de operación) | todos, incluida la Prueba, más verificación y accesos | completa |
| Encargados de turno | Caja, Salón, Comandas, Carta | completa |
| Garzones | Caja, Salón, Comandas, Carta | solo cobro y stock |
| Barra, cocina | Comandas, Salón, Carta | — |

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
`verificacion/informe.json` (124 de 124 en la v2.1).

El sistema general incluye además una verificación que corre en el navegador de cada equipo (sección
para dirección). Cada módulo lleva en su `<head>` una línea que avisa al sistema general cuando se abre
dentro de él, para escuchar errores desde el primer instante; fuera del sistema no hace nada.

Con el Apache del repo se abre en `/EmporioAndinoPOS/`. Todo es HTML estático, sin compilación.
