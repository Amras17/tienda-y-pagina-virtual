import { config } from './config.js';
import { prisma } from './db.js';
import { createApp } from './app.js';

// Express 5 entrega los errores de arranque (p. ej. puerto ocupado) al callback.
const server = createApp().listen(config.PORT, (err) => {
  if (err) {
    console.error(
      err.code === 'EADDRINUSE'
        ? `\n✖ El puerto ${config.PORT} ya está en uso: probablemente el POS ya está abierto en otra ventana.\n`
        : err,
    );
    process.exit(1);
  }
  console.log(`POS Cafetería escuchando en http://localhost:${config.PORT}`);
});

// Cierre ordenado (docker stop / Ctrl+C): termina requests en curso y
// libera la conexión a la base.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}
