// BIG BROTHER COMPLIANT - Agent Routes
const express = require('express');
const logger = require('../utils/logger');
const { asyncHandler, uploadRateLimiter } = require('../utils/middleware');
const agentService = require('../services/agentService');
const audioManager = require('../services/audioManager');

const router = express.Router();

router.use((req, res, next) => {
  res.header('X-Big-Brother-Compliant', 'true');
  res.header('X-Service', 'Agent Management v2');
  next();
});

const sendResponse = (res, success, data, duration, requestId, statusCode = success ? 200 : 500) => {
  res.status(statusCode).json({
    success,
    ...data,
    service: 'Big Brother Voice v2',
    requestId,
    bigBrotherCompliant: true,
    duration,
    timestamp: new Date().toISOString()
  });
};

router.post('/', uploadRateLimiter, audioManager.getUploadMiddleware(), asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  try {
    const { name, description, settings } = req.body;
    const audioFile = req.file;
    logger.agentOperation('Creating agent', { name, filename: audioFile?.originalname, requestId });
    
    const agentData = { name, description, settings: settings ? JSON.parse(settings) : {} };
    const result = await agentService.createAgent(agentData, audioFile);
    const duration = Date.now() - startTime;
    
    logger.performance('Agent created', duration, { agentId: result.agent.id, requestId });
    sendResponse(res, true, { agent: result.agent, processingDuration: duration }, duration, requestId, 201);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Agent creation failed', { error: error.message, requestBody: req.body, file: req.file?.originalname, duration, requestId });
    sendResponse(res, false, { error: error.message }, duration, requestId, 500);
  }
}));

router.get('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  try {
    logger.agentOperation('Listing agents', { query: req.query, requestId });
    const result = await agentService.listAgents(req.query);
    const duration = Date.now() - startTime;
    logger.performance('Agents listed', duration, { count: result.agents.length, page: result.pagination.page, requestId });
    sendResponse(res, true, { agents: result.agents, pagination: result.pagination }, duration, requestId);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Failed to list agents', { error: error.message, query: req.query, duration, requestId });
    sendResponse(res, false, { error: error.message }, duration, requestId);
  }
}));

router.get('/:agentId', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  const { agentId } = req.params;
  try {
    logger.agentOperation('Fetching agent', { agentId, requestId });
    const result = await agentService.getAgent(agentId);
    const duration = Date.now() - startTime;
    logger.performance('Agent fetched', duration, { agentId, requestId });
    sendResponse(res, true, { agent: result.agent }, duration, requestId);
  } catch (error) {
    const duration = Date.now() - startTime;
    const statusCode = error.message.includes('not found') ? 404 : 500;
    logger.error('Failed to fetch agent', { error: error.message, agentId, duration, requestId });
    sendResponse(res, false, { error: error.message, agentId }, duration, requestId, statusCode);
  }
}));

router.put('/:agentId', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  const { agentId } = req.params;
  try {
    logger.agentOperation('Updating agent', { agentId, updateData: req.body, requestId });
    const result = await agentService.updateAgent(agentId, req.body);
    const duration = Date.now() - startTime;
    logger.performance('Agent updated', duration, { agentId, requestId });
    sendResponse(res, true, { agent: result.agent }, duration, requestId);
  } catch (error) {
    const duration = Date.now() - startTime;
    const statusCode = error.message.includes('not found') ? 404 : 500;
    logger.error('Failed to update agent', { error: error.message, agentId, updateData: req.body, duration, requestId });
    sendResponse(res, false, { error: error.message, agentId }, duration, requestId, statusCode);
  }
}));

router.delete('/:agentId', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  const { agentId } = req.params;
  try {
    logger.agentOperation('Deleting agent', { agentId, requestId });
    const result = await agentService.deleteAgent(agentId);
    const duration = Date.now() - startTime;
    logger.performance('Agent deleted', duration, { agentId, requestId });
    sendResponse(res, true, { message: 'Agent deleted successfully', agentId: result.agentId }, duration, requestId);
  } catch (error) {
    const duration = Date.now() - startTime;
    const statusCode = error.message.includes('not found') ? 404 : 500;
    logger.error('Failed to delete agent', { error: error.message, agentId, duration, requestId });
    sendResponse(res, false, { error: error.message, agentId }, duration, requestId, statusCode);
  }
}));

router.get('/stats/overview', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = res.locals.performance?.requestId;
  try {
    logger.agentOperation('Fetching agent stats', { requestId });
    const result = await agentService.getAgentStats();
    const duration = Date.now() - startTime;
    logger.performance('Agent stats fetched', duration, { requestId });
    sendResponse(res, true, { stats: result.stats }, duration, requestId);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Failed to fetch agent stats', { error: error.message, duration, requestId });
    sendResponse(res, false, { error: error.message }, duration, requestId);
  }
}));

module.exports = router;