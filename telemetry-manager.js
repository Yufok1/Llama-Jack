#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class TelemetryManager {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.telemetryDir = path.join(dataDir, '.telemetry');
        this.metricsFile = path.join(this.telemetryDir, 'metrics.json');
        this.predictionsFile = path.join(this.telemetryDir, 'predictions.json');
        this.intervalIds = []; // Store interval IDs for cleanup

        // Real-time metrics collection
        this.metrics = {
            // Performance metrics
            responseTimes: [],
            tokenUsage: [],
            errorRates: [],
            throughput: [],

            // User behavior metrics
            commandFrequency: {},
            toolUsage: {},
            sessionPatterns: [],
            editPatterns: [],

            // Task management metrics
            taskCreation: [],
            taskCompletion: [],
            taskDuration: [],
            taskTypes: {},
            taskSuccess: [],

            // System health metrics
            memoryUsage: [],
            cpuUsage: [],
            networkLatency: [],
            apiCallSuccess: [],

            // Predictive analytics data
            performanceTrends: [],
            errorPatterns: [],
            usagePredictions: [],
            optimizationOpportunities: []
        };

        // Predictive models - DISABLED: Demo implementations not reliable
        this.predictiveModels = {
            responseTimePredictor: null, // new TimeSeriesPredictor(),
            errorPredictor: null, // new PatternPredictor(),
            usagePredictor: null, // new TrendPredictor(),
            optimizationAdvisor: null // new OptimizationAdvisor()
        };

        // Alerting system
        this.alerts = {
            performanceThresholds: {
                maxResponseTime: 30000, // 30 seconds
                maxErrorRate: 0.1, // 10%
                minThroughput: 10 // requests per minute
            },
            activeAlerts: [],
            alertHistory: []
        };

        this.ensureTelemetryDirectory();
        this.startMetricsCollection();
    }

    async ensureTelemetryDirectory() {
        try {
            await fs.mkdir(this.telemetryDir, { recursive: true });
            await this.loadMetrics();
        } catch (error) {
            console.error('[TELEMETRY] Failed to create telemetry directory:', error.message);
        }
    }

    async loadMetrics() {
        try {
            const metricsData = await fs.readFile(this.metricsFile, 'utf8');
            const loadedMetrics = JSON.parse(metricsData);

            // Merge loaded metrics with defaults
            Object.keys(loadedMetrics).forEach(key => {
                if (Array.isArray(loadedMetrics[key])) {
                    this.metrics[key] = loadedMetrics[key];
                } else if (typeof loadedMetrics[key] === 'object') {
                    this.metrics[key] = { ...this.metrics[key], ...loadedMetrics[key] };
                }
            });
        } catch (error) {
            // File doesn't exist or is corrupted, use defaults
            console.log('[TELEMETRY] Initializing new metrics database');
        }
    }

    async saveMetrics() {
        try {
            await fs.writeFile(this.metricsFile, JSON.stringify(this.metrics, null, 2));
        } catch (error) {
            console.error('[TELEMETRY] Failed to save metrics:', error.message);
        }
    }

    startMetricsCollection() {
        // Collect system metrics every 30 seconds
        this.intervalIds.push(setInterval(() => {
            this.collectSystemMetrics();
        }, 30000));

        // Generate predictions every 5 minutes
        this.intervalIds.push(setInterval(() => {
            this.generatePredictions();
        }, 300000));

        // Clean old data daily
        this.intervalIds.push(setInterval(() => {
            this.cleanupOldData();
        }, 86400000));
    }

    /**
     * Record API call metrics
     */
    recordApiCall(model, responseTime, tokens, success, error = null) {
        const metric = {
            timestamp: Date.now(),
            model,
            responseTime,
            tokens,
            success,
            error: error ? error.message : null
        };

        this.metrics.responseTimes.push(metric);
        this.metrics.tokenUsage.push({
            timestamp: Date.now(),
            model,
            tokens,
            success
        });

        // Keep only last 1000 entries for each metric
        if (this.metrics.responseTimes.length > 1000) {
            this.metrics.responseTimes = this.metrics.responseTimes.slice(-1000);
        }
        if (this.metrics.tokenUsage.length > 1000) {
            this.metrics.tokenUsage = this.metrics.tokenUsage.slice(-1000);
        }

        // Check for performance alerts
        this.checkPerformanceAlerts(metric);

        this.saveMetrics();
    }

    /**
     * Record tool usage
     */
    recordToolUsage(toolName, executionTime, success, parameters = {}) {
        if (!this.metrics.toolUsage[toolName]) {
            this.metrics.toolUsage[toolName] = [];
        }

        this.metrics.toolUsage[toolName].push({
            timestamp: Date.now(),
            executionTime,
            success,
            parameterCount: Object.keys(parameters).length
        });

        // Keep only last 500 entries per tool
        if (this.metrics.toolUsage[toolName].length > 500) {
            this.metrics.toolUsage[toolName] = this.metrics.toolUsage[toolName].slice(-500);
        }

        this.saveMetrics();
    }

    /**
     * Record user command patterns
     */
    recordCommand(command, context = {}) {
        const commandKey = command.toLowerCase().split(' ')[0];

        if (!this.metrics.commandFrequency[commandKey]) {
            this.metrics.commandFrequency[commandKey] = 0;
        }
        this.metrics.commandFrequency[commandKey]++;

        this.metrics.sessionPatterns.push({
            timestamp: Date.now(),
            command: commandKey,
            context: {
                hasTools: context.hasTools || false,
                responseTime: context.responseTime || 0,
                success: context.success !== false
            }
        });

        // Keep only last 1000 session patterns
        if (this.metrics.sessionPatterns.length > 1000) {
            this.metrics.sessionPatterns = this.metrics.sessionPatterns.slice(-1000);
        }

        this.saveMetrics();
    }

    /**
     * Record chat request metrics
     */
    recordChatRequest(commandLength, model) {
        const metric = {
            timestamp: Date.now(),
            commandLength,
            model,
            type: 'chat_request'
        };

        this.metrics.responseTimes.push(metric);
        this.metrics.throughput.push({
            timestamp: Date.now(),
            type: 'chat_request',
            count: 1
        });

        // Keep metrics bounded
        if (this.metrics.responseTimes.length > 1000) {
            this.metrics.responseTimes = this.metrics.responseTimes.slice(-1000);
        }
        if (this.metrics.throughput.length > 1000) {
            this.metrics.throughput = this.metrics.throughput.slice(-1000);
        }

        this.saveMetrics();
    }

    /**
     * Record chat response metrics
     */
    recordChatResponse(duration, tokens, toolCalls) {
        const metric = {
            timestamp: Date.now(),
            duration,
            tokens,
            toolCalls,
            type: 'chat_response'
        };

        this.metrics.responseTimes.push(metric);
        this.metrics.tokenUsage.push({
            timestamp: Date.now(),
            tokens,
            type: 'chat_response'
        });

        // Keep metrics bounded
        if (this.metrics.responseTimes.length > 1000) {
            this.metrics.responseTimes = this.metrics.responseTimes.slice(-1000);
        }
        if (this.metrics.tokenUsage.length > 1000) {
            this.metrics.tokenUsage = this.metrics.tokenUsage.slice(-1000);
        }

        this.saveMetrics();
    }

    /**
     * Record chat error metrics
     */
    recordChatError(duration, errorMessage) {
        const metric = {
            timestamp: Date.now(),
            duration,
            error: errorMessage,
            type: 'chat_error'
        };

        this.metrics.responseTimes.push(metric);
        this.metrics.errorRates.push({
            timestamp: Date.now(),
            error: errorMessage,
            type: 'chat_error'
        });

        // Keep metrics bounded
        if (this.metrics.responseTimes.length > 1000) {
            this.metrics.responseTimes = this.metrics.responseTimes.slice(-1000);
        }
        if (this.metrics.errorRates.length > 1000) {
            this.metrics.errorRates = this.metrics.errorRates.slice(-1000);
        }

        this.saveMetrics();
    }

    /**
     * Record task creation event
     */
    recordTaskCreation(taskId, type, priority, description) {
        const metric = {
            timestamp: Date.now(),
            taskId,
            type,
            priority,
            description: description.substring(0, 100), // Truncate for storage
            created: true
        };

        this.metrics.taskCreation.push(metric);

        // Track task type frequency
        if (!this.metrics.taskTypes[type]) {
            this.metrics.taskTypes[type] = 0;
        }
        this.metrics.taskTypes[type]++;

        // Keep metrics bounded
        if (this.metrics.taskCreation.length > 500) {
            this.metrics.taskCreation = this.metrics.taskCreation.slice(-500);
        }

        this.saveMetrics();
    }

    /**
     * Record task completion event
     */
    recordTaskCompletion(taskId, type, duration, success, result = null) {
        const metric = {
            timestamp: Date.now(),
            taskId,
            type,
            duration, // in minutes
            success,
            result: result ? result.toString().substring(0, 200) : null,
            completed: true
        };

        this.metrics.taskCompletion.push(metric);
        this.metrics.taskDuration.push({
            timestamp: Date.now(),
            type,
            duration,
            success
        });
        this.metrics.taskSuccess.push({
            timestamp: Date.now(),
            taskId,
            success
        });

        // Keep metrics bounded
        if (this.metrics.taskCompletion.length > 500) {
            this.metrics.taskCompletion = this.metrics.taskCompletion.slice(-500);
        }
        if (this.metrics.taskDuration.length > 500) {
            this.metrics.taskDuration = this.metrics.taskDuration.slice(-500);
        }
        if (this.metrics.taskSuccess.length > 500) {
            this.metrics.taskSuccess = this.metrics.taskSuccess.slice(-500);
        }

        this.saveMetrics();
    }

    /**
     * Collect system health metrics
     */
    async collectSystemMetrics() {
        try {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            const systemMetric = {
                timestamp: Date.now(),
                memory: {
                    rss: memUsage.rss,
                    heapTotal: memUsage.heapTotal,
                    heapUsed: memUsage.heapUsed,
                    external: memUsage.external
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                }
            };

            this.metrics.memoryUsage.push(systemMetric);
            this.metrics.cpuUsage.push(systemMetric);

            // Keep only last 100 entries
            if (this.metrics.memoryUsage.length > 100) {
                this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
            }
            if (this.metrics.cpuUsage.length > 100) {
                this.metrics.cpuUsage = this.metrics.cpuUsage.slice(-100);
            }

        } catch (error) {
            console.error('[TELEMETRY] Failed to collect system metrics:', error.message);
        }
    }

    /**
     * Check for performance alerts
     */
    checkPerformanceAlerts(metric) {
        const alerts = [];

        // Response time alert
        if (metric.responseTime > this.alerts.performanceThresholds.maxResponseTime) {
            alerts.push({
                type: 'performance',
                severity: 'high',
                message: `Slow response time: ${metric.responseTime}ms for ${metric.model}`,
                metric: 'responseTime',
                value: metric.responseTime,
                threshold: this.alerts.performanceThresholds.maxResponseTime
            });
        }

        // Error rate alert
        const recentErrors = this.metrics.responseTimes
            .slice(-50)
            .filter(m => !m.success).length;
        const errorRate = recentErrors / 50;

        if (errorRate > this.alerts.performanceThresholds.maxErrorRate) {
            alerts.push({
                type: 'error',
                severity: 'high',
                message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
                metric: 'errorRate',
                value: errorRate,
                threshold: this.alerts.performanceThresholds.maxErrorRate
            });
        }

        // Add alerts to active alerts
        alerts.forEach(alert => {
            this.alerts.activeAlerts.push({
                ...alert,
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                resolved: false
            });
        });

        // Keep only last 50 alerts
        if (this.alerts.activeAlerts.length > 50) {
            this.alerts.activeAlerts = this.alerts.activeAlerts.slice(-50);
        }
    }

    /**
     * Generate predictive analytics - DISABLED: Demo implementations not reliable
     */
    async generatePredictions() {
        const predictions = {
            timestamp: Date.now(),
            responseTimeTrend: this.predictiveModels.responseTimePredictor ?
                this.predictiveModels.responseTimePredictor.predict(this.metrics.responseTimes) :
                { trend: 'disabled', message: 'Predictive analysis disabled' },
            errorPatterns: this.predictiveModels.errorPredictor ?
                this.predictiveModels.errorPredictor.analyze(this.metrics.responseTimes) :
                { patterns: [], message: 'Predictive analysis disabled' },
            usageTrends: this.predictiveModels.usagePredictor ?
                this.predictiveModels.usagePredictor.forecast(this.metrics.sessionPatterns) :
                { forecast: [], message: 'Predictive analysis disabled' },
            optimizations: this.predictiveModels.optimizationAdvisor ?
                this.predictiveModels.optimizationAdvisor.suggest(this.metrics) :
                { suggestions: [], message: 'Predictive analysis disabled' }
        };

        // Only add predictions if models are enabled
        if (this.predictiveModels.responseTimePredictor) {
            this.metrics.performanceTrends.push(predictions.responseTimeTrend);
        }
        if (this.predictiveModels.errorPredictor) {
            this.metrics.errorPatterns.push(predictions.errorPatterns);
        }
        if (this.predictiveModels.usagePredictor) {
            this.metrics.usagePredictions.push(predictions.usageTrends);
        }
        if (this.predictiveModels.optimizationAdvisor) {
            this.metrics.optimizationOpportunities.push(predictions.optimizations);
        }

        // Keep only last 100 predictions
        Object.keys(this.metrics).forEach(key => {
            if (key.includes('Trends') || key.includes('Patterns') || key.includes('Predictions') || key.includes('Opportunities')) {
                if (this.metrics[key].length > 100) {
                    this.metrics[key] = this.metrics[key].slice(-100);
                }
            }
        });

        // Save predictions
        try {
            await fs.writeFile(this.predictionsFile, JSON.stringify(predictions, null, 2));
        } catch (error) {
            console.error('[TELEMETRY] Failed to save predictions:', error.message);
        }

        this.saveMetrics();
    }

    /**
     * Clean up old telemetry data
     */
    cleanupOldData() {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

        // Clean old metrics
        Object.keys(this.metrics).forEach(key => {
            if (Array.isArray(this.metrics[key])) {
                this.metrics[key] = this.metrics[key].filter(item => {
                    return !item.timestamp || item.timestamp > thirtyDaysAgo;
                });
            }
        });

        // Clean old alerts
        this.alerts.alertHistory = this.alerts.alertHistory.filter(alert =>
            alert.timestamp > thirtyDaysAgo
        );

        this.saveMetrics();
    }

    /**
     * Get comprehensive telemetry dashboard
     */
    getTelemetryDashboard() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        return {
            current: {
                activeAlerts: this.alerts.activeAlerts.filter(a => !a.resolved),
                recentErrors: this.metrics.responseTimes.filter(m => !m.success && m.timestamp > oneHourAgo),
                systemHealth: this.getSystemHealth()
            },
            trends: {
                responseTimeTrend: this.calculateTrend(this.metrics.responseTimes.slice(-50)),
                errorRateTrend: this.calculateErrorRateTrend(),
                usagePatterns: this.analyzeUsagePatterns()
            },
            predictions: {
                nextHourLoad: this.predictiveModels.usagePredictor ?
                    this.predictiveModels.usagePredictor.predictNextHour() :
                    { load: 'unknown', message: 'Predictive analysis disabled' },
                potentialIssues: this.predictiveModels.errorPredictor ?
                    this.predictiveModels.errorPredictor.predictIssues() :
                    { issues: [], message: 'Predictive analysis disabled' },
                optimizationSuggestions: this.predictiveModels.optimizationAdvisor ?
                    this.predictiveModels.optimizationAdvisor.getSuggestions() :
                    { suggestions: [], message: 'Predictive analysis disabled' }
            },
            analytics: {
                topCommands: Object.entries(this.metrics.commandFrequency)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10),
                toolPerformance: this.analyzeToolPerformance(),
                modelComparison: this.compareModelPerformance()
            }
        };
    }

    /**
     * Get dashboard data (alias for getTelemetryDashboard)
     */
    getDashboardData() {
        return this.getTelemetryDashboard();
    }

    /**
     * Calculate response time trend
     */
    calculateTrend(data) {
        if (data.length < 10) return 'insufficient_data';

        const recent = data.slice(-10);
        const older = data.slice(-20, -10);

        const recentAvg = recent.reduce((sum, item) => sum + item.responseTime, 0) / recent.length;
        const olderAvg = older.reduce((sum, item) => sum + item.responseTime, 0) / older.length;

        const change = ((recentAvg - olderAvg) / olderAvg) * 100;

        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
    }

    /**
     * Calculate error rate trend
     */
    calculateErrorRateTrend() {
        const recent = this.metrics.responseTimes.slice(-50);
        const older = this.metrics.responseTimes.slice(-100, -50);

        const recentErrors = recent.filter(m => !m.success).length / recent.length;
        const olderErrors = older.filter(m => !m.success).length / older.length;

        return {
            current: recentErrors,
            previous: olderErrors,
            trend: recentErrors > olderErrors ? 'worsening' : 'improving'
        };
    }

    /**
     * Analyze usage patterns
     */
    analyzeUsagePatterns() {
        const patterns = {};
        const sessions = this.metrics.sessionPatterns.slice(-100);

        sessions.forEach(session => {
            const hour = new Date(session.timestamp).getHours();
            if (!patterns[hour]) patterns[hour] = [];
            patterns[hour].push(session);
        });

        return Object.entries(patterns).map(([hour, sessions]) => ({
            hour: parseInt(hour),
            commandCount: sessions.length,
            avgResponseTime: sessions.reduce((sum, s) => sum + s.context.responseTime, 0) / sessions.length,
            successRate: sessions.filter(s => s.context.success).length / sessions.length
        }));
    }

    /**
     * Analyze tool performance
     */
    analyzeToolPerformance() {
        const toolStats = {};

        Object.entries(this.metrics.toolUsage).forEach(([toolName, usages]) => {
            const successful = usages.filter(u => u.success);
            const failed = usages.filter(u => !u.success);

            toolStats[toolName] = {
                totalCalls: usages.length,
                successRate: successful.length / usages.length,
                avgExecutionTime: successful.reduce((sum, u) => sum + u.executionTime, 0) / successful.length,
                errorRate: failed.length / usages.length,
                recentTrend: this.calculateTrend(usages.map(u => ({ responseTime: u.executionTime })))
            };
        });

        return toolStats;
    }

    /**
     * Compare model performance
     */
    compareModelPerformance() {
        const modelStats = {};

        this.metrics.responseTimes.forEach(metric => {
            if (!modelStats[metric.model]) {
                modelStats[metric.model] = {
                    calls: 0,
                    successful: 0,
                    totalResponseTime: 0,
                    totalTokens: 0
                };
            }

            modelStats[metric.model].calls++;
            if (metric.success) {
                modelStats[metric.model].successful++;
                modelStats[metric.model].totalResponseTime += metric.responseTime;
                modelStats[metric.model].totalTokens += metric.tokens || 0;
            }
        });

        // Calculate averages
        Object.keys(modelStats).forEach(model => {
            const stats = modelStats[model];
            stats.successRate = stats.successful / stats.calls;
            stats.avgResponseTime = stats.totalResponseTime / stats.successful;
            stats.avgTokens = stats.totalTokens / stats.successful;
        });

        return modelStats;
    }

    /**
     * Get system health status
     */
    getSystemHealth() {
        const recentMemory = this.metrics.memoryUsage.slice(-5);
        const recentCpu = this.metrics.cpuUsage.slice(-5);

        if (recentMemory.length === 0) return 'unknown';

        const avgMemoryUsage = recentMemory.reduce((sum, m) => sum + m.memory.heapUsed, 0) / recentMemory.length;
        const memoryMB = avgMemoryUsage / (1024 * 1024);

        return {
            memoryUsage: Math.round(memoryMB),
            memoryStatus: memoryMB > 500 ? 'high' : memoryMB > 200 ? 'moderate' : 'low',
            uptime: process.uptime(),
            activeConnections: this.metrics.throughput.length > 0 ?
                this.metrics.throughput.slice(-1)[0].value : 0
        };
    }
}

