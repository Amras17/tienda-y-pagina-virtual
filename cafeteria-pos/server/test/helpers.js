import { execSync } from 'node:child_process';
import fs from 'node:fs';
import request from 'supertest';

// Cada archivo de test corre en su propio proceso con una base SQLite nueva
// (prisma/test.db, desechable) con las migraciones aplicadas.
process.env.DATABASE_URL = 'file:./test.db';
process.env.NODE_ENV = 'test';
for (const f of ['prisma/test.db', 'prisma/test.db-journal']) fs.rmSync(f, { force: true });
execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env });

const { createApp } = await import('../src/app.js');
const { prisma } = await import('../src/db.js');
const { sembrar } = await import('../prisma/seed.js');

await sembrar(prisma, { ventasDemo: false });

export { prisma };
export const app = createApp();

export async function login(rol) {
  const email = `${rol.toLowerCase()}@cafeteria.cl`;
  const res = await request(app).post('/api/auth/login').send({ email, password: 'demo1234' });
  const token = res.body.token;
  const conToken = (req) => req.set('Authorization', `Bearer ${token}`);
  return {
    get: (url) => conToken(request(app).get(url)),
    post: (url, body = {}) => conToken(request(app).post(url)).send(body),
    put: (url, body = {}) => conToken(request(app).put(url)).send(body),
    del: (url) => conToken(request(app).delete(url)),
  };
}

export const publico = (url) => request(app).get(url);

export async function producto(nombre) {
  return prisma.producto.findFirstOrThrow({ where: { nombre } });
}

export async function stockDe(nombre) {
  const insumo = await prisma.insumo.findFirstOrThrow({ where: { nombre }, include: { lotes: true } });
  return insumo.lotes.reduce((a, l) => a + l.cantidadRestante, 0);
}
