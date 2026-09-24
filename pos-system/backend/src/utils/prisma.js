const { PrismaClient } = require('@prisma/client');

// Instancia unica compartida por toda la app (patron recomendado por Prisma
// para evitar agotar conexiones en desarrollo con recarga de modulos).
const prisma = new PrismaClient();

module.exports = prisma;
