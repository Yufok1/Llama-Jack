/**
 * TokenManager - Accurate token counting and budget management
 * Uses tiktoken for precise token estimation instead of rough char/4 approximation
 */

const { get_encoding } = require('tiktoken');
const logger = require('./logger');

class TokenManager {
    constructor() {
        this.encoder = null;
        this.initEncoder();
    }

    /**
     * Initialize the tiktoken encoder (cached for performance)
     */
    initEncoder() {
        try {
            // Use cl100k_base encoding (GPT-3.5/GPT-4 compatible, works well for most models)
            this.encoder = get_encoding('cl100k_base');
            logger.debug('TokenManager: tiktoken encoder initialized');
        } catch (error) {
            logger.warn(`TokenManager: Failed to initialize tiktoken encoder: ${error.message}`);
            this.encoder = null;
        }
    }

    /**
     * Count tokens in text using tiktoken (accurate)
     * Falls back to char/4 approximation if tiktoken fails
     * @param {string} text - Text to count tokens for
     * @returns {number} - Accurate token count
     */
    countTokens(text) {
        if (!text || typeof text !== 'string') {
            return 0;
        }

        if (this.encoder) {
            try {
                const tokens = this.encoder.encode(text);
                return tokens.length;
            } catch (error) {
                logger.warn(`TokenManager: tiktoken encoding failed: ${error.message}, falling back to approximation`);
            }
        }

        // Fallback to rough approximation (old method)
        return Math.ceil(text.length / 4);
    }

    /**
     * Check if text is within token budget
     * @param {string} text - Text to check
     * @param {number} budget - Token budget limit
     * @param {number} threshold - Warning threshold (0.0-1.0, default 0.85)
     * @returns {Object} - Budget check result
     */
    checkBudget(text, budget, threshold = 0.85) {
        const tokenCount = this.countTokens(text);
        const warningLimit = Math.floor(budget * threshold);
        const usage = tokenCount / budget;
        
        return {
            estimatedTokens: tokenCount,
            threshold: budget,
            warningLimit,
            usage: Math.round(usage * 100), // Percentage
            withinBudget: tokenCount <= budget,
            nearLimit: tokenCount >= warningLimit,
            overage: Math.max(0, tokenCount - budget)
        };
    }

    /**
     * Get dynamic context limit for a model
     * Uses pattern matching and caching for known models
     * @param {string} model - Model name
     * @returns {number} - Context limit in tokens
     */
    getContextLimit(model) {
        if (!model) return 32000; // Safe default

        // Known model patterns with their actual context limits
        const modelLimits = {
            // Llama models
            'llama3.2:1b': 128000,
            'llama3.2:3b': 128000, 
            'llama3.1:8b': 128000,
            'llama3.1:70b': 128000,
            'llama2:7b': 4096,
            'llama2:13b': 4096,
            'llama2:70b': 4096,
            
            // Code models
            'codellama:7b': 16384,
            'codellama:13b': 16384,
            'codellama:34b': 16384,
            
            // Other popular models
            'mistral:7b': 32768,
            'mixtral:8x7b': 32768,
            'qwen2.5:7b': 32768,
            'qwen2.5:14b': 32768,
            'phi3:3.8b': 128000,
            'gemma2:9b': 8192,
            'gemma2:27b': 8192
        };

        // Exact match first
        if (modelLimits[model]) {
            logger.debug(`TokenManager: Found exact context limit for ${model}: ${modelLimits[model]} tokens`);
            return modelLimits[model];
        }

        // Pattern matching for model families
        const modelLower = model.toLowerCase();
        
        if (modelLower.includes('llama3.2') || modelLower.includes('llama3.1')) {
            return 128000; // Llama 3.1/3.2 have 128k context
        }
        
        if (modelLower.includes('llama3')) {
            return 8192; // Llama 3.0 base models
        }
        
        if (modelLower.includes('llama2')) {
            return 4096; // Llama 2 models
        }
        
        if (modelLower.includes('codellama')) {
            return 16384; // Code Llama models
        }
        
        if (modelLower.includes('mistral') || modelLower.includes('mixtral')) {
            return 32768; // Mistral family
        }
        
        if (modelLower.includes('qwen')) {
            return 32768; // Qwen models generally have 32k
        }
        
        if (modelLower.includes('phi3')) {
            return 128000; // Phi-3 has long context
        }
        
        if (modelLower.includes('gemma')) {
            return 8192; // Gemma models
        }

        // Size-based fallback
        if (modelLower.includes('70b') || modelLower.includes('72b')) {
            return 128000; // Large models often have extended context
        }
        
        if (modelLower.includes('13b') || modelLower.includes('14b') || modelLower.includes('8b') || modelLower.includes('7b')) {
            return 32000; // Medium models
        }
        
        if (modelLower.includes('3b') || modelLower.includes('1b')) {
            return 32000; // Small models can still have good context
        }

        logger.debug(`TokenManager: Using default context limit for unknown model ${model}: 32000 tokens`);
        return 32000; // Conservative default
    }

    /**
     * Get appropriate token budget based on model size and user settings
     * @param {string} model - Model name
     * @param {Object} env - Environment variables
     * @returns {number} - Token budget
     */
    getBudget(model, env = process.env) {
        const contextLimit = this.getContextLimit(model);
        
        // Use 85% of context limit as budget to leave room for response
        const calculatedBudget = Math.floor(contextLimit * 0.85);
        
        // Check user overrides
        const modelLower = model.toLowerCase();
        
        if (modelLower.includes('70b') || modelLower.includes('72b')) {
            return Math.min(calculatedBudget, parseInt(env.JACK_TOKEN_BUDGET_LARGE) || 128000);
        }
        
        if (modelLower.includes('7b') || modelLower.includes('8b') || modelLower.includes('13b') || modelLower.includes('14b')) {
            return Math.min(calculatedBudget, parseInt(env.JACK_TOKEN_BUDGET_SMALL) || 32000);
        }
        
        if (modelLower.includes('1b') || modelLower.includes('3b')) {
            return Math.min(calculatedBudget, parseInt(env.JACK_TOKEN_BUDGET_TINY) || 32000);
        }

        return Math.min(calculatedBudget, parseInt(env.JACK_TOKEN_BUDGET_DEFAULT) || 32000);
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.encoder) {
            try {
                this.encoder.free();
                this.encoder = null;
                logger.debug('TokenManager: tiktoken encoder cleaned up');
            } catch (error) {
                logger.warn(`TokenManager: Error cleaning up encoder: ${error.message}`);
            }
        }
    }
}

// Export singleton instance
module.exports = new TokenManager();