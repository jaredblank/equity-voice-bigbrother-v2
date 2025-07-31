// @compliance BIG_BROTHER_V2
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const logger = require('../utils/logger');

class BigBrotherMonitor {
    constructor() {
        this.violations = [];
        this.recentChanges = [];
        this.stats = {
            totalFiles: 0,
            compliantFiles: 0,
            violations: 0,
            avgLineCount: 0
        };
        this.isMonitoring = false;
        this.rules = [
            {
                id: 1,
                name: 'Max Lines per File',
                type: 'number',
                value: 250,
                active: true,
                severity: 'high',
                category: 'performance',
                description: 'Keep files focused and maintainable'
            },
            {
                id: 2,
                name: 'Max Response Time (ms)',
                type: 'number',
                value: 100,
                active: true,
                severity: 'high',
                category: 'performance',
                description: 'APIs must respond under 100ms'
            },
            {
                id: 3,
                name: 'Required Error Handling',
                type: 'boolean',
                value: true,
                active: true,
                severity: 'high',
                category: 'bulletproof',
                description: 'Every API call must handle failures'
            },
            {
                id: 4,
                name: 'No Database Queries in Loops',
                type: 'boolean',
                value: true,
                active: true,
                severity: 'high',
                category: 'performance',
                description: 'Prevents N+1 query problems'
            }
        ];
        this.watchedDirectories = [
            path.join(__dirname, '../..'),
            path.join(__dirname, '../../../equity-ai-assistant-bigbrother-v2'),
            path.join(__dirname, '../../../equity-chat-v2')
        ];
    }

    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        logger.info('Big Brother monitoring started', { component: 'BigBrotherMonitor' });

        this.watchedDirectories.forEach(dir => {
            if (fs.existsSync(dir)) {
                const watcher = chokidar.watch(dir, {
                    ignored: /(node_modules|\.git|logs)/,
                    persistent: true
                });

                watcher.on('change', (filepath) => this.checkFile(filepath, 'modified'));
                watcher.on('add', (filepath) => this.checkFile(filepath, 'created'));
            }
        });

