// BIG BROTHER COMPLIANT - Voice Routes
const express = require('express');
const logger = require('../utils/logger');
const validators = require('../utils/validators');
const { asyncHandler, voiceRateLimiter } = require('../utils/middleware');
const voiceProcessor = require('../services/voiceProcessor');
const audioManager = require('../services/audioManager');
const agentService = require('../services/agentService');

const router = express.Router();

router.use((req, res, next) => {
  res.header('X-Big-Brother-Compliant', 'true');
  res.header('X-Service', 'Voice Processing v2');
  next();
});

const sendVoiceResponse = (res, success, data, requestId, statusCode = success ? 200 : 500) => {
  res.status(statusCode).json({
    success,
    ...data,
    service: 'Big Brother Voice v2',
    requestId,
    bigBrotherCompliant: true,
    timestamp: new Date().toISOString()
  });
};

router.post('/synthesize', voiceRateLimiter, asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  try {
    const validation = validators.validateTextToSpeechRequest(req.body);
    if (!validation.isValid) {
      logger.warn('TTS request validation failed', { errors: validation.errors, requestId });
      return sendVoiceResponse(res, false, { error: 'Validation failed', details: validation.errors }, requestId, 400);
    }
    const { text, agentId, settings } = validation.sanitized;
    const agent = await agentService.getAgent(agentId);
    if (!agent.success) return sendVoiceResponse(res, false, { error: 'Agent not found', agentId }, requestId, 404);
    
    const mergedSettings = { ...agent.agent.settings, ...settings };
    const result = await voiceProcessor.generateSpeech(text, agent.agent.voiceId, mergedSettings);
    const filename = `tts_${agentId}_${Date.now()}.mp3`;
    const audioResult = await audioManager.saveGeneratedAudio(result.audioStream, filename);
    const duration = Date.now() - startTime;
    
    logger.voiceProcessing('TTS synthesis completed', { agentId, textLength: text.length, filename: audioResult.filename, duration, requestId });
    sendVoiceResponse(res, true, {
      result: { agentId, text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), audioUrl: `/uploads/${audioResult.filename}`, filename: audioResult.filename, size: audioResult.size, settings: mergedSettings, duration: result.duration, processingDuration: duration }
    }, requestId);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('TTS synthesis failed', { error: error.message, requestBody: req.body, duration, requestId });
    sendVoiceResponse(res, false, { error: error.message }, requestId, 500);
  }
}));

router.get('/voices', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  try {
    logger.voiceProcessing('Fetching available voices', { requestId });
    const result = await voiceProcessor.getVoices();
    const duration = Date.now() - startTime;
    logger.performance('Voices fetched', duration, { count: result.voices.length, requestId });
    sendVoiceResponse(res, true, { voices: result.voices, count: result.voices.length, duration }, requestId);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Failed to fetch voices', { error: error.message, duration, requestId });
    sendVoiceResponse(res, false, { error: error.message }, requestId, 500);
  }
}));

router.post('/clone', voiceRateLimiter, audioManager.getUploadMiddleware(), asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  try {
    const { name, description, settings } = req.body;
    const audioFile = req.file;
    if (!audioFile) return sendVoiceResponse(res, false, { error: 'Audio file is required' }, requestId, 400);
    
    logger.voiceProcessing('Starting voice clone', { name, filename: audioFile.originalname, size: audioFile.size, requestId });
    const agentData = { name, description, settings: settings ? JSON.parse(settings) : {} };
    const result = await agentService.createAgent(agentData, audioFile);
    const duration = Date.now() - startTime;
    
    logger.performance('Voice clone completed', duration, { agentId: result.agent.id, voiceId: result.agent.voiceId, requestId });
    sendVoiceResponse(res, true, { agent: result.agent, processingDuration: duration }, requestId);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Voice clone failed', { error: error.message, requestBody: req.body, file: req.file?.originalname, duration, requestId });
    sendVoiceResponse(res, false, { error: error.message }, requestId, 500);
  }
}));

router.get('/queue/status', asyncHandler(async (req, res) => {
  const requestId = res.locals.performance?.requestId;
  try {
    const queueStatus = voiceProcessor.getQueueStatus();
    const fileStats = await audioManager.getFileStats();
    sendVoiceResponse(res, true, { queue: queueStatus, files: fileStats }, requestId);
  } catch (error) {
    logger.error('Failed to get queue status', { error: error.message, requestId });
    sendVoiceResponse(res, false, { error: error.message }, requestId, 500);
  }
}));

router.get('/user', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  try {
    const result = await voiceProcessor.getUserInfo();
    const duration = Date.now() - startTime;
    sendVoiceResponse(res, true, { userInfo: result.userInfo, duration }, requestId);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Failed to get user info', { error: error.message, duration, requestId });
    sendVoiceResponse(res, false, { error: error.message }, requestId, 500);
  }
}));

module.exports = router;