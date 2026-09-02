import { Router } from 'express';
import { testConnection } from '../db/connection.js';

const router = Router();

// GET /api/health
router.get('/', async (_req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: 'ok',
    service: 'AutoSAR AI API',
    version: '2.0.0',
    database: dbStatus.success ? 'connected' : `error: ${dbStatus.error}`,
    timestamp: new Date().toISOString(),
  });
});

export default router;
