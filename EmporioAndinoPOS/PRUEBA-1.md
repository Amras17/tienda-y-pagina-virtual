# Prueba nº 1 del sistema · EmporioAndinoPOS 3.0

Un turno real, en un solo Mac (ver `INSTALAR-MAC.md`), con una ventana por puesto. Lo que falle o
se pueda mejorar se anota en **Retroalimentación** apenas pase, con el módulo y la prioridad.

## Antes de abrir

1. Abrir el sistema con `Iniciar EmporioAndinoPOS.command`.
2. Dirección entra y corre **Verificación → Verificar**: todo en verde.
3. Cada persona toca su nombre en la pantalla de inicio y crea su PIN de 4 dígitos la primera vez. Entra
   directo a su área: barra a Comandas de barra, cocina a Comandas de cocina, panadería a Panadería,
   garzones a Fila y mesas. Para anular o reabrir hace falta el PIN de un encargado.
4. Abrir una ventana por puesto: **Caja**, **Fila y mesas**, **Horno**, **Panadería**, **Comandas de
   cocina**, **Comandas de barra**. Ojo: en un mismo Mac todas las ventanas comparten **una sola
   sesión** (la de quien ingresó último). Para la prueba con varias ventanas, que ingrese alguien de
   jefatura (Marbelis o Gustavo), que abre todo. Para probar la vista de cada persona (barista, cocina,
   panadería, garzón), ingresa con ella: cambia la sesión de todas las ventanas, y al terminar vuelve a
   ingresar jefatura. Un perfil de navegador distinto no sirve: no comparte los datos.
5. En **Fila y mesas → Pantalla de llamado**, abrir la pantalla en la tele o un segundo monitor y tocarla
   una vez para activar el sonido. Revisar en *Ajustes de la fila* la cantidad de mesas.

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
| 14 | Fila | Anotar a un grupo que espera mesa con el **código** que le dio la Carta en su teléfono | Queda anotado con sus personas y su pedido |
| 15 | Fila | Anotar a alguien para llevar y **Comandar** a mano con *Preparar ya* | Sale a Comandas antes de que llegue al mesón |
| 16 | Fila | Liberar una mesa (**Se levantaron**) | Propone llamar al siguiente; la pantalla de llamado lo muestra y suena |
| 17 | Fila | **Llegó: sentar** | La mesa queda ocupada y su pedido sale a Comandas |
| 18 | Fila | **Cobrar en Caja** | La Caja lo toma con su modo; al registrar no se vuelve a comandar |
| 19 | Caja | Revisar precios de la carta nueva (pino $4.000, latte $4.000, Catarpe $9.500) | Iguales a la carta física |
| 20 | Caja | Cierre de turno y exportar el día | Respaldo del día descargado |
| 21 | Seguridad | Un garzón intenta anular una venta; un barista abre la Caja por su dirección | Pide la clave de un encargado; la Caja responde 403 |
| 22 | Dirección | **Versiones → Bitácora de seguridad** | Cadena íntegra; ingresos, 403 y autorizaciones del turno |

## Qué anotar en Retroalimentación

- Lo que no se entiende a la primera o toma más pasos de los necesarios.
- Diferencias entre lo que dice el sistema y lo que hay en el horno o la vitrina.
- Tiempos reales: cuánto tarda de verdad la primera tanda y las siguientes (se ajusta en
  **Horno → Tandas de hoy → Ajustes del horno**: capacidad, cocción y mínimo en vitrina).
- Si el plan diario de la panadería debe cambiar (se ajusta en **Panadería → Plan de cada día**).