/**
 * PREDICTIVE ANALYTICS CLASSES - DISABLED
 * These demo implementations are not reliable and have been disabled.
 * Remove this comment block if you want to re-enable predictive analysis.
 */

// Time Series Predictor for response times
// DEMO IMPLEMENTATION: Uses simple linear regression for trend analysis
// In production, replace with proper statistical/ML models
/*
class TimeSeriesPredictor {
    predict(data) {
        if (data.length < 10) return { trend: 'insufficient_data' };

        const recent = data.slice(-20);
        const values = recent.map(d => d.responseTime);

        // Simple linear regression for trend
        const n = values.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = values.reduce((sum, val, idx) => sum + val * idx, 0);
        const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

        return {
            trend: slope > 50 ? 'increasing' : slope < -50 ? 'decreasing' : 'stable',
            slope: slope,
            predictedNext: values[values.length - 1] + slope,
            confidence: Math.min(0.9, n / 50) // Higher confidence with more data
        };
    }
}

// Pattern Predictor for errors
// DEMO IMPLEMENTATION: Uses basic pattern matching and frequency analysis
// In production, replace with proper anomaly detection algorithms
class PatternPredictor {
    analyze(data) {
        const errors = data.filter(d => !d.success);
        const patterns = {};

        errors.forEach(error => {
            const time = new Date(error.timestamp);
            const hour = time.getHours();
            const day = time.getDay();

            const key = `${day}-${hour}`;
            if (!patterns[key]) patterns[key] = 0;
            patterns[key]++;
        });

        return {
            highRiskTimes: Object.entries(patterns)
                .filter(([, count]) => count > 2)
                .map(([time]) => time),
            totalErrors: errors.length,
            errorRate: errors.length / data.length
        };
    }

    predictIssues() {
        // Predict potential issues based on patterns
        return {
            predictedErrors: Math.random() * 0.1, // Placeholder for actual prediction
            riskLevel: 'low',
            recommendations: [
                'Monitor response times during peak hours',
                'Consider model fallback for high-error periods'
            ]
        };
    }
}

// Trend Predictor for usage patterns
// DEMO IMPLEMENTATION: Uses simple moving averages and basic forecasting
// In production, replace with time series analysis libraries
class TrendPredictor {
    forecast(data) {
        const hourlyUsage = {};
        data.forEach(item => {
            const hour = new Date(item.timestamp).getHours();
            if (!hourlyUsage[hour]) hourlyUsage[hour] = 0;
            hourlyUsage[hour]++;
        });

        return {
            peakHours: Object.entries(hourlyUsage)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([hour]) => parseInt(hour)),
            usageTrend: 'stable',
            predictedLoad: 'moderate'
        };
    }

    predictNextHour() {
        return {
            expectedRequests: Math.floor(Math.random() * 20) + 5,
            confidence: 0.7
        };
    }
}

// Optimization Advisor
class OptimizationAdvisor {
    suggest(metrics) {
        const suggestions = [];

        // Response time optimization
        const avgResponseTime = metrics.responseTimes
            .slice(-50)
            .reduce((sum, m) => sum + m.responseTime, 0) / 50;

        if (avgResponseTime > 10000) {
            suggestions.push({
                type: 'performance',
                priority: 'high',
                suggestion: 'Consider using faster models or implementing response caching',
                expectedImprovement: '30-50% faster responses'
            });
        }

        // Error rate optimization
        const errorRate = metrics.responseTimes
            .slice(-50)
            .filter(m => !m.success).length / 50;

        if (errorRate > 0.05) {
            suggestions.push({
                type: 'reliability',
                priority: 'high',
                suggestion: 'Implement retry logic and model fallback strategies',
                expectedImprovement: 'Reduce errors by 40%'
            });
        }

        // Tool usage optimization
        const toolUsage = Object.entries(metrics.toolUsage);
        const slowTools = toolUsage
            .filter(([, usages]) => {
                const avgTime = usages.reduce((sum, u) => sum + u.executionTime, 0) / usages.length;
                return avgTime > 5000; // 5 seconds
            });

        if (slowTools.length > 0) {
            suggestions.push({
                type: 'efficiency',
                priority: 'medium',
                suggestion: `Optimize slow tools: ${slowTools.map(([name]) => name).join(', ')}`,
                expectedImprovement: 'Faster tool execution'
            });
        }

        return suggestions;
    }

    getSuggestions() {
        return [
            'Enable model caching for repeated queries',
            'Implement request batching for multiple tool calls',
            'Consider using streaming responses for large outputs',
            'Add connection pooling for API calls'
        ];
    }

    // Cleanup intervals on process exit
    cleanup() {
        this.intervalIds.forEach(id => clearInterval(id));
        this.intervalIds = [];
    }
}
*/

module.exports = TelemetryManager;