/**
 * BIG BROTHER COMPLIANT - Performance Logger
 * Voice processing performance monitoring and logging
 * MAX LINES: 250 | CURRENT: 95
 */

const fs = require('fs');
const path = require('path');

class VoiceLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDirectory();
    this.bigBrotherCompliant = true;
  }

  ensureLogDirectory() {
    try {
      if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_FILE_LOGGING) {
        return; // Skip directory creation in production unless explicitly enabled
      }
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.warn('Could not create log directory:', error.message);
    }
  }

  formatLog(level, message, meta = {}) {
    return JSON.stringify({
      level,
      message,
      service: 'Big Brother Voice v2',
      timestamp: new Date().toISOString(),
      bigBrotherCompliant: this.bigBrotherCompliant,
      performance: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      },
      ...meta
    });
  }

  writeToFile(logData) {
    try {
      if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_FILE_LOGGING) {
        return; // Skip file logging in production unless explicitly enabled
      }
      const logFile = path.join(this.logDir, `voice-${new Date().toISOString().split('T')[0]}.log`);
      fs.appendFileSync(logFile, logData + '\n');
    } catch (error) {
      // Silently fail file logging to prevent app crashes
      console.warn('File logging failed:', error.message);
    }
  }

  info(message, meta = {}) {
    const logData = this.formatLog('info', message, meta);
    console.log(logData);
    this.writeToFile(logData);
  }

  error(message, meta = {}) {
    const logData = this.formatLog('error', message, {
      ...meta,
      stack: meta.error?.stack || meta.stack
    });
    console.error(logData);
    this.writeToFile(logData);
  }

  warn(message, meta = {}) {
    const logData = this.formatLog('warn', message, meta);
    console.warn(logData);
    this.writeToFile(logData);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV !== 'production') {
      const logData = this.formatLog('debug', message, meta);
      console.log(logData);
      this.writeToFile(logData);
    }
  }

  voiceProcessing(message, meta = {}) {
    this.info(`[VOICE] ${message}`, {
      category: 'voice-processing',
      ...meta
    });
  }

  agentOperation(message, meta = {}) {
    this.info(`[AGENT] ${message}`, {
      category: 'agent-operation',
      ...meta
    });
  }

  audioProcessing(message, meta = {}) {
    this.info(`[AUDIO] ${message}`, {
      category: 'audio-processing',
      ...meta
    });
  }

  performance(operation, duration, meta = {}) {
    this.info(`[PERF] ${operation} completed in ${duration}ms`, {
      category: 'performance',
      operation,
      duration,
      ...meta
    });
  }

  apiRequest(method, endpoint, duration, status, meta = {}) {
    this.info(`[API] ${method} ${endpoint} - ${status} (${duration}ms)`, {
      category: 'api-request',
      method,
      endpoint,
      duration,
      status,
      ...meta
    });
  }

  cleanup() {
    const files = fs.readdirSync(this.logDir);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    files.forEach(file => {
      const filePath = path.join(this.logDir, file);
      const stats = fs.statSync(filePath);
      if (stats.mtime < cutoff) {
        fs.unlinkSync(filePath);
      }
    });
  }
}

module.exports = new VoiceLogger();