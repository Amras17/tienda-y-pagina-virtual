# Instalar EmporioAndinoPOS en un Mac

EmporioAndinoPOS son páginas web estáticas: no hay base de datos ni programa que instalar. El Mac sirve
la carpeta en `http://localhost:8080` y el navegador guarda ventas, stock, pedidos y PIN.

## 1. Bajar la carpeta

**Con GitHub en el navegador:** en el repositorio `amras17/tienda-y-pagina-virtual`, elige la rama
`claude/peaceful-gates-i9qi2z`, toca **Code → Download ZIP** y descomprime el archivo. Copia la carpeta
`EmporioAndinoPOS` a un lugar fijo, por ejemplo `Documentos/EmporioAndinoPOS`.

**Con Terminal (si ya usas git):**

```bash
cd ~/Documents
git clone -b claude/peaceful-gates-i9qi2z https://github.com/amras17/tienda-y-pagina-virtual.git
cd tienda-y-pagina-virtual/EmporioAndinoPOS
```

## 2. Abrir el sistema

Doble clic en **`Iniciar EmporioAndinoPOS.command`** (está dentro de la carpeta). Se abre el navegador en
`http://localhost:8080` con la pantalla de ingreso.

La primera vez macOS puede frenarlo:

- *"no se puede abrir porque es de un desarrollador no identificado"*: clic derecho sobre el archivo →
  **Abrir** → **Abrir**. En macOS 15 o más nuevo: **Ajustes del Sistema → Privacidad y seguridad**, abajo,
  **Abrir igualmente**.
- *"no tienes permiso"* o se abre como texto: en Terminal, dentro de la carpeta,
  `chmod +x *.command` y vuelve a hacer doble clic.
- Si pide instalar las *herramientas de línea de comandos* (para Python 3), acepta y espera que termine;
  después abre el archivo de nuevo. También se instalan con `xcode-select --install`.

Para apagarlo: doble clic en **`Detener EmporioAndinoPOS.command`**. Los datos no se borran.

## 3. Dejarlo como una app

- **Chrome:** con el sistema abierto, menú **⋮ → Transmitir, guardar y compartir → Instalar página como
  app**. Queda en el Dock con su propia ventana.
- **Safari (macOS 14 o más nuevo):** **Archivo → Añadir al Dock**.
- **Que arranque solo al encender el Mac:** **Ajustes del Sistema → General → Ítems de inicio → +** y elige
  `Iniciar EmporioAndinoPOS.command`.

## 4. Reinstalar o actualizar sin perder datos

1. Doble clic en `Detener EmporioAndinoPOS.command`.
2. Reemplaza la carpeta por la nueva (o en Terminal: `git pull` dentro de la carpeta).
3. Doble clic en `Iniciar EmporioAndinoPOS.command`.

Los datos viven en el navegador, asociados a la dirección `http://localhost:8080`. Mientras se use **el
mismo navegador** y **esa misma dirección**, todo sigue ahí. Ojo:

- `http://127.0.0.1:8080` es otra dirección para el navegador: entra siempre por `localhost`.
- No borres los datos de navegación de ese sitio ni uses ventanas privadas.
- Chrome y Safari guardan por separado: elige uno y quédate con él.
- Antes de reinstalar, exporta el día desde la **Caja** (cierre de turno) como respaldo.

## 5. Varios puestos (horno, panadería, caja)

Todas las ventanas y pestañas **del mismo Mac y el mismo navegador** comparten los datos al instante:
puedes tener la Caja en una ventana, el Horno en otra y la Panadería en una tercera.

Un segundo equipo (una tablet en el horno, otro computador en la panadería) guarda **sus propios datos**:
no ve las ventas ni los pedidos del Mac. Para la Prueba nº1, usa un solo Mac con una ventana por puesto.
Compartir entre equipos necesita un servidor y queda para una versión siguiente.

## 6. Comprobar que quedó bien

Ingresa con un usuario de dirección y abre **Verificación → Verificar**: revisa que cada módulo abra en
ese Mac (Caja, Salón, Comandas de cocina y de barra, Horno, Panadería, Carta y Prueba).
