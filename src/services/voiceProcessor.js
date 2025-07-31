// BIG BROTHER COMPLIANT - Voice Processor Service
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const voiceConfig = require('../config/voiceConfig');

class VoiceProcessor {
  constructor() {
    this.bigBrotherCompliant = true;
    this.activeRequests = new Map();
    this.requestQueue = [];
    this.maxConcurrent = voiceConfig.elevenLabsConfig.maxConcurrentRequests;
  }

  async processQueue() {
    if (this.activeRequests.size >= this.maxConcurrent || this.requestQueue.length === 0) return;
    const request = this.requestQueue.shift();
    if (request) {
      this.activeRequests.set(request.id, request);
      try {
        const result = await request.execute();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      } finally {
        this.activeRequests.delete(request.id);
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  async queueRequest(executeFunction) {
    return new Promise((resolve, reject) => {
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.requestQueue.push({ id: requestId, execute: executeFunction, resolve, reject });
      this.processQueue();
    });
  }

  async createVoiceClone(name, description, audioFilePath) {
    const startTime = Date.now();
    try {
      logger.voiceProcessing('Starting voice clone creation', { name, audioFilePath });
      const result = await this.queueRequest(async () => {
        const formData = new FormData();
        formData.append('name', name);
        if (description) formData.append('description', description);
        formData.append('files', fs.createReadStream(audioFilePath), path.basename(audioFilePath));
        const response = await axios.post(
          `${voiceConfig.elevenLabsConfig.baseUrl}${voiceConfig.elevenLabsConfig.endpoints.voiceClone}`,
          formData,
          { headers: { ...voiceConfig.getElevenLabsHeaders(), ...formData.getHeaders() }, timeout: voiceConfig.elevenLabsConfig.timeout }
        );
        return response.data;
      });
      const duration = Date.now() - startTime;
      logger.performance('Voice clone created', duration, { name, voiceId: result.voice_id });
      return { success: true, voiceId: result.voice_id, name: result.name, duration, bigBrotherCompliant: this.bigBrotherCompliant };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Voice clone creation failed', { error: error.message, name, duration, status: error.response?.status });
      throw this.handleElevenLabsError(error);
    }
  }

  async generateSpeech(text, voiceId, settings = {}) {
    const startTime = Date.now();
    try {
      logger.voiceProcessing('Starting speech generation', { voiceId, textLength: text.length });
      const validatedSettings = voiceConfig.validateVoiceSettings(settings);
      const result = await this.queueRequest(async () => {
        return await axios.post(
          `${voiceConfig.elevenLabsConfig.baseUrl}${voiceConfig.elevenLabsConfig.endpoints.textToSpeech}/${voiceId}`,
          { text, voice_settings: validatedSettings },
          { headers: voiceConfig.getElevenLabsHeaders(), timeout: voiceConfig.elevenLabsConfig.timeout, responseType: 'stream' }
        );
      });
      const duration = Date.now() - startTime;
      logger.performance('Speech generated', duration, { voiceId, textLength: text.length });
      return { success: true, audioStream: result.data, duration, settings: validatedSettings, bigBrotherCompliant: this.bigBrotherCompliant };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Speech generation failed', { error: error.message, voiceId, textLength: text.length, duration, status: error.response?.status });
      throw this.handleElevenLabsError(error);
    }
  }

  async getVoices() {
    try {
      logger.voiceProcessing('Fetching available voices');
      const result = await this.queueRequest(async () => {
        const response = await axios.get(
          `${voiceConfig.elevenLabsConfig.baseUrl}${voiceConfig.elevenLabsConfig.endpoints.voices}`,
          { headers: voiceConfig.getElevenLabsHeaders(), timeout: voiceConfig.elevenLabsConfig.timeout }
        );
        return response.data;
      });
      logger.voiceProcessing('Voices fetched successfully', { count: result.voices?.length || 0 });
      return { success: true, voices: result.voices || [], bigBrotherCompliant: this.bigBrotherCompliant };
    } catch (error) {
      logger.error('Failed to fetch voices', { error: error.message });
      throw this.handleElevenLabsError(error);
    }
  }

  async deleteVoice(voiceId) {
    try {
      logger.voiceProcessing('Deleting voice', { voiceId });
      await this.queueRequest(async () => {
        await axios.delete(
          `${voiceConfig.elevenLabsConfig.baseUrl}${voiceConfig.elevenLabsConfig.endpoints.voiceDelete}/${voiceId}`,
          { headers: voiceConfig.getElevenLabsHeaders(), timeout: voiceConfig.elevenLabsConfig.timeout }
        );
      });
      logger.voiceProcessing('Voice deleted successfully', { voiceId });
      return { success: true, voiceId, bigBrotherCompliant: this.bigBrotherCompliant };
    } catch (error) {
      logger.error('Voice deletion failed', { error: error.message, voiceId });
      throw this.handleElevenLabsError(error);
    }
  }

  async getUserInfo() {
    try {
      const result = await this.queueRequest(async () => {
        const response = await axios.get(
          `${voiceConfig.elevenLabsConfig.baseUrl}${voiceConfig.elevenLabsConfig.endpoints.user}`,
          { headers: voiceConfig.getElevenLabsHeaders(), timeout: voiceConfig.elevenLabsConfig.timeout }
        );
        return response.data;
      });
      return { success: true, userInfo: result, bigBrotherCompliant: this.bigBrotherCompliant };
    } catch (error) {
      logger.error('Failed to fetch user info', { error: error.message });
      throw this.handleElevenLabsError(error);
    }
  }

  handleElevenLabsError(error) {
    const status = error.response?.status;
    const message = error.response?.data?.detail || error.message;
    const errorMap = {
      401: 'Invalid ElevenLabs API key',
      402: 'ElevenLabs quota exceeded',
      422: `Invalid request: ${message}`,
      429: 'ElevenLabs rate limit exceeded',
      500: 'ElevenLabs server error'
    };
    return new Error(errorMap[status] || `ElevenLabs API error: ${message}`);
  }

  getQueueStatus() {
    return { activeRequests: this.activeRequests.size, queuedRequests: this.requestQueue.length, maxConcurrent: this.maxConcurrent, bigBrotherCompliant: this.bigBrotherCompliant };
  }
}

module.exports = new VoiceProcessor();