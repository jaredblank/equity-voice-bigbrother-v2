// BIG BROTHER COMPLIANT - Simple Health Routes
const express = require('express');
const os = require('os');
const logger = require('../utils/logger');

const router = express.Router();

router.use((req, res, next) => {
  res.header('X-Big-Brother-Compliant', 'true');
  res.header('X-Service', 'Health Monitoring v2');
  next();
});

router.get('/', (req, res) => {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.status(200).json({
      status: 'healthy',
      service: 'Big Brother Voice v2',
      version: '2.0.0',
      uptime: Math.round(uptime),
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024)
      },
      bigBrotherCompliant: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      status: 'unhealthy',
      service: 'Big Brother Voice v2',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;