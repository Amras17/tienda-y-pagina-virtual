# Prueba nº 1 del sistema · EmporioAndinoPOS 3.2

Un turno real, en un solo Mac (ver `INSTALAR-MAC.md`), con una ventana por puesto. Lo que falle o
se pueda mejorar se anota en **Retroalimentación** apenas pase, con el módulo y la prioridad.

## Antes de abrir

1. Abrir el sistema con `Iniciar EmporioAndinoPOS.command`.
2. Dirección entra y corre **Verificación → Verificar**: todo en verde.
3. Cada persona toca su nombre en la pantalla de inicio y crea su PIN de 4 dígitos la primera vez. Entra
   directo a su área: barra a Comandas de barra, cocina a Comandas de cocina, panadería a Panadería,
   garzones a Pedidos. Para anular o reabrir hace falta el PIN de un encargado.
4. Abrir una ventana por puesto: **Pedidos**, **Caja**, **Fila y mesas**, **Horno**, **Panadería**, **Comandas de
   cocina**, **Comandas de barra**. Ojo: en un mismo Mac todas las ventanas comparten **una sola
   sesión** (la de quien ingresó último). Para la prueba con varias ventanas, que ingrese alguien de
   jefatura (Marbelis o Gustavo), que abre todo. Para probar la vista de cada persona (barista, cocina,
   panadería, garzón), ingresa con ella: cambia la sesión de todas las ventanas, y al terminar vuelve a
   ingresar jefatura. Un perfil de navegador distinto no sirve: no comparte los datos.
5. Revisar en **Fila y mesas → Ajustes de la fila** la cantidad de mesas.

## Recorrido

| # | Puesto | Qué hacer | Qué tiene que pasar |
|---|---|---|---|
| 1 | Panadería | Revisar **Precocido de ayer** (el primer día no hay) y el **Plan de hoy**: 6 latas de pino y 2 de cada otra (22 latas = 330) | El plan descuenta las latas completas que quedaron precocidas |
| 2 | Panadería (Eva, Claudia o jefatura) | **Enviar al horno** | El Horno lo ve *por recibir*; la campana avisa a cocina |
| 3 | Horno (María Torrez, Daisy Pérez o un encargado) | Contar las latas, corregir si falta o sobra, **Confirmar recepción** | Pasan a *por hornear*; propone la primera tanda |
| 4 | Horno | **Comenzar producción · primera tanda** (20 min, hasta 4 latas) | El reloj grande arriba cuenta 20:00 hacia atrás |
| 5 | Horno | Al llegar a 0:00 (o **Salió ya**) | Las empanadas pasan a la vitrina; la Caja y la Carta las ven |
| 6 | Caja | Vender empanadas, un plato y una bebida | Empanada → comandas del Horno; plato → Comandas de cocina; bebida → Comandas de barra |
| 7 | Horno | **Vitrina · Revisar**: contar y corregir con − / + | La Caja descuenta desde lo corregido |
| 8 | Horno | Cliente sin vitrina: **Esperan la tanda → Anotar** | Al salir la tanda avisa *entregar a …* |
| 9 | Horno | Sobredemanda: **Solicitar empanadas** con motivo | Queda *por confirmar*; la Panadería recibe el aviso |
| 10 | Panadería (Eva, Claudia o jefatura) | **Confirmar y enviar** (o *No se puede* con motivo) | El Horno la ve por recibir (o el motivo) |
| 11 | Panadería | Revisar **Escandallos** e **Insumos del plan de hoy** | Cantidades por unidad y por lata; costos solo para dueños |
| 12 | Todos | 11:45 y 11:55; 21:15 y 21:25; 21:55 | Avisos de fin de desayuno, cierre de mesas y cocina, y cierre del local |
| 13 | Horno | Al cierre: **Precocido para mañana → Reportar** | La Panadería lo ve mañana como punto de partida |
| 14 | Pedidos | **Mesas** → tocar una libre, elegir personas, **Abrir**; sumar productos y **Enviar ronda 1** | Sale a Comandas de cocina, barra u Horno según cada producto |
| 15 | Pedidos | En la misma mesa, **ronda 2** con un desayuno: elegir su **bebida incluida** y una **nota** | Cocina ve el plato con la nota; barra, la bebida "incluida en …" |
| 16 | Pedidos | **Para llevar** con un nombre, y **Fila** a alguien que espera mesa (*sale al sentarse*) | Lo de la fila sale a Comandas al sentarlo en Fila y mesas |
| 17 | Caja | **Por cobrar** → tocar la mesa | La cuenta entera se carga; al registrar queda cobrada y no se vuelve a comandar |
| 18 | Pedidos / Fila | **Se levantaron: liberar** | Propone llamar al siguiente de la fila (campana y WhatsApp) |
| 19 | Caja | Revisar precios de la carta nueva (pino $4.000, latte $4.000, Catarpe $9.500) | Iguales a la carta física |
| 20 | Caja | Cierre de turno y exportar el día | Respaldo del día descargado |
| 20b | Reportes | Revisar *Hoy*: por hora, área, más vendidos, pagos, canal y garzón; **Exportar CSV** | Cuadra con el cierre de la Caja |
| 20c | Todos | Tocar la **campana → Recientes** | Cada acción del turno lleva a su área |
| 21 | Seguridad | Un garzón intenta anular una venta; un barista abre la Caja por su dirección | Pide la clave de un encargado; la Caja responde 403 |
| 22 | Dirección | **Versiones → Bitácora de seguridad** | Cadena íntegra; ingresos, 403 y autorizaciones del turno |

## Qué anotar en Retroalimentación

- Lo que no se entiende a la primera o toma más pasos de los necesarios.
- Diferencias entre lo que dice el sistema y lo que hay en el horno o la vitrina.
- Tiempos reales: cuánto tarda de verdad la primera tanda y las siguientes (se ajusta en
  **Horno → Tandas de hoy → Ajustes del horno**: capacidad, cocción y mínimo en vitrina).
- Si el plan diario de la panadería debe cambiar (se ajusta en **Panadería → Plan de cada día**).
