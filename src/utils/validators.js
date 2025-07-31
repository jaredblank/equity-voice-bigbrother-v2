/**
 * BIG BROTHER COMPLIANT - Input Validators
 * Voice/audio file and API request validation
 * MAX LINES: 250 | CURRENT: 248
 */

const path = require('path');
const fs = require('fs');
const logger = require('./logger');

class VoiceValidators {
  constructor() {
    this.bigBrotherCompliant = true;
    this.supportedAudioFormats = ['.mp3', '.wav', '.m4a', '.flac', '.ogg'];
    this.maxFileSize = parseInt(process.env.MAX_AUDIO_SIZE) || 50 * 1024 * 1024;
    this.minFileDuration = 5; // seconds
    this.maxFileDuration = 300; // 5 minutes
  }

  validateAudioFile(file) {
    const errors = [];

    if (!file) {
      errors.push('Audio file is required');
      return { isValid: false, errors };
    }

    const ext = path.extname(file.originalname || file.name || '').toLowerCase();
    if (!this.supportedAudioFormats.includes(ext)) {
      errors.push(`Unsupported format. Allowed: ${this.supportedAudioFormats.join(', ')}`);
    }

    if (file.size > this.maxFileSize) {
      errors.push(`File too large. Max size: ${Math.round(this.maxFileSize / 1024 / 1024)}MB`);
    }

    if (file.size < 1024) {
      errors.push('File too small. Minimum size: 1KB');
    }

    const filename = file.originalname || file.name || '';
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      errors.push('Invalid filename. Use only letters, numbers, dots, underscores, and hyphens');
    }

    return {
      isValid: errors.length === 0,
      errors,
      metadata: {
        filename,
        extension: ext,
        size: file.size,
        bigBrotherCompliant: this.bigBrotherCompliant
      }
    };
  }

  validateVoiceCloneRequest(data) {
    const errors = [];
    const { name, description, voiceFile, settings } = data;

    if (!name || typeof name !== 'string') {
      errors.push('Agent name is required and must be a string');
    } else if (name.length < 2 || name.length > 50) {
      errors.push('Agent name must be 2-50 characters long');
    } else if (!/^[a-zA-Z0-9\s._-]+$/.test(name)) {
      errors.push('Agent name contains invalid characters');
    }

    if (description && typeof description !== 'string') {
      errors.push('Description must be a string');
    } else if (description && description.length > 500) {
      errors.push('Description must be under 500 characters');
    }

    if (voiceFile) {
      const fileValidation = this.validateAudioFile(voiceFile);
      if (!fileValidation.isValid) {
        errors.push(...fileValidation.errors);
      }
    }

    if (settings && typeof settings !== 'object') {
      errors.push('Settings must be an object');
    } else if (settings) {
      const settingsValidation = this.validateVoiceSettings(settings);
      if (!settingsValidation.isValid) {
        errors.push(...settingsValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: {
        name: name?.trim(),
        description: description?.trim(),
        settings: settings || {},
        bigBrotherCompliant: this.bigBrotherCompliant
      }
    };
  }

  validateVoiceSettings(settings) {
    const errors = [];
    const {
      stability = 0.5,
      similarityBoost = 0.5,
      style = 0.0,
      speakerBoost = true
    } = settings;

    if (typeof stability !== 'number' || stability < 0 || stability > 1) {
      errors.push('Stability must be a number between 0 and 1');
    }

    if (typeof similarityBoost !== 'number' || similarityBoost < 0 || similarityBoost > 1) {
      errors.push('Similarity boost must be a number between 0 and 1');
    }

    if (typeof style !== 'number' || style < 0 || style > 1) {
      errors.push('Style must be a number between 0 and 1');
    }

    if (typeof speakerBoost !== 'boolean') {
      errors.push('Speaker boost must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: {
        stability: Math.max(0, Math.min(1, stability)),
        similarityBoost: Math.max(0, Math.min(1, similarityBoost)),
        style: Math.max(0, Math.min(1, style)),
        speakerBoost: Boolean(speakerBoost),
        bigBrotherCompliant: this.bigBrotherCompliant
      }
    };
  }

  validateTextToSpeechRequest(data) {
    const errors = [];
    const { text, agentId, settings } = data;

    if (!text || typeof text !== 'string') {
      errors.push('Text is required and must be a string');
    } else if (text.length < 1) {
      errors.push('Text cannot be empty');
    } else if (text.length > 5000) {
      errors.push('Text must be under 5000 characters');
    }

    if (!agentId || typeof agentId !== 'string') {
      errors.push('Agent ID is required and must be a string');
    } else if (!/^[a-zA-Z0-9-_]+$/.test(agentId)) {
      errors.push('Invalid agent ID format');
    }

    if (settings) {
      const settingsValidation = this.validateVoiceSettings(settings);
      if (!settingsValidation.isValid) {
        errors.push(...settingsValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: {
        text: text?.trim(),
        agentId: agentId?.trim(),
        settings: settings || {},
        bigBrotherCompliant: this.bigBrotherCompliant
      }
    };
  }

  validateAgentId(agentId) {
    const errors = [];

    if (!agentId || typeof agentId !== 'string') {
      errors.push('Agent ID is required and must be a string');
    } else if (!/^[a-zA-Z0-9-_]+$/.test(agentId)) {
      errors.push('Agent ID can only contain letters, numbers, hyphens, and underscores');
    } else if (agentId.length < 3 || agentId.length > 50) {
      errors.push('Agent ID must be 3-50 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: agentId?.trim()
    };
  }

  validatePaginationParams(query) {
    const errors = [];
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('Page must be a positive integer');
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('Limit must be between 1 and 100');
    }

    const validSortFields = ['createdAt', 'updatedAt', 'name', 'id'];
    if (!validSortFields.includes(sortBy)) {
      errors.push(`Invalid sort field. Allowed: ${validSortFields.join(', ')}`);
    }

    const validSortOrders = ['asc', 'desc'];
    if (!validSortOrders.includes(sortOrder.toLowerCase())) {
      errors.push('Sort order must be "asc" or "desc"');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: {
        page: Math.max(1, pageNum),
        limit: Math.max(1, Math.min(100, limitNum)),
        sortBy,
        sortOrder: sortOrder.toLowerCase(),
        bigBrotherCompliant: this.bigBrotherCompliant
      }
    };
  }

  sanitizeFilename(filename) {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 100);
  }

  logValidationError(type, errors, data = {}) {
    logger.warn(`Validation failed: ${type}`, {
      errors,
      data: { ...data, bigBrotherCompliant: this.bigBrotherCompliant }
    });
  }
}

module.exports = new VoiceValidators();