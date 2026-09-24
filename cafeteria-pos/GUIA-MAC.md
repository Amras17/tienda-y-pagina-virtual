# Guía paso a paso: POS Cafetería en Mac

Para personas sin experiencia técnica. La primera vez toma unos 15 minutos;
después, encenderlo es un doble clic.

---

## Parte 1 — Instalar Node.js (una sola vez)

Node.js es el programa que hace funcionar el POS.

1. Abre Safari o Chrome y entra a **https://nodejs.org**
2. Presiona el botón de descarga de la versión **LTS** (la recomendada).
   Descarga un archivo que termina en **`.pkg`**.
3. Abre la carpeta **Descargas** y haz doble clic en ese `.pkg`.
4. Sigue el instalador: **Continuar → Continuar → Aceptar → Instalar**.
   Te pedirá la **contraseña de tu Mac** (la misma con la que entras al equipo).
5. Cuando diga «La instalación se completó correctamente», presiona **Cerrar**.
   Si pregunta si quieres mover el instalador a la papelera, di que sí.

**Comprobar que quedó bien (opcional):**

1. Presiona **⌘ Comando + Barra espaciadora**, escribe **Terminal** y presiona Enter.
2. En la ventana que se abre escribe `node -v` y presiona Enter.
3. Debe aparecer algo como `v22.x.x` o un número mayor. Si dice
   `command not found`, repite la instalación.
4. Cierra la Terminal (**⌘ Comando + Q**).

---

## Parte 2 — Descargar el POS (una sola vez)

1. Abre este enlace:
   **https://github.com/Amras17/tienda-y-pagina-virtual/archive/refs/heads/claude/happy-pasteur-cmz75d.zip**
2. Abre la carpeta **Descargas** en el Finder.
   - Con **Safari**, el ZIP suele descomprimirse solo y verás una carpeta.
   - Con **Chrome**, verás un archivo `.zip`: haz doble clic y se crea la carpeta.
3. La carpeta se llama `tienda-y-pagina-virtual-claude-happy-pasteur-cmz75d`.
   **Recomendado:** arrástrala a tu carpeta de usuario (la de la casita 🏠) o
   a **Documentos**, y cámbiale el nombre a **`POS`** para encontrarla fácil.
   Evita dejarla en Descargas: es fácil borrarla sin querer.
4. Entra a la carpeta y luego a **`cafeteria-pos`**. Dentro verás, entre otros:
   ```
   Iniciar POS.command     ← este es el que usarás
   GUIA-MAC.md
   scripts   server   web
   ```

---

## Parte 3 — Encender el POS por primera vez

1. Dentro de `cafeteria-pos`, haz **doble clic** en **`Iniciar POS.command`**.
2. **Aviso de seguridad de macOS.** Como el archivo viene de internet, la
   primera vez el Mac lo bloquea con un mensaje como *«No se puede abrir
   "Iniciar POS.command"…»* o *«Apple no pudo verificar…»*. Es normal:
   - Presiona **OK** o **Listo** (no «Trasladar a la papelera»).
   - Abre ** → Configuración del Sistema → Privacidad y seguridad**.
   - Baja hasta el final: verás *«Se bloqueó "Iniciar POS.command"…»*.
     Presiona **Abrir igualmente** y confirma con tu contraseña o Touch ID.
   - En **macOS más antiguos** basta con: clic derecho (o Control + clic)
     sobre el archivo → **Abrir** → **Abrir**.

   Esto se hace **una sola vez**.
3. Se abre una ventana de **Terminal** con texto. La primera vez instala todo y
   tarda **3 a 5 minutos**; verás los pasos `☕ [1/5]` … `☕ [5/5]`.
4. Si aparece *«¿Desea que la aplicación "node" acepte conexiones de red
   entrantes?»*, presiona **Permitir**. Así las tablets del local podrán conectarse.
