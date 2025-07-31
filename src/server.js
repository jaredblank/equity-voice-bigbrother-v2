/**
 * BIG BROTHER COMPLIANT - Voice Clone Server v2
 * Enterprise-grade voice processing server
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const logger = require('./utils/logger');
const { performanceMonitoring, errorHandler, rateLimiter } = require('./utils/middleware');
const voiceRoutes = require('./routes/voiceRoutes');
const agentRoutes = require('./routes/agentRoutes');
const healthRoutes = require('./routes/healthRoutes');

class BigBrotherVoiceServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 10000;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://equity-voice-bigbrother-v2.onrender.com']
        : true,
      credentials: true
    }));

    this.app.use(morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) }
    }));

    this.app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(performanceMonitoring);
    this.app.use(rateLimiter);

    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
  }

  setupRoutes() {
    this.app.get('/', (req, res) => {
      res.json({
        status: 'ok',
        service: 'Equity Voice Big Brother v2',
        version: '2.0.0',
        bigBrotherCompliant: true,
        capabilities: [
          'voice-cloning',
          'audio-processing', 
          'agent-management',
          'real-time-synthesis',
          'microservices-architecture'
        ],
        performance: res.locals.performance,
        timestamp: new Date().toISOString()
      });
    });

    this.app.use('/api/v2/voice', voiceRoutes);
    this.app.use('/api/v2/agents', agentRoutes);
    // TODO: Re-enable monitoring routes after fixing logger API compatibility
    // this.app.use('/api/v2/monitor', require('./routes/monitorRoutes'));
    this.app.use('/health', healthRoutes);
  }

  setupErrorHandling() {
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        service: 'Big Brother Voice v2',
        timestamp: new Date().toISOString()
      });
    });

    this.app.use(errorHandler);
  }

  async start() {
    try {
      const server = this.app.listen(this.port, '0.0.0.0', () => {
        logger.info(`🎙️ Big Brother Voice v2 Server started`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          bigBrotherCompliant: true,
          capabilities: ['voice-cloning', 'agent-management', 'real-time-synthesis'],
          memoryUsage: process.memoryUsage()
        });
      });

      server.timeout = 30000;

      process.on('SIGTERM', () => {
        logger.info('SIGTERM received, shutting down gracefully');
        server.close(() => {
          logger.info('Process terminated');
          process.exit(0);
        });
      });

      process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception', { error: error.message, stack: error.stack });
        // Don't exit immediately in production to allow for graceful recovery
        if (process.env.NODE_ENV !== 'production') {
          process.exit(1);
        }
      });

      process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled rejection', { reason, promise });
        // Don't exit immediately in production to allow for graceful recovery
        if (process.env.NODE_ENV !== 'production') {
          process.exit(1);
        }
      });

    } catch (error) {
      logger.error('Failed to start server', { error: error.message });
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const server = new BigBrotherVoiceServer();
  server.start();
}

module.exports = BigBrotherVoiceServer;