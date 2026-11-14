import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './server/db.js';
import { csrfGuard } from './server/auth.js';
import authRoutes from './server/routes/auth.js';
import dashboardRoutes from './server/routes/dashboard.js';
import productosRoutes from './server/routes/productos.js';
import categoriasRoutes from './server/routes/categorias.js';
import proveedoresRoutes from './server/routes/proveedores.js';
import movimientosRoutes from './server/routes/movimientos.js';
import alertasRoutes from './server/routes/alertas.js';
import reportesRoutes from './server/routes/reportes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  await initDatabase();
  console.log('[InventPro] Esquema PostgreSQL (Neon) verificado e inicializado.');

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // CSRF protection for all mutating API requests
  app.use(csrfGuard);

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'inventpro' });
  });

  // API Routes
  app.use('/api', authRoutes);
  app.use('/api', dashboardRoutes);
  app.use('/api', productosRoutes);
  app.use('/api', categoriasRoutes);
  app.use('/api', proveedoresRoutes);
  app.use('/api', movimientosRoutes);
  app.use('/api', alertasRoutes);
  app.use('/api', reportesRoutes);

  // Global error fallback for /api/*
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta de API no encontrada' });
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`[InventPro] Servidor ejecutándose en http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[InventPro] Error fatal al iniciar el servidor:', err);
  process.exit(1);
});
