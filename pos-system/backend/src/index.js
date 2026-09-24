require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const insumosRoutes = require('./routes/insumos');
const proveedoresRoutes = require('./routes/proveedores');
const ordenesCompraRoutes = require('./routes/ordenesCompra');
const productosRoutes = require('./routes/productos');
const recetasRoutes = require('./routes/recetas');
const mesasRoutes = require('./routes/mesas');
const ventasRoutes = require('./routes/ventas');
const boletasRoutes = require('./routes/boletas');
const dashboardRoutes = require('./routes/dashboard');
const reportesRoutes = require('./routes/reportes');
const comandaRoutes = require('./routes/comanda');
const publicoRoutes = require('./routes/publico');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/insumos', insumosRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/ordenes-compra', ordenesCompraRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/recetas', recetasRoutes);
app.use('/api/mesas', mesasRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/boletas', boletasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/comanda', comandaRoutes);
// Rutas publicas, sin JWT: pantalla orientada al cliente.
app.use('/api/publico', publicoRoutes);

// Middleware de errores centralizado.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend POS Cafeteria escuchando en puerto ${PORT}`);
});
