// BIG BROTHER COMPLIANT - Agent Service
const crypto = require('crypto');
const logger = require('../utils/logger');
const validators = require('../utils/validators');
const database = require('../config/database');
const voiceProcessor = require('./voiceProcessor');
const audioManager = require('./audioManager');

class AgentService {
  constructor() { this.bigBrotherCompliant = true; }

  generateAgentId(name) {
    const sanitized = name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').substring(0, 20);
    return `agent_${sanitized}_${crypto.randomBytes(4).toString('hex')}`;
  }

  async createAgent(agentData, audioFile) {
    const startTime = Date.now();
    try {
      const validation = validators.validateVoiceCloneRequest({ ...agentData, voiceFile: audioFile });
      if (!validation.isValid) throw new Error(`Validation failed: ${validation.errors.join(', ')}`);

      const agentId = this.generateAgentId(validation.sanitized.name);
      logger.agentOperation('Creating new agent', { agentId, name: validation.sanitized.name, audioFile: audioFile?.originalname });

      const audioResult = audioFile ? await audioManager.processUpload(audioFile) : null;
      const voiceResult = await voiceProcessor.createVoiceClone(validation.sanitized.name, validation.sanitized.description, audioResult?.path);

      const now = new Date().toISOString();
      const agent = {
        id: agentId, name: validation.sanitized.name, description: validation.sanitized.description || '',
        voice_id: voiceResult.voiceId, settings: JSON.stringify(validation.sanitized.settings),
        file_path: audioResult?.path || null, file_size: audioResult?.size || null,
        created_at: now, updated_at: now, big_brother_compliant: 1
      };

      const db = await database.getDatabase();
      await db.run(`INSERT INTO agents (id, name, description, voice_id, settings, file_path, file_size, created_at, updated_at, big_brother_compliant) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [agent.id, agent.name, agent.description, agent.voice_id, agent.settings, agent.file_path, agent.file_size, agent.created_at, agent.updated_at, agent.big_brother_compliant]);

      const duration = Date.now() - startTime;
      logger.performance('Agent created', duration, { agentId, voiceId: voiceResult.voiceId });
      
      return {
        success: true,
        agent: { id: agent.id, name: agent.name, description: agent.description, voiceId: agent.voice_id, settings: JSON.parse(agent.settings), createdAt: agent.created_at, bigBrotherCompliant: this.bigBrotherCompliant },
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Agent creation failed', { error: error.message, name: agentData?.name, duration });
      throw error;
    }
  }

  async getAgent(agentId) {
    try {
      logger.agentOperation('Fetching agent', { agentId });
      const validation = validators.validateAgentId(agentId);
      if (!validation.isValid) throw new Error(validation.errors.join(', '));

      const db = await database.getDatabase();
      const agent = await db.get('SELECT * FROM agents WHERE id = ?', [agentId]);
      if (!agent) throw new Error('Agent not found');

      return {
        success: true,
        agent: { id: agent.id, name: agent.name, description: agent.description, voiceId: agent.voice_id, settings: JSON.parse(agent.settings || '{}'), createdAt: agent.created_at, updatedAt: agent.updated_at, bigBrotherCompliant: this.bigBrotherCompliant }
      };
    } catch (error) {
      logger.error('Failed to fetch agent', { error: error.message, agentId });
      throw error;
    }
  }

  async listAgents(options = {}) {
    try {
      const validation = validators.validatePaginationParams(options);
      if (!validation.isValid) throw new Error(validation.errors.join(', '));

      const { page, limit, sortBy, sortOrder } = validation.sanitized;
      const offset = (page - 1) * limit;
      logger.agentOperation('Listing agents', { page, limit, sortBy, sortOrder });

      const db = await database.getDatabase();
      const total = (await db.get('SELECT COUNT(*) as total FROM agents')).total;
      const agents = await db.all(`SELECT id, name, description, voice_id, settings, created_at, updated_at, big_brother_compliant FROM agents ORDER BY ${sortBy} ${sortOrder.toUpperCase()} LIMIT ? OFFSET ?`, [limit, offset]);

      return {
        success: true,
        agents: agents.map(agent => ({ id: agent.id, name: agent.name, description: agent.description, voiceId: agent.voice_id, settings: JSON.parse(agent.settings || '{}'), createdAt: agent.created_at, updatedAt: agent.updated_at, bigBrotherCompliant: agent.big_brother_compliant === 1 })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 },
        bigBrotherCompliant: this.bigBrotherCompliant
      };
    } catch (error) {
      logger.error('Failed to list agents', { error: error.message, options });
      throw error;
    }
  }

  async updateAgent(agentId, updateData) {
    const startTime = Date.now();
    try {
      logger.agentOperation('Updating agent', { agentId, updateData });
      const agentValidation = validators.validateAgentId(agentId);
      if (!agentValidation.isValid) throw new Error(agentValidation.errors.join(', '));

      const agent = await this.getAgent(agentId);
      if (!agent.success) throw new Error('Agent not found');

      const validation = validators.validateVoiceCloneRequest({
        name: updateData.name || agent.agent.name,
        description: updateData.description || agent.agent.description,
        settings: updateData.settings || agent.agent.settings
      });
      if (!validation.isValid) throw new Error(validation.errors.join(', '));

      const now = new Date().toISOString();
      const db = await database.getDatabase();
      await db.run(`UPDATE agents SET name = ?, description = ?, settings = ?, updated_at = ? WHERE id = ?`,
        [validation.sanitized.name, validation.sanitized.description, JSON.stringify(validation.sanitized.settings), now, agentId]);

      const duration = Date.now() - startTime;
      logger.performance('Agent updated', duration, { agentId });

      return {
        success: true,
        agent: { id: agentId, name: validation.sanitized.name, description: validation.sanitized.description, voiceId: agent.agent.voiceId, settings: validation.sanitized.settings, updatedAt: now, bigBrotherCompliant: this.bigBrotherCompliant },
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Agent update failed', { error: error.message, agentId, duration });
      throw error;
    }
  }

  async deleteAgent(agentId) {
    const startTime = Date.now();
    try {
      logger.agentOperation('Deleting agent', { agentId });
      const validation = validators.validateAgentId(agentId);
      if (!validation.isValid) throw new Error(validation.errors.join(', '));

      const agent = await this.getAgent(agentId);
      if (!agent.success) throw new Error('Agent not found');

      await voiceProcessor.deleteVoice(agent.agent.voiceId);
      const db = await database.getDatabase();
      const result = await db.run('DELETE FROM agents WHERE id = ?', [agentId]);
      if (result.changes === 0) throw new Error('Agent not found in database');

      const duration = Date.now() - startTime;
      logger.performance('Agent deleted', duration, { agentId });
      return { success: true, agentId, duration, bigBrotherCompliant: this.bigBrotherCompliant };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Agent deletion failed', { error: error.message, agentId, duration });
      throw error;
    }
  }

  async getAgentStats() {
    try {
      const db = await database.getDatabase();
      const stats = await db.all(`SELECT COUNT(*) as total_agents, COUNT(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 END) as created_today, AVG(file_size) as avg_file_size FROM agents`);
      return { success: true, stats: stats[0], bigBrotherCompliant: this.bigBrotherCompliant };
    } catch (error) {
      logger.error('Failed to get agent stats', { error: error.message });
      throw error;
    }
  }
}

module.exports = new AgentService();