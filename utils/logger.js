/**
 * Centralized Logging System for Ollama Jack
 * Provides consistent logging with levels, timestamps, and environment-controlled verbosity
 */

class Logger {
    constructor() {
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3,
            TRACE: 4
        };
        
        // Set log level from environment or default to INFO
        const envLevel = process.env.JACK_LOG_LEVEL || 'INFO';
        this.currentLevel = this.levels[envLevel.toUpperCase()] ?? this.levels.INFO;
        
        // Color codes for different log levels
        this.colors = {
            ERROR: '\x1b[91m',    // Bright red
            WARN: '\x1b[93m',     // Bright yellow
            INFO: '\x1b[94m',     // Bright blue
            DEBUG: '\x1b[90m',    // Gray
            TRACE: '\x1b[37m',    // White
            RESET: '\x1b[0m'      // Reset
        };
        
        // Icons for different log levels
        this.icons = {
            ERROR: '❌',
            WARN: '⚠️',
            INFO: 'ℹ️',
            DEBUG: '🔍',
            TRACE: '📝'
        };
    }
    
    _log(level, message, ...args) {
        if (this.levels[level] > this.currentLevel) return;
        
        const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
        const color = this.colors[level];
        const icon = this.icons[level];
        const reset = this.colors.RESET;
        
        // Format the message
        const prefix = `${color}${icon} [${timestamp}] ${level}:${reset}`;
        
        if (args.length > 0) {
            console.log(prefix, message, ...args);
        } else {
            console.log(prefix, message);
        }
    }
    
    error(message, ...args) {
        this._log('ERROR', message, ...args);
    }
    
    warn(message, ...args) {
        this._log('WARN', message, ...args);
    }
    
    info(message, ...args) {
        this._log('INFO', message, ...args);
    }
    
    debug(message, ...args) {
        this._log('DEBUG', message, ...args);
    }
    
    trace(message, ...args) {
        this._log('TRACE', message, ...args);
    }
    
    // Convenience methods for common patterns
    success(message, ...args) {
        console.log(`✅ ${message}`, ...args);
    }
    
    failure(message, ...args) {
        console.log(`❌ ${message}`, ...args);
    }
    
    progress(message, ...args) {
        console.log(`🔄 ${message}`, ...args);
    }
    
    // Method to change log level at runtime
    setLevel(level) {
        const upperLevel = level.toUpperCase();
        if (this.levels[upperLevel] !== undefined) {
            this.currentLevel = this.levels[upperLevel];
            this.info(`Log level changed to ${upperLevel}`);
        } else {
            this.warn(`Invalid log level: ${level}. Valid levels:`, Object.keys(this.levels).join(', '));
        }
    }
    
    // Get current log level name
    getLevel() {
        return Object.keys(this.levels).find(key => this.levels[key] === this.currentLevel) || 'INFO';
    }
}

// Export singleton instance
const logger = new Logger();
module.exports = logger;