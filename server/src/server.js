import './config/loadEnv.js';
import express from 'express';
import cors from 'cors';

import { initDatabase } from './db/initDb.js';
import healthRouter from './routes/health.js';
import casesRouter from './routes/cases.js';
import sarRouter from './routes/sar.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Request logger ────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/cases', casesRouter);
app.use('/api/sar', sarRouter);

// Root
app.get('/', (_req, res) => {
  res.json({ message: 'AutoSAR AI API', version: '2.0.0', status: 'running' });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ─── Bootstrap ────────────────────────────────────────────────
async function start() {
  console.log('🚀 AutoSAR AI Server Starting...');

  // Auto-initialize DB tables on startup
  const dbResult = await initDatabase();
  if (dbResult.success) {
    console.log('✅ Database initialized and ready.');
  } else {
    console.warn('⚠️  Database init failed:', dbResult.error, '– API will still start, but DB operations may fail.');
  }

  app.listen(PORT, () => {
    console.log(`✅ AutoSAR AI API running at http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
}

start().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
