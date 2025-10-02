/**
 * Canvas-Jack Bridge - Integration layer for unified Canvas + Jack operation
 * Handles data flow, command routing, and Ollama resource coordination
 */

const OllamaOrchestrator = require('./ollama-orchestrator');
const logger = require('./logger');

class CanvasJackBridge {
    constructor(jackEngine) {
        this.jack = jackEngine;
        this.orchestrator = OllamaOrchestrator;
        this.canvasData = new Map();
        this.bridgeActive = false;
        this.commandQueue = [];
        
        this.init();
    }

    /**
     * Initialize bridge with Canvas system
     */
    init() {
        logger.info('Canvas-Jack Bridge initializing...');
        this.setupCanvasDataSync();
        this.setupCommandRouting();
        this.bridgeActive = true;
    }

    /**
     * Setup Canvas data synchronization
     */
    setupCanvasDataSync() {
        // In real implementation, this would connect to Canvas localStorage/IndexedDB
        // For now, simulate the data structures we identified
        this.canvasData.set('aiFeeds', []);
        this.canvasData.set('observations', []);
        this.canvasData.set('systemMetrics', {
            djinn: 50, nazar: 50, narra: 50, whale: 50, watchtower: 50
        });
        this.canvasData.set('correlations', []);
        this.canvasData.set('documentContent', '');
        this.canvasData.set('synthesisResults', '');
    }

    /**
     * Setup command routing for Canvas-specific operations
     */
    setupCommandRouting() {
        // Add Canvas-specific commands to Jack
        this.jack.canvasCommands = {
            'canvas-status': () => this.getCanvasStatus(),
            'canvas-analyze': (content) => this.analyzeWithCanvas(content),
            'canvas-edit': (changes) => this.editCanvasDocument(changes),
            'canvas-query': (query) => this.queryCanvasSystems(query),
            'canvas-synthesis': () => this.triggerSynthesis(),
            'canvas-export': () => this.exportCanvasData(),
            'ollama-balance': () => this.balanceOllamaLoad(),
            'system-orchestrate': (command) => this.orchestrateSystems(command)
        };
    }

    /**
     * Get optimal Ollama configuration considering Canvas load
     */
    getOptimalOllamaConfig(requestType = 'standard') {
        const canvasLoad = this.estimateCanvasLoad();
        const jackPriority = this.determineJackPriority(requestType);
        
        return this.orchestrator.getOptimalConfig('jack', {
            priority: jackPriority,
            loadBalance: true,
            canvasActive: canvasLoad > 0,
            requestType
        });
    }

    /**
     * Estimate current Canvas AI system load
     */
    estimateCanvasLoad() {
        // Simulate Canvas load detection
        // In real implementation, this would check Canvas system activity
        const aiFeeds = this.canvasData.get('aiFeeds') || [];
        const recentActivity = aiFeeds.filter(feed => 
            Date.now() - new Date(feed.timestamp).getTime() < 10000 // Last 10 seconds
        );
        
        return recentActivity.length; // 0-5 systems active
    }

    /**
     * Determine Jack's priority based on request type
     */
    determineJackPriority(requestType) {
        const canvasLoad = this.estimateCanvasLoad();
        
        // If Canvas is heavily loaded (4-5 systems), Jack should prefer cloud
        if (canvasLoad >= 4) {
            return 'cloud-prefer';
        }
        
        // For urgent Jack operations, prefer available resources
        if (requestType === 'urgent' || requestType === 'interactive') {
            return 'balanced';
        }
        
        // For background operations, be Canvas-friendly
        return 'local-prefer';
    }

    /**
     * Configure Ollama mode coordination
     */
    configureOllamaCoordination(jackMode, canvasMode) {
        const config = {
            jack: jackMode,    // 'local', 'cloud', 'auto'
            canvas: canvasMode // 'local', 'turbo', 'auto'
        };

        logger.info('Configuring Ollama coordination:', config);

        // Update orchestrator with coordination rules
        this.orchestrator.updateConfiguration('jack', {
            mode: jackMode,
            coordinationMode: true,
            canvasMode: canvasMode
        });

        // In real implementation, would sync to Canvas localStorage
        this.syncCanvasMode(canvasMode);

        return this.orchestrator.getStatusReport();
    }

    /**
     * Sync Canvas mode (simulated)
     */
    syncCanvasMode(mode) {
        // Simulate updating Canvas localStorage
        const canvasConfig = {
            turboEnabled: mode === 'turbo' || mode === 'cloud',
            mode: mode,
            coordinationActive: true
        };
        
        this.canvasData.set('ollamaConfig', canvasConfig);
        logger.debug('Synced Canvas mode:', canvasConfig);
    }

