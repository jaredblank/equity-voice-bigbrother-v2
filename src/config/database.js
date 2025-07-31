// BIG BROTHER COMPLIANT - Database Configuration
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/voice.db');
    this.bigBrotherCompliant = true;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._initialize();
    return this.initPromise;
  }

  async _initialize() {
    try {
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
      this.db = await open({ filename: this.dbPath, driver: sqlite3.Database });
      await this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA cache_size = -2000; PRAGMA temp_store = memory;');
      await this.createTables();
      await this.createIndexes();
      logger.info('Database initialized successfully', { path: this.dbPath, bigBrotherCompliant: this.bigBrotherCompliant });
    } catch (error) {
      logger.error('Database initialization failed', { error: error.message });
      throw error;
    }
  }

  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, voice_id TEXT, settings TEXT DEFAULT '{}', file_path TEXT, file_size INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, big_brother_compliant BOOLEAN DEFAULT 1)`,
      `CREATE TABLE IF NOT EXISTS generations (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, text TEXT NOT NULL, audio_path TEXT, audio_size INTEGER, duration REAL, settings TEXT DEFAULT '{}', status TEXT DEFAULT 'pending', error_message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME, big_brother_compliant BOOLEAN DEFAULT 1, FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS usage_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT, operation TEXT NOT NULL, duration INTEGER, file_size INTEGER, status TEXT, ip_address TEXT, user_agent TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, big_brother_compliant BOOLEAN DEFAULT 1, FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE SET NULL)`,
      `CREATE TABLE IF NOT EXISTS error_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, operation TEXT NOT NULL, error_message TEXT NOT NULL, error_stack TEXT, context TEXT DEFAULT '{}', ip_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, big_brother_compliant BOOLEAN DEFAULT 1)`
    ];
    for (const table of tables) await this.db.exec(table);
  }

  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_agents_name ON agents (name)',
      'CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents (created_at)',
      'CREATE INDEX IF NOT EXISTS idx_generations_agent_id ON generations (agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_generations_status ON generations (status)',
      'CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations (created_at)',
      'CREATE INDEX IF NOT EXISTS idx_usage_logs_agent_id ON usage_logs (agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_usage_logs_operation ON usage_logs (operation)',
      'CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs (created_at)',
      'CREATE INDEX IF NOT EXISTS idx_error_logs_operation ON error_logs (operation)',
      'CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs (created_at)'
    ];
    for (const index of indexes) await this.db.exec(index);
  }

  async getDatabase() {
    if (!this.db) await this.initialize();
    return this.db;
  }

  async executeQuery(query, params = []) {
    try {
      const db = await this.getDatabase();
      const result = await db.all(query, params);
      logger.debug('Database query executed', { query: query.substring(0, 100), paramCount: params.length, resultCount: result.length });
      return result;
    } catch (error) {
      logger.error('Database query failed', { error: error.message, query: query.substring(0, 100), params });
      throw error;
    }
  }

  async executeUpdate(query, params = []) {
    try {
      const db = await this.getDatabase();
      const result = await db.run(query, params);
      logger.debug('Database update executed', { query: query.substring(0, 100), paramCount: params.length, changes: result.changes, lastID: result.lastID });
      return result;
    } catch (error) {
      logger.error('Database update failed', { error: error.message, query: query.substring(0, 100), params });
      throw error;
    }
  }

  async logUsage(agentId, operation, duration, fileSize, status, ipAddress, userAgent) {
    return this.executeUpdate('INSERT INTO usage_logs (agent_id, operation, duration, file_size, status, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)', 
      [agentId, operation, duration, fileSize, status, ipAddress, userAgent]);
  }

  async logError(operation, errorMessage, errorStack, context, ipAddress) {
    return this.executeUpdate('INSERT INTO error_logs (operation, error_message, error_stack, context, ip_address) VALUES (?, ?, ?, ?, ?)', 
      [operation, errorMessage, errorStack, JSON.stringify(context), ipAddress]);
  }

  async getStats() {
    const queries = [
      'SELECT COUNT(*) as agent_count FROM agents',
      'SELECT COUNT(*) as generation_count FROM generations',
      'SELECT COUNT(*) as usage_count FROM usage_logs WHERE created_at > datetime("now", "-24 hours")',
      'SELECT COUNT(*) as error_count FROM error_logs WHERE created_at > datetime("now", "-24 hours")'
    ];
    const results = await Promise.all(queries.map(q => this.executeQuery(q)));
    return { agents: results[0][0].agent_count, generations: results[1][0].generation_count, usageToday: results[2][0].usage_count, errorsToday: results[3][0].error_count, bigBrotherCompliant: this.bigBrotherCompliant };
  }

  async cleanup() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const queries = ['DELETE FROM usage_logs WHERE created_at < ?', 'DELETE FROM error_logs WHERE created_at < ?', 'DELETE FROM generations WHERE status = "completed" AND created_at < ?'];
    const cutoffString = cutoffDate.toISOString();
    for (const query of queries) await this.executeUpdate(query, [cutoffString]);
    await this.db.exec('VACUUM');
    logger.info('Database cleanup completed');
  }

  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }
}

module.exports = new DatabaseManager();