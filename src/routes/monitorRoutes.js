// @compliance BIG_BROTHER_V2
const express = require('express');
const BigBrotherMonitor = require('../services/bigBrotherMonitor');
const logger = require('../utils/logger');

const router = express.Router();
const monitor = new BigBrotherMonitor();

// Don't auto-start monitoring to prevent deployment issues
// Monitor will be started via API endpoint when needed

// GET /api/monitor/status - Get monitoring status and data
router.get('/status', (req, res) => {
    const timer = logger.performance('monitor-status', 'MonitorRoutes');
    try {
        const status = monitor.getStatus();
        
        timer.addMetadata('violationsCount', status.violations.length);
        timer.addMetadata('recentChangesCount', status.recentChanges.length);
        timer.end('Monitor status retrieved');

        res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        timer.endWithError(error, 'Failed to get monitor status');
        logger.error('Failed to get monitor status', {
            component: 'MonitorRoutes',
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve monitoring status',
            message: error.message
        });
    }
});

// POST /api/monitor/start - Start monitoring
router.post('/start', (req, res) => {
    const timer = logger.performance('monitor-start', 'MonitorRoutes');
    try {
        monitor.startMonitoring();
        
        timer.end('Monitoring started');
        logger.info('Big Brother monitoring started via API', { component: 'MonitorRoutes' });

        res.json({
            success: true,
            message: 'Big Brother monitoring started',
            isMonitoring: monitor.isMonitoring
        });
    } catch (error) {
        timer.endWithError(error, 'Failed to start monitoring');
        logger.error('Failed to start monitoring', {
            component: 'MonitorRoutes',
            error: error.message
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to start monitoring',
            message: error.message
        });
    }
});

// POST /api/monitor/stop - Stop monitoring
router.post('/stop', (req, res) => {
    const timer = logger.performance('monitor-stop', 'MonitorRoutes');
    try {
        monitor.stopMonitoring();
        
        timer.end('Monitoring stopped');
        logger.info('Big Brother monitoring stopped via API', { component: 'MonitorRoutes' });

        res.json({
            success: true,
            message: 'Big Brother monitoring stopped',
            isMonitoring: monitor.isMonitoring
        });
    } catch (error) {
        timer.endWithError(error, 'Failed to stop monitoring');
        logger.error('Failed to stop monitoring', {
            component: 'MonitorRoutes',
            error: error.message
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to stop monitoring',
            message: error.message
        });
    }
});

// GET /api/monitor/rules - Get all rules
router.get('/rules', (req, res) => {
    const timer = logger.performance('get-rules', 'MonitorRoutes');
    try {
        const rules = monitor.rules;
        
        timer.addMetadata('rulesCount', rules.length);
        timer.end('Rules retrieved');

        res.json({
            success: true,
            data: rules,
            count: rules.length
        });
    } catch (error) {
        timer.endWithError(error, 'Failed to get rules');
        
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve rules',
            message: error.message
        });
    }
});

// POST /api/monitor/rules - Add new rule
router.post('/rules', (req, res) => {
    const timer = logger.performance('add-rule', 'MonitorRoutes');
    try {
        const { name, type, value, severity, category, description } = req.body;
        
        if (!name || !type || value === undefined || !severity) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, type, value, severity'
            });
        }

        const newRule = monitor.addRule({
            name,
            type,
            value,
            severity,
            category,
            description
        });

        timer.addMetadata('ruleId', newRule.id);
        timer.end('Rule added');
        
        logger.info('New Big Brother rule added', {
            component: 'MonitorRoutes',
            ruleName: name,
            ruleId: newRule.id
        });

        res.json({
            success: true,
            data: newRule,
            message: 'Rule added successfully'
        });
    } catch (error) {
        timer.endWithError(error, 'Failed to add rule');
        
        res.status(500).json({
            success: false,
            error: 'Failed to add rule',
            message: error.message
        });
    }
});

// PUT /api/monitor/rules/:id - Update existing rule
router.put('/rules/:id', (req, res) => {
    const timer = logger.performance('update-rule', 'MonitorRoutes');
    const ruleId = parseInt(req.params.id);
    
    try {
        const success = monitor.updateRule(ruleId, req.body);
        
        if (success) {
            timer.end('Rule updated');
            logger.info('Big Brother rule updated', {
                component: 'MonitorRoutes',
                ruleId
            });

            res.json({
                success: true,
                message: 'Rule updated successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Rule not found'
            });
        }
    } catch (error) {
        timer.endWithError(error, 'Failed to update rule');
        
        res.status(500).json({
            success: false,
            error: 'Failed to update rule',
            message: error.message
        });
    }
});

// DELETE /api/monitor/rules/:id - Delete rule
router.delete('/rules/:id', (req, res) => {
    const timer = logger.performance('delete-rule', 'MonitorRoutes');
    const ruleId = parseInt(req.params.id);
    
    try {
        const success = monitor.deleteRule(ruleId);
        
        if (success) {
            timer.end('Rule deleted');
            logger.info('Big Brother rule deleted', {
                component: 'MonitorRoutes',
                ruleId
            });

            res.json({
                success: true,
                message: 'Rule deleted successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Rule not found'
            });
        }
    } catch (error) {
        timer.endWithError(error, 'Failed to delete rule');
        
        res.status(500).json({
            success: false,
            error: 'Failed to delete rule',
            message: error.message
        });
    }
});

// GET /api/monitor/rules/export - Export rules configuration
router.get('/rules/export', (req, res) => {
    const timer = logger.performance('export-rules', 'MonitorRoutes');
    try {
        const rulesConfig = monitor.exportRules();
        
        timer.end('Rules exported');
        
        res.json({
            success: true,
            data: rulesConfig
        });
    } catch (error) {
        timer.endWithError(error, 'Failed to export rules');
        
        res.status(500).json({
            success: false,
            error: 'Failed to export rules',
            message: error.message
        });
    }
});

// POST /api/monitor/rules/import - Import rules configuration
router.post('/rules/import', (req, res) => {
    const timer = logger.performance('import-rules', 'MonitorRoutes');
    try {
        const success = monitor.importRules(req.body);
        
        if (success) {
            timer.end('Rules imported');
            logger.info('Big Brother rules imported', {
                component: 'MonitorRoutes',
                rulesCount: req.body.rules?.length || 0
            });

            res.json({
                success: true,
                message: 'Rules imported successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Invalid rules format'
            });
        }
    } catch (error) {
        timer.endWithError(error, 'Failed to import rules');
        
        res.status(500).json({
            success: false,
            error: 'Failed to import rules',
            message: error.message
        });
    }
});

module.exports = router;