    /**
     * Balance Ollama load between systems
     */
    balanceOllamaLoad() {
        const status = this.orchestrator.getStatusReport();
        const canvasLoad = this.estimateCanvasLoad();
        
        const report = {
            timestamp: new Date().toISOString(),
            canvasSystemsActive: canvasLoad,
            ollamaLoad: status.currentLoad,
            recommendations: status.recommendations,
            coordination: this.generateCoordinationPlan(status, canvasLoad)
        };

        logger.info('Ollama load balance report:', report);
        return report;
    }

    /**
     * Generate coordination plan
     */
    generateCoordinationPlan(status, canvasLoad) {
        const plan = {
            recommended: {},
            reasoning: []
        };

        const localUtil = status.currentLoad.local.utilization;
        const cloudUtil = status.currentLoad.cloud.utilization;

        if (canvasLoad >= 3 && localUtil > 0.7) {
            plan.recommended.jack = 'cloud';
            plan.recommended.canvas = 'local';
            plan.reasoning.push('Canvas heavy load detected - Jack should use cloud');
        } else if (canvasLoad <= 1 && cloudUtil > 0.7) {
            plan.recommended.jack = 'local';
            plan.recommended.canvas = 'turbo';
            plan.reasoning.push('Canvas light load - Jack can use local, Canvas can use turbo');
        } else {
            plan.recommended.jack = 'auto';
            plan.recommended.canvas = 'auto';
            plan.reasoning.push('Balanced load - auto-selection recommended');
        }

        return plan;
    }

    /**
     * Get Canvas system status
     */
    getCanvasStatus() {
        const metrics = this.canvasData.get('systemMetrics') || {};
        const aiFeeds = this.canvasData.get('aiFeeds') || [];
        const recentActivity = aiFeeds.filter(feed => 
            Date.now() - new Date(feed.timestamp || Date.now()).getTime() < 30000
        );

        return {
            systems: {
                djinn: { confidence: metrics.djinn || 0, active: recentActivity.some(f => f.system === 'djinn') },
                nazar: { confidence: metrics.nazar || 0, active: recentActivity.some(f => f.system === 'nazar') },
                narra: { confidence: metrics.narra || 0, active: recentActivity.some(f => f.system === 'narra') },
                whale: { confidence: metrics.whale || 0, active: recentActivity.some(f => f.system === 'whale') },
                watchtower: { confidence: metrics.watchtower || 0, active: recentActivity.some(f => f.system === 'watchtower') }
            },
            document: {
                length: (this.canvasData.get('documentContent') || '').length,
                lastModified: this.canvasData.get('documentLastModified') || null
            },
            synthesis: {
                available: !!(this.canvasData.get('synthesisResults') || '').length,
                lastUpdate: this.canvasData.get('synthesisLastUpdate') || null
            },
            recentActivity: recentActivity.length
        };
    }

    /**
     * Query Canvas AI systems through Jack
     */
    queryCanvasSystems(query) {
        // This would interface with Canvas AI systems
        logger.info(`Querying Canvas systems: ${query}`);
        
        const status = this.getCanvasStatus();
        const activeSystems = Object.entries(status.systems)
            .filter(([_, system]) => system.active)
            .map(([name, _]) => name);

        return {
            query,
            targetSystems: activeSystems,
            currentStatus: status,
            response: `Query "${query}" would be sent to: ${activeSystems.join(', ')}`,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Orchestrate systems coordination
     */
    orchestrateSystems(command) {
        const validCommands = ['sync', 'balance', 'priority-canvas', 'priority-jack', 'auto'];
        
        if (!validCommands.includes(command)) {
            return { error: `Invalid command. Valid: ${validCommands.join(', ')}` };
        }

        logger.info(`Orchestrating systems: ${command}`);

        switch (command) {
            case 'sync':
                return this.syncSystems();
            case 'balance':
                return this.balanceOllamaLoad();
            case 'priority-canvas':
                return this.configureOllamaCoordination('cloud-prefer', 'local-prefer');
            case 'priority-jack':
                return this.configureOllamaCoordination('local-prefer', 'cloud-prefer');
            case 'auto':
                return this.configureOllamaCoordination('auto', 'auto');
            default:
                return { error: 'Unknown orchestration command' };
        }
    }

    /**
     * Sync systems state
     */
    syncSystems() {
        const canvasStatus = this.getCanvasStatus();
        const ollamaStatus = this.orchestrator.getStatusReport();
        
        return {
            timestamp: new Date().toISOString(),
            canvas: canvasStatus,
            ollama: ollamaStatus,
            bridge: {
                active: this.bridgeActive,
                commandQueue: this.commandQueue.length
            },
            sync: 'complete'
        };
    }

    /**
     * Get bridge status for debugging
     */
    getStatus() {
        return {
            bridgeActive: this.bridgeActive,
            canvasDataKeys: Array.from(this.canvasData.keys()),
            commandQueue: this.commandQueue.length,
            orchestrator: this.orchestrator.getStatusReport()
        };
    }
}

module.exports = CanvasJackBridge;