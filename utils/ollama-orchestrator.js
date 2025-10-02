/**
 * Ollama Network Orchestrator - Unified configuration for Canvas & Jack systems
 * Handles load balancing, mode switching, and resource management between systems
 */

const logger = require('./logger');

class OllamaOrchestrator {
    constructor() {
        this.configurations = {
            canvas: null,
            jack: null
        };
        
        this.endpoints = {
            local: 'http://localhost:11434',
            canvasProxy: 'http://localhost:11435', // Canvas turbo proxy
            jackCloud: 'https://api.ollama.com'   // Direct cloud access
        };
        
        this.loadBalancer = {
            localConnections: 0,
            cloudConnections: 0,
            maxLocalConcurrent: 3,  // Ollama local limit
            maxCloudConcurrent: 10  // Cloud API limit
        };
        
        this.sharedStorage = new Map();
        this.init();
    }

    /**
     * Initialize orchestrator with cross-system communication
     */
    init() {
        logger.info('Ollama Orchestrator initializing...');
        this.loadConfigurations();
        this.setupStorageSync();
    }

    /**
     * Load configurations from both systems
     */
    loadConfigurations() {
        // Load Jack configuration
        this.configurations.jack = {
            mode: this.detectJackMode(),
            host: process.env.OLLAMA_HOST || this.endpoints.local,
            apiKey: process.env.OLLAMA_API_KEY,
            priority: 'balanced' // balanced, local-prefer, cloud-prefer
        };

        // Load Canvas configuration (from localStorage simulation)
        this.configurations.canvas = this.detectCanvasMode();
        
        logger.debug('Configurations loaded:', this.configurations);
    }

    /**
     * Detect Jack's optimal mode based on environment and load
     */
    detectJackMode() {
        const hasApiKey = !!process.env.OLLAMA_API_KEY;
        const forceLocal = process.env.MODE === 'local';
        const forceCloud = process.env.MODE === 'cloud';
        
        if (forceLocal) return 'local';
        if (forceCloud && hasApiKey) return 'cloud';
        if (hasApiKey && this.loadBalancer.localConnections >= this.loadBalancer.maxLocalConcurrent) {
            return 'cloud'; // Fallback to cloud if local is busy
        }
        
        return hasApiKey ? 'auto' : 'local';
    }

    /**
     * Detect Canvas mode from simulated localStorage
     */
    detectCanvasMode() {
        // In real implementation, this would read Canvas localStorage
        // For now, simulate common configurations
        return {
            mode: 'local', // or 'turbo'
            endpoint: this.endpoints.local,
            apiKey: null,
            priority: 'local-prefer'
        };
    }

    /**
     * Get optimal Ollama configuration for a system
     * @param {string} system - 'canvas' or 'jack'
     * @param {Object} options - Request options
     * @returns {Object} - Ollama configuration
     */
    getOptimalConfig(system, options = {}) {
        const config = this.configurations[system];
        const currentLoad = this.getCurrentLoad();
        
        logger.debug(`Getting optimal config for ${system}:`, { currentLoad, config });

        // Load balancing logic
        if (config.mode === 'auto' || options.loadBalance) {
            return this.selectOptimalEndpoint(system, options);
        }

        // Fixed mode configurations
        switch (config.mode) {
            case 'local':
                return this.getLocalConfig(system);
            case 'cloud':
            case 'turbo':
                return this.getCloudConfig(system);
            default:
                return this.getLocalConfig(system);
        }
    }

    /**
     * Select optimal endpoint based on current load
     */
    selectOptimalEndpoint(system, options) {
        const canUseLocal = this.loadBalancer.localConnections < this.loadBalancer.maxLocalConcurrent;
        const canUseCloud = this.loadBalancer.cloudConnections < this.loadBalancer.maxCloudConcurrent;
        const hasCloudAccess = this.configurations[system].apiKey;

        // Priority-based selection
        const priority = options.priority || this.configurations[system].priority;
        
        switch (priority) {
            case 'local-prefer':
                return canUseLocal ? this.getLocalConfig(system) : 
                       (canUseCloud && hasCloudAccess ? this.getCloudConfig(system) : this.getLocalConfig(system));
                       
            case 'cloud-prefer':
                return (canUseCloud && hasCloudAccess) ? this.getCloudConfig(system) : 
                       (canUseLocal ? this.getLocalConfig(system) : this.getCloudConfig(system));
                       
            case 'balanced':
            default:
                // Balance based on current load
                const localLoad = this.loadBalancer.localConnections / this.loadBalancer.maxLocalConcurrent;
                const cloudLoad = this.loadBalancer.cloudConnections / this.loadBalancer.maxCloudConcurrent;
                
                if (hasCloudAccess && cloudLoad < localLoad) {
                    return this.getCloudConfig(system);
                }
                return this.getLocalConfig(system);
        }
    }

