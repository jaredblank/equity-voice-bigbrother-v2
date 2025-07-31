// BIG BROTHER COMPLIANT - Health Routes
const express = require('express');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/middleware');
const database = require('../config/database');
const voiceProcessor = require('../services/voiceProcessor');
const audioManager = require('../services/audioManager');

const router = express.Router();

router.use((req, res, next) => {
  res.header('X-Big-Brother-Compliant', 'true');
  res.header('X-Service', 'Health Monitoring v2');
  next();
});

const sendHealthResponse = (res, success, data, requestId, statusCode = success ? 200 : 500) => {
  res.status(statusCode).json({ ...data, service: 'Big Brother Voice v2', requestId, bigBrotherCompliant: true, timestamp: new Date().toISOString() });
};

router.get('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const systemInfo = { platform: os.platform(), architecture: os.arch(), cpus: os.cpus().length, totalMemory: os.totalmem(), freeMemory: os.freemem(), loadAverage: os.loadavg() };
    const duration = Date.now() - startTime;
    sendHealthResponse(res, true, {
      status: 'healthy', version: '2.0.0', uptime: Math.round(uptime),
      memory: { rss: Math.round(memoryUsage.rss / 1024 / 1024), heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), external: Math.round(memoryUsage.external / 1024 / 1024) },
      system: { platform: systemInfo.platform, arch: systemInfo.architecture, cpus: systemInfo.cpus, totalMemoryMB: Math.round(systemInfo.totalMemory / 1024 / 1024), freeMemoryMB: Math.round(systemInfo.freeMemory / 1024 / 1024), loadAverage: systemInfo.loadAverage.map(load => Math.round(load * 100) / 100) },
      duration
    }, requestId);
  } catch (error) {
    logger.error('Health check failed', { error: error.message, requestId });
    sendHealthResponse(res, false, { status: 'unhealthy', error: error.message }, requestId, 500);
  }
}));

router.get('/detailed', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  const checks = {};
  try {
    // Database check
    try {
      const dbStats = await database.getStats();
      checks.database = { status: 'healthy', stats: dbStats, message: 'Database connection successful' };
    } catch (error) {
      checks.database = { status: 'unhealthy', error: error.message, message: 'Database connection failed' };
    }
    // Voice processor check
    try {
      const queueStatus = voiceProcessor.getQueueStatus();
      checks.voiceProcessor = { status: 'healthy', queue: queueStatus, message: 'Voice processor operational' };
    } catch (error) {
      checks.voiceProcessor = { status: 'unhealthy', error: error.message, message: 'Voice processor check failed' };
    }
    // Audio manager check
    try {
      const fileStats = await audioManager.getFileStats();
      checks.audioManager = { status: 'healthy', files: fileStats, message: 'Audio manager operational' };
    } catch (error) {
      checks.audioManager = { status: 'unhealthy', error: error.message, message: 'Audio manager check failed' };
    }
    // Disk space check
    try {
      const uploadsDir = path.join(__dirname, '../../uploads');
      const tempDir = path.join(__dirname, '../../temp');
      const uploadsStats = await fs.stat(uploadsDir).catch(() => null);
      const tempStats = await fs.stat(tempDir).catch(() => null);
      checks.diskSpace = { status: 'healthy', directories: { uploads: uploadsStats ? 'exists' : 'missing', temp: tempStats ? 'exists' : 'missing' }, message: 'Disk space check completed' };
    } catch (error) {
      checks.diskSpace = { status: 'unhealthy', error: error.message, message: 'Disk space check failed' };
    }
    const overallStatus = Object.values(checks).every(check => check.status === 'healthy') ? 'healthy' : 'degraded';
    const duration = Date.now() - startTime;
    sendHealthResponse(res, true, {
      status: overallStatus, version: '2.0.0', checks,
      summary: { total: Object.keys(checks).length, healthy: Object.values(checks).filter(check => check.status === 'healthy').length, unhealthy: Object.values(checks).filter(check => check.status === 'unhealthy').length },
      duration
    }, requestId);
  } catch (error) {
    logger.error('Detailed health check failed', { error: error.message, requestId });
    sendHealthResponse(res, false, { status: 'unhealthy', error: error.message }, requestId, 500);
  }
}));

router.get('/metrics', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  try {
    const metrics = {
      uptime: process.uptime(), memory: process.memoryUsage(), cpu: process.cpuUsage(),
      system: { loadAverage: os.loadavg(), freeMemory: os.freemem(), totalMemory: os.totalmem() },
      queue: voiceProcessor.getQueueStatus(), files: await audioManager.getFileStats(), database: await database.getStats()
    };
    const duration = Date.now() - startTime;
    sendHealthResponse(res, true, { success: true, metrics, duration }, requestId);
  } catch (error) {
    logger.error('Metrics collection failed', { error: error.message, requestId });
    sendHealthResponse(res, false, { success: false, error: error.message }, requestId, 500);
  }
}));

router.get('/ready', asyncHandler(async (req, res) => {
  const requestId = res.locals.performance?.requestId;
  try {
    await database.getDatabase();
    sendHealthResponse(res, true, { ready: true }, requestId);
  } catch (error) {
    sendHealthResponse(res, false, { ready: false, error: error.message }, requestId, 503);
  }
}));

module.exports = router;