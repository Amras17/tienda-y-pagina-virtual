# EmporioAndinoPOS v1.0

Sistema gastronómico y punto de venta de Emporio Andino (San Pedro de Atacama).
Publicado el 6 de octubre de 2026.

| Módulo | Archivo | Quién lo usa |
|---|---|---|
| Lanzador, verificación y retroalimentación | `index.html` | Dirección y mantención |
| Carta Interactiva | `carta/index.html` (+ `carta/img`, `carta/brand`) | Clientes en la mesa |
| Control de Salón | `carta/salon.html` | Equipo de salón |
| Emporio System 1.1 (POS) | `sistema/index.html` | Caja, cocina, barra, horno |

Todo es HTML estático: no necesita compilación. Con el Apache del repo se abre en
`/EmporioAndinoPOS/` (la regla de `.htaccess` no reescribe archivos ni carpetas que existen).
Los módulos comparten el `localStorage` del mismo origen: lo que Control de Salón marca
como agotado (`ea_control`) lo lee la Carta.

## Verificación

```bash
cd EmporioAndinoPOS
NODE_PATH=$(npm root -g) node verificacion/verificar.mjs
```

El agente levanta un servidor local, abre cada módulo en Chromium a ancho de escritorio
(1366 px) y de teléfono (390 px), recorre el ingreso con PIN y las 12 áreas del Sistema,
las capas de la Carta, Control de Salón y el lanzador (incluido su autodiagnóstico).
Falla si hay errores de JavaScript, recursos propios que no cargan o desborde horizontal.
Deja el resultado en `verificacion/informe.json`. Resultado del lanzamiento: 76/76.

El lanzador incluye además una verificación que corre en el navegador de cada equipo
(almacenamiento, tipografías, apertura de los tres módulos, 39 fotos, datos guardados).
Para escuchar errores desde el primer instante, cada módulo lleva una línea en su `<head>`
que avisa al lanzador cuando se abre dentro de él; fuera del lanzador no hace nada.

## Cambios respecto de los artefactos originales

- Sistema: el ingreso con PIN perdía los dígitos tecleados mientras validaba el primer PIN
  (unos 120 ms), y al teclear rápido mostraba "Los PIN no coinciden". Ahora el código se
  toma al completar los 4 dígitos y el buffer queda libre al instante.
- Control de Salón: ahora tiene `<!doctype html>` y se abre en modo estándar, como
  en su versión original.
- Los tres módulos: línea de enganche para la verificación (ver arriba).

## Retroalimentación y mantención

En la versión publicada como artefacto, los reportes se guardan en la base compartida del
artefacto (colección `retro`; el último diagnóstico queda en `diagnosticos/ultimo`).
Así el equipo los ve y se pueden leer en la próxima sesión de mantención. Abierto fuera de
claude.ai, el libro se guarda solo en ese equipo.
