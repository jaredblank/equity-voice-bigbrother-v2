/**
 * BIG BROTHER COMPLIANT - Express Middleware
 * Performance monitoring, rate limiting, error handling for voice services
 * MAX LINES: 250 | CURRENT: 247
 */

const rateLimit = require('express-rate-limit');
const logger = require('./logger');

const performanceMonitoring = (req, res, next) => {
  const startTime = Date.now();
  
  res.locals.performance = {
    startTime,
    requestId: `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    bigBrotherCompliant: true
  };

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.apiRequest(
      req.method,
      req.originalUrl,
      duration,
      res.statusCode,
      {
        requestId: res.locals.performance.requestId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        contentLength: res.get('Content-Length')
      }
    );
  });

  next();
};

const rateLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    service: 'Big Brother Voice v2',
    bigBrotherCompliant: true,
    retryAfter: Math.ceil((process.env.RATE_LIMIT_WINDOW || 900000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
      service: 'Big Brother Voice v2',
      bigBrotherCompliant: true,
      retryAfter: Math.ceil((process.env.RATE_LIMIT_WINDOW || 900000) / 1000)
    });
  }
});

const voiceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Voice processing rate limit exceeded',
    service: 'Big Brother Voice v2',
    bigBrotherCompliant: true
  }
});

const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Upload rate limit exceeded',
    service: 'Big Brother Voice v2',
    bigBrotherCompliant: true
  }
});

const errorHandler = (error, req, res, next) => {
  const requestId = res.locals.performance?.requestId || 'unknown';
  
  logger.error('Request failed', {
    error: error.message,
    stack: error.stack,
    requestId,
    endpoint: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File too large',
      maxSize: process.env.MAX_REQUEST_SIZE || '50mb',
      service: 'Big Brother Voice v2',
      requestId,
      bigBrotherCompliant: true
    });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON format',
      service: 'Big Brother Voice v2',
      requestId,
      bigBrotherCompliant: true
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.message,
      service: 'Big Brother Voice v2',
      requestId,
      bigBrotherCompliant: true
    });
  }

  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized access',
      service: 'Big Brother Voice v2',
      requestId,
      bigBrotherCompliant: true
    });
  }

  const isDev = process.env.NODE_ENV !== 'production';
  
  res.status(error.status || 500).json({
    success: false,
    error: isDev ? error.message : 'Internal server error',
    ...(isDev && { stack: error.stack }),
    service: 'Big Brother Voice v2',
    requestId,
    bigBrotherCompliant: true,
    timestamp: new Date().toISOString()
  });
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const requestLogger = (req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length')
  });
  next();
};

const corsHandler = (req, res, next) => {
  res.header('X-Big-Brother-Compliant', 'true');
  res.header('X-Service-Version', '2.0.0');
  res.header('X-Request-ID', res.locals.performance?.requestId);
  next();
};

const healthCheck = (req, res, next) => {
  if (req.path === '/health' || req.path === '/health/') {
    return res.json({
      status: 'healthy',
      service: 'Big Brother Voice v2',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      bigBrotherCompliant: true,
      timestamp: new Date().toISOString()
    });
  }
  next();
};

const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey && process.env.REQUIRE_API_KEY === 'true') {
    return res.status(401).json({
      success: false,
      error: 'API key required',
      service: 'Big Brother Voice v2',
      bigBrotherCompliant: true
    });
  }

  if (apiKey && process.env.VALID_API_KEYS) {
    const validKeys = process.env.VALID_API_KEYS.split(',');
    if (!validKeys.includes(apiKey)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        service: 'Big Brother Voice v2',
        bigBrotherCompliant: true
      });
    }
  }

  next();
};

module.exports = {
  performanceMonitoring,
  rateLimiter,
  voiceRateLimiter,
  uploadRateLimiter,
  errorHandler,
  asyncHandler,
  requestLogger,
  corsHandler,
  healthCheck,
  validateApiKey
};