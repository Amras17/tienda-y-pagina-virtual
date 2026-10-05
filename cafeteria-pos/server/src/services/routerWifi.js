// Punto de integración con el router / controlador WiFi del local.
//
// El POS decide QUIÉN navega y POR CUÁNTO TIEMPO (código, minutos, MAC). El
// corte físico de la conexión lo hace el equipo de red: hasta conectar uno,
// este archivo funciona en modo STUB (el portal valida el código y muestra el
// tiempo restante, pero no abre ni cierra la red por sí mismo).
//
// Cómo se conecta según el equipo (todos usan "portal cautivo externo": la
// red de invitados redirige al cliente a /portal-wifi con su MAC en la URL):
//   - Ubiquiti UniFi: tras validar el código, llamar al controlador
//     `POST /api/s/<sitio>/cmd/stamgr` con { cmd: 'authorize-guest', mac, minutes }
//     y `unauthorize-guest` para revocar.
//   - TP-Link Omada: API del controlador, autorización de cliente por MAC con
//     duración (hotspot / portal externo).
//   - MikroTik (Hotspot): crear un usuario en `/ip/hotspot/user` con
//     name = password = código y `limit-uptime` = minutos (API REST de
//     RouterOS 7) y enviar al cliente al login del hotspot con esas credenciales.
//   - OpenWrt + openNDS: autenticación FAS con la duración en minutos.
//
// Ambas funciones reciben segundos RESTANTES (no el total) para que una
// reconexión no regale tiempo.
export async function autorizarDispositivo({ codigo, mac, segundos }) {
  return { estado: 'STUB', codigo, mac: mac ?? null, segundos };
}

export async function revocarDispositivos({ codigo, macs }) {
  return { estado: 'STUB', codigo, macs };
}
