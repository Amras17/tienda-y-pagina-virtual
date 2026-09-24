import { config } from './config.js';
import { prisma } from './db.js';
import { createApp } from './app.js';

const server = createApp().listen(config.PORT, () => {
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
