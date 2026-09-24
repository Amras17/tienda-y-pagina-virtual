import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { errorHandler } from './lib/errors.js';
import auth from './routes/auth.js';
import insumos from './routes/insumos.js';
import proveedores from './routes/proveedores.js';
import ordenesCompra from './routes/ordenesCompra.js';
import productos from './routes/productos.js';
import recetas from './routes/recetas.js';
import mesas from './routes/mesas.js';
import ventas from './routes/ventas.js';
import boletas from './routes/boletas.js';
import dashboard from './routes/dashboard.js';
import reportes from './routes/reportes.js';
import comanda from './routes/comanda.js';
import publico from './routes/publico.js';

// Frontend compilado (web/dist copiado a server/public en la imagen Docker).
const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  // CORS solo si el frontend vive en otro origen (en dev se usa el proxy de
  // Vite y en producción el mismo servidor sirve el frontend).
  if (config.CORS_ORIGIN) {
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', config.CORS_ORIGIN);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') return res.status(204).end();
      next();
    });
  }

  const api = express.Router();
  api.get('/health', (req, res) => res.json({ ok: true }));
  api.use('/auth', auth);
  api.use('/insumos', insumos);
  api.use('/proveedores', proveedores);
  api.use('/ordenes-compra', ordenesCompra);
  api.use('/productos', productos);
  api.use('/recetas', recetas);
  api.use('/mesas', mesas);
  api.use('/ventas', ventas);
  api.use('/boletas', boletas);
  api.use('/dashboard', dashboard);
  api.use('/reportes', reportes);
  api.use('/comanda', comanda);
  api.use('/publico', publico); // sin JWT: pantalla del cliente
  api.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  app.use('/api', api);

  if (fs.existsSync(PUBLIC_DIR)) {
    // Los assets de Vite llevan hash en el nombre: se pueden cachear para siempre.
    app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), { maxAge: '1y', immutable: true }));
    app.use(express.static(PUBLIC_DIR, { index: false }));
    // Fallback SPA: cualquier GET que no sea /api ni un archivo sirve index.html.
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