        // Initial scan
        this.performInitialScan();
    }

    stopMonitoring() {
        this.isMonitoring = false;
        logger.info('Big Brother monitoring stopped', { component: 'BigBrotherMonitor' });
    }

    performInitialScan() {
        const timer = logger.performance('initial-scan', 'BigBrotherMonitor');
        let scannedFiles = 0;

        this.watchedDirectories.forEach(dir => {
            if (fs.existsSync(dir)) {
                this.scanDirectory(dir, (filepath) => {
                    this.checkFile(filepath, 'scanned');
                    scannedFiles++;
                });
            }
        });

        timer.end(`Initial scan completed: ${scannedFiles} files`);
    }

    scanDirectory(dir, callback) {
        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !['node_modules', '.git', 'logs'].includes(item)) {
                this.scanDirectory(fullPath, callback);
            } else if (stat.isFile() && this.isCodeFile(fullPath)) {
                callback(fullPath);
            }
        });
    }

    isCodeFile(filepath) {
        const extensions = ['.js', '.ts', '.py', '.java', '.go', '.php', '.jsx', '.vue'];
        return extensions.some(ext => filepath.endsWith(ext));
    }

    checkFile(filepath, action) {
        try {
            const content = fs.readFileSync(filepath, 'utf-8');
            const lineCount = content.split('\n').length;
            const violations = this.checkRules(content, filepath);

            const change = {
                id: Date.now(),
                file: path.basename(filepath),
                timestamp: new Date().toLocaleTimeString(),
                lineCount,
                violation: violations.length > 0,
                violationType: violations[0]?.type || null
            };

            this.recentChanges.unshift(change);
            if (this.recentChanges.length > 10) {
                this.recentChanges = this.recentChanges.slice(0, 10);
            }

            this.stats.totalFiles++;
            this.stats.avgLineCount = Math.round((this.stats.avgLineCount + lineCount) / 2);

            if (violations.length > 0) {
                this.stats.violations += violations.length;
                violations.forEach(violation => this.addViolation(violation));
                logger.warn('Big Brother violation detected', {
                    component: 'BigBrotherMonitor',
                    file: path.basename(filepath),
                    violations: violations.length
                });
            } else {
                this.stats.compliantFiles++;
                logger.info('File compliance check passed', {
                    component: 'BigBrotherMonitor',
                    file: path.basename(filepath),
                    lines: lineCount
                });
            }
        } catch (error) {
            logger.error('Error checking file', {
                component: 'BigBrotherMonitor',
                filepath,
                error: error.message
            });
        }
    }

    checkRules(content, filepath) {
        const violations = [];
        const activeRules = this.rules.filter(rule => rule.active);

        activeRules.forEach(rule => {
            const violation = this.checkSingleRule(rule, content, filepath);
            if (violation) {
                violations.push(violation);
            }
        });

        return violations;
    }

    checkSingleRule(rule, content, filepath) {
        const filename = path.basename(filepath);

        switch (rule.name) {
            case 'Max Lines per File':
                const lineCount = content.split('\n').length;
                if (lineCount > rule.value) {
                    return {
                        id: Date.now(),
                        file: filename,
                        type: 'line_limit_exceeded',
                        severity: rule.severity,
                        timestamp: new Date().toLocaleTimeString(),
                        description: `File has ${lineCount} lines (max: ${rule.value})`
                    };
                }
                break;

            case 'Required Error Handling':
                const errorPatterns = [
                    /try\s*{[\s\S]*?catch/i,
                    /\.catch\s*\(/i,
                    /if.*error/i
                ];
                const hasErrorHandling = errorPatterns.some(pattern => pattern.test(content));
                
                if (!hasErrorHandling && content.length > 100) {
                    return {
                        id: Date.now(),
                        file: filename,
                        type: 'missing_error_handling',
                        severity: rule.severity,
                        timestamp: new Date().toLocaleTimeString(),
                        description: 'Missing error handling - Code may crash on errors'
                    };
                }
                break;

            case 'No Database Queries in Loops':
                const loopQueryPatterns = [
                    /(for|while|forEach)[\s\S]*?(query|find|insert|update|delete|SELECT|INSERT|UPDATE|DELETE)/i
                ];
                if (loopQueryPatterns.some(pattern => pattern.test(content))) {
                    return {
                        id: Date.now(),
                        file: filename,
                        type: 'database_loop_query',
                        severity: rule.severity,
                        timestamp: new Date().toLocaleTimeString(),
                        description: 'Database query detected in loop - Performance killer'
                    };
                }
                break;
        }

        return null;
    }

    addViolation(violation) {
        this.violations.unshift(violation);
        if (this.violations.length > 20) {
            this.violations = this.violations.slice(0, 20);
        }
    }

    getStatus() {
        return {
            violations: this.violations,
            recentChanges: this.recentChanges,
            stats: this.stats,
            isMonitoring: this.isMonitoring,
            rules: this.rules
        };
    }

    addRule(ruleData) {
        const newRule = {
            id: Date.now(),
            name: ruleData.name,
            type: ruleData.type,
            value: ruleData.value,
            active: true,
            severity: ruleData.severity,
            category: ruleData.category || 'custom',
            description: ruleData.description || 'Custom rule'
        };
        this.rules.push(newRule);
        return newRule;
    }

    updateRule(ruleId, updates) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) {
            Object.assign(rule, updates);
            return true;
        }
        return false;
    }

    deleteRule(ruleId) {
        const index = this.rules.findIndex(r => r.id === ruleId);
        if (index !== -1) {
            this.rules.splice(index, 1);
            return true;
        }
        return false;
    }

    exportRules() {
        return {
            rules: this.rules,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
    }

    importRules(rulesConfig) {
        if (rulesConfig.rules && Array.isArray(rulesConfig.rules)) {
            this.rules = rulesConfig.rules;
            return true;
        }
        return false;
    }
}

module.exports = BigBrotherMonitor;