# EmporioAndinoPOS 3.2 frente a Fudo

Comparación hecha en octubre de 2026 con información pública de Fudo: su sitio y centro de soporte para
Chile, GetApp, Capterra y su ficha en tiendas. Lo que no se pudo confirmar se marca *no verificado*.
Fudo es un software de gestión en la nube para restaurantes, bares y cafés, con sede en Buenos Aires y
presencia en Chile.

## Cuadro por área

| Área | Fudo | EmporioAndinoPOS 3.2 | Veredicto |
|---|---|---|---|
| Salón y mesas | Plano por salas, control de mesas, comandas a cocina, **división de cuentas** | Mesas con estado, apertura con personas, cuenta en rondas, fila de espera y llamado (campana, WhatsApp) | Fudo gana en dividir cuentas y plano por salas; nosotros en la fila de espera |
| Toma de pedidos | App para mozos en celular o tablet, app para comensales, menú QR, tienda online | Pedidos por mesa, para llevar y fila; agregados, bebida incluida, notas | Fudo gana: varios dispositivos a la vez y pedidos del cliente desde su teléfono |
| Comandas | Pantalla de cocina (KDS) o **impresora de comandas** (USB, serie, Ethernet); precuenta impresa | Pantallas separadas de cocina, barra y horno; cada ronda es una comanda; nota a cocina | Empate en pantallas; Fudo gana porque imprime |
| Caja y cobro | Medios de pago, Terminal de pagos propia, apertura y cierre | Cobro por medio de pago, propina sugerida (Art. 64), cuentas por cobrar, cierre, historial, anulación con PIN de encargado | Empate; Fudo integra su terminal de pago |
| Boleta electrónica | **Integrada con el SII**: boletas, facturas y notas de crédito, sin costo extra según Fudo; requiere certificado y folios | Solo registra el folio a mano | **Fudo gana claramente** |
| Delivery y online | Integración con PedidosYa, Rappi y Uber Eats; tienda online y QR | DesertGo como modo de venta, sin integración | Fudo gana |
| Stock y recetas | Movimientos de stock, alertas de faltantes, recetas con costeo automático | Stock por unidades, compras, mermas, fichas técnicas con costo y food cost, escandallos por lata | Empate |
| Producción | No tiene planificación de horno ni de panadería (*no verificado* como módulo) | Plan por latas, envío al horno, tandas con temporizador, vitrina, precocido para el día siguiente | **Nosotros ganamos claramente** |
| Carta para el cliente | Menú QR y tienda online | Carta interactiva en 10 idiomas con fotos, horario y bebida incluida; el Salón la usa para estudiar | Nosotros ganamos en profundidad; Fudo en pedido online |
| Reportes | Ventas y costos, exportación a Excel | Por hora o día, área, producto, pago, canal y garzón (propinas y mesas), CSV; Prueba con proyección por temporada | Empate; nosotros sumamos la simulación |
| Simulación de cambios | No tiene (*no verificado*) | Prueba: precios, carta y metas con escenarios por día, semana o mes antes de aplicarlos | Nosotros ganamos |
| Usuarios y permisos | Usuarios con permisos (detalle *no verificado*) | Cargos y área por persona, PIN, autorización de encargado con un uso, bitácora encadenada | Nosotros ganamos en control fino |
| Nube y equipos | En la nube, apps iOS y Android, varios equipos sincronizados; hay versiones contradictorias sobre si funciona sin internet | Todo en el navegador de un solo equipo; funciona sin internet, pero **no comparte datos entre equipos** | **Fudo gana claramente** |
| Soporte | Equipo de soporte; las reseñas critican la atención en horas de servicio y la carga manual | Mantenido por nosotros, a la medida del local | Depende de quién lo mantenga |
| Costo | Desde unos US$35 (Avanzado) a US$45 (Pro) al mes según GetApp y Capterra; varía por país | Sin licencia | Nosotros ganamos |

## Falencias de EmporioAndinoPOS (de mayor a menor impacto)

1. **Un solo equipo.** Sin servidor no hay app de garzón en el celular ni tablets en cocina con los
   mismos datos. Bloquea casi todo lo demás.
2. **Sin boleta electrónica SII.** El folio se anota a mano; Fudo emite boletas, facturas y notas de
   crédito desde la venta.
3. **No divide cuentas, no mueve ni une mesas.** Se cobra la cuenta entera de la mesa.
4. **No imprime.** No hay comanda ni precuenta en impresora térmica.
5. **Sin delivery integrado ni pedidos online.** DesertGo, PedidosYa y Rappi se digitan a mano.
6. **Sin clientes ni fidelización.** No hay registro de clientes (en Fudo, el alcance de esto está *no
   verificado*).

## Fortalezas de EmporioAndinoPOS

- **Producción hecha para el local:** panadería por latas, tandas de horno con reloj, vitrina y
  precocido.
- **Carta interactiva:** 10 idiomas y bebida incluida bien resuelta en Caja, Pedidos y Comandas.
- **Fila de espera:** con llamado por campana y WhatsApp.
- **Prueba y simulación:** cambios de precios y carta medidos antes de aplicarlos, con historial de
  versiones.
- **Permisos por cargo y área:** autorizaciones con PIN y bitácora de seguridad.
- **Sin costo mensual y sin depender de internet.**

## Qué haría falta para cerrar la brecha

1. **Servidor y sincronización** (con la base de datos del artefacto o un backend propio). Es la base
   del resto: garzón en el celular, varias pantallas y la seguridad del lado del servidor.
2. **Boleta electrónica** a través de un proveedor de documentos tributarios con API, como los que Fudo
   integra (OpenFactura, Bsale). Necesita certificado digital y folios del SII.
3. **Dividir cuenta y mover o unir mesas** en Pedidos. Se puede hacer ya, sin servidor.
4. **Impresión** de comanda y precuenta en impresora térmica desde el navegador.
5. **Delivery integrado**, una vez que haya servidor.

Fuentes: [fu.do (Chile)](https://fu.do/es-cl/),
[DTE en Chile: alcance y limitaciones](https://soporte.fu.do/es/articles/12754203-facturacion-electronica-dte-en-chile-alcance-y-limitaciones),
[Integración con el SII](https://soporte.fu.do/es/articles/11731433-integracion-con-el-sii-declarar-modelo-de-emision-en-el-sii),
[Tu Gestión](https://fu.do/es-ar/tu-gestion/),
[GetApp](https://www.getapp.com/retail-consumer-services-software/a/fudo/),
[Capterra](https://www.capterra.co.uk/software/1023879/fudo),
[App Store](https://apps.apple.com/us/app/fudo-software-gastron%C3%B3mico/id1137158486).