    /**
     * Get local Ollama configuration
     */
    getLocalConfig(system) {
        return {
            type: 'local',
            host: this.endpoints.local,
            headers: { 'Content-Type': 'application/json' },
            endpoint: `${this.endpoints.local}/api/generate`,
            tagsEndpoint: `${this.endpoints.local}/api/tags`,
            maxConcurrent: this.loadBalancer.maxLocalConcurrent
        };
    }

    /**
     * Get cloud/turbo configuration
     */
    getCloudConfig(system) {
        const config = this.configurations[system];
        
        if (system === 'canvas') {
            // Canvas uses proxy server for CORS
            return {
                type: 'turbo',
                host: this.endpoints.canvasProxy,
                headers: { 'Content-Type': 'application/json' },
                endpoint: `${this.endpoints.canvasProxy}/api/generate`,
                tagsEndpoint: `${this.endpoints.canvasProxy}/api/tags`,
                maxConcurrent: this.loadBalancer.maxCloudConcurrent
            };
        } else {
            // Jack uses direct cloud API
            return {
                type: 'cloud',
                host: this.endpoints.jackCloud,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                endpoint: `${this.endpoints.jackCloud}/api/generate`,
                tagsEndpoint: `${this.endpoints.jackCloud}/api/tags`,
                maxConcurrent: this.loadBalancer.maxCloudConcurrent
            };
        }
    }

    /**
     * Reserve a connection slot
     */
    reserveConnection(type, system) {
        if (type === 'local') {
            this.loadBalancer.localConnections++;
            logger.trace(`Reserved local connection for ${system} (${this.loadBalancer.localConnections}/${this.loadBalancer.maxLocalConcurrent})`);
        } else {
            this.loadBalancer.cloudConnections++;
            logger.trace(`Reserved cloud connection for ${system} (${this.loadBalancer.cloudConnections}/${this.loadBalancer.maxCloudConcurrent})`);
        }
    }

    /**
     * Release a connection slot
     */
    releaseConnection(type, system) {
        if (type === 'local') {
            this.loadBalancer.localConnections = Math.max(0, this.loadBalancer.localConnections - 1);
            logger.trace(`Released local connection for ${system} (${this.loadBalancer.localConnections}/${this.loadBalancer.maxLocalConcurrent})`);
        } else {
            this.loadBalancer.cloudConnections = Math.max(0, this.loadBalancer.cloudConnections - 1);
            logger.trace(`Released cloud connection for ${system} (${this.loadBalancer.cloudConnections}/${this.loadBalancer.maxCloudConcurrent})`);
        }
    }

    /**
     * Get current system load
     */
    getCurrentLoad() {
        return {
            local: {
                connections: this.loadBalancer.localConnections,
                capacity: this.loadBalancer.maxLocalConcurrent,
                utilization: this.loadBalancer.localConnections / this.loadBalancer.maxLocalConcurrent
            },
            cloud: {
                connections: this.loadBalancer.cloudConnections,
                capacity: this.loadBalancer.maxCloudConcurrent,
                utilization: this.loadBalancer.cloudConnections / this.loadBalancer.maxCloudConcurrent
            }
        };
    }

    /**
     * Update configuration for a system
     */
    updateConfiguration(system, newConfig) {
        this.configurations[system] = { ...this.configurations[system], ...newConfig };
        this.syncToStorage(system, newConfig);
        logger.info(`Updated ${system} configuration:`, newConfig);
    }

    /**
     * Setup cross-system storage synchronization
     */
    setupStorageSync() {
        // In real implementation, this would setup localStorage/sessionStorage watchers
        // and file system watchers for .env changes
        logger.debug('Storage synchronization setup complete');
    }

    /**
     * Sync configuration to appropriate storage
     */
    syncToStorage(system, config) {
        if (system === 'jack') {
            // Update environment variables (would need process restart for .env)
            this.sharedStorage.set('jack_config', config);
        } else if (system === 'canvas') {
            // Simulate localStorage update
            this.sharedStorage.set('canvas_config', config);
        }
    }

    /**
     * Get system status report
     */
    getStatusReport() {
        const load = this.getCurrentLoad();
        return {
            timestamp: new Date().toISOString(),
            configurations: this.configurations,
            currentLoad: load,
            recommendations: this.getRecommendations(load)
        };
    }

    /**
     * Get optimization recommendations
     */
    getRecommendations(load) {
        const recommendations = [];
        
        if (load.local.utilization > 0.8) {
            recommendations.push({
                type: 'warning',
                message: 'Local Ollama near capacity - consider enabling cloud mode',
                action: 'enable_cloud_fallback'
            });
        }
        
        if (load.cloud.utilization > 0.8) {
            recommendations.push({
                type: 'warning', 
                message: 'Cloud API near rate limit - consider load balancing',
                action: 'enable_load_balancing'
            });
        }
        
        if (load.local.utilization < 0.3 && load.cloud.utilization > 0.5) {
            recommendations.push({
                type: 'optimization',
                message: 'Local Ollama underutilized - consider local-prefer mode',
                action: 'prefer_local'
            });
        }

        return recommendations;
    }
}

// Export singleton instance
module.exports = new OllamaOrchestrator();