5. Cuando aparezca esto, el POS está listo y **el navegador se abre solo**:
   ```
   ✔ POS funcionando. Abre en el navegador:
       http://localhost:4000
   Desde tablets o celulares en el mismo wifi:
       http://192.168.1.25:4000
   ```
   Si el navegador no se abre, escribe **http://localhost:4000** en Safari o Chrome.

---

## Parte 4 — Usar el POS

En la pantalla de entrada hay botones con los usuarios de prueba. La
contraseña de todos es **`demo1234`**.

| Usuario     | Para qué                                   |
|-------------|--------------------------------------------|
| `cajero`    | Vender en el mostrador                      |
| `garzon`    | Tomar pedidos en las mesas                  |
| `encargado` | Todo lo anterior, además de stock, carta, proveedores y dashboard |
| `admin`     | Todo                                        |

**Tablet de barra o pantalla para el cliente:** en la tablet (conectada al
**mismo wifi** que el Mac) abre la dirección que empieza con `http://192.168…`
que muestra la Terminal.

- **Barra:** entra con cualquier usuario y abre **Comanda**.
- **Cliente:** desde **Mesas**, toca una mesa → **«Pantalla de la mesa ↗»**.

---

## Parte 5 — El día a día

- **Encender:** doble clic en `Iniciar POS.command`. Tarda unos segundos.
- **Mientras trabajas:** **no cierres la ventana de Terminal**; esa ventana
  *es* el POS. Puedes minimizarla (botón amarillo).
- **El Mac no se dormirá** mientras el POS esté encendido. La pantalla sí
  puede apagarse; el POS sigue funcionando.
- **Apagar:** en la ventana de Terminal presiona **Control + C** (la tecla
  *control*, no *comando*). Luego presiona Enter para cerrar la ventana.
- **Las ventas, el stock y la carta se guardan** al apagar.

Consejo: arrastra `Iniciar POS.command` al **Dock** (junto a la papelera) para
tenerlo siempre a un clic.

---

## Parte 6 — Respaldo de los datos

Todos los datos del local viven en un solo archivo:

```
cafeteria-pos/server/prisma/dev.db
```

Para respaldar: **apaga el POS** y copia ese archivo a un pendrive, iCloud
Drive o Google Drive. Hazlo al menos una vez por semana.

Para **actualizar** a una versión nueva del POS: descarga la nueva carpeta
(Parte 2) y, antes de encenderla, copia tu `dev.db` a la misma ubicación en la
carpeta nueva (`cafeteria-pos/server/prisma/`). Así conservas todo.

---

## Si algo falla

| Qué ves | Qué hacer |
|---|---|
| Se abre la página de nodejs.org y dice «Falta instalar Node.js» | Haz la Parte 1 y vuelve a abrir `Iniciar POS.command`. |
| «No se puede abrir… desarrollador no identificado» | Parte 3, paso 2. |
| «Permiso denegado» / «permission denied» | Abre Terminal, escribe `chmod +x ` (con un espacio al final), **arrastra** `Iniciar POS.command` a la ventana y presiona Enter. Luego vuelve a hacer doble clic. |
| «El POS ya está funcionando en otra ventana» | Ya estaba encendido: busca la otra ventana de Terminal o abre http://localhost:4000 |
| «Necesitas Node.js 22 o superior» | Instala la versión LTS más nueva (Parte 1). |
| La tablet no abre la dirección | Revisa que esté en el mismo wifi que el Mac y que hayas presionado **Permitir** (Parte 3, paso 4). Si no apareció, ve a ** → Configuración del Sistema → Red → Firewall → Opciones** y permite «node». |
| Otro error en rojo | Toma una foto de la ventana de Terminal y envíala para revisarla. |

### Alternativa sin doble clic (desde la Terminal)

Si prefieres la Terminal o el doble clic no funciona:

1. Abre **Terminal** (⌘ + Barra espaciadora → «Terminal»).
2. Escribe `cd ` (con un espacio al final), **arrastra la carpeta
   `cafeteria-pos`** desde el Finder a la ventana y presiona Enter.
3. Escribe `npm run iniciar` y presiona Enter.
