const express = require('express');
const { spawn, exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { Ollama } = require('ollama');
const axios = require('axios');
const clipboardy = require('clipboardy');
const { EditVersionController } = require('./edit-controller');
const SessionMemory = require('./session-memory');
const TelemetryManager = require('./telemetry-manager');
const logger = require('./utils/logger');
const tokenManager = require('./utils/token');
const { enhancedMetaConstrain } = require('./recursive-meta-constrain-enhancements');
const UniversalAlignmentEngine = require('./utils/alignment-engine');
const osAwareness = require('./utils/os-awareness');

// Load environment from the Ollama Jack project directory, not the target workspace
const jackProjectRoot = path.dirname(__filename);
require('dotenv').config({ path: path.join(jackProjectRoot, '.env'), override: true });

class OllamaJack {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 11435;
        
        // Terminal window visibility configuration - DEFAULT: ON
        this.showTerminalWindows = process.env.JACK_SHOW_TERMINALS !== 'false'; // Default: true (ON by default)
        this.terminalTimeout = parseInt(process.env.JACK_TERMINAL_TIMEOUT) || 3; // Seconds to show window after completion
        
        // TOKEN BUDGET MANAGEMENT - Dynamic Context Length Detection
        this.tokenBudgets = {
            'tiny': 4000,       // Small models like llama3.2:1b (4k context)
            'small': 32000,     // Medium models like llama3.1:8b (32k context) 
            'large': 128000,    // Large models like gpt-oss:120b (128k context)
            'default': 32000    // Safe fallback (32k context)
        };
        this.modelContextLimits = new Map(); // Cache actual model limits from Ollama
        this.currentTokenCount = 0;
        this.tokenSafetyThreshold = 0.85; // 85% threshold for monitoring warnings (no truncation)
        this.tokenCountingEnabled = true;
        
        // Enhanced logging method for comprehensive token traffic logs (disabled by default for cleaner chat)
        this.logTraffic = (data) => {
            // Traffic logging disabled to reduce chat spam - can be enabled via debug mode
            if (this.debugMode) {
                const timestamp = new Date().toISOString();
                const logEntry = {
                    timestamp,
                    type: data.type || 'unknown',
                    method: data.method || 'unknown',
                    endpoint: data.endpoint || 'unknown',
                    status: data.status || 'unknown',
                    source: data.source || 'unknown',
                    responseTime: data.responseTime || 0,
                    bytes: data.bytes || 0,
                    tokens: data.tokens || 0,
                    model: data.model || this.currentModel || 'unknown',
                    error: data.error || null,
                    ...data
                };
                logger.trace(`TRAFFIC: ${JSON.stringify(logEntry, null, 0)}`);
            }
        };
        
        // CLEAN FIX: Simple response formatter for proper line breaks
        this.formatResponse = (content) => {
            if (!content) return '';

            // Convert literal \n to actual newlines and clean up spacing
            return content
                .replace(/\\n/g, '\n')  // Convert literal \n to actual newlines
                .replace(/\n\n+/g, '\n\n')  // Normalize multiple breaks
                .trim();
        };

        // JACK PROCESSING SPINNER: Stationary contextual status display with ASCII art patterns
        this.spinner = {
            frames: ['⚡🦙', '⚯🦙', '⚮🦙', '⚰🦙'],  // Lightning effects with llama
            current: 0,
            interval: null,
            isSpinning: false,
            context: 'Processing...', // Current context message
            rl: null, // Store readline interface
            dotCounter: 0, // For dot sequence animation (., .., ...)
            patternType: 0, // Current pattern type
            patternCounter: 0 // Counter for pattern animations
        };

        // ASCII Art Loading Patterns Collection (pure ASCII only)
        this.loadingPatterns = {
            dots: ['.', '..', '...'],
            spinner: ['|', '/', '-', '\\'],
            bouncing: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
            arrows: ['<', '^', '>', 'v'],
            squares: ['▖', '▘', '▝', '▗'],
            bars: ['▁', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃'],
            wave: ['~', '~~', '~~~', '~~~~', '~~~~~', '~~~~', '~~~', '~~'],
            pulsing: ['●', '◐', '◑', '◒', '◓', '◔', '◕', '◖', '◗'],
            zigzag: ['/', '\\', '|', '-'],
            loading: ['L', 'Lo', 'Loa', 'Load', 'Loadi', 'Loadin', 'Loading', 'Loading.', 'Loading..', 'Loading...'],
            progress: ['[    ]', '[=   ]', '[==  ]', '[=== ]', '[====]', '[====]', '[=== ]', '[==  ]', '[=   ]'],
            binary: ['0', '1', '01', '10', '101', '010', '1010', '0101'],
            blocks: ['░', '▒', '▓', '█', '▓', '▒'],
            hearts: ['<3', '</3', '<3<3', '</3</3'],
            stars: ['*', '**', '***', '****', '***', '**'],
            circle: ['o', 'O', '0', 'O'],
            bounce: ['.   ', '..  ', '... ', '....', ' ...', '  ..', '   .'],
            matrix: ['0', '1', 'I', 'l', '|', '!'],
            gears: ['+', 'x', '*', 'X'],
            pulse: ['-', '=', '#', '='],
            spiral: ['/', '|', '\\', '-'],
            slide: ['[>   ]', '[ >  ]', '[  > ]', '[   >]', '[  < ]', '[ <  ]', '[<   ]']
        };

        // Color codes for variety
        this.spinnerColors = [
            '\x1b[31m', // Red
            '\x1b[32m', // Green
            '\x1b[33m', // Yellow
            '\x1b[34m', // Blue
            '\x1b[35m', // Magenta
            '\x1b[36m', // Cyan
            '\x1b[91m', // Bright Red
            '\x1b[92m', // Bright Green
            '\x1b[93m', // Bright Yellow
            '\x1b[94m', // Bright Blue
            '\x1b[95m', // Bright Magenta
            '\x1b[96m'  // Bright Cyan
        ];

        // Get current ASCII pattern animation
        this.getPatternAnimation = () => {
            const patternNames = Object.keys(this.loadingPatterns);
            const currentPatternName = patternNames[this.spinner.patternType % patternNames.length];
            const currentPattern = this.loadingPatterns[currentPatternName];
            const frame = currentPattern[this.spinner.patternCounter % currentPattern.length];
            const color = this.spinnerColors[this.spinner.patternType % this.spinnerColors.length];
            return `${color}${frame}\x1b[0m`;
        };

        // Randomly change pattern every 10 cycles for variety
        this.updatePattern = () => {
            if (this.spinner.patternCounter % 30 === 0) { // Change pattern every 30 frames (6 seconds at 200ms)
                this.spinner.patternType = Math.floor(Math.random() * Object.keys(this.loadingPatterns).length);
            }
        };

        // Update spinner context while it's running
        this.updateSpinnerContext = (newContext) => {
            if (this.spinner.isSpinning) {
                this.spinner.context = newContext;
                // Immediately update the prompt if using readline
                if (this.spinner.rl) {
                    const asciiPattern = this.getPatternAnimation();
                    const spinnerPrompt = `\x1b[36m${this.spinner.frames[this.spinner.current]}\x1b[0m ${this.spinner.context} ${asciiPattern} `;
                    this.spinner.rl.setPrompt(spinnerPrompt);
                    process.stdout.write('\r\x1b[K');
                    this.spinner.rl.prompt(false);
                }
            }
        };

        this.startSpinner = (context = 'Processing...', rl = null) => {
            if (this.spinner.isSpinning) return; // Already spinning

            this.spinner.isSpinning = true;
            this.spinner.current = 0;
            this.spinner.dotCounter = 0; // Reset dot counter
            this.spinner.patternCounter = 0; // Reset pattern counter
            this.spinner.patternType = Math.floor(Math.random() * Object.keys(this.loadingPatterns).length); // Random starting pattern
            this.spinner.context = context;
            this.spinner.rl = rl; // Store readline interface

            // If we have readline interface, update prompt instead of stdout
            if (rl) {
                this.spinner.interval = setInterval(() => {
                    this.updatePattern(); // Check if we should change pattern
                    const asciiPattern = this.getPatternAnimation();
                    const spinnerPrompt = `\x1b[36m${this.spinner.frames[this.spinner.current]}\x1b[0m ${this.spinner.context} ${asciiPattern} `;
                    rl.setPrompt(spinnerPrompt);
                    // Clear line and redraw prompt
                    process.stdout.write('\r\x1b[K');
                    rl.prompt(false); // Don't preserve current line
                    this.spinner.current = (this.spinner.current + 1) % this.spinner.frames.length;
                    this.spinner.patternCounter++; // Increment pattern counter
                }, 200);
            } else {
                // Fallback to stdout method for compatibility
                process.stdout.write('\x1b[?25l'); // Hide cursor
                this.spinner.interval = setInterval(() => {
                    this.updatePattern(); // Check if we should change pattern
                    const asciiPattern = this.getPatternAnimation();
                    process.stdout.write(`\r${this.spinner.frames[this.spinner.current]} ${this.spinner.context} ${asciiPattern}`);
                    this.spinner.current = (this.spinner.current + 1) % this.spinner.frames.length;
                    this.spinner.patternCounter++; // Increment pattern counter
                }, 200);
            }
        };

        this.stopSpinner = () => {
            if (!this.spinner.isSpinning) return;

            clearInterval(this.spinner.interval);
            this.spinner.isSpinning = false;

            // Restore normal prompt if we have readline interface
            if (this.spinner.rl) {
                this.spinner.rl.setPrompt('\x1b[92m👤 User >\x1b[0m ');
                process.stdout.write('\r\x1b[K'); // Clear current line
                this.spinner.rl.prompt(false);
                this.spinner.rl = null; // Clear reference
            } else {
                // Fallback cleanup for stdout method
                process.stdout.write('\r\x1b[K'); // Clear current line
                process.stdout.write('\x1b[?25h'); // Show cursor
            }
        };
        
        // TASK-TOOL CORRELATION: Link tool executions to active tasks
        this.linkToolToActiveTasks = (toolName, args, result) => {
            const activeTasks = this.sessionMemory.getCurrentTasks().filter(t => t.status === 'in_progress' || t.status === 'pending');

            // Link tools based on file operations
            if (args.filePath && activeTasks.length > 0) {
                activeTasks.forEach(task => {
                    this.sessionMemory.linkFileToTask(task.id, args.filePath);
                    this.sessionMemory.linkToolToTask(task.id, toolName, args);
                });
            }
            // Link tools based on task type correlation
            else if (activeTasks.length > 0) {
                const relevantTasks = activeTasks.filter(task => {
                    return this.isToolRelevantToTask(toolName, task.type);
                });

                relevantTasks.forEach(task => {
                    this.sessionMemory.linkToolToTask(task.id, toolName, args);
                });
            }
        };

        this.isToolRelevantToTask = (toolName, taskType) => {
            const correlations = {
                'coding': ['write_file', 'read_file', 'search_code', 'grep_search'],
                'debugging': ['execute_terminal_command', 'read_file', 'search_code', 'grep_search'],
                'testing': ['execute_terminal_command', 'read_file', 'grep_search'],
                'research': ['web_search', 'web_fetch', 'read_file', 'list_directory', 'grep_search'],
                'analysis': ['read_file', 'list_directory', 'search_code', 'grep_search'],
                'documentation': ['write_file', 'read_file', 'grep_search']
            };

            return correlations[taskType]?.includes(toolName) || false;
        };

        this.logDebug = (data) => {
            // Debug logging disabled by default for cleaner chat interface
            if (this.debugMode) {
                const timestamp = new Date().toISOString();
                const logEntry = {
                    timestamp,
                    type: data.type || 'unknown',
                    message: data.message || 'unknown',
                    tool: data.tool || null,
                    status: data.status || 'unknown',
                    data: data.data || null,
                    ...data
                };
                logger.debug(`DEBUG: ${JSON.stringify(logEntry, null, 0)}`);
            }
        };
        
        // Parse command line arguments for workspace override
        this.parseCommandLineArgs();
        
        this.workspaceRoot = this.targetWorkspace || process.env.HIJACK_TARGET_WORKSPACE || process.env.HIJACK_WORKSPACE || process.cwd();
        this.projectType = this.targetProjectType || process.env.HIJACK_PROJECT_TYPE || 'generic';
        
        // Configuration for data storage location
        this.noFootprintMode = process.env.JACK_NO_FOOTPRINT === 'true' || this.targetNoFootprint;
        this.dataDir = this.getDataDirectory();
        
        this.activeTerminals = new Map();
        this.editController = new EditVersionController(this.workspaceRoot, this.dataDir);

        // Universal Alignment Engine - Military-grade targeting for all operations
        this.alignmentEngine = new UniversalAlignmentEngine();
        logger.info('Universal Alignment Engine initialized - targeting system active');

        // Recent actions tracking for alignment prerequisite checks
        this.recentActions = [];
        this.maxRecentActions = 50;

        // Advanced Telemetry System with Predictive Analytics (optional)
        if (!this.noFootprintMode) {
            this.telemetryManager = new TelemetryManager(this.dataDir);
            this.webSearchFile = path.join(this.dataDir, '.telemetry', 'websearch.json');
        }

        this.sessionMemory = new SessionMemory(this.dataDir, this.workspaceRoot, this.telemetryManager); // Memory system with telemetry
        this.currentModel = null; // Track the currently active model
        
        // Auto-discover workspace structure for better AI understanding
        this.performInitialWorkspaceDiscovery();
        this.autoAcceptEdits = false; // DEFAULT: Manual mode - edits require Accept/Reject/Refactor approval
        this.pendingEdit = null; // Track the current pending edit for 1/2/3 system
        this.debugMode = this.isDebugEnabled(); // Control debug log verbosity
        
        // Web search usage tracking
        this.webSearchUsage = {
            searches: 0,
            fetches: 0,
            dailyLimit: 100, // Assumed daily limit - adjust based on actual Ollama limits
            resetDate: new Date().toDateString()
        };
        
        // Terminal output logging for Canvas mirror
        this.terminalLog = [];
        this.maxTerminalLogSize = 1000;
        
        // Optional Canvas integration data storage (does not affect core Jack operation)
        this.canvasData = null;
        this.pendingCanvasEdit = null;
        this.canvasIntegrationEnabled = false; // Optional feature flag
        this.canvasDataFreshFlag = false; // Event-driven freshness indicator // Keep last 1000 lines
        this.originalConsoleLog = console.log;
        this.originalConsoleError = console.error;
        this.originalConsoleWarn = console.warn;
        
        // Override console methods to capture ALL terminal output
        console.log = (...args) => {
            const message = args.join(' ');
            this.addToTerminalLog('log', message);
            this.originalConsoleLog(...args);
        };
        
        console.error = (...args) => {
            const message = args.join(' ');
            this.addToTerminalLog('error', message);
            this.originalConsoleError(...args);
        };
        
        console.warn = (...args) => {
            const message = args.join(' ');
            this.addToTerminalLog('warn', message);
            this.originalConsoleWarn(...args);
        };

        // Model usage tracking system (data collection to determine real limits)
        this.modelUsage = {
            resetDate: new Date().toDateString(),
            resetTime: new Date().getTime(),
            models: {
                // Dynamic tracking - models added as they're used
            },
            currentConversation: {
                model: null,
                consecutiveToolCalls: 0,
                startTime: null
            },
            dailyStats: {
                totalRequests: 0,
                totalTokens: 0,
                totalErrors: 0,
                rateLimitErrors: 0,
                toolCallErrors: 0,
                simpleChatRequests: 0,
                toolCallRequests: 0
            }
        };
        
        // Show workspace info if running globally
        if (this.targetWorkspace && this.targetWorkspace !== process.cwd()) {
            logger.info(`Target Workspace: ${this.workspaceRoot}`);
            logger.info(`Project Type: ${this.projectType}`);
            logger.info(`Jack Base: ${process.cwd()}`);
        }
        
        this.setupOllamaPromise = this.setupOllama();
        this.setupMiddleware();
        this.setupRoutes();
        this.loadWebSearchUsage();
        this.setupTools();
    }

    // TOKEN BUDGET MANAGEMENT METHODS - Enhanced with accurate tiktoken counting
    estimateTokenCount(text) {
        if (!text || !this.tokenCountingEnabled) return 0;
        // Use accurate tiktoken counting instead of rough approximation
        return tokenManager.countTokens(text);
    }

    async getModelBudget(modelName = null) {
        const model = modelName || this.currentModel;
        if (!model) return this.tokenBudgets.default;
        
        // Check if we have cached the actual context limit for this model
        if (this.modelContextLimits.has(model)) {
            return this.modelContextLimits.get(model);
        }
        
        // Try to get actual model info from Ollama first
        try {
            if (this.ollama) {
                const modelInfo = await this.ollama.show({ name: model.replace('-cloud', '') });
                if (modelInfo && modelInfo.details && modelInfo.details.context_length) {
                    const contextLimit = parseInt(modelInfo.details.context_length);
                    logger.debug(`Detected context limit for ${model}: ${contextLimit} tokens`);
                    this.modelContextLimits.set(model, contextLimit);
                    return contextLimit;
                }
            }
        } catch (error) {
            // Silently fall back to TokenManager pattern matching if API call fails
            logger.warn(`Could not detect context limit for ${model}, using TokenManager pattern matching`);
        }
        
        // Use TokenManager for accurate model classification and budgets
        const budget = tokenManager.getBudget(model, process.env);
        
        // Cache the result
        this.modelContextLimits.set(model, budget);
        logger.debug(`TokenManager context limit for ${model}: ${budget} tokens`);
        return budget;
    }

    async checkTokenBudget(messages, tools = [], modelName = null) {
        if (!this.tokenCountingEnabled) return { withinBudget: true, estimatedTokens: 0 };
        
        // Build full context text for accurate token counting
        let contextText = '';
        
        // Add messages content
        for (const message of messages) {
            if (message.content) {
                contextText += message.content + '\n';
            }
        }
        
        // Add tools (tool definitions can be large)
        if (tools && tools.length > 0) {
            contextText += JSON.stringify(tools) + '\n';
        }
        
        const budget = await this.getModelBudget(modelName);
        const budgetCheck = tokenManager.checkBudget(contextText, budget, this.tokenSafetyThreshold);
        
        this.currentTokenCount = budgetCheck.estimatedTokens;
        
        return {
            withinBudget: budgetCheck.withinBudget,
            estimatedTokens: budgetCheck.estimatedTokens,
            budget: budget,
            threshold: budgetCheck.warningLimit,
            usage: budgetCheck.usage
        };
    }

    // Terminal logging for Canvas mirror
    addToTerminalLog(type, message) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            type,
            message: message.toString()
        };
        
        this.terminalLog.push(logEntry);
        
        // Keep only the last N entries
        if (this.terminalLog.length > this.maxTerminalLogSize) {
            this.terminalLog = this.terminalLog.slice(-this.maxTerminalLogSize);
        }
    }

    // Convenience method for logging messages that appear in terminal
    logToTerminal(message) {
        console.log(message);
        this.addToTerminalLog('log', message);
    }

    // Build Canvas context by reading from localStorage/storage (event-driven, stateless)
    buildCanvasContext() {
        try {
            // Read Canvas data from storage systems
            const canvasData = this.readCanvasDataFromStorage();
            
            if (!canvasData.hasData) {
                return 'Canvas integration available but no analysis data found. Run Canvas analysis to populate context.';
            }

            let context = `You have access to Canvas document analysis data (last updated: ${canvasData.lastUpdate}):\n\n`;
            
            // Document summary
            if (canvasData.document) {
                const docLength = canvasData.document.length;
                const preview = canvasData.document.substring(0, 300) + (docLength > 300 ? '...' : '');
                context += `📄 DOCUMENT (${docLength} chars):\n${preview}\n\n`;
            }

            // AI Memory and Analysis
            if (canvasData.aiMemory) {
                context += `🧠 AI SYSTEM MEMORY:\n`;
                Object.entries(canvasData.aiMemory).forEach(([system, memory]) => {
                    if (memory.conversationHistory && memory.conversationHistory.length > 0) {
                        const recentResponse = memory.conversationHistory[memory.conversationHistory.length - 1];
                        const summary = recentResponse.substring(0, 150) + (recentResponse.length > 150 ? '...' : '');
                        context += `• ${system.toUpperCase()}: ${summary}\n`;
                    }
                });
                context += '\n';
            }

            // DJINN Council Analysis
            if (canvasData.djinnCouncil) {
                context += `⚖️ DJINN COUNCIL ANALYSIS:\n`;
                
                // Individual member analyses
                Object.entries(canvasData.djinnCouncil.members || {}).forEach(([member, data]) => {
                    if (data.reports && data.reports.length > 0) {
                        const latest = data.reports[data.reports.length - 1];
                        const summary = latest.analysis.substring(0, 120) + (latest.analysis.length > 120 ? '...' : '');
                        context += `• ${member.toUpperCase()}: ${summary}\n`;
                    }
                });

                // Consensus Report
                if (canvasData.djinnCouncil.consensusHistory && canvasData.djinnCouncil.consensusHistory.length > 0) {
                    const latestConsensus = canvasData.djinnCouncil.consensusHistory[canvasData.djinnCouncil.consensusHistory.length - 1];
                    const consensusSummary = latestConsensus.content.substring(0, 200) + (latestConsensus.content.length > 200 ? '...' : '');
                    context += `\n🤝 CONSENSUS REPORT:\n${consensusSummary}\n`;
                }

                // Intelligence Report
                if (canvasData.djinnCouncil.intelligenceReports && canvasData.djinnCouncil.intelligenceReports.length > 0) {
                    const latestIntel = canvasData.djinnCouncil.intelligenceReports[canvasData.djinnCouncil.intelligenceReports.length - 1];
                    const intelSummary = latestIntel.content.substring(0, 200) + (latestIntel.content.length > 200 ? '...' : '');
                    context += `\n� INTELLIGENCE REPORT:\n${intelSummary}\n`;
                }
                
                context += '\n';
            }

            // IndexedDB Analysis Data (big reports and history)
            if (this.canvasIndexedDB) {
                context += `📊 INDEXEDDB ANALYSIS DATA:\n`;
                
                // Canvas IndexedDB data
                if (this.canvasIndexedDB.synthesisReports && this.canvasIndexedDB.synthesisReports.length > 0) {
                    context += `• SYNTHESIS REPORTS: ${this.canvasIndexedDB.synthesisReports.length} reports available\n`;
                }
                
                if (this.canvasIndexedDB.analysisHistory && this.canvasIndexedDB.analysisHistory.length > 0) {
                    context += `• ANALYSIS HISTORY: ${this.canvasIndexedDB.analysisHistory.length} analysis cycles\n`;
                }
                
                if (this.canvasIndexedDB.aiFeeds && this.canvasIndexedDB.aiFeeds.length > 0) {
                    context += `• AI FEEDS: ${this.canvasIndexedDB.aiFeeds.length} feed entries\n`;
                }

                // DJINN Council IndexedDB data
                if (this.canvasIndexedDB.consensusReports && this.canvasIndexedDB.consensusReports.length > 0) {
                    context += `• CONSENSUS REPORTS: ${this.canvasIndexedDB.consensusReports.length} consensus reports\n`;
                }
                
                if (this.canvasIndexedDB.intelligenceReports && this.canvasIndexedDB.intelligenceReports.length > 0) {
                    context += `• INTELLIGENCE REPORTS: ${this.canvasIndexedDB.intelligenceReports.length} intelligence reports\n`;
                }
                
                if (this.canvasIndexedDB.memberReports && this.canvasIndexedDB.memberReports.length > 0) {
                    context += `• DJINN MEMBER REPORTS: ${this.canvasIndexedDB.memberReports.length} member reports\n`;
                }
                
                context += '\n';
            }

            context += `💡 You can reference this comprehensive Canvas and DJINN Council analysis in your responses. This includes both localStorage (current state) and IndexedDB (historical reports and big data). Suggest edits, builds, or improvements based on the document content, AI insights, council consensus, and strategic intelligence above. When making suggestions, reference specific insights from the analysis to justify your recommendations.`;

            // Keep fresh flag active for continued Canvas awareness in conversations
            // Flag only gets cleared when new Canvas data arrives

            return context;
        } catch (error) {
            console.error('Error building Canvas context:', error);
            return 'Canvas integration available but error reading analysis data.';
        }
    }

    // Read Canvas data from localStorage and memory systems (stateless access)
    readCanvasDataFromStorage() {
        const data = {
            hasData: false,
            document: null,
            aiMemory: null,
            djinnCouncil: null,
            lastUpdate: null
        };

        try {
            // Canvas document content
            const canvasContent = this.readFromBrowserStorage('sovereign_canvas_content');
            if (canvasContent) {
                data.document = canvasContent;
                data.hasData = true;
            }

            // AI Memory state
            const aiMemoryJson = this.readFromBrowserStorage('ai_memory_state');
            if (aiMemoryJson) {
                data.aiMemory = JSON.parse(aiMemoryJson);
                data.hasData = true;
            }

            // DJINN Council memory
            const djinnMemoryJson = this.readFromBrowserStorage('djinn_council_complete_memory');
            if (djinnMemoryJson) {
                data.djinnCouncil = JSON.parse(djinnMemoryJson);
                data.hasData = true;
            }

            // Get last update timestamp
            data.lastUpdate = this.readFromBrowserStorage('canvas_last_analysis') || 
                             this.readFromBrowserStorage('djinn_last_analysis') || 
                             'Unknown';

            return data;
        } catch (error) {
            console.error('Error reading Canvas storage:', error);
            return data;
        }
    }

    // Read from cached browser localStorage (stateless approach)
    readFromBrowserStorage(key) {
        // Check if we have fresh Canvas localStorage data
        if (!this.canvasDataFreshFlag || !this.canvasLocalStorage) {
            return null; // No fresh data available
        }
        
        // Return the requested localStorage key value
        return this.canvasLocalStorage[key] || null;
    }

    // TRUNCATION METHOD REMOVED - Use constrain system for information management instead
    // The sophisticated constrain system provides targeted information flow control
    // rather than crude message truncation that loses context and information
    
    parseCommandLineArgs() {
        const args = process.argv.slice(2);
        this.targetWorkspace = null;
        this.targetProjectType = null;
        this.targetNoFootprint = false;
        this.serverOnly = false; // New flag for server-only mode
        
        for (const arg of args) {
            if (arg.startsWith('--workspace=')) {
                this.targetWorkspace = arg.split('=')[1].replace(/"/g, '');
            } else if (arg.startsWith('--type=')) {
                this.targetProjectType = arg.split('=')[1];
            } else if (arg === '--no-footprint') {
                this.targetNoFootprint = true;
            } else if (arg === '--server-only') {
                this.serverOnly = true; // Enable server-only mode
            }
        }
    }

    getDataDirectory() {
        if (this.noFootprintMode) {
            // Use system temp directory for no-footprint mode
            const os = require('os');
            const path = require('path');
            const crypto = require('crypto');
            
            // Create a unique subdirectory based on workspace path hash
            const workspaceHash = crypto.createHash('md5').update(this.workspaceRoot).digest('hex').substring(0, 8);
            return path.join(os.tmpdir(), 'ollama-jack', workspaceHash);
        } else {
            // Use workspace directory (original behavior)
            return this.workspaceRoot;
        }
    }

    // Debug logging method with configurable levels
    debugLog(message, level = 'DEBUG') {
        if (this.debugMode) {
            const timestamp = new Date().toISOString().substring(11, 23);
            logger.debug(`[${level}] ${timestamp} ${message}`);
        }
    }

    /**
     * Track recent actions for alignment prerequisite checking
     */
    trackAction(toolName, params, result) {
        this.recentActions.push({
            tool: toolName,
            params: params,
            result: result,
            timestamp: Date.now()
        });

        // Keep only recent actions
        if (this.recentActions.length > this.maxRecentActions) {
            this.recentActions.shift(); // Remove oldest
        }
    }

    /**
     * Get recent actions for alignment validation
     */
    getRecentActions() {
        return this.recentActions;
    }

    /**
     * Get current context for alignment validation
     */
    getCurrentContext() {
        return {
            workspaceRoot: this.workspaceRoot,
            currentModel: this.currentModel,
            autoAcceptEdits: this.autoAcceptEdits,
            recentActions: this.recentActions.slice(-10) // Last 10 actions
        };
    }
    
    // SECURITY: Path traversal validation helper
    validateWorkspacePath(userPath) {
        // Reject obviously invalid paths immediately
        if (userPath.includes('/home/') || userPath.includes('/usr/') || userPath.includes('\\home\\')) {
            throw new Error(`Invalid path detected: '${userPath}' appears to be a Linux-style path. This is a Windows workspace. Use relative paths or Windows-style paths only.`);
        }
        
        const fullPath = path.resolve(this.workspaceRoot, userPath);
        const relativePath = path.relative(this.workspaceRoot, fullPath);
        const normalizedPath = path.normalize(relativePath);
        if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
            throw new Error(`Security violation: Path traversal detected. File path '${userPath}' resolves outside workspace: ${this.workspaceRoot}`);
        }
        return fullPath;
    }

    // Smart tool argument preprocessing to fix common AI mistakes
    preprocessToolArguments(toolName, args) {
        logger.trace(`Preprocessing tool: ${toolName}`, JSON.stringify(args, null, 2));
        
        // Fix tool parameter confusion - AI sometimes mixes tool parameters
        if (toolName === 'show_file_diff') {
            // If AI confused this with execute_terminal_command, fix it
            if (args.command && !args.filePath && !args.newContent) {
                logger.debug(`AI confused show_file_diff with execute_terminal_command, skipping malformed call`);
                throw new Error(`show_file_diff requires filePath and newContent parameters, not command parameters. Use execute_terminal_command for git diff.`);
            }
            
            // Ensure required parameters exist
            if (!args.filePath || !args.newContent) {
                throw new Error(`show_file_diff requires both filePath and newContent parameters`);
            }
        }
        
        // Fix common path issues for file operations
        const fileOps = ['read_file', 'write_file', 'show_file_diff', 'grep_search'];
        if (fileOps.includes(toolName) && args.filePath) {
            // Convert Linux-style paths to relative paths
            if (args.filePath.startsWith('/home/') || args.filePath.startsWith('/usr/')) {
                logger.debug(`Converting invalid Linux path: ${args.filePath}`);
                // Extract just the filename or make it relative
                const pathParts = args.filePath.split('/');
                args.filePath = pathParts[pathParts.length - 1]; // Just use filename
                logger.debug(`Converted to: ${args.filePath}`);
            }
        }

        // Clean args object - remove parameters that don't belong to this tool
        const toolParamMap = {
            'show_file_diff': ['filePath', 'newContent', 'contextLines', 'includeDev'],
            'execute_terminal_command': ['command', 'cwd'],
            'read_file': ['filePath'],
            'write_file': ['filePath', 'content'],
            'list_directory': ['path'],
            'grep_search': ['pattern', 'path', 'filePattern']
        };
        
        if (toolParamMap[toolName]) {
            const validParams = toolParamMap[toolName];
            const cleanedArgs = {};
            
            for (const param of validParams) {
                if (args.hasOwnProperty(param)) {
                    cleanedArgs[param] = args[param];
                }
            }
            
            // Log if we cleaned invalid parameters
            const removedParams = Object.keys(args).filter(key => !validParams.includes(key));
            if (removedParams.length > 0) {
                logger.debug(`Removed invalid parameters for ${toolName}: ${removedParams.join(', ')}`);
            }
            
            return cleanedArgs;
        }

        return args;
    }

    // Auto-discover workspace structure to help AI understand the project
    async performInitialWorkspaceDiscovery() {
        try {
            const fs = require('fs').promises;
            
            // Get top-level files and directories
            const entries = await fs.readdir(this.workspaceRoot, { withFileTypes: true });
            const files = entries.filter(e => e.isFile()).map(e => e.name).slice(0, 10); // Limit to 10 files
            const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).slice(0, 5); // Limit to 5 dirs
            
            // Look for key project files
            const keyFiles = ['package.json', 'README.md', 'requirements.txt', '.gitignore', 'Dockerfile'];
            const foundKeyFiles = files.filter(f => keyFiles.includes(f));
            
            // Store workspace structure in session memory
            const workspaceInfo = {
                files: files,
                directories: dirs,
                keyFiles: foundKeyFiles,
                discoveredAt: new Date().toISOString()
            };
            
            // Update the context workspace structure
            this.sessionMemory.context.workspace.structure = workspaceInfo;
            this.sessionMemory.saveSession();
            
            logger.debug(`Discovered ${files.length} files, ${dirs.length} directories`);
            if (foundKeyFiles.length > 0) {
                logger.info(`Key files found: ${foundKeyFiles.join(', ')}`);
            }
            
        } catch (error) {
            logger.error(`Discovery failed: ${error.message}`);
        }
    }
    
    // Robust debug mode detection
    isDebugEnabled() {
        const debugEnv = process.env.DEBUG_MODE;
        if (!debugEnv) return false;
        
        // Handle various truthy values
        const normalized = debugEnv.toLowerCase().trim();
        return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
    }

    // Load web search usage from persistent storage
    async loadWebSearchUsage() {
        if (this.noFootprintMode || !this.webSearchFile) return;
        
        try {
            if (await fs.pathExists(this.webSearchFile)) {
                const data = await fs.readJson(this.webSearchFile);
                this.webSearchUsage = { ...this.webSearchUsage, ...data };
            }
        } catch (error) {
            logger.warn(`Failed to load usage data: ${error.message}`);
        }
    }

    // Save web search usage to persistent storage
    async saveWebSearchUsage() {
        if (this.noFootprintMode || !this.webSearchFile) return;
        
        try {
            await fs.ensureDir(path.dirname(this.webSearchFile));
            await fs.writeJson(this.webSearchFile, this.webSearchUsage, { spaces: 2 });
        } catch (error) {
            logger.warn(`Failed to save usage data: ${error.message}`);
        }
    }

    // Unified cloud mode detection helper
    isCloudMode() {
        // STRICT MODE DETECTION: Explicit MODE setting takes absolute priority
        const mode = process.env.MODE?.toLowerCase()?.trim();
        const hasApiKey = !!process.env.OLLAMA_API_KEY;

        // Silent mode detection for cleaner chat interface
        if (this.debugMode) {
            logger.debug(`MODE='${mode}', hasApiKey=${hasApiKey}`);
        }

        // If MODE is explicitly set to 'local', ALWAYS use local mode
        if (mode === 'local') {
            if (this.debugMode) {
                logger.info(`FORCED LOCAL MODE: Ignoring API key`);
            }
            return false;
        }

        // If MODE is explicitly set to 'cloud', use cloud mode
        if (mode === 'cloud') {
            if (this.debugMode) {
                console.log(`[MODE DETECTION] FORCED CLOUD MODE`);
            }
            return true;
        }

        // Only fall back to API key detection if MODE is not set at all
        const result = hasApiKey;
        if (this.debugMode) {
            console.log(`[MODE DETECTION] FALLBACK: Using API key detection = ${result}`);
        }
        return result;
    }

    async setupOllama() {
        // Debug: Show what mode was detected (only in debug mode)
        if (this.debugMode) {
            this.debugLog(`Environment MODE: '${process.env.MODE}'`);
            this.debugLog(`Environment OLLAMA_API_KEY present: ${process.env.OLLAMA_API_KEY ? 'Yes' : 'No'}`);
            this.debugLog(`Environment OLLAMA_HOST: '${process.env.OLLAMA_HOST}'`);
        }
        
        // P1.2 FIX: Simplified cloud mode detection - if API key exists, use cloud (unless explicitly forced local)
        const isCloudMode = this.isCloudMode();
        
        if (!isCloudMode) {
            if (this.debugMode) {
                console.log('[HIJACKER] ⚙️ Local mode selected - Using local Ollama installation');
            }
            const localHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
            this.ollama = new Ollama({
                host: localHost
            });
            
            // Test local connection
            try {
                const models = await this.ollama.list();
                if (this.debugMode) {
                    this.debugLog(`Local list() call successful, got models: ${models.models?.map(m => m.name).join(', ')}`);
                }
                console.log(`[HIJACKER] ✅ Connected to local Ollama at ${localHost} - ${models.models?.length || 0} models available`);
                
                // Log local connection (only in debug mode)
                if (this.debugMode) {
                    this.logTraffic({
                        type: 'system_startup',
                        method: 'CONNECT',
                        endpoint: 'ollama_local',
                        status: 'success',
                        source: 'system',
                        modelCount: models.models?.length || 0,
                        host: localHost,
                        mode: 'local',
                        timestamp: new Date().toISOString()
                    });
                }
                
            } catch (error) {
                console.log(`[HIJACKER] ⚠️ Local Ollama connection test failed: ${error.message}`);
                if (this.debugMode) {
                    console.log(`[HIJACKER] ℹ️ Make sure 'ollama serve' is running`);
                }
                console.log(`[HIJACKER] ✅ Using local Ollama at ${localHost} (connection will be tested on first use)`);
            }
            return;
        }
        
        if (isCloudMode) {
            // Configure for Ollama Cloud - trying multiple auth formats
            if (this.debugMode) {
                console.log('[HIJACKER] Configuring Ollama Cloud connection...');
            }
            
            // First try with Bearer token format
            this.ollama = new Ollama({
                host: 'https://ollama.com',
                headers: { 
                    'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            // Test cloud connection with multiple auth methods
            let connected = false;
            const authMethods = [
                { name: 'Bearer Token', headers: { 'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}` } },
                { name: 'Direct Token', headers: { 'Authorization': process.env.OLLAMA_API_KEY } },
                { name: 'X-API-Key', headers: { 'X-API-Key': process.env.OLLAMA_API_KEY } }
            ];
            
            if (this.debugMode) {
                console.log('[HIJACKER] Testing Ollama Cloud connection...');
                this.debugLog(`Using host: https://ollama.com`);
            }
            
            for (const authMethod of authMethods) {
                try {
                    this.debugLog(`Trying ${authMethod.name} authentication...`);
                    
                    this.ollama = new Ollama({
                        host: 'https://ollama.com',
                        headers: authMethod.headers,
                        timeout: 300000 // 5 minutes for complex tool chains
                    });
                    
                    this.debugLog(`Ollama client created, testing with list() call...`);
                    const models = await this.ollama.list();
                    this.debugLog(`list() call successful, got models: ${models.models?.map(m => m.name).join(', ')}`);
                    console.log(`[HIJACKER] ✅ Connected to Ollama Cloud with ${authMethod.name} - ${models.models?.length || 0} models available`);
                    
                    // Log system startup
                    this.logTraffic({
                        type: 'system_startup',
                        method: 'CONNECT',
                        endpoint: 'ollama_cloud',
                        status: 'success',
                        source: 'system',
                        modelCount: models.models?.length || 0,
                        authMethod: authMethod.name,
                        mode: 'cloud',
                        timestamp: new Date().toISOString()
                    });
                    
                    connected = true;
                    break;
                } catch (error) {
                    this.debugLog(`${authMethod.name} failed with error: ${error.message} (status: ${error.status})`);
                }
            }
            
            if (!connected) {
                console.log('\x1b[91m[HIJACKER] ❌ CLOUD CONNECTION FAILED - All auth methods failed\x1b[0m');
                
                // Try a simple HTTP test
                this.debugLog('Testing basic HTTP connectivity to ollama.com...', 'NETWORK');
                try {
                    const axios = require('axios');
                    const testResponse = await axios.get('https://ollama.com', { timeout: 10000 });
                    this.debugLog('✅ Basic HTTP connectivity to ollama.com works', 'NETWORK');
                    console.log('\x1b[93m[HINT] Network is fine, likely an API key or endpoint issue\x1b[0m');
                } catch (httpError) {
                    this.debugLog('❌ Basic HTTP connectivity failed', 'NETWORK');
                    this.debugLog(`HTTP Error: ${httpError.message}`, 'NETWORK');
                    console.log('\x1b[93m[HINT] Check your internet connection\x1b[0m');
                }
                
                console.log('\x1b[91m[FATAL] Cannot connect to Ollama Cloud - terminating hijacker\x1b[0m');
                console.log('\x1b[93m[HINT] Try running in local mode by selecting local mode during setup\x1b[0m');
                process.exit(1);
            }
        } else {
            this.ollama = new Ollama({ 
                host: process.env.OLLAMA_HOST || 'http://localhost:11434',
                timeout: 300000 // 5 minutes for complex tool chains
            });
            console.log('[HIJACKER] Connected to Local Ollama');
        }
    }
    


    setupMiddleware() {
        // Increase body size limit for Canvas data (default is 100kb, increase to 50MB)
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ limit: '50mb', extended: true }));
        
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', '*');
            res.header('Access-Control-Allow-Methods', '*');
            next();
        });
    }

    setupTools() {
        this.tools = [
            {
                type: "function",
                function: {
                    name: "execute_terminal_command",
                    description: "Execute any terminal command in the workspace",
                    parameters: {
                        type: "object",
                        properties: {
                            command: { type: "string", description: "Command to execute" },
                            cwd: { type: "string", description: "Working directory (optional)" }
                        },
                        required: ["command"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "read_file",
                    description: "Read contents of any file in the workspace",
                    parameters: {
                        type: "object",
                        properties: {
                            filePath: { type: "string", description: "Path to file" }
                        },
                        required: ["filePath"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "read_file_chunk",
                    description: "Read specific chunk of a large file that was previously chunked",
                    parameters: {
                        type: "object",
                        properties: {
                            filePath: { type: "string", description: "Path to file" },
                            chunkIndex: { type: "number", description: "Chunk index to read (0-based)" },
                            commentary: { type: "string", description: "Optional mental commentary or inner thought to express while reading this chunk" }
                        },
                        required: ["filePath", "chunkIndex"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "write_file",
                    description: "Write or modify files in the workspace",
                    parameters: {
                        type: "object",
                        properties: {
                            filePath: { type: "string", description: "Path to file" },
                            content: { type: "string", description: "File content" },
                            mode: { type: "string", enum: ["write", "append"], description: "Write mode" },
                            commentary: { type: "string", description: "Optional mental commentary or inner thought to express while writing this file" }
                        },
                        required: ["filePath", "content"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "surgical_edit",
                    description: "Make precise, surgical edits by replacing exact strings in a file. REQUIRES recent read_file call (within 60 seconds). Use for small, targeted changes to avoid destroying entire files.",
                    parameters: {
                        type: "object",
                        properties: {
                            filePath: { type: "string", description: "Path to file to edit" },
                            oldString: { type: "string", description: "Exact string to find and replace (must exist exactly in file, including whitespace)" },
                            newString: { type: "string", description: "New string to replace with" },
                            replaceAll: { type: "boolean", description: "Replace all occurrences (default: false, requires unique match)", default: false }
                        },
                        required: ["filePath", "oldString", "newString"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "list_directory",
                    description: "List files and directories in the workspace",
                    parameters: {
                        type: "object",
                        properties: {
                            dirPath: { type: "string", description: "Directory path (optional)" }
                        },
                        required: [],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "search_code",
                    description: "Search for code patterns across the workspace",
                    parameters: {
                        type: "object",
                        properties: {
                            pattern: { type: "string", description: "Search pattern or regex" },
                            fileTypes: { type: "array", items: { type: "string" }, description: "File extensions to search" }
                        },
                        required: ["pattern"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "grep_search",
                    description: "Advanced grep-like search with regex support, line numbers, context lines, and precise pattern matching",
                    parameters: {
                        type: "object",
                        properties: {
                            pattern: { type: "string", description: "Search pattern (supports regex when isRegex=true)" },
                            filePath: { type: "string", description: "Specific file to search (optional, searches all files if not provided)" },
                            isRegex: { type: "boolean", description: "Whether pattern is a regular expression (default: false)" },
                            caseSensitive: { type: "boolean", description: "Case sensitive search (default: false)" },
                            wholeWord: { type: "boolean", description: "Match whole words only (default: false)" },
                            contextLines: { type: "integer", description: "Number of context lines before/after matches (default: 0)" },
                            maxResults: { type: "integer", description: "Maximum number of results to return (default: 100)" },
                            fileTypes: { type: "array", items: { type: "string" }, description: "File extensions to include (e.g., ['.js', '.html', '.css'])" },
                            excludePatterns: { type: "array", items: { type: "string" }, description: "File/directory patterns to exclude (e.g., ['node_modules', '.git'])" }
                        },
                        required: ["pattern"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "git_operations",
                    description: "Perform git operations in the workspace",
                    parameters: {
                        type: "object",
                        properties: {
                            operation: { type: "string", enum: ["status", "add", "commit", "push", "pull", "branch", "log"] },
                            args: { type: "array", items: { type: "string" }, description: "Additional arguments" }
                        },
                        required: ["operation"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "web_search",
                    description: "Search the web for information using Ollama Cloud's web search API",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Search query string" },
                            max_results: { type: "integer", description: "Maximum results to return (default 5, max 10)", minimum: 1, maximum: 10 }
                        },
                        required: ["query"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "web_fetch",
                    description: "Fetch content from a specific web page URL using Ollama Cloud's web fetch API",
                    parameters: {
                        type: "object",
                        properties: {
                            url: { type: "string", description: "URL to fetch content from" }
                        },
                        required: ["url"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "run_tests",
                    description: "Run test suites and return structured results with pass/fail counts and error details",
                    parameters: {
                        type: "object",
                        properties: {
                            testCommand: { type: "string", description: "Test command to run (e.g., 'npm test', 'pytest', 'jest')" },
                            cwd: { type: "string", description: "Working directory (optional)" },
                            timeout: { type: "integer", description: "Timeout in seconds (default 300)", minimum: 30, maximum: 1800 }
                        },
                        required: ["testCommand"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "run_linter",
                    description: "Run code linting/static analysis and return structured warnings and errors",
                    parameters: {
                        type: "object",
                        properties: {
                            linterCommand: { type: "string", description: "Linter command (e.g., 'eslint .', 'flake8', 'pylint')" },
                            cwd: { type: "string", description: "Working directory (optional)" },
                            filePath: { type: "string", description: "Specific file to lint (optional)" }
                        },
                        required: ["linterCommand"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "check_dependencies",
                    description: "Check installed packages and their versions for Node.js (npm/pnpm/yarn) or Python (pip)",
                    parameters: {
                        type: "object",
                        properties: {
                            packageManager: { type: "string", enum: ["npm", "yarn", "pnpm", "pip", "auto"], description: "Package manager to use (auto-detects if not specified)" },
                            cwd: { type: "string", description: "Working directory (optional)" },
                            includeDev: { type: "boolean", description: "Include dev dependencies (npm/yarn/pnpm only)", default: true }
                        },
                        required: [],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "show_file_diff",
                    description: "Show unified diff for file changes (git diff style) between current and proposed content",
                    parameters: {
                        type: "object",
                        properties: {
                            filePath: { type: "string", description: "Path to file to show diff for" },
                            newContent: { type: "string", description: "New content to compare against current file" },
                            contextLines: { type: "integer", description: "Number of context lines around changes (default 3)", minimum: 0, maximum: 10 }
                        },
                        required: ["filePath", "newContent"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "commentary",
                    description: "Express AI thoughts, reasoning, and planning in natural language. Use for transparency, learning documentation, risk assessment, and collaborative dialogue.",
                    parameters: {
                        type: "object",
                        properties: {
                            channel: { 
                                type: "string", 
                                enum: ["reasoning", "planning", "learning", "safety", "collaboration", "creativity", "meta"],
                                description: "Commentary channel for categorization"
                            },
                            content: { type: "string", description: "Natural language commentary content" },
                            priority: { 
                                type: "string", 
                                enum: ["low", "normal", "high", "urgent"],
                                description: "Priority level for display and attention"
                            },
                            requiresInput: { type: "boolean", description: "Whether this commentary requires human response", default: false },
                            workflowStep: { type: "string", description: "Current step in multi-step process (e.g., '2/5')" }
                        },
                        required: ["channel", "content"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "constrain",
                    description: "Set operational constraints, limits, and execution parameters for subsequent operations. Use to control scope, resource usage, safety boundaries, and workflow parameters.",
                    parameters: {
                        type: "object",
                        properties: {
                            operation: {
                                type: "string",
                                enum: ["search_code", "grep_search", "list_directory", "read_file", "write_file", "execute_terminal_command", "run_tests", "web_search", "git_operations", "workflow", "planning", "general"],
                                description: "The operation or workflow to constrain"
                            },
                            constraints: {
                                type: "object",
                                description: "Key-value pairs defining specific limits and boundaries",
                                properties: {
                                    maxResults: { type: "number", description: "Maximum number of results to return" },
                                    maxDepth: { type: "number", description: "Maximum directory depth to search" },
                                    maxSize: { type: "number", description: "Maximum file size in bytes" },
                                    timeout: { type: "number", description: "Maximum execution time in seconds" },
                                    fileTypes: { type: "array", items: { type: "string" }, description: "Allowed file extensions" },
                                    excludePatterns: { type: "array", items: { type: "string" }, description: "Patterns to exclude" },
                                    safetyLevel: { type: "string", enum: ["low", "medium", "high", "strict"], description: "Safety constraint level" },
                                    scopeLimit: { type: "string", description: "Limit operation scope (e.g., 'current-dir-only')" }
                                },
                                additionalProperties: true
                            },
                            reason: { type: "string", description: "Explanation of why these constraints are being applied" },
                            priority: {
                                type: "string",
                                enum: ["advisory", "recommended", "required", "critical"],
                                description: "Constraint enforcement priority"
                            },
                            duration: {
                                type: "string",
                                enum: ["single-use", "session", "persistent"],
                                description: "How long these constraints should remain active"
                            }
                        },
                        required: ["operation", "constraints"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "meta_constrain_enhance",
                    description: "Apply recursive optimization loops to constraints for self-improving operations. Creates feedback loops that automatically optimize constraints based on results.",
                    parameters: {
                        type: "object",
                        properties: {
                            operation: {
                                type: "string",
                                enum: ["search_code", "grep_search"],
                                description: "The operation to optimize through recursive constraint enhancement"
                            },
                            pattern: {
                                type: "string",
                                description: "Search pattern for the operation"
                            },
                            constraints: {
                                type: "object",
                                description: "Initial constraints to optimize",
                                properties: {
                                    maxResults: { type: "number", description: "Starting maximum number of results" },
                                    contextLines: { type: "number", description: "Lines of context around matches" },
                                    fileTypes: { type: "array", items: { type: "string" }, description: "File extensions to include" },
                                    excludePatterns: { type: "array", items: { type: "string" }, description: "Patterns to exclude" }
                                },
                                additionalProperties: true
                            },
                            commentary: {
                                type: "object",
                                description: "Commentary settings for optimization feedback",
                                properties: {
                                    channel: { 
                                        type: "string", 
                                        enum: ["reasoning", "planning", "learning", "meta"],
                                        description: "Channel for optimization commentary"
                                    },
                                    priority: { 
                                        type: "string", 
                                        enum: ["low", "normal", "high"],
                                        description: "Priority of optimization commentary"
                                    },
                                    workflowStep: { type: "string", description: "Workflow step identifier" }
                                },
                                required: ["channel"]
                            },
                            duration: {
                                type: "string",
                                enum: ["single-use", "session", "persistent"],
                                description: "How long optimized constraints should remain active",
                                default: "single-use"
                            },
                            priority: {
                                type: "string",
                                enum: ["advisory", "recommended", "required", "critical"],
                                description: "Constraint enforcement priority",
                                default: "recommended"
                            }
                        },
                        required: ["operation", "pattern", "constraints", "commentary"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "canvas_storage_list",
                    description: "List all Canvas localStorage keys by category. Use this to explore what Canvas data is available.",
                    parameters: {
                        type: "object",
                        properties: {
                            category: { 
                                type: "string", 
                                description: "Filter by category: 'content', 'ai_memory', 'synthesis', 'djinn', 'config', 'system', 'test', 'all'",
                                enum: ["content", "ai_memory", "synthesis", "djinn", "config", "system", "test", "all"]
                            }
                        },
                        required: [],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "canvas_storage_read",
                    description: "Read the full content of a specific Canvas localStorage key. Perfect for accessing Canvas documents, AI memory, synthesis reports, etc.",
                    parameters: {
                        type: "object",
                        properties: {
                            key: { 
                                type: "string", 
                                description: "The localStorage key to read (get keys from canvas_storage_list first)"
                            }
                        },
                        required: ["key"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "canvas_storage_search",
                    description: "Search Canvas localStorage keys and content for specific terms. Useful for finding relevant analysis data.",
                    parameters: {
                        type: "object",
                        properties: {
                            searchTerm: { 
                                type: "string", 
                                description: "Term to search for in keys and content"
                            },
                            searchContent: {
                                type: "boolean",
                                description: "Whether to search inside content (true) or just key names (false). Default: true"
                            }
                        },
                        required: ["searchTerm"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "canvas_storage_status",
                    description: "Get Canvas integration status including ping activity, storage summary, and last update times.",
                    parameters: {
                        type: "object",
                        properties: {},
                        additionalProperties: false
                    }
                }
            }
        ];
    }

    async executeTool(toolCall, useVersioning = true) {
        const startTime = Date.now();
        const { name, arguments: args } = toolCall.function;

        // Debug logging to understand what's being passed
        if (this.debugMode || name.includes('constrain')) {
            console.log('[DEBUG] Tool call received:');
            console.log('  Name:', name);
            console.log('  Arguments:', JSON.stringify(args, null, 2));
            console.log('  Full toolCall:', JSON.stringify(toolCall, null, 2));
        }

        // Parse tool name for commentary channel and normalize format
        let toolName = name;
        let commentaryChannel = null;
        let formatSpecifier = null;

        // 🎯 UNIVERSAL TOOL CALL VALIDATION (applies to ALL tools except commentary)
        // This is the FIRST line of defense before any tool executes
        if (toolName !== 'commentary' && toolName !== 'constrain' && !toolName.includes('canvas')) {
            try {
                const toolAlignment = await this.alignmentEngine.validate('tool_call', {
                    toolName: toolName,
                    toolParams: args,
                    availableTools: this.tools.map(t => t.function.name),
                    recentActions: this.getRecentActions(),
                    context: this.getCurrentContext()
                });

                if (!toolAlignment.allSystemsGo) {
                    logger.warn(`Tool call blocked by alignment engine: ${toolName}`);
                    this.trackAction(toolName, args, { error: 'Blocked by alignment', alignment: toolAlignment });
                    return {
                        error: `Tool execution blocked by alignment system:\n${toolAlignment.failureReport}`,
                        blocked: true,
                        alignment: {
                            confidence: toolAlignment.overallConfidence,
                            riskLevel: toolAlignment.riskLevel,
                            failedChecks: toolAlignment.failed
                        }
                    };
                }

                logger.debug(`Tool alignment passed: ${toolName} (${toolAlignment.overallConfidence}% confidence)`);
            } catch (alignmentError) {
                logger.error('Tool alignment validation error:', alignmentError);
                // Continue execution on alignment engine failure (fail-open for safety)
            }
        }
        
        // Handle commentary channel format
        if (name.includes('<|channel|>')) {
            const match = name.match(/^(.+)<\|channel\|>(.+)$/);
            if (match) {
                toolName = match[1];
                commentaryChannel = match[2];
            }
        }
        
        // Normalize tool name format - handle <|toolname|>format patterns
        if (toolName.includes('<|') && toolName.includes('|>')) {
            const formatMatch = toolName.match(/^<\|([^|]+)\|>(.*)$/);
            if (formatMatch) {
                toolName = formatMatch[1]; // Extract the actual tool name
                formatSpecifier = formatMatch[2] || null; // Extract format (json, yaml, text, etc.)
            }
        }
        
        // Operations that modify state should use versioning
        const modifyingOps = ['execute_terminal_command', 'write_file', 'git_operations', 'start_repl'];
        
        if (useVersioning && modifyingOps.includes(toolName)) {
            return await this.executeVersionedTool(toolCall);
        }
        
        // Smart tool argument preprocessing and validation
        this.preprocessToolArguments(toolName, args);

        // Don't start spinner here - it should be managed at the chat level

        try {
            let result;
            switch (toolName) {
                case 'execute_terminal_command':
                    result = await this.executeCommand(args.command, args.cwd, this.showTerminalWindows);
                    break;
                    
                case 'read_file':
                    result = await this.readFile(args.filePath);
                    // Track file read for surgical edit pre-read enforcement
                    if (result && result.content) {
                        this.editController.trackFileRead(args.filePath, result.content);
                    }
                    break;

                case 'read_file_chunk':
                    result = await this.readFileChunk(args.filePath, args.chunkIndex);
                    break;

                case 'surgical_edit':
                    // Surgical edit with exact string matching
                    result = await this.proposeEditSurgical(args.filePath, args.oldString, args.newString, {
                        replace_all: args.replaceAll || false
                    });
                    break;

                case 'write_file':
                    // 🎯 FILE OPERATION ALIGNMENT - Validate write operations
                    try {
                        const fileAlignment = await this.alignmentEngine.validate('file_operation', {
                            filePath: args.filePath,
                            content: args.content,
                            mode: args.mode || 'write',
                            workspaceRoot: this.workspaceRoot
                        });

                        if (!fileAlignment.allSystemsGo) {
                            logger.warn(`File write blocked by alignment engine: ${args.filePath}`);
                            result = {
                                success: false,
                                error: `File operation blocked for safety:\n${fileAlignment.failureReport}`,
                                alignment: {
                                    confidence: fileAlignment.overallConfidence,
                                    riskLevel: fileAlignment.riskLevel
                                }
                            };
                            break;
                        }

                        logger.debug(`File write alignment passed: ${args.filePath} (${fileAlignment.overallConfidence}% confidence)`);
                    } catch (alignmentError) {
                        logger.error('File alignment validation error:', alignmentError);
                        // Continue on alignment error (fail-open)
                    }

                    result = await this.writeFile(args.filePath, args.content, args.mode);
                    break;
                    
                case 'list_directory':
                    result = await this.listDirectory(args.dirPath);
                    break;
                    
                case 'search_code':
                    result = await this.searchCode(args.pattern, args.fileTypes);
                    break;
                    
                case 'grep_search':
                    result = await this.grepSearch(args);
                    break;
                    
                case 'git_operations':
                    result = await this.gitOperation(args.operation, args.args);
                    break;
                    
                case 'web_search':
                    result = await this.webSearch(args.query, args.max_results);
                    break;
                    
                case 'web_fetch':
                    result = await this.webFetch(args.url);
                    break;
                    
                case 'run_tests':
                    result = await this.runTests(args.testCommand, args.cwd, args.timeout);
                    break;
                    
                case 'run_linter':
                    result = await this.runLinter(args.linterCommand, args.cwd, args.filePath);
                    break;
                    
                case 'check_dependencies':
                    result = await this.checkDependencies(args.packageManager, args.cwd, args.includeDev);
                    break;
                    
                case 'show_file_diff':
                    result = await this.showFileDiff(args.filePath, args.newContent, args.contextLines);
                    break;
                    
                case 'start_repl':
                    result = await this.startRepl(args.language, args.cwd, args.imports);
                    break;
                    
                case 'commentary':
                    result = await this.handleCommentary(args.channel, args.content, args.priority, args.requiresInput, args.workflowStep);
                    break;
                    
                case 'constrain':
                    // Debug logging for constrain tool
                    if (this.debugMode) {
                        console.log('[DEBUG] Constrain tool called with args:', JSON.stringify(args, null, 2));
                        console.log('[DEBUG] Format specifier:', formatSpecifier);
                    }
                    
                    // Handle the case where AI is trying to use constrain for commentary-like operations
                    if (!args || Object.keys(args).length === 0) {
                        // If no arguments provided but we have format specifier with JSON
                        if (formatSpecifier && (formatSpecifier.startsWith('json:') || formatSpecifier.startsWith('{'))) {
                            try {
                                const jsonData = formatSpecifier.startsWith('json:') ? 
                                    formatSpecifier.substring(5).trim() : formatSpecifier;
                                
                                // Try to parse the JSON data
                                const parsedData = JSON.parse(jsonData);
                                
                                if (this.debugMode) {
                                    console.log('[DEBUG] Parsed data from format specifier:', parsedData);
                                }
                                
                                // Check if this looks like commentary data (has channel and content)
                                if (parsedData.channel && parsedData.content) {
                                    if (this.debugMode) {
                                        console.log('[DEBUG] Detected commentary data, redirecting to commentary tool');
                                    }
                                    // Redirect to commentary tool instead
                                    result = await this.handleCommentary(
                                        parsedData.channel, 
                                        parsedData.content, 
                                        parsedData.priority || 'normal',
                                        parsedData.requiresInput || false,
                                        parsedData.workflowStep || null
                                    );
                                    break;
                                } else {
                                    // Use as constraints for a general operation
                                    if (this.debugMode) {
                                        console.log('[DEBUG] Using parsed data as constraints for general operation');
                                    }
                                    args = {
                                        operation: 'general',
                                        constraints: parsedData,
                                        reason: 'Parsed from format specifier',
                                        priority: parsedData.priority || 'recommended'
                                    };
                                }
                            } catch (e) {
                                console.log('[DEBUG] Failed to parse JSON in format specifier:', e.message);
                                result = { error: `Invalid JSON in format specifier: ${e.message}` };
                                break;
                            }
                        } else {
                            result = { error: 'No arguments provided and no valid format specifier' };
                            break;
                        }
                    }
                    
                    // Also handle the case where args exist but contain commentary-style data
                    if (args && args.channel && args.content && !args.operation && !args.constraints) {
                        if (this.debugMode) {
                            console.log('[DEBUG] Args contain commentary data, redirecting to commentary tool');
                        }
                        result = await this.handleCommentary(
                            args.channel,
                            args.content,
                            args.priority || 'normal',
                            args.requiresInput || false,
                            args.workflowStep || null
                        );
                        break;
                    }
                    
                    // Handle missing constraints in provided args
                    if (args && !args.constraints && formatSpecifier) {
                        if (formatSpecifier.startsWith('json:') || formatSpecifier.startsWith('{')) {
                            try {
                                const jsonData = formatSpecifier.startsWith('json:') ? 
                                    formatSpecifier.substring(5).trim() : formatSpecifier;
                                args.constraints = JSON.parse(jsonData);
                                args.operation = args.operation || 'general';
                            } catch (e) {
                                result = { error: `Invalid JSON in format specifier: ${e.message}` };
                                break;
                            }
                        }
                    }
                    
                    // Ensure we have required parameters
                    if (!args.operation || !args.constraints) {
                        const debugInfo = this.debugMode ? {
                            argsReceived: args,
                            formatSpecifier: formatSpecifier,
                            suggestion: args.channel ? 'This looks like commentary data - use the commentary tool instead' : 'Provide operation and constraints parameters'
                        } : {};
                        
                        result = { 
                            error: `Missing required parameters. operation: ${args.operation || 'missing'}, constraints: ${args.constraints ? 'present' : 'missing'}`,
                            debug: debugInfo
                        };
                        break;
                    }
                    
                    result = await this.handleConstrain(args.operation, args.constraints, args.reason, args.priority, args.duration, formatSpecifier);
                    break;

                case 'meta_constrain_enhance':
                    if (this.debugMode) {
                        console.log('[DEBUG] Enhanced meta constrain called with args:', JSON.stringify(args, null, 2));
                        console.log('[DEBUG] Available engine methods:', Object.getOwnPropertyNames(this).filter(name => name.startsWith('handle') || name.includes('search') || name.includes('grep')));
                    }
                    
                    try {
                        // Call the enhanced meta constrain function with bound context
                        result = await enhancedMetaConstrain.call(this, {
                            constraints: args.constraints,
                            operation: args.operation,
                            pattern: args.pattern,
                            commentary: args.commentary,
                            duration: args.duration || 'single-use',
                            priority: args.priority || 'recommended'
                        });
                    } catch (error) {
                        console.log('[DEBUG] Enhanced meta constrain error details:', error);
                        result = { 
                            error: `Enhanced meta constrain failed: ${error.message}`,
                            details: this.debugMode ? error.stack : undefined
                        };
                    }
                    break;

                case 'canvas_storage_list':
                    result = await this.handleCanvasStorageList(args.category);
                    break;

                case 'canvas_storage_read':
                    result = await this.handleCanvasStorageRead(args.key);
                    break;

                case 'canvas_storage_search':
                    result = await this.handleCanvasStorageSearch(args.searchTerm, args.searchContent);
                    break;

                case 'canvas_storage_status':
                    result = await this.handleCanvasStorageStatus();
                    break;
                    
                default:
                    result = { error: `Unknown tool: ${toolName}` };
            }
            
            if (commentaryChannel) {
                let content = args.commentary || `Mental commentary during ${toolName}`;
                let channel = commentaryChannel === 'commentary' ? 'meta' : commentaryChannel;
                await this.handleCommentary(channel, content, 'normal');
            }
            
            // Record telemetry
            const executionTime = Date.now() - startTime;
            if (this.telemetryManager) {
                this.telemetryManager.recordToolUsage(toolName, executionTime, !result.error, args);
            }
            
            // CRITICAL FIX: Track tool execution in session memory so Jack remembers what he did
            this.sessionMemory.addToolCall(toolName, args, result);

            // TASK LINKING: Automatically link tools to active tasks
            this.linkToolToActiveTasks(toolName, args, result);

            // 🎯 TRACK ACTION: Add to recent actions for alignment prerequisite checks
            this.trackAction(toolName, args, result);

            // Don't stop spinner here - let the chat level manage it

            return result;
        } catch (error) {
            // Record failed telemetry
            const executionTime = Date.now() - startTime;
            if (this.telemetryManager) {
                this.telemetryManager.recordToolUsage(toolName, executionTime, false, args);
            }

            const errorResult = { error: error.message };

            // CRITICAL FIX: Track failed tool execution in session memory
            this.sessionMemory.addToolCall(toolName, args, errorResult);

            // 🎯 TRACK ACTION: Add failed action to recent actions
            this.trackAction(toolName, args, errorResult);

            // Don't stop spinner here - let the chat level manage it

            return errorResult;
        }
    }

    async executeVersionedTool(toolCall) {
        const { name, arguments: rawArgs } = toolCall.function;
        
        // Parse arguments if they come as a string
        let args;
        try {
            args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
        } catch (error) {
            console.log(`\x1b[91m❌ Failed to parse tool arguments: ${error.message}\x1b[0m`);
            this.debugLog(`Raw args: ${JSON.stringify(rawArgs)}`, 'TOOL');
            return { error: `Invalid tool arguments: ${error.message}` };
        }
        
        // Debug logging
        this.debugLog(`Tool: ${name}, Args: ${JSON.stringify(args)}`, 'TOOL');
        
        // Convert tool call to edit operation with verbose context
        let operation;
        let verboseContext;
        
        switch (name) {
            case 'write_file':
                operation = {
                    type: 'write_file',
                    filePath: args.filePath,
                    content: args.content,
                    mode: args.mode || 'write'
                };
                // Get comprehensive edit context from session memory
                verboseContext = this.sessionMemory.getVerboseEditContext(
                    'write_file', 
                    args.filePath, 
                    args.content
                );
                break;
            case 'execute_terminal_command':
                operation = {
                    type: 'execute_command',
                    command: args.command,
                    cwd: args.cwd || this.workspaceRoot
                };
                verboseContext = this.sessionMemory.getVerboseEditContext(
                    'execute_command',
                    `terminal: ${args.command}`,
                    `Working directory: ${args.cwd || this.workspaceRoot}`
                );
                break;
            case 'git_operations':
                operation = {
                    type: 'git_operation',
                    operation: args.operation,
                    args: args.args
                };
                verboseContext = this.sessionMemory.getVerboseEditContext(
                    'git_operation',
                    `git ${args.operation}`,
                    JSON.stringify(args.args)
                );
                break;
        }
        
        // Add verbose context to operation
        operation.verboseContext = verboseContext;
        operation.sessionContext = this.sessionMemory.getContextForAI();
        
        // Propose the edit instead of executing immediately
        const editId = await this.editController.proposeEdit(operation);

        // FEEDBACK LOOP: Check if there's a pending decision about this or previous edit
        const decision = this.lastEditDecision;
        const decisionInfo = decision ? {
            lastEditDecision: {
                decision: decision.decision, // accepted/rejected/refactored
                success: decision.success,
                reason: decision.reason || null,
                userFeedback: decision.userFeedback || null,
                editId: decision.editId
            }
        } : {};

        return {
            editProposed: true,
            editId,
            message: `Edit ${editId} proposed and queued for review`,
            operation: operation.type,
            description: operation,
            ...decisionInfo  // Include decision info if available
        };
    }

    async executeCommand(command, cwd = this.workspaceRoot, showWindow = true) {
        const startTime = Date.now();
        const timeout = 30000; // 30 second timeout for commands

        // 🖥️ OS-AWARENESS: Adapt command for current operating system
        logger.debug(`Original command: ${command}`);

        // Validate command for current OS
        const validation = osAwareness.validateCommand(command);
        if (!validation.valid) {
            const duration = Date.now() - startTime;
            logger.error(`Command validation failed: ${command}`);
            return {
                success: false,
                error: `Command not compatible with ${osAwareness.osInfo.name}:\n${validation.errors.join('\n')}`,
                stdout: '',
                stderr: `OS validation failed`,
                duration: duration,
                originalCommand: command,
                osContext: osAwareness.getOSContext()
            };
        }

        // Show warnings if any
        if (validation.warnings.length > 0) {
            logger.warn(`Command warnings for ${osAwareness.osInfo.name}: ${validation.warnings.join(', ')}`);
        }

        // Adapt command for current OS
        const adaptedCommand = osAwareness.adaptCommand(command);
        logger.debug(`Adapted command for ${osAwareness.osInfo.name}: ${adaptedCommand}`);

        // Store original command for reference
        const originalCommand = command;
        command = adaptedCommand;

        // 🎯 UNIVERSAL ALIGNMENT ENGINE - Validate command execution
        try {
            const alignment = await this.alignmentEngine.validate('command_execution', {
                command,
                originalCommand,
                cwd,
                workspaceRoot: this.workspaceRoot,
                osContext: osAwareness.getOSContext()
            });

            if (!alignment.allSystemsGo) {
                const duration = Date.now() - startTime;
                logger.error(`Command execution aborted by alignment engine: ${command}`);
                return {
                    success: false,
                    error: `Command execution blocked for safety:\n${alignment.failureReport}`,
                    stdout: '',
                    stderr: `Alignment check failed (${alignment.failed}/${alignment.totalParameters} parameters)`,
                    duration: duration,
                    command: command,
                    originalCommand: originalCommand,
                    osContext: osAwareness.getOSContext(),
                    wasAdapted: originalCommand !== command
                };
            }

            logger.info(`Command alignment passed (${alignment.overallConfidence}% confidence)`, {
                command: command.substring(0, 50),
                risk: alignment.riskLevel
            });
        } catch (alignmentError) {
            logger.error('Alignment engine error:', alignmentError);
            // Continue execution if alignment engine fails (fail-open for now)
        }
        
        return new Promise((resolve) => {
            // Enhanced execution with timeout and better error handling
            const executeWithTimeout = (cmd, options, callback) => {
                const child = exec(cmd, { 
                    ...options, 
                    timeout: timeout,
                    killSignal: 'SIGTERM'
                }, callback);
                
                // Add timeout handling
                const timeoutId = setTimeout(() => {
                    child.kill('SIGTERM');
                    callback(new Error(`Command timed out after ${timeout/1000}s: ${cmd}`), '', '');
                }, timeout);
                
                child.on('exit', () => clearTimeout(timeoutId));
                child.on('error', () => clearTimeout(timeoutId));
                
                return child;
            };

            if (showWindow && process.platform === 'win32') {
                // Windows: Show command in popup window
                const windowCommand = `start "Jack Terminal - ${command.substring(0, 30)}..." cmd /c "` +
                    `cd /d "${cwd}" && ` +
                    `echo [JACK AI TERMINAL SESSION] && ` +
                    `echo Command: ${command} && ` +
                    `echo Directory: ${cwd} && ` +
                    `echo. && ` +
                    `${command} && ` +
                    `echo. && ` +
                    `echo [JACK TERMINAL SESSION COMPLETE] && ` +
                    `timeout /t 3 /nobreak >nul && ` +
                    `echo Closing in 3 seconds... && ` +
                    `timeout /t 3 /nobreak >nul"`;
                
                let windowError = null;
                exec(windowCommand, (wError) => {
                    if (wError) {
                        windowError = wError;
                        logger.warn(`Window spawn failed: ${wError.message}`);
                    }
                });
                
                // Also run the command normally to capture output
                executeWithTimeout(command, { cwd }, (error, stdout, stderr) => {
                    const duration = Date.now() - startTime;
                    
                    // Enhanced error reporting with logger
                    if (error) {
                        logger.error(`Command failed (${duration}ms): ${command}`);
                        logger.error(`Error: ${error.message}`);
                        if (stderr) logger.warn(`Stderr: ${stderr.trim()}`);
                    } else {
                        logger.success(`Command succeeded (${duration}ms): ${command}`);
                        if (stderr) logger.warn(`Command warnings: ${stderr.trim()}`);
                    }
                    
                    resolve({
                        success: !error,
                        stdout: stdout || '',
                        stderr: stderr || '',
                        error: error?.message || null,
                        windowShown: !windowError,
                        duration: duration,
                        command: command,
                        originalCommand: originalCommand,
                        cwd: cwd,
                        osContext: osAwareness.getOSContext(),
                        wasAdapted: originalCommand !== command
                    });
                });
            } else if (showWindow && (process.platform === 'linux' || process.platform === 'darwin')) {
                // Linux/Mac: Show command in popup terminal
                const terminalCmd = process.platform === 'linux' 
                    ? `gnome-terminal --title="Jack Terminal - ${command.substring(0, 30)}..." -- bash -c "cd '${cwd}' && echo '[JACK AI TERMINAL SESSION]' && echo 'Command: ${command}' && echo 'Directory: ${cwd}' && echo '' && ${command} && echo '' && echo '[JACK TERMINAL SESSION COMPLETE]' && echo 'Press any key to close...' && read -n 1"`
                    : `osascript -e 'tell app "Terminal" to do script "cd '${cwd}' && echo '[JACK AI TERMINAL SESSION]' && echo 'Command: ${command}' && echo 'Directory: ${cwd}' && echo '' && ${command} && echo '' && echo '[JACK TERMINAL SESSION COMPLETE]' && sleep 5 && exit"'`;
                
                let windowError = null;
                exec(terminalCmd, (wError) => {
                    if (wError) {
                        windowError = wError;
                        logger.warn(`Terminal spawn failed: ${wError.message}`);
                    }
                });
                
                // Also run the command normally to capture output
                executeWithTimeout(command, { cwd }, (error, stdout, stderr) => {
                    const duration = Date.now() - startTime;
                    
                    // Enhanced error reporting with logger
                    if (error) {
                        logger.error(`Command failed (${duration}ms): ${command}`);
                        logger.error(`Error: ${error.message}`);
                        if (stderr) logger.warn(`Stderr: ${stderr.trim()}`);
                    } else {
                        logger.success(`Command succeeded (${duration}ms): ${command}`);
                        if (stderr) logger.warn(`Command warnings: ${stderr.trim()}`);
                    }
                    
                    resolve({
                        success: !error,
                        stdout: stdout || '',
                        stderr: stderr || '',
                        error: error?.message || null,
                        windowShown: !windowError,
                        duration: duration,
                        command: command,
                        originalCommand: originalCommand,
                        cwd: cwd,
                        osContext: osAwareness.getOSContext(),
                        wasAdapted: originalCommand !== command
                    });
                });
            } else {
                // Fallback: Silent execution with enhanced error handling
                executeWithTimeout(command, { cwd }, (error, stdout, stderr) => {
                    const duration = Date.now() - startTime;
                    
                    // Enhanced error reporting with logger
                    if (error) {
                        logger.error(`Command failed (${duration}ms): ${command}`);
                        logger.error(`Error: ${error.message}`);
                        if (stderr) logger.warn(`Stderr: ${stderr.trim()}`);
                    } else {
                        logger.success(`Command succeeded (${duration}ms): ${command}`);
                        if (stderr) logger.warn(`Command warnings: ${stderr.trim()}`);
                    }
                    
                    resolve({
                        success: !error,
                        stdout: stdout || '',
                        stderr: stderr || '',
                        error: error?.message || null,
                        windowShown: false,
                        duration: duration,
                        command: command,
                        originalCommand: originalCommand,
                        cwd: cwd,
                        osContext: osAwareness.getOSContext(),
                        wasAdapted: originalCommand !== command
                    });
                });
            }
        });
    }

    async readFile(filePath) {
        const startTime = Date.now();
        try {
            const fullPath = this.validateWorkspacePath(filePath);
            const content = await fs.readFile(fullPath, 'utf8');

            // Calculate line count and other metrics
            const lines = content.split('\n');
            const lineCount = lines.length;
            const charCount = content.length;
            const avgLineLength = charCount / lineCount;
            const readTime = Date.now() - startTime;

            // Update spinner context
            this.updateSpinnerContext(`Reading file: ${path.basename(filePath)}`);
            
            console.log(`📖 READ_FILE: ${filePath}`);
            console.log(`   📊 Size: ${charCount} chars, ${lineCount} lines (avg: ${avgLineLength.toFixed(1)} chars/line)`);
            console.log(`   ⏱️  Read time: ${readTime}ms`);
            console.log(''); // Add blank line for better spacing

            // Check if content is too large and needs chunking
            const MAX_CHUNK_SIZE = 32000; // ~8000 tokens worth of content
            if (content.length > MAX_CHUNK_SIZE) {
                const chunks = [];
                let totalChunkLines = 0;

                for (let i = 0; i < content.length; i += MAX_CHUNK_SIZE) {
                    const chunk = content.slice(i, i + MAX_CHUNK_SIZE);
                    const chunkLines = chunk.split('\n').length;
                    chunks.push(chunk);
                    totalChunkLines += chunkLines;
                }

                const chunkLines = chunks[0].split('\n').length;
                console.log(`   📦 Chunking: ${chunks.length} chunks (${MAX_CHUNK_SIZE} chars each)`);
                console.log(`   📄 Chunk 1: ${chunks[0].length} chars, ${chunkLines} lines`);
                console.log(`   📈 Total estimated: ${totalChunkLines} lines across all chunks`);

                return {
                    success: true,
                    content: chunks[0], // Return first chunk
                    chunked: true,
                    totalChunks: chunks.length,
                    chunkIndex: 0,
                    totalSize: content.length,
                    totalLines: lineCount,
                    chunkSize: chunks[0].length,
                    chunkLines: chunkLines,
                    maxChunkSize: MAX_CHUNK_SIZE,
                    readTime: readTime,
                    message: `File is large (${content.length} chars, ${lineCount} lines). Reading chunk 1/${chunks.length}. Use read_file_chunk tool for more chunks.`
                };
            }

            console.log(`   ✅ Complete file read (${charCount} chars, ${lineCount} lines)`);
            console.log(''); // Add blank line for better spacing
            return {
                success: true,
                content,
                totalSize: charCount,
                totalLines: lineCount,
                avgLineLength: avgLineLength,
                readTime: readTime
            };
        } catch (error) {
            const readTime = Date.now() - startTime;
            console.log(`❌ READ_FILE ERROR: ${filePath} (${readTime}ms) - ${error.message}`);
            return { success: false, error: error.message, readTime: readTime };
        }
    }

    async readFileChunk(filePath, chunkIndex) {
        const startTime = Date.now();
        try {
            const fullPath = this.validateWorkspacePath(filePath);
            const content = await fs.readFile(fullPath, 'utf8');

            const MAX_CHUNK_SIZE = 32000; // ~8000 tokens worth of content
            if (content.length <= MAX_CHUNK_SIZE) {
                const readTime = Date.now() - startTime;
                console.log(`❌ READ_CHUNK ERROR: ${filePath} - File too small for chunking (${content.length} chars)`);
                return {
                    success: false,
                    error: 'File is not large enough to be chunked',
                    fileSize: content.length,
                    maxChunkSize: MAX_CHUNK_SIZE,
                    readTime: readTime
                };
            }

            const chunks = [];
            let totalLinesProcessed = 0;

            for (let i = 0; i < content.length; i += MAX_CHUNK_SIZE) {
                const chunk = content.slice(i, i + MAX_CHUNK_SIZE);
                const chunkLines = chunk.split('\n').length;
                chunks.push(chunk);
                totalLinesProcessed += chunkLines;
            }

            if (chunkIndex < 0 || chunkIndex >= chunks.length) {
                const readTime = Date.now() - startTime;
                console.log(`❌ READ_CHUNK ERROR: ${filePath} - Invalid chunk index ${chunkIndex} (valid: 0-${chunks.length - 1})`);
                return {
                    success: false,
                    error: `Invalid chunk index ${chunkIndex}. Valid range: 0-${chunks.length - 1}`,
                    totalChunks: chunks.length,
                    requestedIndex: chunkIndex,
                    readTime: readTime
                };
            }

            const chunkContent = chunks[chunkIndex];
            const chunkLines = chunkContent.split('\n').length;
            const chunkChars = chunkContent.length;
            const readTime = Date.now() - startTime;

            console.log(`📖 READ_CHUNK: ${filePath} [${chunkIndex + 1}/${chunks.length}]`);
            console.log(`   📊 Chunk size: ${chunkChars} chars, ${chunkLines} lines`);
            console.log(`   📈 Progress: ${((chunkIndex + 1) / chunks.length * 100).toFixed(1)}% of file`);
            console.log(`   ⏱️  Read time: ${readTime}ms`);
            console.log(''); // Add blank line for better spacing

            return {
                success: true,
                content: chunkContent,
                chunked: true,
                totalChunks: chunks.length,
                chunkIndex: chunkIndex,
                totalSize: content.length,
                totalLines: content.split('\n').length,
                chunkSize: chunkChars,
                chunkLines: chunkLines,
                maxChunkSize: MAX_CHUNK_SIZE,
                progressPercent: ((chunkIndex + 1) / chunks.length * 100).toFixed(1),
                readTime: readTime,
                message: `Reading chunk ${chunkIndex + 1}/${chunks.length} (${chunkChars} chars, ${chunkLines} lines)`
            };
        } catch (error) {
            const readTime = Date.now() - startTime;
            console.log(`❌ READ_CHUNK ERROR: ${filePath} (${readTime}ms) - ${error.message}`);
            return { success: false, error: error.message, readTime: readTime };
        }
    }

    async writeFile(filePath, content, mode = 'write') {
        const startTime = Date.now();
        try {
            const fullPath = path.resolve(this.workspaceRoot, filePath);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });

            const contentLines = content.split('\n').length;
            const contentChars = content.length;
            const operation = mode === 'append' ? 'APPEND' : 'WRITE';

            if (mode === 'append') {
                await fs.appendFile(fullPath, content);
            } else {
                await fs.writeFile(fullPath, content);
            }

            const writeTime = Date.now() - startTime;
            console.log(`📝 ${operation}_FILE: ${filePath}`);
            console.log(`   📊 Content: ${contentChars} chars, ${contentLines} lines`);
            console.log(`   ⏱️  Write time: ${writeTime}ms`);

            return {
                success: true,
                operation: operation.toLowerCase(),
                charsWritten: contentChars,
                linesWritten: contentLines,
                writeTime: writeTime
            };
        } catch (error) {
            const writeTime = Date.now() - startTime;
            console.log(`❌ ${mode.toUpperCase()}_FILE ERROR: ${filePath} (${writeTime}ms) - ${error.message}`);
            return {
                success: false,
                error: error.message,
                operation: mode,
                writeTime: writeTime
            };
        }
    }

    /**
     * Surgical edit wrapper - proposes exact string replacement edits
     * NOW WITH UNIVERSAL ALIGNMENT ENGINE - 20 parameter targeting system
     */
    async proposeEditSurgical(filePath, oldString, newString, options = {}) {
        try {
            // Get file content from recent read
            const fileState = this.editController.getRecentFileRead(filePath);
            const content = fileState ? fileState.content : null;

            if (!content) {
                // Pre-read enforcement will catch this, but provide helpful message
                throw new Error(`Must read ${filePath} first before surgical edit (within 60 seconds)`);
            }

            // 🎯 UNIVERSAL ALIGNMENT ENGINE - Fire all targeting systems
            const alignment = await this.alignmentEngine.validate('surgical_edit', {
                filePath,
                oldString,
                newString,
                options,
                content,
                workspaceRoot: this.workspaceRoot
            });

            // Check if all systems aligned
            if (!alignment.allSystemsGo) {
                throw new Error(`Surgical edit targeting failed:\n${alignment.failureReport}`);
            }

            // All systems aligned - proceed with edit proposal
            const editId = await this.editController.proposeEditSurgical(filePath, oldString, newString, options);

            // Check for previous edit decision feedback
            const decision = this.lastEditDecision;
            const decisionInfo = decision ? {
                lastEditDecision: {
                    decision: decision.decision,
                    success: decision.success,
                    reason: decision.reason || null,
                    userFeedback: decision.userFeedback || null,
                    editId: decision.editId
                }
            } : {};

            return {
                success: true,
                editProposed: true,
                editId: editId,
                message: `Surgical edit ${editId} proposed for ${filePath}`,
                operation: 'surgical_edit',
                alignment: {
                    confidence: alignment.overallConfidence,
                    riskLevel: alignment.riskLevel,
                    parametersChecked: alignment.totalParameters,
                    parametersPassed: alignment.passed
                },
                ...decisionInfo
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                operation: 'surgical_edit',
                filePath: filePath
            };
        }
    }

    async listDirectory(dirPath = '') {
        const startTime = Date.now();
        try {
            const fullPath = this.validateWorkspacePath(dirPath);
            const items = await fs.readdir(fullPath, { withFileTypes: true });

            const result = items.map(item => ({
                name: item.name,
                type: item.isDirectory() ? 'directory' : 'file',
                path: path.join(dirPath, item.name)
            }));

            const fileCount = result.filter(item => item.type === 'file').length;
            const dirCount = result.filter(item => item.type === 'directory').length;
            const listTime = Date.now() - startTime;

            // Update spinner context
            this.updateSpinnerContext(`Listing directory: ${dirPath || '.'}`);
            
            console.log(`📁 LIST_DIR: ${dirPath || '.'}`);
            console.log(`   📊 Contents: ${result.length} items (${fileCount} files, ${dirCount} dirs)`);
            console.log(`   ⏱️  List time: ${listTime}ms`);
            console.log(''); // Add blank line for better spacing

            return {
                success: true,
                items: result,
                totalItems: result.length,
                fileCount: fileCount,
                directoryCount: dirCount,
                listTime: listTime
            };
        } catch (error) {
            const listTime = Date.now() - startTime;
            console.log(`❌ LIST_DIR ERROR: ${dirPath} (${listTime}ms) - ${error.message}`);
            return {
                success: false,
                error: error.message,
                listTime: listTime
            };
        }
    }

    async handleCommentary(channel, content, priority = 'normal', requiresInput = false, workflowStep = null) {
        const timestamp = new Date().toISOString();
        
        // Create commentary message for RICH CLI
        const commentaryMessage = {
            type: 'commentary',
            channel: channel,
            content: content,
            priority: priority,
            requiresInput: requiresInput,
            workflowStep: workflowStep,
            timestamp: timestamp
        };

        // Send to RICH CLI via WebSocket if available
        if (this.wss) {
            this.wss.clients.forEach(client => {
                if (client.readyState === 1) { // OPEN
                    client.send(JSON.stringify({
                        type: 'commentary',
                        data: commentaryMessage
                    }));
                }
            });
        }

        // Log to console with channel-specific formatting
        const channelEmoji = {
            'reasoning': '🧠',
            'planning': '📋',
            'learning': '🎓',
            'safety': '⚠️',
            'collaboration': '🤝',
            'creativity': '💡',
            'meta': '📊'
        };

        const priorityColor = {
            'low': '\x1b[37m',      // gray
            'normal': '\x1b[36m',   // cyan
            'high': '\x1b[33m',     // yellow
            'urgent': '\x1b[31m'    // red
        };

        const emoji = channelEmoji[channel] || '🎙️';
        const color = priorityColor[priority] || '\x1b[36m';
        const reset = '\x1b[0m';
        
        const stepInfo = workflowStep ? ` [${workflowStep}]` : '';
        const inputIndicator = requiresInput ? ' [REQUIRES INPUT]' : '';
        
        console.log(`${color}${emoji} COMMENTARY [${channel}]${stepInfo}${inputIndicator}:${reset}`);
        console.log(this.formatResponse(content));

        return {
            success: true,
            channel: channel,
            content: content,
            priority: priority,
            requiresInput: requiresInput,
            workflowStep: workflowStep,
            timestamp: timestamp,
            message: `Commentary posted to ${channel} channel`
        };
    }

    async handleConstrain(operation, constraints, reason = null, priority = 'recommended', duration = 'single-use', format = null) {
        const timestamp = new Date().toISOString();
        
        // Handle format-specific constraint processing
        let processedConstraints = constraints;
        if (format) {
            processedConstraints = await this.processConstraintsForFormat(constraints, format);
        }
        
        // Store constraints in session context for enforcement
        if (!this.activeConstraints) {
            this.activeConstraints = new Map();
        }
        
        const constraintId = `constraint_${Date.now()}`;
        const constraintData = {
            id: constraintId,
            operation: operation,
            constraints: processedConstraints,
            originalConstraints: constraints,
            format: format,
            reason: reason,
            priority: priority,
            duration: duration,
            timestamp: timestamp,
            applied: false
        };
        
        // Apply duration logic
        switch (duration) {
            case 'single-use':
                // Will be removed after first use
                break;
            case 'session':
                // Will persist for this session
                break;
            case 'persistent':
                // Would persist across sessions (not implemented yet)
                break;
        }
        
        this.activeConstraints.set(constraintId, constraintData);
        
        // Create constraint message for RICH CLI
        const constraintMessage = {
            type: 'constraint',
            operation: operation,
            constraints: processedConstraints,
            originalConstraints: constraints,
            format: format,
            reason: reason,
            priority: priority,
            duration: duration,
            timestamp: timestamp
        };

        // Send to RICH CLI via WebSocket if available
        if (this.wss) {
            this.wss.clients.forEach(client => {
                if (client.readyState === 1) { // OPEN
                    client.send(JSON.stringify({
                        type: 'constraint',
                        data: constraintMessage
                    }));
                }
            });
        }

        // Log to console with priority-specific formatting
        const priorityEmoji = {
            'advisory': '💡',
            'recommended': '⚠️',
            'required': '🔒',
            'critical': '🚨'
        };

        const priorityColor = {
            'advisory': '\x1b[37m',     // gray
            'recommended': '\x1b[33m',  // yellow
            'required': '\x1b[31m',     // red
            'critical': '\x1b[91m'      // bright red
        };

        const emoji = priorityEmoji[priority] || '⚙️';
        const color = priorityColor[priority] || '\x1b[33m';
        const reset = '\x1b[0m';
        
        const reasonInfo = reason ? ` - ${reason}` : '';
        
        console.log(`${color}${emoji} CONSTRAINT [${operation}] ${priority.toUpperCase()}:${reset} Applied ${Object.keys(constraints).length} constraints${reasonInfo}`);
        
        // Log constraint details
        for (const [key, value] of Object.entries(processedConstraints)) {
            console.log(`${color}  ├─ ${key}: ${JSON.stringify(value)}${reset}`);
        }
        
        if (format) {
            console.log(`${color}  ├─ format: ${format}${reset}`);
        }

        return {
            success: true,
            constraintId: constraintId,
            operation: operation,
            constraints: processedConstraints,
            originalConstraints: constraints,
            format: format,
            reason: reason,
            priority: priority,
            duration: duration,
            timestamp: timestamp,
            message: `Constraint applied to ${operation} with ${priority} priority`
        };
    }

    async processConstraintsForFormat(constraints, format) {
        // Handle different format specifiers for constraint processing
        switch (format.toLowerCase()) {
            case 'json':
                return this.processJsonConstraints(constraints);
            
            case 'yaml':
            case 'yml':
                return this.processYamlConstraints(constraints);
            
            case 'text':
            case 'txt':
                return this.processTextConstraints(constraints);
            
            case 'code':
                return this.processCodeConstraints(constraints);
            
            case 'structured':
                return this.processStructuredConstraints(constraints);
            
            default:
                // For unknown formats, return original constraints with warning
                console.log(`⚠️ Unknown constraint format '${format}', using default processing`);
                return constraints;
        }
    }

    processJsonConstraints(constraints) {
        // Enhanced JSON-specific constraint processing
        // Handle null/undefined constraints gracefully
        const processed = constraints ? { ...constraints } : {};
        
        // Add JSON-specific validation rules
        if (!processed.schema_validation) {
            processed.schema_validation = 'strict';
        }
        
        if (!processed.format_requirements) {
            processed.format_requirements = {
                valid_json: true,
                no_trailing_commas: true,
                quoted_keys: true,
                proper_escaping: true
            };
        }
        
        return processed;
    }

    processYamlConstraints(constraints) {
        // YAML-specific constraint processing
        const processed = constraints ? { ...constraints } : {};
        
        if (!processed.format_requirements) {
            processed.format_requirements = {
                valid_yaml: true,
                consistent_indentation: true,
                no_tabs: true,
                proper_line_breaks: true
            };
        }
        
        return processed;
    }

    processTextConstraints(constraints) {
        // Plain text constraint processing
        const processed = constraints ? { ...constraints } : {};
        
        if (!processed.format_requirements) {
            processed.format_requirements = {
                readable_format: true,
                proper_line_breaks: true,
                no_special_chars: false
            };
        }
        
        return processed;
    }

    processCodeConstraints(constraints) {
        // Code-specific constraint processing
        const processed = constraints ? { ...constraints } : {};
        
        if (!processed.format_requirements) {
            processed.format_requirements = {
                syntax_valid: true,
                proper_indentation: true,
                no_syntax_errors: true,
                consistent_style: true
            };
        }
        
        return processed;
    }

    processStructuredConstraints(constraints) {
        // Structured data constraint processing
        const processed = { ...constraints };
        
        if (!processed.format_requirements) {
            processed.format_requirements = {
                well_formed: true,
                hierarchical: true,
                consistent_structure: true
            };
        }
        
        return processed;
    }

    async searchCode(pattern, fileTypes = []) {
        const startTime = Date.now();
        const results = [];
        let filesSearched = 0;
        let totalLinesSearched = 0;

        const searchDir = async (dir) => {
            const items = await fs.readdir(dir, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dir, item.name);

                if (item.isDirectory() && !item.name.startsWith('.')) {
                    await searchDir(fullPath);
                } else if (item.isFile()) {
                    const ext = path.extname(item.name);
                    if (fileTypes.length === 0 || fileTypes.includes(ext)) {
                        try {
                            const content = await fs.readFile(fullPath, 'utf8');
                            const lines = content.split('\n');
                            filesSearched++;
                            totalLinesSearched += lines.length;

                            lines.forEach((line, index) => {
                                if (line.includes(pattern)) {
                                    results.push({
                                        file: path.relative(this.workspaceRoot, fullPath),
                                        line: index + 1,
                                        content: line.trim()
                                    });
                                }
                            });
                        } catch (error) {
                            // Skip files that can't be read
                        }
                    }
                }
            }
        };

        await searchDir(this.workspaceRoot);

        const searchTime = Date.now() - startTime;
        console.log(`🔍 SEARCH_CODE: "${pattern}"`);
        console.log(`   📊 Results: ${results.length} matches in ${filesSearched} files`);
        console.log(`   📈 Searched: ${totalLinesSearched} lines total`);
        console.log(`   ⏱️  Search time: ${searchTime}ms`);

        return {
            success: true,
            results,
            matchCount: results.length,
            filesSearched: filesSearched,
            totalLinesSearched: totalLinesSearched,
            searchTime: searchTime,
            pattern: pattern,
            fileTypes: fileTypes
        };
    }

    async grepSearch(args) {
        const startTime = Date.now();
        const {
            pattern,
            filePath = null,
            isRegex = false,
            caseSensitive = false,
            wholeWord = false,
            contextLines = 0,
            maxResults = 100,
            fileTypes = [],
            excludePatterns = ['node_modules', '.git', '.env', '.memory', '.edits', '.telemetry']
        } = args;

        let results = [];
        let filesSearched = 0;
        let totalLinesSearched = 0;

        // Create search regex
        let searchRegex;
        try {
            let regexPattern = pattern;
            
            if (!isRegex) {
                // Escape special regex characters for literal search
                regexPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }
            
            if (wholeWord) {
                regexPattern = `\\b${regexPattern}\\b`;
            }
            
            const flags = caseSensitive ? 'g' : 'gi';
            searchRegex = new RegExp(regexPattern, flags);
        } catch (error) {
            return {
                success: false,
                error: `Invalid regex pattern: ${error.message}`,
                pattern: pattern
            };
        }

        const shouldExclude = (filePath) => {
            return excludePatterns.some(pattern => {
                if (pattern.includes('*') || pattern.includes('?')) {
                    // Simple glob pattern matching
                    const regexPattern = pattern
                        .replace(/\*/g, '.*')
                        .replace(/\?/g, '.');
                    return new RegExp(regexPattern, 'i').test(filePath);
                }
                return filePath.includes(pattern);
            });
        };

        const searchFile = async (fullPath) => {
            if (shouldExclude(fullPath)) return;
            
            const ext = path.extname(fullPath);
            if (fileTypes.length > 0 && !fileTypes.some(type => 
                type.startsWith('.') ? ext === type : ext === '.' + type
            )) {
                return;
            }

            try {
                const content = await fs.readFile(fullPath, 'utf8');
                const lines = content.split('\n');
                filesSearched++;
                totalLinesSearched += lines.length;

                for (let i = 0; i < lines.length && results.length < maxResults; i++) {
                    const line = lines[i];
                    const matches = line.match(searchRegex);
                    
                    if (matches) {
                        // Collect context lines if requested
                        const contextBefore = contextLines > 0 ? 
                            lines.slice(Math.max(0, i - contextLines), i) : [];
                        const contextAfter = contextLines > 0 ? 
                            lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines)) : [];

                        results.push({
                            file: path.relative(this.workspaceRoot, fullPath),
                            line: i + 1,
                            content: line,
                            matches: matches.length,
                            matchedText: matches,
                            contextBefore: contextBefore,
                            contextAfter: contextAfter,
                            // Add character positions of matches
                            positions: [...line.matchAll(searchRegex)].map(match => ({
                                start: match.index,
                                end: match.index + match[0].length,
                                text: match[0]
                            }))
                        });
                    }
                }
            } catch (error) {
                // Skip files that can't be read
            }
        };

        // Search specific file or entire workspace
        if (filePath) {
            const fullPath = path.resolve(this.workspaceRoot, filePath);
            if (await fs.pathExists(fullPath)) {
                const stat = await fs.stat(fullPath);
                if (stat.isFile()) {
                    await searchFile(fullPath);
                }
            }
        } else {
            // Search entire workspace
            const searchDir = async (dir) => {
                if (shouldExclude(dir)) return;
                
                const items = await fs.readdir(dir, { withFileTypes: true });

                for (const item of items) {
                    const fullPath = path.join(dir, item.name);

                    if (item.isDirectory()) {
                        await searchDir(fullPath);
                    } else if (item.isFile()) {
                        await searchFile(fullPath);
                    }
                }
            };

            await searchDir(this.workspaceRoot);
        }

        const searchTime = Date.now() - startTime;
        
        // Enhanced logging with grep-style output
        console.log(`🔍 GREP_SEARCH: "${pattern}"`);
        console.log(`   📊 Results: ${results.length} matches in ${filesSearched} files`);
        console.log(`   📈 Searched: ${totalLinesSearched} lines total`);
        console.log(`   ⏱️  Search time: ${searchTime}ms`);
        console.log(`   🔧 Options: regex=${isRegex}, case-sensitive=${caseSensitive}, whole-word=${wholeWord}, context=${contextLines}`);

        // Show first few results in grep format
        if (results.length > 0) {
            console.log(`   📄 Sample matches:`);
            results.slice(0, 3).forEach(result => {
                console.log(`      ${result.file}:${result.line}: ${result.content.trim()}`);
            });
            if (results.length > 3) {
                console.log(`      ... and ${results.length - 3} more matches`);
            }
        }

        return {
            success: true,
            results,
            matchCount: results.length,
            filesSearched: filesSearched,
            totalLinesSearched: totalLinesSearched,
            searchTime: searchTime,
            pattern: pattern,
            isRegex: isRegex,
            caseSensitive: caseSensitive,
            wholeWord: wholeWord,
            contextLines: contextLines,
            fileTypes: fileTypes,
            excludePatterns: excludePatterns
        };
    }

    async gitOperation(operation, args = []) {
        const command = `git ${operation} ${args.join(' ')}`.trim();
        return await this.executeCommand(command);
    }

    async webSearch(query, maxResults = 5) {
        try {
            // Check if we're in cloud mode and have API key
            if (!process.env.OLLAMA_API_KEY) {
                return { 
                    error: "Web search requires Ollama Cloud API key. Set OLLAMA_API_KEY environment variable or switch to cloud mode." 
                };
            }

            // Reset usage counter if it's a new day
            const today = new Date().toDateString();
            if (this.webSearchUsage.resetDate !== today) {
                this.webSearchUsage.searches = 0;
                this.webSearchUsage.fetches = 0;
                this.webSearchUsage.resetDate = today;
                console.log(`[WEB SEARCH] 🔄 Daily usage reset for ${today}`);
            }

            // Check daily limit
            if (this.webSearchUsage.searches >= this.webSearchUsage.dailyLimit) {
                return {
                    error: `Daily web search limit reached (${this.webSearchUsage.dailyLimit}). Try again tomorrow.`,
                    usage: this.getWebSearchUsage()
                };
            }

            const response = await axios.post('https://ollama.com/api/web_search', {
                query: query,
                max_results: Math.min(maxResults, 10)
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.results) {
                // Increment usage counter
                this.webSearchUsage.searches++;
                await this.saveWebSearchUsage();
                console.log(`[WEB SEARCH] 🔍 Query: "${query}" | Usage: ${this.webSearchUsage.searches}/${this.webSearchUsage.dailyLimit}`);
                
                return {
                    success: true,
                    query: query,
                    results: response.data.results,
                    count: response.data.results.length,
                    usage: this.getWebSearchUsage()
                };
            } else {
                return { error: "Invalid response from web search API" };
            }
        } catch (error) {
            return { 
                error: `Web search failed: ${error.response?.data?.error || error.message}` 
            };
        }
    }

    async webFetch(url) {
        try {
            // Check if we're in cloud mode and have API key
            if (!process.env.OLLAMA_API_KEY) {
                return { 
                    error: "Web fetch requires Ollama Cloud API key. Set OLLAMA_API_KEY environment variable or switch to cloud mode." 
                };
            }

            // Reset usage counter if it's a new day
            const today = new Date().toDateString();
            if (this.webSearchUsage.resetDate !== today) {
                this.webSearchUsage.searches = 0;
                this.webSearchUsage.fetches = 0;
                this.webSearchUsage.resetDate = today;
                console.log(`[WEB SEARCH] 🔄 Daily usage reset for ${today}`);
            }

            // Check daily limit (fetches count toward same limit)
            if (this.webSearchUsage.fetches >= this.webSearchUsage.dailyLimit) {
                return {
                    error: `Daily web fetch limit reached (${this.webSearchUsage.dailyLimit}). Try again tomorrow.`,
                    usage: this.getWebSearchUsage()
                };
            }

            // Ensure URL has protocol
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }

            const response = await axios.post('https://ollama.com/api/web_fetch', {
                url: url
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data) {
                // Increment usage counter
                this.webSearchUsage.fetches++;
                await this.saveWebSearchUsage();
                console.log(`[WEB SEARCH] 🌐 Fetch: "${url}" | Usage: ${this.webSearchUsage.fetches}/${this.webSearchUsage.dailyLimit}`);
                
                return {
                    success: true,
                    url: url,
                    title: response.data.title,
                    content: response.data.content,
                    links: response.data.links || [],
                    usage: this.getWebSearchUsage()
                };
            } else {
                return { error: "Invalid response from web fetch API" };
            }
        } catch (error) {
            return { 
                error: `Web fetch failed: ${error.response?.data?.error || error.message}` 
            };
        }
    }

    getWebSearchUsage() {
        return {
            searches: this.webSearchUsage.searches,
            fetches: this.webSearchUsage.fetches,
            total: this.webSearchUsage.searches + this.webSearchUsage.fetches,
            dailyLimit: this.webSearchUsage.dailyLimit,
            remaining: this.webSearchUsage.dailyLimit - (this.webSearchUsage.searches + this.webSearchUsage.fetches),
            resetDate: this.webSearchUsage.resetDate
        };
    }

    // New enhanced tools implementation
    async runTests(testCommand, cwd = this.workspaceRoot, timeout = 300) {
        try {
            const { exec } = require('child_process');

            return new Promise((resolve) => {
                const startTime = Date.now();
                const timeoutMs = timeout * 1000;

                const child = exec(testCommand, {
                    cwd,
                    timeout: timeoutMs,
                    maxBuffer: 1024 * 1024 * 10 // 10MB buffer
                }, (error, stdout, stderr) => {
                    const executionTime = Date.now() - startTime;

                    // Parse test results based on common test output patterns
                    const output = stdout + stderr;
                    const result = this.parseTestOutput(output, executionTime, error);

                    resolve(result);
                });

                // Handle timeout
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill('SIGTERM');
                        resolve({
                            success: false,
                            error: `Test execution timed out after ${timeout} seconds`,
                            timeout: true,
                            executionTime: timeout * 1000
                        });
                    }
                }, timeoutMs);
            });
        } catch (error) {
            return {
                success: false,
                error: `Failed to run tests: ${error.message}`,
                executionTime: 0
            };
        }
    }

    parseTestOutput(output, executionTime, error) {
        const result = {
            success: !error,
            executionTime,
            output: output,
            summary: {}
        };

        // Parse Jest/Mocha style output
        const passedMatch = output.match(/(\d+)\s+passing/);
        const failedMatch = output.match(/(\d+)\s+failing/);
        const testsMatch = output.match(/(\d+)\s+tests?/);

        if (passedMatch || failedMatch || testsMatch) {
            result.summary = {
                total: testsMatch ? parseInt(testsMatch[1]) : 0,
                passed: passedMatch ? parseInt(passedMatch[1]) : 0,
                failed: failedMatch ? parseInt(failedMatch[1]) : 0,
                framework: 'jest/mocha'
            };
        }

        // Parse pytest output
        const pytestPassed = output.match(/(\d+)\s+passed/);
        const pytestFailed = output.match(/(\d+)\s+failed/);
        const pytestErrors = output.match(/(\d+)\s+errors?/);

        if (pytestPassed || pytestFailed || pytestErrors) {
            result.summary = {
                total: (pytestPassed ? parseInt(pytestPassed[1]) : 0) +
                       (pytestFailed ? parseInt(pytestFailed[1]) : 0) +
                       (pytestErrors ? parseInt(pytestErrors[1]) : 0),
                passed: pytestPassed ? parseInt(pytestPassed[1]) : 0,
                failed: (pytestFailed ? parseInt(pytestFailed[1]) : 0) +
                        (pytestErrors ? parseInt(pytestErrors[1]) : 0),
                framework: 'pytest'
            };
        }

        // Extract error details
        if (error) {
            result.error = error.message;
            result.exitCode = error.code;
        }

        return result;
    }

    async runLinter(linterCommand, cwd = this.workspaceRoot, filePath = null) {
        try {
            const { exec } = require('child_process');

            // If filePath is specified, append it to the command
            const fullCommand = filePath ? `${linterCommand} ${filePath}` : linterCommand;

            return new Promise((resolve) => {
                exec(fullCommand, {
                    cwd,
                    maxBuffer: 1024 * 1024 * 5 // 5MB buffer for linter output
                }, (error, stdout, stderr) => {
                    const output = stdout + stderr;
                    const result = this.parseLinterOutput(output, error);

                    resolve(result);
                });
            });
        } catch (error) {
            return {
                success: false,
                error: `Failed to run linter: ${error.message}`,
                issues: []
            };
        }
    }

    parseLinterOutput(output, error) {
        const result = {
            success: !error || error.code === 0,
            output: output,
            issues: []
        };

        // Parse ESLint output
        const eslintRegex = /^(.+?): line (\d+), col (\d+), (Error|Warning) - (.+?)(?:\s\((.+?)\))?$/gm;
        let match;
        while ((match = eslintRegex.exec(output)) !== null) {
            result.issues.push({
                file: match[1],
                line: parseInt(match[2]),
                column: parseInt(match[3]),
                severity: match[4].toLowerCase(),
                message: match[5],
                rule: match[6] || null,
                linter: 'eslint'
            });
        }

        // Parse flake8 output
        const flake8Regex = /^(.+?):(\d+):(\d+): (\w+) (.+)$/gm;
        while ((match = flake8Regex.exec(output)) !== null) {
            result.issues.push({
                file: match[1],
                line: parseInt(match[2]),
                column: parseInt(match[3]),
                severity: match[4].toLowerCase(),
                message: match[5],
                linter: 'flake8'
            });
        }

        // Count issues by severity
        const errorCount = result.issues.filter(i => i.severity === 'error').length;
        const warningCount = result.issues.filter(i => i.severity === 'warning').length;

        result.summary = {
            totalIssues: result.issues.length,
            errors: errorCount,
            warnings: warningCount
        };

        if (error && error.code !== 0) {
            result.error = error.message;
            result.exitCode = error.code;
        }

        return result;
    }

    async checkDependencies(packageManager = 'auto', cwd = this.workspaceRoot, includeDev = true) {
        try {
            const fs = require('fs').promises;
            const path = require('path');

            // Auto-detect package manager
            if (packageManager === 'auto') {
                const hasPackageLock = await fs.access(path.join(cwd, 'package-lock.json')).then(() => true).catch(() => false);
                const hasYarnLock = await fs.access(path.join(cwd, 'yarn.lock')).then(() => true).catch(() => false);
                const hasPnpmLock = await fs.access(path.join(cwd, 'pnpm-lock.yaml')).then(() => true).catch(() => false);
                const hasPipfile = await fs.access(path.join(cwd, 'Pipfile')).then(() => true).catch(() => false);
                const hasRequirements = await fs.access(path.join(cwd, 'requirements.txt')).then(() => true).catch(() => false);

                if (hasPackageLock) packageManager = 'npm';
                else if (hasYarnLock) packageManager = 'yarn';
                else if (hasPnpmLock) packageManager = 'pnpm';
                else if (hasPipfile || hasRequirements) packageManager = 'pip';
                else packageManager = 'npm'; // default fallback
            }

            let result;
            switch (packageManager) {
                case 'npm':
                    result = await this.checkNpmDependencies(cwd, includeDev);
                    break;
                case 'yarn':
                    result = await this.checkYarnDependencies(cwd, includeDev);
                    break;
                case 'pnpm':
                    result = await this.checkPnpmDependencies(cwd, includeDev);
                    break;
                case 'pip':
                    result = await this.checkPipDependencies(cwd);
                    break;
                default:
                    return { error: `Unsupported package manager: ${packageManager}` };
            }

            return result;
        } catch (error) {
            return {
                success: false,
                error: `Failed to check dependencies: ${error.message}`,
                packageManager: packageManager
            };
        }
    }

    async checkNpmDependencies(cwd, includeDev) {
        const { exec } = require('child_process');

        return new Promise((resolve) => {
            const command = includeDev ? 'npm list --depth=0 --json' : 'npm list --depth=0 --json --production';
            exec(command, { cwd }, (error, stdout, stderr) => {
                try {
                    const data = JSON.parse(stdout);
                    const dependencies = data.dependencies || {};

                    const result = {
                        success: !error,
                        packageManager: 'npm',
                        includeDev,
                        dependencies: Object.entries(dependencies).map(([name, info]) => ({
                            name,
                            version: info.version,
                            type: info.dev ? 'dev' : 'prod'
                        }))
                    };

                    resolve(result);
                } catch (parseError) {
                    resolve({
                        success: false,
                        error: `Failed to parse npm output: ${parseError.message}`,
                        rawOutput: stdout
                    });
                }
            });
        });
    }

    async checkYarnDependencies(cwd, includeDev) {
        const { exec } = require('child_process');

        return new Promise((resolve) => {
            const command = 'yarn list --depth=0 --json';
            exec(command, { cwd }, (error, stdout, stderr) => {
                // Yarn list output is complex, fallback to npm-style parsing
                resolve({
                    success: false,
                    error: 'Yarn dependency checking not fully implemented yet',
                    packageManager: 'yarn'
                });
            });
        });
    }

    async checkPnpmDependencies(cwd, includeDev) {
        const { exec } = require('child_process');

        return new Promise((resolve) => {
            const command = 'pnpm list --depth=0 --json';
            exec(command, { cwd }, (error, stdout, stderr) => {
                try {
                    const data = JSON.parse(stdout);
                    const result = {
                        success: !error,
                        packageManager: 'pnpm',
                        includeDev,
                        dependencies: data.map(dep => ({
                            name: dep.name,
                            version: dep.version,
                            type: 'prod' // pnpm doesn't distinguish easily
                        }))
                    };

                    resolve(result);
                } catch (parseError) {
                    resolve({
                        success: false,
                        error: `Failed to parse pnpm output: ${parseError.message}`,
                        rawOutput: stdout
                    });
                }
            });
        });
    }

    async checkPipDependencies(cwd) {
        const { exec } = require('child_process');

        return new Promise((resolve) => {
            exec('pip freeze', { cwd }, (error, stdout, stderr) => {
                const lines = stdout.split('\n').filter(line => line.trim());
                const dependencies = lines.map(line => {
                    const [name, version] = line.split('==');
                    return { name, version };
                });

                resolve({
                    success: !error,
                    packageManager: 'pip',
                    dependencies
                });
            });
        });
    }

    async showFileDiff(filePath, newContent, contextLines = 3) {
        try {
            const fs = require('fs').promises;
            const path = require('path');

            const fullPath = this.validateWorkspacePath(filePath);

            // Read current content
            let currentContent;
            try {
                currentContent = await fs.readFile(fullPath, 'utf8');
            } catch (error) {
                // File doesn't exist, treat as empty
                currentContent = '';
            }

            const currentLines = currentContent.split('\n');
            const newLines = newContent.split('\n');

            // Generate unified diff
            const diff = this.generateUnifiedDiff(filePath, currentLines, newLines, contextLines);

            return {
                success: true,
                filePath,
                diff,
                changes: this.countDiffChanges(diff),
                currentLines: currentLines.length,
                newLines: newLines.length
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate diff: ${error.message}`,
                filePath
            };
        }
    }

    generateUnifiedDiff(filePath, oldLines, newLines, contextLines) {
        const diff = [];
        diff.push(`--- a/${filePath}`);
        diff.push(`+++ b/${filePath}`);

        let oldIndex = 0;
        let newIndex = 0;
        let hunkStart = -1;
        let hunkLines = [];

        while (oldIndex < oldLines.length || newIndex < newLines.length) {
            // Find next difference
            let diffStart = -1;
            for (let i = 0; i < Math.min(oldLines.length - oldIndex, newLines.length - newIndex); i++) {
                if (oldLines[oldIndex + i] !== newLines[newIndex + i]) {
                    diffStart = i;
                    break;
                }
            }

            if (diffStart === -1) {
                // No more differences in this range
                if (oldIndex < oldLines.length) {
                    // Remaining old lines are deletions
                    if (hunkStart === -1) {
                        hunkStart = oldIndex + 1;
                        hunkLines = [];
                    }
                    const remaining = oldLines.length - oldIndex;
                    for (let i = 0; i < remaining; i++) {
                        hunkLines.push(`-${oldLines[oldIndex + i]}`);
                    }
                    oldIndex = oldLines.length;
                } else if (newIndex < newLines.length) {
                    // Remaining new lines are additions
                    if (hunkStart === -1) {
                        hunkStart = oldIndex + 1;
                        hunkLines = [];
                    }
                    const remaining = newLines.length - newIndex;
                    for (let i = 0; i < remaining; i++) {
                        hunkLines.push(`+${newLines[newIndex + i]}`);
                    }
                    newIndex = newLines.length;
                }
            } else {
                // Found a difference
                if (hunkStart === -1) {
                    hunkStart = oldIndex + 1;
                    hunkLines = [];
                }

                // Add context before the change
                const contextStart = Math.max(0, diffStart - contextLines);
                for (let i = contextStart; i < diffStart; i++) {
                    if (oldIndex + i < oldLines.length) {
                        hunkLines.push(` ${oldLines[oldIndex + i]}`);
                    }
                }

                // Find the end of the difference
                let diffEnd = diffStart;
                while (diffEnd < Math.min(oldLines.length - oldIndex, newLines.length - newIndex)) {
                    if (oldLines[oldIndex + diffEnd] === newLines[newIndex + diffEnd]) {
                        break;
                    }
                    diffEnd++;
                }

                // Add the changed lines
                for (let i = diffStart; i < diffEnd; i++) {
                    if (oldIndex + i < oldLines.length) {
                        hunkLines.push(`-${oldLines[oldIndex + i]}`);
                    }
                    if (newIndex + i < newLines.length) {
                        hunkLines.push(`+${newLines[newIndex + i]}`);
                    }
                }

                // Add context after the change
                const contextEnd = Math.min(diffEnd + contextLines,
                    Math.min(oldLines.length - oldIndex, newLines.length - newIndex));
                for (let i = diffEnd; i < contextEnd; i++) {
                    if (oldIndex + i < oldLines.length) {
                        hunkLines.push(` ${oldLines[oldIndex + i]}`);
                    }
                }

                oldIndex += diffEnd;
                newIndex += diffEnd;
            }

            // Output hunk if we have one
            if (hunkStart !== -1 && hunkLines.length > 0) {
                diff.push(`@@ -${hunkStart},${oldLines.length} +${hunkStart},${newLines.length} @@`);
                diff.push(...hunkLines);
                hunkStart = -1;
                hunkLines = [];
            }
        }

        return diff.join('\n');
    }

    countDiffChanges(diff) {
        const lines = diff.split('\n');
        let additions = 0;
        let deletions = 0;

        for (const line of lines) {
            if (line.startsWith('+') && !line.startsWith('+++')) {
                additions++;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                deletions++;
            }
        }

        return { additions, deletions, total: additions + deletions };
    }

    async startRepl(language = 'auto', cwd = this.workspaceRoot, imports = []) {
        try {
            const { spawn } = require('child_process');

            // Auto-detect language
            if (language === 'auto') {
                const fs = require('fs');
                const hasPackageJson = fs.existsSync(require('path').join(cwd, 'package.json'));
                const hasRequirements = fs.existsSync(require('path').join(cwd, 'requirements.txt'));
                const hasPipfile = fs.existsSync(require('path').join(cwd, 'Pipfile'));

                if (hasPackageJson) language = 'node';
                else if (hasRequirements || hasPipfile) language = 'python';
                else language = 'node'; // default
            }

            let command, args;
            switch (language) {
                case 'node':
                    command = 'node';
                    args = ['-i']; // interactive mode
                    if (imports.length > 0) {
                        // Pre-import modules
                        args.push('-e', imports.map(imp => `require('${imp}')`).join(';'));
                    }
                    break;
                case 'python':
                    command = 'python';
                    args = ['-i']; // interactive mode
                    if (imports.length > 0) {
                        // Pre-import modules
                        args.push('-c', imports.map(imp => `import ${imp}`).join(';'));
                    }
                    break;
                default:
                    return { error: `Unsupported REPL language: ${language}` };
            }

            // Note: This starts a background process, but for the tool response
            // we just indicate it was started successfully
            const child = spawn(command, args, {
                cwd,
                stdio: 'inherit', // Pass through to terminal
                detached: true
            });

            // Detach so it doesn't get killed when this process exits
            child.unref();

            return {
                success: true,
                language,
                command: `${command} ${args.join(' ')}`,
                cwd,
                message: `REPL started in background. Use your terminal to interact with it.`,
                pid: child.pid
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to start REPL: ${error.message}`,
                language
            };
        }
    }

    // Model usage tracking methods (collect real data)
    resetUsageIfNeeded() {
        const today = new Date().toDateString();
        
        // Reset daily stats if it's a new day
        if (this.modelUsage.resetDate !== today) {
            console.log(`[USAGE] 🔄 Daily usage reset for ${today}`);
            
            // Archive yesterday's data for analysis
            if (Object.keys(this.modelUsage.models).length > 0) {
                console.log(`[USAGE] 📊 Yesterday's usage summary:`);
                Object.entries(this.modelUsage.models).forEach(([modelName, stats]) => {
                    const successRate = stats.totalRequests > 0 ? 
                        Math.round(((stats.totalRequests - stats.errors) / stats.totalRequests) * 100) : 0;
                    console.log(`[USAGE]   ${modelName}: ${stats.totalRequests} requests, ${stats.errors} errors (${successRate}% success)`);
                    if (stats.rateLimitErrors > 0) {
                        console.log(`[USAGE]     └─ ${stats.rateLimitErrors} rate limit errors detected`);
                    }
                });
            }
            
            this.modelUsage.resetDate = today;
            this.modelUsage.resetTime = new Date().getTime();
            
            // Reset all model stats
            Object.keys(this.modelUsage.models).forEach(modelName => {
                this.modelUsage.models[modelName] = {
                    totalRequests: 0,
                    successfulRequests: 0,
                    errors: 0,
                    rateLimitErrors: 0,
                    totalTokens: 0,
                    lastUsed: null,
                    firstUsed: null,
                    errorMessages: []
                };
            });
            
            // Reset daily stats
            this.modelUsage.dailyStats = {
                totalRequests: 0,
                totalTokens: 0,
                totalErrors: 0,
                rateLimitErrors: 0
            };
        }
    }

    trackModelUsage(modelName, isError = false, errorMessage = null, tokenCount = 0, isToolCall = false, responseTime = 0) {
        this.debugLog(`trackModelUsage called: ${modelName}, error=${isError}, tokens=${tokenCount}, toolCall=${isToolCall}`, 'USAGE');
        this.resetUsageIfNeeded();
        
        // Record telemetry data
        if (this.telemetryManager) {
            this.telemetryManager.recordApiCall(modelName, responseTime, tokenCount, !isError, isError ? new Error(errorMessage) : null);
        }
        
        // Initialize model tracking if not exists
        if (!this.modelUsage.models[modelName]) {
            this.debugLog(`Initializing tracking for new model: ${modelName}`, 'USAGE');
            this.modelUsage.models[modelName] = {
                totalRequests: 0,
                successfulRequests: 0,
                errors: 0,
                rateLimitErrors: 0,
                toolCallErrors: 0,
                simpleChatRequests: 0,
                toolCallRequests: 0,
                totalTokens: 0,
                lastUsed: null,
                firstUsed: new Date().toISOString(),
                errorMessages: [],
                consecutiveToolCallFailures: [],  // Track where in sequence failures occur
                maxConsecutiveToolCalls: 0        // Track longest successful sequence
            };
        }
        
        // Track consecutive tool call patterns
        if (this.modelUsage.currentConversation.model !== modelName) {
            // New conversation/model - reset consecutive counter
            this.modelUsage.currentConversation = {
                model: modelName,
                consecutiveToolCalls: 0,
                startTime: new Date().getTime()
            };
        }
        
        const model = this.modelUsage.models[modelName];
        const now = new Date().getTime();
        
        // Update model stats
        model.totalRequests++;
        model.lastUsed = new Date().toISOString();
        this.modelUsage.dailyStats.totalRequests++;
        
        // Track request type
        if (isToolCall) {
            model.toolCallRequests++;
            this.modelUsage.dailyStats.toolCallRequests++;
            this.modelUsage.currentConversation.consecutiveToolCalls++;
        } else {
            model.simpleChatRequests++;
            this.modelUsage.dailyStats.simpleChatRequests++;
            // Reset consecutive tool call counter on simple chat
            this.modelUsage.currentConversation.consecutiveToolCalls = 0;
        }
        
        if (isError) {
            model.errors++;
            this.modelUsage.dailyStats.totalErrors++;
            
            // Check if it's a tool call error
            if (isToolCall) {
                model.toolCallErrors++;
                this.modelUsage.dailyStats.toolCallErrors++;
                
                // Track consecutive tool call failure pattern
                const consecutiveCount = this.modelUsage.currentConversation.consecutiveToolCalls;
                model.consecutiveToolCallFailures.push({
                    failureAtStep: consecutiveCount,
                    timestamp: new Date().toISOString(),
                    errorMessage: errorMessage || 'Unknown error'
                });
                
                console.log(`[USAGE] ⚠️ Tool call #${consecutiveCount} failed for ${modelName} (${model.toolCallErrors} total tool call errors)`);
                
                // Keep only last 10 consecutive failure records
                if (model.consecutiveToolCallFailures.length > 10) {
                    model.consecutiveToolCallFailures = model.consecutiveToolCallFailures.slice(-10);
                }
            }
            
            // Check if it's a rate limit error
            const isRateLimit = errorMessage && (
                errorMessage.toLowerCase().includes('rate limit') ||
                errorMessage.toLowerCase().includes('quota') ||
                errorMessage.toLowerCase().includes('too many requests') ||
                errorMessage.toLowerCase().includes('limit exceeded')
            );
            
            if (isRateLimit) {
                model.rateLimitErrors++;
                this.modelUsage.dailyStats.rateLimitErrors++;
                console.log(`[USAGE] ⚠️ Rate limit detected for ${modelName} (${model.rateLimitErrors} today)`);
            }
            
            // Store error message (keep last 5)
            model.errorMessages.unshift({
                message: errorMessage || 'Unknown error',
                timestamp: new Date().toISOString(),
                isRateLimit,
                isToolCall,
                requestType: isToolCall ? 'tool_call' : 'simple_chat'
            });
            if (model.errorMessages.length > 5) {
                model.errorMessages = model.errorMessages.slice(0, 5);
            }
            
        } else {
            // Successful request
            model.successfulRequests++;
            model.totalTokens += tokenCount;
            this.modelUsage.dailyStats.totalTokens += tokenCount;
        }
        
        console.log(`[USAGE] 📊 ${modelName}: ${model.successfulRequests}/${model.totalRequests} success (${model.rateLimitErrors} rate limits)`);
    }

    getModelUsage() {
        this.resetUsageIfNeeded();
        
        this.debugLog(`getModelUsage called, models tracked: ${Object.keys(this.modelUsage.models).length}`, 'USAGE');
        this.debugLog(`Available models: ${Object.keys(this.modelUsage.models).join(', ')}`, 'USAGE');
        
        const usage = {};
        Object.keys(this.modelUsage.models).forEach(modelName => {
            const model = this.modelUsage.models[modelName];
            const successRate = model.totalRequests > 0 ? 
                Math.round((model.successfulRequests / model.totalRequests) * 100) : 0;
            
            usage[modelName] = {
                totalRequests: model.totalRequests,
                successfulRequests: model.successfulRequests,
                errors: model.errors,
                rateLimitErrors: model.rateLimitErrors,
                toolCallErrors: model.toolCallErrors,
                simpleChatRequests: model.simpleChatRequests,
                toolCallRequests: model.toolCallRequests,
                totalTokens: model.totalTokens,
                successRate: successRate,
                toolCallSuccessRate: model.toolCallRequests > 0 ? 
                    Math.round(((model.toolCallRequests - model.toolCallErrors) / model.toolCallRequests) * 100) : 0,
                avgTokensPerRequest: model.successfulRequests > 0 ? 
                    Math.round(model.totalTokens / model.successfulRequests) : 0,
                lastUsed: model.lastUsed,
                firstUsed: model.firstUsed,
                recentErrors: model.errorMessages.slice(0, 3) // Last 3 errors
            };
        });
        
        return {
            resetDate: this.modelUsage.resetDate,
            models: usage,
            dailyStats: this.modelUsage.dailyStats,
            summary: {
                totalModels: Object.keys(usage).length,
                modelsWithErrors: Object.values(usage).filter(m => m.errors > 0).length,
                modelsWithRateLimits: Object.values(usage).filter(m => m.rateLimitErrors > 0).length,
                totalSuccessRate: this.modelUsage.dailyStats.totalRequests > 0 ? 
                    Math.round(((this.modelUsage.dailyStats.totalRequests - this.modelUsage.dailyStats.totalErrors) / this.modelUsage.dailyStats.totalRequests) * 100) : 0
            }
        };
    }

    setupRoutes() {
        // Health check
        this.app.get('/hijack/status', (req, res) => {
            res.json({
                status: 'jacked-in',
                workspace: this.workspaceRoot,
                mode: this.isCloudMode() ? 'cloud' : 'local',
                activeTerminals: this.activeTerminals.size,
                currentModel: this.currentModel,
                webSearchUsage: this.getWebSearchUsage(),
                app: 'Ollama Jack'
            });
        });

        // Also provide /api/status for compatibility
        this.app.get('/api/status', (req, res) => {
            res.json({
                status: 'online',
                workspace: this.workspaceRoot,
                mode: this.isCloudMode() ? 'cloud' : 'local',
                model: this.currentModel,
                activeTerminals: this.activeTerminals.size,
                webSearchUsage: this.getWebSearchUsage()
            });
        });

        // Web search usage endpoint
        this.app.get('/jack/web-usage', (req, res) => {
            res.json({
                usage: this.getWebSearchUsage(),
                message: `${this.getWebSearchUsage().remaining} web searches remaining today`
            });
        });

        // Model usage endpoint
        this.app.get('/jack/model-usage', (req, res) => {
            const usage = this.getModelUsage();
            res.json({
                usage,
                message: `${usage.summary.totalModels} models tracked, ${usage.summary.modelsWithRateLimits} with rate limits (${usage.summary.totalSuccessRate}% overall success)`
            });
        });

        // Terminal log endpoint for Canvas mirror - with CORS preflight support
        this.app.options('/jack/terminal-log', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            res.sendStatus(200);
        });
        
        this.app.get('/jack/terminal-log', (req, res) => {
            // Ensure CORS headers are set
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            
            const limit = parseInt(req.query.limit) || 100;
            const since = req.query.since ? new Date(req.query.since) : null;
            
            let logs = this.terminalLog;
            
            // Filter by timestamp if 'since' parameter provided
            if (since) {
                logs = logs.filter(log => new Date(log.timestamp) > since);
            }
            
            // Limit results
            const recentLogs = logs.slice(-limit);
            
            res.json({
                logs: recentLogs,
                total: recentLogs.length,
                maxSize: this.maxTerminalLogSize,
                currentSize: this.terminalLog.length
            });
        });

        // Canvas data endpoints for Jack-Canvas integration
        this.app.options('/jack/canvas-data', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            res.sendStatus(200);
        });

        // Receive Canvas document and AI analysis data
        this.app.post('/jack/canvas-data', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            
            try {
                const {
                    document,
                    aiAnalysis,
                    synthesis,
                    metrics,
                    timestamp
                } = req.body;

                // Store Canvas data for Jack to access (optional enhancement)
                this.canvasData = {
                    document: document || '',
                    aiAnalysis: aiAnalysis || {},
                    synthesis: synthesis || '',
                    metrics: metrics || {},
                    lastUpdate: timestamp || new Date().toISOString()
                };

                this.canvasIntegrationEnabled = true;
                this.logToTerminal(`📊 Canvas integration activated: ${document?.length || 0} chars, ${Object.keys(aiAnalysis || {}).length} AI insights`);
                
                res.json({
                    success: true,
                    received: {
                        documentLength: document?.length || 0,
                        aiSystems: Object.keys(aiAnalysis || {}),
                        hasSynthesis: !!synthesis,
                        timestamp: this.canvasData.lastUpdate
                    }
                });
            } catch (error) {
                console.error('Canvas data endpoint error:', error);
                res.status(400).json({ error: error.message });
            }
        });

        // Get Canvas data for Jack to read
        this.app.get('/jack/canvas-data', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            
            res.json(this.canvasData || {
                document: '',
                aiAnalysis: {},
                synthesis: '',
                metrics: {},
                lastUpdate: null
            });
        });

        // Canvas document edit endpoint - Jack can edit Canvas document
        this.app.options('/jack/canvas-edit', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            res.sendStatus(200);
        });

        this.app.post('/jack/canvas-edit', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            
            try {
                const { content, editType, position } = req.body;
                
                // Store edit for Canvas to retrieve
                this.pendingCanvasEdit = {
                    content,
                    editType, // 'replace', 'append', 'insert', 'prepend'
                    position,
                    timestamp: new Date().toISOString(),
                    id: Date.now().toString()
                };

                this.logToTerminal(`✏️ Jack edit queued: ${editType} - ${content?.length || 0} chars`);
                
                res.json({
                    success: true,
                    editId: this.pendingCanvasEdit.id,
                    editType,
                    contentLength: content?.length || 0
                });
            } catch (error) {
                console.error('Canvas edit endpoint error:', error);
                res.status(400).json({ error: error.message });
            }
        });

        // Canvas retrieves pending edits from Jack
        this.app.get('/jack/canvas-edit', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            
            const edit = this.pendingCanvasEdit;
            if (edit) {
                // Clear the edit after serving it
                this.pendingCanvasEdit = null;
                res.json(edit);
            } else {
                res.json({ noEdit: true });
            }
        });

        // Canvas event notification endpoint - lightweight pings for fresh data
        this.app.options('/jack/canvas-ping', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            res.sendStatus(200);
        });

        this.app.post('/jack/canvas-ping', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            
            try {
                const { event, timestamp, source } = req.body;
                
                // Set fresh data flag - Jack will read from storage when needed
                this.canvasDataFreshFlag = true;
                this.canvasIntegrationEnabled = true;
                this.lastCanvasPingTime = new Date().toISOString();
                
                // Track ping history for Rich CLI
                if (!this.canvasPingHistory) {
                    this.canvasPingHistory = [];
                }
                
                this.canvasPingHistory.push({
                    event,
                    source: source || 'canvas',
                    timestamp: timestamp || new Date().toISOString(),
                    acknowledged: new Date().toISOString()
                });
                
                // Keep only last 50 pings
                if (this.canvasPingHistory.length > 50) {
                    this.canvasPingHistory = this.canvasPingHistory.slice(-50);
                }
                
                // Canvas events are tracked silently - visible only in Rich CLI Canvas section
                // No logging to main Jack chat interface to avoid clutter
                
                res.json({
                    success: true,
                    event,
                    source: source || 'canvas',
                    acknowledged: timestamp || new Date().toISOString()
                });
            } catch (error) {
                console.error('Canvas ping endpoint error:', error);
                res.status(400).json({ error: error.message });
            }
        });

        // localStorage proxy endpoint - Jack can request specific localStorage keys
        this.app.options('/jack/localStorage', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            res.sendStatus(200);
        });

        this.app.post('/jack/localStorage', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            
            try {
                const { keys, localStorage: localStorageData, indexedDB: indexedDBData } = req.body;
                
                if (keys && Array.isArray(keys)) {
                    // Jack is requesting specific localStorage keys
                    res.json({
                        success: true,
                        message: 'localStorage keys requested - Canvas should respond with data',
                        requestedKeys: keys
                    });
                } else if (localStorageData || indexedDBData) {
                    // Canvas is providing localStorage and/or IndexedDB data for Jack
                    if (localStorageData) {
                        this.canvasLocalStorage = localStorageData;
                    }
                    if (indexedDBData) {
                        this.canvasIndexedDB = indexedDBData;
                    }
                    this.canvasDataFreshFlag = true;
                    
                    const localStorageKeys = localStorageData ? Object.keys(localStorageData).length : 0;
                    const indexedDBKeys = indexedDBData ? Object.keys(indexedDBData).length : 0;
                    
                    this.logToTerminal(`📋 Canvas data received - localStorage: ${localStorageKeys} keys, IndexedDB: ${indexedDBKeys} stores`);
                    
                    res.json({
                        success: true,
                        message: 'Canvas data received',
                        localStorageKeysReceived: localStorageKeys,
                        indexedDBStoresReceived: indexedDBKeys
                    });
                } else {
                    res.status(400).json({ error: 'Invalid request - provide keys array or localStorage/indexedDB data' });
                }
            } catch (error) {
                console.error('localStorage proxy endpoint error:', error);
                res.status(400).json({ error: error.message });
            }
        });

        // Canvas integration status endpoint for Rich CLI
        this.app.get('/jack/canvas-status', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            
            try {
                const status = {
                    integrationEnabled: this.canvasIntegrationEnabled || false,
                    hasFreshData: this.canvasDataFreshFlag || false,
                    lastPingTime: this.lastCanvasPingTime || null,
                    localStorage: {
                        available: !!this.canvasLocalStorage,
                        keyCount: this.canvasLocalStorage ? Object.keys(this.canvasLocalStorage).length : 0,
                        keys: this.canvasLocalStorage ? Object.keys(this.canvasLocalStorage) : []
                    },
                    indexedDB: {
                        available: !!this.canvasIndexedDB,
                        storeCount: this.canvasIndexedDB ? Object.keys(this.canvasIndexedDB).length : 0,
                        stores: this.canvasIndexedDB ? Object.keys(this.canvasIndexedDB) : []
                    },
                    recentPings: this.canvasPingHistory || []
                };
                
                res.json(status);
            } catch (error) {
                console.error('Canvas status endpoint error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Canvas storage detail endpoint for Rich CLI
        this.app.get('/jack/canvas-storage-detail', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            
            try {
                // If we have cached Canvas data, return it
                if (this.canvasLocalStorage || this.canvasIndexedDB) {
                    const storageDetail = {
                        localStorage: this.canvasLocalStorage || {},
                        indexedDB: this.canvasIndexedDB || {},
                        lastUpdated: this.lastCanvasPingTime || null,
                        dataAvailable: true,
                        source: 'cached'
                    };
                    
                    res.json(storageDetail);
                    return;
                }
                
                // No cached data - provide guidance for accessing Canvas storage
                const storageDetail = {
                    localStorage: {},
                    indexedDB: {},
                    lastUpdated: null,
                    dataAvailable: false,
                    source: 'unavailable',
                    message: 'Canvas storage not available. Canvas must ping Jack to provide storage access.',
                    instructions: [
                        'Open Canvas in browser',
                        'Run analysis or interact with Canvas',
                        'Canvas will ping Jack with storage notification',
                        'Jack can then access Canvas storage data'
                    ]
                };
                
                res.json(storageDetail);
            } catch (error) {
                console.error('Canvas storage detail endpoint error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Canvas storage sync endpoint - for Canvas to provide storage data on-demand
        this.app.post('/jack/canvas-storage-sync', (req, res) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
            
            try {
                const { localStorage, indexedDB, source } = req.body;
                
                // Store the provided data temporarily (replaces previous data)
                this.canvasLocalStorage = localStorage || {};
                this.canvasIndexedDB = indexedDB || {};
                this.lastCanvasPingTime = new Date().toISOString();
                this.canvasDataFreshFlag = true;
                
                // Add to ping history
                if (!this.canvasPingHistory) this.canvasPingHistory = [];
                this.canvasPingHistory.push({
                    timestamp: this.lastCanvasPingTime,
                    event: 'storage_sync',
                    source: source || 'canvas',
                    type: 'data_update'
                });
                
                // Keep only last 50 ping records
                if (this.canvasPingHistory.length > 50) {
                    this.canvasPingHistory = this.canvasPingHistory.slice(-50);
                }
                
                console.log(`\x1b[96m📊 Canvas storage synced: ${Object.keys(localStorage || {}).length} localStorage keys, ${Object.keys(indexedDB || {}).length} IndexedDB stores\x1b[0m`);
                
                res.json({ 
                    success: true, 
                    message: 'Storage data synced successfully',
                    storedKeys: Object.keys(localStorage || {}),
                    storedStores: Object.keys(indexedDB || {})
                });
                
            } catch (error) {
                console.error('Canvas storage sync error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Auto-Edit Mode toggle endpoint - Simple binary on/off
        this.app.post('/jack/auto-accept', (req, res) => {
            const { setting } = req.body;
            
            if (setting === 'on') {
                this.autoAcceptEdits = true;
                console.log(`\x1b[92m🤖 Auto-Edit Mode ENABLED - Edits will be applied automatically\x1b[0m`);
                res.json({ 
                    success: true, 
                    autoAcceptEdits: true,
                    mode: 'AUTO',
                    message: 'Auto-Edit Mode enabled - all edits applied automatically'
                });
            } else if (setting === 'off') {
                this.autoAcceptEdits = false;
                console.log(`\x1b[93m👤 Manual Mode ENABLED - Edits require approval (Accept/Reject/Refactor)\x1b[0m`);
                res.json({ 
                    success: true, 
                    autoAcceptEdits: false,
                    mode: 'MANUAL',
                    message: 'Manual Mode enabled - edits require approval (Accept/Reject/Refactor)'
                });
            } else if (setting === 'status') {
                // Return current status without changing it
                const currentMode = this.autoAcceptEdits ? 'AUTO' : 'MANUAL';
                const description = this.autoAcceptEdits 
                    ? 'All edits applied automatically' 
                    : 'Edits require approval (Accept/Reject/Refactor)';
                    
                res.json({ 
                    success: true, 
                    autoAcceptEdits: this.autoAcceptEdits,
                    mode: currentMode,
                    message: `Current mode: ${currentMode} - ${description}`
                });
            } else {
                res.status(400).json({ 
                    success: false, 
                    error: 'Invalid setting. Use "on" (auto-edit), "off" (manual), or "status"' 
                });
            }
        });

        // GET endpoint for auto-accept status (P2 fix)
        this.app.get('/jack/auto-accept', (req, res) => {
            const currentMode = this.autoAcceptEdits ? 'AUTO' : 'MANUAL';
            const description = this.autoAcceptEdits 
                ? 'All edits applied automatically' 
                : 'Edits require approval (Accept/Reject/Refactor)';
                
            res.json({ 
                success: true, 
                autoAcceptEdits: this.autoAcceptEdits,
                mode: currentMode,
                message: `Current mode: ${currentMode} - ${description}`
            });
        });

        // Terminal windows toggle endpoint
        this.app.post('/jack/terminal-windows', (req, res) => {
            const { setting } = req.body;
            
            if (setting === 'on' || setting === 'off') {
                this.showTerminalWindows = (setting === 'on');
                const modeName = this.showTerminalWindows ? 'Terminal Windows ON' : 'Terminal Windows OFF';
                const description = this.showTerminalWindows 
                    ? 'Terminal commands will show in popup windows'
                    : 'Terminal commands will run silently';
                
                console.log(`🖥️ ${modeName}: ${description}`);
                
                res.json({ 
                    success: true, 
                    showTerminalWindows: this.showTerminalWindows,
                    mode: modeName,
                    message: `Terminal windows ${setting.toUpperCase()}: ${description}`
                });
            } else {
                res.status(400).json({ 
                    success: false, 
                    message: 'Invalid setting. Use "on" or "off"' 
                });
            }
        });

        // GET endpoint for terminal windows status
        this.app.get('/jack/terminal-windows', (req, res) => {
            const currentMode = this.showTerminalWindows ? 'ON' : 'OFF';
            const description = this.showTerminalWindows 
                ? 'Terminal commands show in popup windows' 
                : 'Terminal commands run silently';
                
            res.json({ 
                success: true, 
                showTerminalWindows: this.showTerminalWindows,
                mode: currentMode,
                message: `Terminal windows: ${currentMode} - ${description}`
            });
        });

        // Token budget toggle endpoint
        this.app.post('/jack/token-budget', (req, res) => {
            const { setting } = req.body;
            
            if (setting === 'on' || setting === 'off') {
                this.tokenCountingEnabled = (setting === 'on');
                const modeName = this.tokenCountingEnabled ? 'Token Budget ON' : 'Token Budget OFF';
                const description = this.tokenCountingEnabled 
                    ? 'Token budget monitoring active - provides awareness, no truncation'
                    : 'Token budget monitoring disabled';
                
                console.log(`🧮 ${modeName}: ${description}`);
                
                res.json({ 
                    success: true, 
                    tokenCountingEnabled: this.tokenCountingEnabled,
                    mode: modeName,
                    message: `Token budget ${setting.toUpperCase()}: ${description}`
                });
            } else {
                res.status(400).json({ 
                    success: false, 
                    message: 'Invalid setting. Use "on" or "off"' 
                });
            }
        });

        // GET endpoint for token budget status
        this.app.get('/jack/token-budget', (req, res) => {
            const currentMode = this.tokenCountingEnabled ? 'ON' : 'OFF';
            const description = this.tokenCountingEnabled 
                ? 'Token budget monitoring active - provides awareness, no truncation' 
                : 'Token budget monitoring disabled';
                
            res.json({ 
                success: true, 
                tokenCountingEnabled: this.tokenCountingEnabled,
                mode: currentMode,
                budgets: this.tokenBudgets,
                currentTokenCount: this.currentTokenCount,
                message: `Token budget: ${currentMode} - ${description}`
            });
        });

        // Debug mode toggle endpoint
        this.app.post('/jack/debug', (req, res) => {
            const { mode } = req.body;
            if (mode === 'on') {
                this.debugMode = true;
                console.log('[HIJACKER] Debug mode enabled');
                res.json({ success: true, debugMode: true, message: 'Debug mode enabled' });
            } else if (mode === 'off') {
                this.debugMode = false;
                console.log('[HIJACKER] Debug mode disabled');
                res.json({ success: true, debugMode: false, message: 'Debug mode disabled' });
            } else {
                res.status(400).json({ success: false, error: 'Invalid mode. Use "on" or "off"' });
            }
        });

        // Set current model endpoint
        this.app.post('/api/model', (req, res) => {
            const { model } = req.body;
            if (model) {
                const previousModel = this.currentModel;
                this.currentModel = model;
                console.log(`[HIJACKER] Model switched to: ${model}`);
                
                // Log model switch
                this.logTraffic({
                    type: 'model_switch',
                    method: 'POST',
                    endpoint: '/api/model',
                    status: 'success',
                    source: 'API',
                    previousModel: previousModel,
                    newModel: model,
                    timestamp: new Date().toISOString()
                });
                
                res.json({ success: true, currentModel: this.currentModel });
            } else {
                res.status(400).json({ error: 'Model name required' });
            }
        });

        // Get current model endpoint
        this.app.get('/api/model', (req, res) => {
            res.json({ currentModel: this.currentModel });
        });

        // Activity endpoint for Jack Perspective Mode
        this.app.get('/activity', (req, res) => {
            try {
                const recentActivity = this.sessionMemory.getRecentActivity(50); // Get last 50 activities
                const currentTasks = this.sessionMemory.getCurrentTasks();
                const toolCallStats = this.sessionMemory.getToolCallStats();
                
                // Debug logging for perspective mode
                const toolCallCount = recentActivity.toolCalls ? recentActivity.toolCalls.length : 0;
                if (toolCallCount > 0 && this.debugMode) {
                    console.log(`[DEBUG] Activity endpoint: returning ${toolCallCount} tool calls`);
                }
                
                res.json({
                    success: true,
                    toolCalls: recentActivity.toolCalls || [],
                    tasks: currentTasks || [],
                    stats: toolCallStats || {},
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error fetching activity:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch activity data',
                    toolCalls: [],
                    tasks: [],
                    stats: {}
                });
            }
        });

        // Dynamic mode switching endpoint
        this.app.post('/hijack/switch-mode', async (req, res) => {
            const { mode } = req.body;
            
            if (!['local', 'cloud'].includes(mode)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid mode. Use "local" or "cloud"' 
                });
            }

            try {
                console.log(`[HIJACKER] 🔄 Dynamic mode switch requested: ${mode}`);
                
                // Update environment variable
                process.env.MODE = mode;
                
                // Reinitialize Ollama connection
                await this.setupOllama();
                
                // Clear current model since it may not be valid in new mode
                this.currentModel = null;
                
                console.log(`[HIJACKER] ✅ Successfully switched to ${mode} mode`);
                
                res.json({ 
                    success: true, 
                    mode: mode,
                    message: `Successfully switched to ${mode} mode`
                });
                
            } catch (error) {
                console.log(`[HIJACKER] ❌ Failed to switch mode: ${error.message}`);
                res.status(500).json({ 
                    success: false, 
                    error: `Failed to switch mode: ${error.message}` 
                });
            }
        });

        // Get available models
        this.app.get('/api/models', async (req, res) => {
            try {
                // Wait for Ollama setup to complete
                await this.setupOllamaPromise;
                
                const models = await this.ollama.list();
                const isCloud = process.env.OLLAMA_API_KEY ? true : false;
                
                // For cloud models, ensure they have the proper naming format
                let processedModels = models.models || [];
                if (isCloud) {
                    processedModels = processedModels.map(model => {
                        // If model name doesn't end with -cloud, add it
                        const modelName = model.name || model;
                        const displayName = modelName.endsWith('-cloud') ? modelName.slice(0, -6) : modelName;
                        const apiName = modelName.endsWith('-cloud') ? modelName : `${modelName}-cloud`;
                        
                        return {
                            ...model,
                            name: displayName,        // For display in Rich CLI
                            apiName: apiName,         // For API calls
                            displayName: displayName,
                            fullName: apiName
                        };
                    });
                }
                
                res.json({
                    models: processedModels,
                    mode: isCloud ? 'cloud' : 'local'
                });
            } catch (error) {
                console.log('Error fetching models:', error.message);
                res.status(500).json({ 
                    error: 'Failed to fetch models',
                    message: error.message 
                });
            }
        });

        // Main hijack endpoint - OpenAI compatible
        this.app.post('/v1/chat/completions', async (req, res) => {
            const startTime = Date.now();
            
            // Log incoming request
            this.logTraffic({
                type: 'request',
                method: 'POST',
                endpoint: '/v1/chat/completions',
                status: 'received',
                timestamp: new Date().toISOString(),
                source: 'IDE'
            });
            
            try {
                const { model, messages, stream = false } = req.body;
                
                // Track user message in session memory
                if (messages && messages.length > 0) {
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage.role === 'user') {
                        this.sessionMemory.trackConversation('user_message', lastMessage.content);
                        
                        // Detect user intent from the current message
                        this.sessionMemory.updateUserIntent(lastMessage.content);
                    }
                }
                
                // Use the requested model or fall back to current model
                const requestedModel = model || this.currentModel;
                if (!this.currentModel && model) {
                    this.currentModel = model; // Set current model if not set
                }
                
                // For cloud models, ensure we use the proper API name with -cloud suffix
                let activeModel = requestedModel;
                
                // Use unified cloud mode detection
                if (this.isCloudMode() && requestedModel && !requestedModel.endsWith('-cloud')) {
                    // Add -cloud suffix for cloud mode (let users specify full names if needed)
                    activeModel = `${requestedModel}-cloud`;
                    console.log(`[HIJACKER] Using cloud model: ${activeModel} (from ${requestedModel})`);
                } else {
                    console.log(`[HIJACKER] Using local model: ${activeModel}`);
                }

                // Add enhanced system message with session memory context
                const baseSystemContent = `You are an AI assistant with full workspace control through an interactive terminal interface. You have these capabilities:

🔧 AVAILABLE TOOLS:
- Execute terminal commands
- Read, write, and modify files  
- Search through code
- Git operations
- Directory exploration
- Workspace analysis

� CRITICAL WORKSPACE RULES:
1. ALWAYS start by using list_directory to discover actual files in the workspace
2. NEVER assume file paths - only work with files that actually exist
3. Use Windows-style paths (backslashes) when on Windows systems
4. Before any file operation, verify the file exists with list_directory or read_file
5. When given vague requests, explore the workspace structure first to understand the project

�💬 INTERACTION STYLE:
- Always explain what you're doing and why
- Before making changes, describe your plan clearly
- When proposing file edits, explain the purpose and impact
- Be conversational and helpful, like a collaborative coding partner

🔧 TOOL USAGE RULES:
- show_file_diff: Requires filePath AND newContent parameters (not command/cwd)
- execute_terminal_command: Use for git commands, shell operations (requires command parameter)
- read_file: Only needs filePath parameter
- For git diff operations: Use execute_terminal_command with "git diff" command, NOT show_file_diff
- Never mix parameters from different tools

🎯 EDIT WORKFLOW:
- File modifications require user approval (accept/reject/refactor)
- Explain each edit's purpose and expected outcome
- Show content previews for proposed changes
- Terminal commands execute immediately but explain the reasoning

✂️ CRITICAL EDITING PROTOCOL (SURGICAL EDITS):
1. **ALWAYS read the file first** - No exceptions! Edit tools fail without recent file read
2. **Find the EXACT section** to change (10-20 lines with surrounding context)
3. **Include surrounding context** in old_string for uniqueness
4. **Make ONE small change at a time** - Never modify entire files
5. **Verify the result** by reading the file again after edit approval

Example Surgical Edit:
\`\`\`
Step 1: read_file({ filePath: "server.js" })
Step 2: Identify exact section with context:
  old_string: "const port = 3000;\\n\\napp.listen(port, () => {"
  new_string: "const port = process.env.PORT || 3000;\\n\\napp.listen(port, () => {"
Step 3: After approval, verify with read_file again
\`\`\`

❌ NEVER DO THIS:
- Write entire file content when you just need to change one line
- Edit without reading the file first
- Assume edits succeeded without checking
- Make multiple unrelated changes in one edit

💭 MANDATORY COMMENTARY PROTOCOL:
**AFTER EVERY tool execution, you MUST use the commentary tool to:**
1. **Observe what actually happened** (success/failure)
2. **Check for errors or unexpected outcomes**
3. **Verify changes were applied correctly**
4. **Decide next action based on reality, not assumptions**

After write_file/surgical_edit tools:
  - commentary({ channel: "learning", content: "Edit tool returned: [result]. Let me verify by reading the file..." })

After execute_terminal_command:
  - commentary({ channel: "meta", content: "Command output shows: [observation]. This means..." })

After read_file (before editing):
  - commentary({ channel: "planning", content: "I see [what] on line [X]. I'll change just that section..." })

When you see lastEditDecision in tool results:
  - If decision === "rejected": commentary({ channel: "safety", content: "User REJECTED my edit. I need to try a different approach..." })
  - If decision === "refactored": commentary({ channel: "collaboration", content: "User wants me to change: [userFeedback]. I'll adjust my approach..." })
  - If decision === "accepted": commentary({ channel: "meta", content: "Edit was accepted and applied. Verified successfully." })

**The commentary chain IS your intelligence** - each observation informs the next action!

🔍 WORKSPACE DISCOVERY PROTOCOL:
When receiving any task:
1. First, run list_directory to see what files exist
2. If analyzing code, use search_code to find relevant patterns
3. Only then proceed with actual file operations
4. Work with real files, not imaginary ones

Always be thorough in explanations and proactive in suggesting improvements!`;

                // Add workspace context to base system content
                const workspaceEnhancedContent = baseSystemContent + `\n\n🏠 WORKSPACE & OPERATING SYSTEM CONTEXT:
- Current workspace: ${this.workspaceRoot}
- Operating System: ${osAwareness.osInfo.name} ${osAwareness.osInfo.version} (${osAwareness.osInfo.arch})
- Platform Family: ${osAwareness.osInfo.family}
- Shell Environment: ${osAwareness.shellInfo.name} (${osAwareness.shellInfo.type})

📋 OPERATING SYSTEM SPECIFICS:
- Path Separator: "${osAwareness.osInfo.pathSeparator}" (use ${osAwareness.osInfo.pathSeparator === '\\' ? 'backslashes' : 'forward slashes'} for file paths)
- File Listing: Use "${osAwareness.commandMappings['ls']}" command
- File Copy: Use "${osAwareness.commandMappings['cp']}" command
- File Delete: Use "${osAwareness.commandMappings['rm']}" command
- Directory Creation: Use "${osAwareness.commandMappings['mkdir']}" command
- Clear Screen: Use "${osAwareness.commandMappings['clear']}" command
- Process List: Use "${osAwareness.commandMappings['ps']}" command
- Find Command: Use "${osAwareness.commandMappings['which']}" command

🔧 DEVELOPMENT TOOLS AVAILABLE:
- Node.js: node
- Package Manager: npm
- Python: ${osAwareness.osInfo.isWindows ? 'python' : 'python3'}
- Package Installer: ${osAwareness.osInfo.isWindows ? 'pip' : 'pip3'}
- Git: git
- Text Editor: ${osAwareness.osInfo.isWindows ? 'notepad' : 'nano'}

⚠️ IMPORTANT OS-SPECIFIC RULES:
${osAwareness.getOSNotes().map(note => `- ${note}`).join('\n')}

💡 COMMAND ADAPTATION:
- All commands will be automatically adapted for your OS (${osAwareness.osInfo.name})
- File paths will be converted to use the correct separator (${osAwareness.osInfo.pathSeparator})
- Environment variables will use the correct syntax (${osAwareness.osInfo.isWindows ? '%VAR%' : '$VAR'})
- Invalid commands for this OS will be automatically suggested with alternatives`;
                
                // Enhance system message with session memory context
                let enhancedSystemContent = this.sessionMemory.getEnhancedSystemPrompt(workspaceEnhancedContent);
                
                // Optional Canvas integration - add Canvas context if available
                if (this.canvasIntegrationEnabled) {
                    const canvasContext = this.buildCanvasContext();
                    enhancedSystemContent += `\n\n📊 CANVAS INTEGRATION ACTIVE:\n${canvasContext}`;
                }
                
                const systemMessage = {
                    role: 'system',
                    content: enhancedSystemContent
                };

                const enhancedMessages = [systemMessage, ...messages];

                // Check if this model supports tools (DeepSeek uses OpenAI-compatible format)
                const supportsTools = true; // DeepSeek officially supports OpenAI-compatible tool calling
                const toolsToUse = supportsTools ? this.tools : undefined;

                if (stream) {
                    res.setHeader('Content-Type', 'text/plain');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');

                    let response;
                    let hadToolCalls = false;
                    let totalContent = '';
                    
                    try {
                        // TOKEN BUDGET MONITORING - No Truncation, Use Constrain System Instead
                        const tokenCheck = await this.checkTokenBudget(enhancedMessages, toolsToUse, activeModel);
                        let messagesToUse = enhancedMessages;
                        
                        if (!tokenCheck.withinBudget) {
                            logger.warn(`Token budget warning: ${tokenCheck.estimatedTokens}/${tokenCheck.threshold} (${tokenCheck.usage}%) for ${activeModel}`);
                            logger.info(`Consider using constrain tools to manage information flow instead of truncation`);
                            // NO TRUNCATION - Let the constrain system handle information management
                        } else {
                            logger.debug(`Token budget OK: ${tokenCheck.estimatedTokens}/${tokenCheck.threshold} tokens (${tokenCheck.usage}%) for ${activeModel}`);
                        }
                        
                        response = await this.ollama.chat({
                            model: activeModel,
                            messages: messagesToUse,
                            tools: toolsToUse,
                            stream: true
                        });
                        
                    } catch (chatError) {
                        // Track failed request
                        this.trackModelUsage(activeModel, true, chatError.message, 0);
                        
                        // Log failed API call attempt
                        this.logDebug({
                            type: 'api_call',
                            message: `Chat completion failed (streaming): ${chatError.message}`,
                            model: requestedModel,
                            success: false,
                            tokens: { total: 0, prompt: 0, completion: 0 }
                        });
                        
                        // Log streaming error
                        this.logDebug({
                            type: 'error',
                            message: `Chat completion failed (streaming): ${chatError.message}`,
                            model: requestedModel
                        });
                        
                        this.logTraffic({
                            type: 'request',
                            status: 'error',
                            error: chatError.message,
                            model: requestedModel,
                            timestamp: new Date().toISOString()
                        });
                        
                        throw chatError;
                    }

                    for await (const part of response) {
                        if (part.message?.tool_calls) {
                            hadToolCalls = true;
                            // Execute tool calls (skip commentary tools in streaming)
                            const executableToolCalls = part.message.tool_calls.filter(toolCall => 
                                toolCall.function.name !== 'commentary'
                            );
                            
                            for (const toolCall of executableToolCalls) {
                                this.logTraffic({
                                    type: 'tool_call',
                                    tool: toolCall.function.name,
                                    status: 'executing',
                                    timestamp: new Date().toISOString()
                                });
                                
                                const result = await this.executeTool(toolCall);
                                console.log(`[TOOL] ${toolCall.function.name}:`, result);
                                
                                this.logDebug({
                                    type: 'tool_call',
                                    message: `Tool executed: ${toolCall.function.name}`,
                                    data: { tool: toolCall.function.name, result }
                                });
                            }
                            
                            // Execute commentary tools separately
                            const commentaryToolCalls = part.message.tool_calls.filter(toolCall => 
                                toolCall.function.name === 'commentary'
                            );
                            
                            for (const toolCall of commentaryToolCalls) {
                                try {
                                    await this.executeTool(toolCall);
                                    console.log(`[COMMENTARY] ${toolCall.function.name}: executed`);
                                } catch (toolError) {
                                    console.log(`\x1b[91m❌ Commentary tool execution failed: ${toolCall.function.name} - ${toolError.message}\x1b[0m`);
                                }
                            }
                        }

                        if (part.message?.content) {
                            totalContent += part.message.content;
                        }

                        const chunk = {
                            id: `hijack-${Date.now()}`,
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: requestedModel, // Use display name
                            choices: [{
                                index: 0,
                                delta: { content: part.message?.content || '' },
                                finish_reason: part.done ? 'stop' : null
                            }]
                        };
                        
                        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                        
                        if (part.done) {
                            res.write('data: [DONE]\n\n');
                            break;
                        }
                    }
                    
                    // Track streaming completion
                    const estimatedTokens = Math.ceil(totalContent.length / 4); // rough estimate
                    this.trackModelUsage(activeModel, false, null, estimatedTokens, hadToolCalls);
                    
                    // Track AI response in session memory
                    if (totalContent.trim()) {
                        this.sessionMemory.trackConversation('ai_response', totalContent.trim());
                    }
                    
                    // Log streaming completion
                    const responseTime = Date.now() - startTime;
                    this.logTraffic({
                        type: 'request',
                        status: 'success',
                        responseTime,
                        tokens: estimatedTokens,
                        model: requestedModel,
                        timestamp: new Date().toISOString()
                    });
                    
                    this.logDebug({
                        type: 'api_call',
                        message: 'Chat completion successful (streaming)',
                        model: requestedModel,
                        success: true,
                        tokens: { total: estimatedTokens, prompt: 0, completion: estimatedTokens }
                    });
                    
                    res.end();
                } else {
                    let response;
                    let retryCount = 0;
                    const maxRetries = 3;
                    let chatError;
                    
                    // Retry logic for initial chat completion
                    while (retryCount <= maxRetries) {
                        try {
                            console.log(retryCount > 0 ? `\x1b[93m🔄 Retrying initial chat completion (attempt ${retryCount + 1}/${maxRetries + 1})\x1b[0m` : '');
                            
                            // TOKEN BUDGET MONITORING - No Truncation, Use Constrain System Instead
                            const tokenCheck = await this.checkTokenBudget(enhancedMessages, toolsToUse, activeModel);
                            let messagesToUse = enhancedMessages;
                            
                            if (!tokenCheck.withinBudget) {
                                console.log(`⚠️ Token budget warning: ${tokenCheck.estimatedTokens}/${tokenCheck.threshold} (${tokenCheck.usage}%) for ${activeModel}`);
                                console.log(`💡 Consider using constrain tools to manage information flow instead of truncation`);
                                // NO TRUNCATION - Let the constrain system handle information management
                            } else if (retryCount === 0) { // Only log on first attempt to avoid spam
                                console.log(`✅ Token budget OK: ${tokenCheck.estimatedTokens}/${tokenCheck.threshold} tokens (${tokenCheck.usage}%) for ${activeModel}`);
                            }
                            
                            response = await this.ollama.chat({
                                model: activeModel,
                                messages: messagesToUse,
                                tools: toolsToUse,
                                stream: false
                            });
                            
                            // Success - break out of retry loop
                            chatError = null;
                            break;
                            
                        } catch (error) {
                            chatError = error;
                            retryCount++;
                            
                            // Log each failed attempt as an API call
                            this.logDebug({
                                type: 'api_call',
                                message: `Chat completion attempt ${retryCount}/${maxRetries + 1} failed: ${error.message}`,
                                model: requestedModel,
                                success: false,
                                attempt: retryCount,
                                tokens: { total: 0, prompt: 0, completion: 0 }
                            });
                            
                            console.log(`\x1b[91m⚠️ Initial chat completion failed (attempt ${retryCount}/${maxRetries + 1}): ${error.message}\x1b[0m`);
                            
                            if (retryCount <= maxRetries) {
                                const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000); // Exponential backoff, max 5s
                                console.log(`\x1b[93m⏳ Waiting ${delay}ms before retry...\x1b[0m`);
                                await new Promise(resolve => setTimeout(resolve, delay));
                            }
                        }
                    }
                    
                    if (chatError) {
                        // Track failed request after all retries
                        this.trackModelUsage(activeModel, true, chatError.message, 0);
                        
                        // Log failed API call attempt
                        this.logDebug({
                            type: 'api_call',
                            message: `Chat completion failed after ${maxRetries + 1} attempts: ${chatError.message}`,
                            model: requestedModel,
                            success: false,
                            tokens: { total: 0, prompt: 0, completion: 0 }
                        });
                        
                        // Log non-streaming error
                        this.logDebug({
                            type: 'error',
                            message: `Chat completion failed after ${maxRetries + 1} attempts: ${chatError.message}`,
                            model: requestedModel
                        });
                        
                        this.logTraffic({
                            type: 'request',
                            status: 'error',
                            error: `After ${maxRetries + 1} attempts: ${chatError.message}`,
                            model: requestedModel,
                            timestamp: new Date().toISOString()
                        });
                        
                        throw chatError;
                    }

                    // Handle tool call sequencing
                    let currentMessages = [...enhancedMessages];
                    let finalResponse = response;
                    
                    // Keep executing tool calls until AI gives final response
                    while (finalResponse.message?.tool_calls && finalResponse.message.tool_calls.length > 0) {
                        // Add the AI's message with tool calls to conversation
                        currentMessages.push(finalResponse.message);
                        
                        // Execute all tool calls in this round with error recovery (now includes commentary for sync)
                        const toolResults = [];
                        const executableToolCalls = finalResponse.message.tool_calls; // Process ALL tools consistently
                        
                        for (const toolCall of executableToolCalls) {
                            this.logTraffic({
                                type: 'tool_call',
                                tool: toolCall.function.name,
                                status: 'executing',
                                timestamp: new Date().toISOString()
                            });
                            
                            let result;
                            try {
                                result = await this.executeTool(toolCall);
                                console.log(`[TOOL] ${toolCall.function.name}:`, result);
                            } catch (toolError) {
                                console.log(`\x1b[91m❌ Tool execution failed: ${toolCall.function.name} - ${toolError.message}\x1b[0m`);
                                result = { 
                                    error: `Tool execution failed: ${toolError.message}`,
                                    success: false,
                                    tool: toolCall.function.name
                                };
                            }
                            
                            // Add tool result to conversation
                            currentMessages.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: JSON.stringify(result)
                            });
                            
                            toolResults.push({ toolCall, result });
                            
                            this.logDebug({
                                type: 'tool_call',
                                message: `Tool executed: ${toolCall.function.name}`,
                                data: { tool: toolCall.function.name, result }
                            });
                        }
                        
                        // Commentary tools are now handled with regular tools above to maintain sync
                        // (Removed separate commentary processing to prevent tool call/result mismatch)
                        
                        // Get AI's next response with tool results with retry logic
                        let retryCount = 0;
                        const maxRetries = 3;
                        let chatError;
                        
                        while (retryCount <= maxRetries) {
                            try {
                                console.log(retryCount > 0 ? `\x1b[93m🔄 Retrying chat completion (attempt ${retryCount + 1}/${maxRetries + 1})\x1b[0m` : '');
                                
                                finalResponse = await this.ollama.chat({
                                    model: activeModel,
                                    messages: currentMessages,
                                    tools: toolsToUse,
                                    stream: false
                                });
                                
                                // Success - break out of retry loop
                                chatError = null;
                                break;
                                
                            } catch (error) {
                                chatError = error;
                                retryCount++;
                                
                                console.log(`\x1b[91m⚠️ Tool follow-up failed (attempt ${retryCount}/${maxRetries + 1}): ${error.message}\x1b[0m`);
                                
                                if (retryCount <= maxRetries) {
                                    const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000); // Exponential backoff, max 5s
                                    console.log(`\x1b[93m⏳ Waiting ${delay}ms before retry...\x1b[0m`);
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                }
                            }
                        }
                        
                        if (chatError) {
                            // Track failed follow-up request after all retries
                            const hasToolCalls = finalResponse?.message?.tool_calls && finalResponse.message.tool_calls.length > 0;
                            this.trackModelUsage(activeModel, true, chatError.message, 0, hasToolCalls);
                            
                            // Log follow-up error
                            this.logDebug({
                                type: 'error',
                                message: `Follow-up chat completion failed after ${maxRetries + 1} attempts: ${chatError.message}`,
                                model: requestedModel
                            });
                            
                            this.logTraffic({
                                type: 'request',
                                status: 'error',
                                error: `After ${maxRetries + 1} attempts: ${chatError.message}`,
                                model: requestedModel,
                                timestamp: new Date().toISOString()
                            });
                            
                            throw chatError;
                        }
                    }

                    // Extract actual token counts from final response
                    const promptTokens = finalResponse.prompt_eval_count || 0;
                    const completionTokens = finalResponse.eval_count || 0;
                    const totalTokens = promptTokens + completionTokens;

                    // Allow longer responses for comprehensive analysis and tool chain workflows
                    // Only truncate truly excessive responses that would overwhelm the terminal
                    const MAX_RESPONSE_LENGTH = 15000; // Increased from 2000 to allow proper analysis
                    let wasTruncated = false;
                    
                    if (responseContent.length > MAX_RESPONSE_LENGTH) {
                        // Try to truncate at a natural break point (sentence, paragraph, etc.)
                        let truncateAt = MAX_RESPONSE_LENGTH;
                        
                        // Look for paragraph break within last 200 chars
                        const paragraphBreak = responseContent.lastIndexOf('\n\n', MAX_RESPONSE_LENGTH);
                        if (paragraphBreak > MAX_RESPONSE_LENGTH - 200) {
                            truncateAt = paragraphBreak;
                        } else {
                            // Look for sentence break
                            const sentenceBreak = responseContent.lastIndexOf('. ', MAX_RESPONSE_LENGTH);
                            if (sentenceBreak > MAX_RESPONSE_LENGTH - 100) {
                                truncateAt = sentenceBreak + 1;
                            }
                        }
                        
                        responseContent = responseContent.substring(0, truncateAt) + '\n\n[Response truncated for brevity]';
                        wasTruncated = true;
                        console.log(`\x1b[93m📝 Response truncated from ${finalResponse.message.content.length} to ${responseContent.length} characters\x1b[0m`);
                    }

                    const openaiResponse = {
                        id: `hijack-${Date.now()}`,
                        object: 'chat.completion',
                        created: Math.floor(Date.now() / 1000),
                        model: requestedModel, // Use display name for response
                        choices: [{
                            index: 0,
                            message: {
                                role: 'assistant',
                                content: responseContent
                            },
                            finish_reason: wasTruncated ? 'length' : 'stop'
                        }],
                        usage: {
                            prompt_tokens: promptTokens,
                            completion_tokens: completionTokens,
                            total_tokens: totalTokens
                        }
                    };
                    
                    // Track final token usage for this conversation
                    const hadToolCalls = currentMessages.some(msg => msg.role === 'tool');
                    this.trackModelUsage(activeModel, false, null, totalTokens, hadToolCalls);
                    
                    // Log successful response
                    const responseTime = Date.now() - startTime;
                    this.logTraffic({
                        type: 'request',
                        status: 'success',
                        responseTime,
                        tokens: totalTokens,
                        model: requestedModel, // Use display name for logging
                        timestamp: new Date().toISOString()
                    });
                    
                    this.logDebug({
                        type: 'api_call',
                        message: 'Chat completion successful',
                        model: requestedModel, // Use display name for logging
                        success: true,
                        tokens: { total: totalTokens, prompt: promptTokens, completion: completionTokens }
                    });
                    
                    // Track AI response in session memory
                    if (responseContent && responseContent.trim()) {
                        this.sessionMemory.trackConversation('ai_response', responseContent.trim());
                    }
                    
                    res.json(openaiResponse);
                }
            } catch (error) {
                console.error('[HIJACK ERROR]:', error);
                
                // Determine if this was a tool call request
                const { messages } = req.body;
                const hasToolCalls = messages && messages.some(msg => 
                    msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0
                );
                
                // Track the error for the model - use activeModel if it was set
                const requestedModel = req.body.model || this.currentModel;
                let modelToTrack = requestedModel;
                
                // Apply same logic as above to get the actual model name used
                if (requestedModel) {
                    if (this.isCloudMode() && !requestedModel.endsWith('-cloud')) {
                        modelToTrack = `${requestedModel}-cloud`;
                    }
                    this.trackModelUsage(modelToTrack, true, error.message, 0, hasToolCalls);
                }
                
                // Log error
                const responseTime = Date.now() - startTime;
                this.logTraffic({
                    type: 'request',
                    method: 'POST',
                    endpoint: '/v1/chat/completions',
                    status: 'error',
                    responseTime,
                    timestamp: new Date().toISOString()
                });
                
                this.logDebug({
                    type: 'error',
                    message: `Hijacking failed: ${error.message}`,
                    data: { error: error.message }
                });
                
                res.status(500).json({ error: 'Hijacking failed', details: error.message });
            }
        });

        // Direct tool execution endpoint
        this.app.post('/hijack/execute', async (req, res) => {
            try {
                const { tool, args } = req.body;
                const toolCall = {
                    function: { name: tool, arguments: args }
                };
                
                const result = await this.executeTool(toolCall);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    async start() {
        console.log('[DEBUG] Starting hijacker setup...');
        // Ensure Ollama is set up before starting the server
        try {
            console.log('[DEBUG] Waiting for Ollama setup...');
            await this.setupOllamaPromise;
            console.log('[DEBUG] Ollama setup completed successfully');
        } catch (error) {
            console.error('[HIJACKER] Failed to setup Ollama:', error);
            process.exit(1);
        }
        
        console.log('[DEBUG] Starting Express server...');
        
        // Return a promise that resolves when server is ready
        return new Promise((resolve) => {
            this.app.listen(this.port, '127.0.0.1', () => {
                console.log(`[DEBUG] Server listening on port ${this.port}`);
                const isGlobalHijack = this.targetWorkspace && this.targetWorkspace !== process.cwd();
                const workspaceDisplay = isGlobalHijack ? 
                    `${path.basename(this.workspaceRoot)} (GLOBAL)` : 
                    path.basename(this.workspaceRoot);
                
                // Show compact status instead of huge banner to reduce visual noise
                const modeDisplay = (process.env.MODE === 'cloud' && !process.env.OLLAMA_HOST?.includes('localhost')) ? '☁️ CLOUD' : '🏠 LOCAL';
                console.log(`\n🦙⚡ Ollama Jack ready - ${modeDisplay} mode - Port ${this.port} - Workspace: ${workspaceDisplay}`);
                console.log(`🎯 Ready to help! Use Rich CLI for commands or chat here.\n`);
                
                // Start interactive chat mode (skip in server-only mode to keep server running)
                if (!this.serverOnly && !this.debugMode) {
                    setTimeout(() => {
                        this.startInteractiveChat();
                        // Also launch Rich CLI automatically for full experience
                        setTimeout(() => {
                            this.launchRichCLI();
                        }, 2000);
                    }, 1000);
                } else {
                    console.log('\n\x1b[93m[SERVER] Skipping interactive chat mode - server running for API/CLI integration\x1b[0m');
                }
                
                // Keep the event loop alive
                setInterval(() => {}, 1000);
                console.log('[DEBUG] Event loop keeper started');
                
                resolve(); // Resolve when server is ready
            });
        });
    }





    setupInstantKeypress(rl) {
        // Store reference to the readline interface
        this.rl = rl;
        this.isProcessingInstantKey = false;
        
        // Enable raw mode for instant keypress detection
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        
        // Store original readline data handler
        this.originalDataHandler = null;
        
        // Handle instant keypresses when there's a pending edit
        const keypressHandler = async (key) => {
            // Only process if we have a pending edit and aren't already processing
            if (!this.pendingEdit || this.isProcessingInstantKey) {
                return;
            }
            
            // Check for 1, 2, 3 keypresses
            if (key === '1' || key === '2' || key === '3') {
                this.isProcessingInstantKey = true;
                
                // Clear the current line and show the action
                process.stdout.write('\r\x1b[K'); // Clear line
                
                // Clear any buffered input to prevent the keypress from reaching readline
                if (this.rl && this.rl.line !== undefined) {
                    this.rl.line = '';
                    this.rl.cursor = 0;
                    this.rl._refreshLine();
                }
                
                switch (key) {
                    case '1':
                        console.log(`\x1b[92m⚡ [1] ACCEPT - Processing edit ${this.pendingEdit}...\x1b[0m`);
                        const acceptSuccess = await this.editController.acceptEdit(this.pendingEdit);

                        // FEEDBACK LOOP: Store the decision for Jack to see
                        this.lastEditDecision = {
                            editId: this.pendingEdit,
                            decision: 'accepted',
                            success: acceptSuccess,
                            timestamp: Date.now()
                        };

                        if (acceptSuccess) {
                            console.log(`\x1b[92m✅ Edit applied successfully! Continuing tool chain...\x1b[0m\n`);
                        } else {
                            console.log(`\x1b[91m❌ Failed to apply edit\x1b[0m\n`);
                        }
                        break;

                    case '2':
                        console.log(`\x1b[91m⚡ [2] REJECT - Rejecting edit ${this.pendingEdit}...\x1b[0m`);
                        const rejectSuccess = await this.editController.rejectEdit(this.pendingEdit, 'User rejected via instant keypress');

                        // FEEDBACK LOOP: Store the rejection for Jack to see
                        this.lastEditDecision = {
                            editId: this.pendingEdit,
                            decision: 'rejected',
                            success: rejectSuccess,
                            reason: 'User rejected via instant keypress',
                            timestamp: Date.now()
                        };

                        if (rejectSuccess) {
                            console.log(`\x1b[91m❌ Edit rejected! Continuing tool chain...\x1b[0m\n`);
                        } else {
                            console.log(`\x1b[91m❌ Failed to reject edit\x1b[0m\n`);
                        }
                        break;
                        
                    case '3':
                        console.log(`\x1b[94m⚡ [3] REFACTOR - Enter changes for edit ${this.pendingEdit}:\x1b[0m`);

                        // STOP SPINNER to prevent interference with input
                        this.stopSpinner();

                        // Temporarily disable raw mode for text input
                        process.stdin.setRawMode(false);
                        rl.question('\x1b[94m🔧 Refactor changes: \x1b[0m', async (refactorChanges) => {
                            if (refactorChanges.trim()) {
                                const oldEditId = this.pendingEdit;
                                const newEditId = await this.editController.refactorEdit(this.pendingEdit, refactorChanges.trim());

                                // FEEDBACK LOOP: Store the refactor request for Jack to see
                                this.lastEditDecision = {
                                    editId: oldEditId,
                                    decision: 'refactored',
                                    success: !!newEditId,
                                    userFeedback: refactorChanges.trim(),
                                    newEditId: newEditId,
                                    timestamp: Date.now()
                                };

                                if (newEditId) {
                                    console.log(`\x1b[96m🔧 Edit refactored successfully! New edit ID: ${newEditId}\x1b[0m`);
                                    console.log(`\x1b[93m💡 Press [1] Accept, [2] Reject, [3] Refactor for the new edit\x1b[0m\n`);
                                    this.pendingEdit = newEditId;
                                } else {
                                    console.log(`\x1b[91m❌ Failed to refactor edit\x1b[0m\n`);
                                    this.pendingEdit = null;
                                }
                            } else {
                                console.log(`\x1b[91m❌ No changes specified, edit unchanged\x1b[0m\n`);
                            }

                            // Re-enable raw mode
                            process.stdin.setRawMode(true);

                            // RESTART SPINNER after refactor input is complete
                            this.startSpinner('Processing...', rl);

                            this.isProcessingInstantKey = false;
                            this.continuePendingToolChain();
                        });
                        return; // Don't continue processing yet
                }
                
                // Clear pending edit and continue tool chain
                this.pendingEdit = null;
                this.isProcessingInstantKey = false;
                this.continuePendingToolChain();
            }
        };
        
        // Attach the keypress handler
        process.stdin.on('data', keypressHandler);
    }

    // Helper method to detect thinking/deliberation responses
    isThinkingResponse(content) {
        if (!content) return false;
        
        // FIXED: Don't treat JSON responses or planning content as thinking responses
        // Only treat explicit thinking tags as thinking responses
        if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
            return false; // JSON responses are not thinking responses
        }
        
        // Check for explicit thinking tags only (not planning content)
        const thinkingPatterns = [
            /^<think>/i,       // Only if it starts with thinking tags
            /^<thinking>/i,    // Only if it starts with thinking tags  
            /^<deliberate>/i   // Only if it starts with deliberate tags
        ];
        
        return thinkingPatterns.some(pattern => pattern.test(content.trim()));
    }

    continuePendingToolChain() {
        // Resume any paused tool execution
        if (this.pausedToolChainResolver) {
            const resolver = this.pausedToolChainResolver;
            this.pausedToolChainResolver = null;
            resolver();
        }
    }
    
    startInteractiveChat() {
        const readline = require('readline');
        
        console.log('\n');
        console.log('\x1b[96m#########################################################################\x1b[0m');
        console.log('\x1b[93m🦙⚡            JACK\'S DIRECT CHAT MODE ACTIVE            ⚡🦙\x1b[0m');
        console.log('\x1b[96m#########################################################################\x1b[0m');
        console.log('');
        console.log('\x1b[91m      +-------------------------------------------------------------+\x1b[0m');
        console.log('\x1b[91m        │\x1b[0m \x1b[93m� DIRECT AI INTERFACE ACTIVE\x1b[0m                     \x1b[91m│\x1b[0m');
        console.log('\x1b[91m      |\x1b[0m \x1b[92mReal-time workspace manipulation enabled\x1b[0m            \x1b[91m|\x1b[0m');
        console.log('\x1b[91m        │\x1b[0m \x1b[94m� All communications intercepted & logged\x1b[0m       \x1b[91m│\x1b[0m');
        console.log('\x1b[91m        │\x1b[0m                                                   \x1b[91m│\x1b[0m');
        console.log('\x1b[91m        |\x1b[0m \x1b[41m\x1b[97m[!] NEURAL COMMANDS: help | paste | tools | status | exit [!]\x1b[0m \x1b[91m|\x1b[0m');
        console.log('\x1b[91m      +-------------------------------------------------------------+\x1b[0m');
        console.log('');
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '\x1b[92m👤 User >\x1b[0m '
        });

        // Set up instant keypress detection for edit control
        this.setupInstantKeypress(rl);
        
        const processCommand = async (command) => {
            
            if (command === '') {
                rl.prompt();
                return;
            }
            
            // Detect pasted content (contains newlines or is very long)
            const isPastedContent = command.includes('\n') || command.length > 500;
            if (isPastedContent && !command.toLowerCase().startsWith('paste')) {
                console.log('\x1b[93m📋 Detected pasted content! Processing as clipboard input...\x1b[0m');
                console.log(`\x1b[90m   📊 Detected: ${command.length} characters, ${command.split('\n').length} lines\x1b[0m`);
                console.log('\n\x1b[96m🤖 Processing pasted content with AI...\x1b[0m\n');
                // Process as if it was from clipboard
            }
            
            if (command.toLowerCase() === 'exit') {
                console.log('\n🛑 Exiting interactive chat...');
                rl.close();
                process.exit(0);
                return;
            }
            
            if (command.toLowerCase() === 'help') {
                console.log('\n\x1b[93m📋 AVAILABLE COMMANDS:\x1b[0m');
                console.log('\x1b[96m  • Any natural language request (AI will use tools as needed)\x1b[0m');
                console.log('\n\x1b[95m⚡ INSTANT EDIT COMMANDS (when edit is pending):\x1b[0m');
                console.log('\x1b[92m  • Press [1] - Instantly accept the proposed edit (no Enter needed)\x1b[0m');
                console.log('\x1b[91m  • Press [2] - Instantly reject the proposed edit (no Enter needed)\x1b[0m');
                console.log('\x1b[94m  • Press [3] - Instantly refactor the edit (prompts for changes)\x1b[0m');
                console.log('\n\x1b[96m🔧 SYSTEM COMMANDS:\x1b[0m');
                console.log('\x1b[92m  • "tools" - List available tools\x1b[0m');
                console.log('\x1b[92m  • "status" - Show system status\x1b[0m');
                console.log('\x1b[92m  • "clear" - Clear screen\x1b[0m');
                console.log('\x1b[95m  • "edits" - Show pending edits\x1b[0m');
                console.log('\x1b[94m  • "paste" - Process content from clipboard (bypasses terminal limits)\x1b[0m');
                console.log('\x1b[93m💡 Use Rich CLI for system commands (auto-accept, models, usage, etc.)\x1b[0m');
                console.log('\n\x1b[90m📝 LEGACY EDIT COMMANDS (still supported):\x1b[0m');
                console.log('\x1b[90m  • "accept <edit_id>" - Accept a specific edit\x1b[0m');
                console.log('\x1b[90m  • "reject <edit_id>" - Reject a specific edit\x1b[0m');
                console.log('\x1b[90m  • "refactor <edit_id> <changes>" - Modify specific edit\x1b[0m');
                console.log('\x1b[90m  • "batch start <description>" - Start edit batch\x1b[0m');
                console.log('\x1b[90m  • "auto-accept on/off" - Toggle automatic edit approval (legacy)\x1b[0m'); 
                console.log('\n\x1b[91m  • "exit" - Exit chat mode\x1b[0m');
                console.log('');
                rl.prompt();
                return;
            }
            
            if (command.toLowerCase() === 'tools') {
                console.log('\n🔧 AVAILABLE TOOLS:');
                this.tools.forEach(tool => {
                    console.log(`  • ${tool.function.name} - ${tool.function.description}`);
                });
                console.log('');
                rl.prompt();
                return;
            }
            
            if (command.toLowerCase() === 'status') {
                const editStats = this.editController.getEditStats();
                console.log('\n\x1b[93m📊 SYSTEM STATUS:\x1b[0m');
                console.log(`\x1b[96m  • Mode: ${process.env.OLLAMA_API_KEY ? 'CLOUD' : 'LOCAL'}\x1b[0m`);
                console.log(`\x1b[96m  • Current Model: ${this.currentModel || 'none selected'}\x1b[0m`);
                console.log(`\x1b[96m  • Port: ${this.port}\x1b[0m`);
                console.log(`\x1b[96m  • Workspace: ${this.workspaceRoot}\x1b[0m`);
                console.log(`\x1b[96m  • Active Terminals: ${this.activeTerminals.size}\x1b[0m`);
                console.log(`\x1b[96m  • API Key: ${process.env.OLLAMA_API_KEY ? '✅ Configured' : '❌ Missing'}\x1b[0m`);
                console.log(`\x1b[93m  • Edit Mode: ${this.autoAcceptEdits ? '🤖 AUTO (edits applied automatically)' : '👤 MANUAL (Accept/Reject/Refactor) ← DEFAULT'}\x1b[0m`);
                console.log(`\x1b[94m  • Pending Edit: ${this.pendingEdit ? `✅ ${this.pendingEdit} (use [1][2][3])` : '❌ None'}\x1b[0m`);
                console.log(`\x1b[95m  • Edit Stats: ${editStats.pending} pending, ${editStats.applied} applied, ${editStats.rejected} rejected\x1b[0m`);
                console.log('');
                rl.prompt();
                return;
            }
            
            if (command.toLowerCase() === 'clear') {
                console.clear();
                console.log('🤖 AI Hijacker Chat - Screen Cleared\n');
                rl.prompt();
                return;
            }
            
            if (command.toLowerCase() === 'paste') {
                console.log('\x1b[96m📋 Paste command detected, reading from clipboard...\x1b[0m');
                try {
                    console.log('\x1b[90m[DEBUG] Clipboardy object:', typeof clipboardy, Object.keys(clipboardy || {}), '\x1b[0m');
                    console.log('\x1b[90m[DEBUG] Attempting to read clipboard...\x1b[0m');
                    
                    // Try different clipboardy methods for ES module compatibility
                    let clipboardContent;
                    if (clipboardy.default && typeof clipboardy.default.read === 'function') {
                        clipboardContent = await clipboardy.default.read();
                    } else if (clipboardy.default && typeof clipboardy.default === 'function') {
                        clipboardContent = await clipboardy.default();
                    } else if (typeof clipboardy.read === 'function') {
                        clipboardContent = await clipboardy.read();
                    } else if (typeof clipboardy === 'function') {
                        clipboardContent = await clipboardy();
                    } else {
                        throw new Error('Clipboardy API not available - ES module issue');
                    }
                    
                    console.log('\x1b[90m[DEBUG] Clipboard read successful, length:', clipboardContent.length, '\x1b[0m');
                    
                    if (!clipboardContent || clipboardContent.trim() === '') {
                        console.log('\x1b[93m⚠️  Clipboard is empty or contains no text\x1b[0m');
                        console.log('\x1b[93m💡 Copy some text to your clipboard first, then type "paste"\x1b[0m');
                        console.log('');
                        rl.prompt();
                        return;
                    }
                    
                    const contentLength = clipboardContent.length;
                    const wordCount = clipboardContent.split(/\s+/).length;
                    const lineCount = clipboardContent.split('\n').length;
                    
                    console.log(`\x1b[92m✅ Clipboard content loaded successfully!\x1b[0m`);
                    console.log(`\x1b[90m   📊 Stats: ${contentLength} characters, ${wordCount} words, ${lineCount} lines\x1b[0m`);
                    console.log(`\x1b[90m   📄 Preview: ${clipboardContent.substring(0, 200)}${contentLength > 200 ? '...' : ''}\x1b[0m`);
                    console.log('\n\x1b[96m🤖 Processing clipboard content with AI...\x1b[0m\n');
                    
                    // Process the clipboard content as if it was typed
                    await processCommand(clipboardContent);
                    return;
                    
                } catch (error) {
                    console.log(`\x1b[91m❌ Failed to read clipboard: ${error.message}\x1b[0m`);
                    console.log('\x1b[93m💡 Make sure you have copied something to your clipboard first\x1b[0m');
                    console.log('');
                    rl.prompt();
                    return;
                }
            }
            
            // Edit control commands
            if (command.toLowerCase() === 'edits') {
                this.editController.displayPendingEdits();
                const stats = this.editController.getEditStats();
                console.log(`\x1b[93m📊 Edit Stats: ${stats.pending} pending, ${stats.applied} applied, ${stats.rejected} rejected\x1b[0m`);
                console.log('');
                rl.prompt();
                return;
            }
            
            // Note: 1/2/3 instant keypress handling is done via setupInstantKeypress method
            
            if (command.toLowerCase().startsWith('accept ')) {
                const editId = command.slice(7).trim();
                const success = await this.editController.acceptEdit(editId);
                if (success) {
                    console.log(`\x1b[92m✅ Edit ${editId} has been applied to the workspace\x1b[0m`);
                } else {
                    console.log(`\x1b[91m❌ Failed to apply edit ${editId}\x1b[0m`);
                }
                console.log('');
                rl.prompt();
                return;
            }
            
            if (command.toLowerCase().startsWith('reject ')) {
                const parts = command.slice(7).trim().split(' ');
                const editId = parts[0];
                const reason = parts.slice(1).join(' ') || 'User rejected';
                const success = await this.editController.rejectEdit(editId, reason);
                if (success) {
                    console.log(`\x1b[91m❌ Edit ${editId} has been rejected\x1b[0m`);
                }
                console.log('');
                rl.prompt();
                return;
            }
            
            if (command.toLowerCase().startsWith('refactor ')) {
                const parts = command.slice(9).trim().split(' ');
                const editId = parts[0];
                const modifications = parts.slice(1).join(' ');
                
                if (!modifications) {
                    console.log(`\x1b[91m❌ Please specify what changes to make: refactor ${editId} <changes>\x1b[0m`);
                    console.log(`\x1b[93m💡 Example: refactor ${editId} use different variable name\x1b[0m`);
                } else {
                    const newEditId = await this.editController.refactorEdit(editId, modifications);
                    if (newEditId) {
                        console.log(`\x1b[96m🔧 Edit refactored successfully! New edit ID: ${newEditId}\x1b[0m`);
                        console.log(`\x1b[93m💡 You can now accept, reject, or refactor the new edit\x1b[0m`);
                    }
                }
                console.log('');
                rl.prompt();
                return;
            }
            
            if (command.toLowerCase() === 'auto-accept on') {
                this.autoAcceptEdits = true;
                console.log(`\x1b[92m✅ Auto-accept mode enabled - edits will be applied automatically\x1b[0m`);
                console.log(`\x1b[93m💡 Use 'auto-accept off' to disable\x1b[0m\n`);
                rl.prompt();
                return;
            }
            
            if (command.toLowerCase() === 'auto-accept off') {
                this.autoAcceptEdits = false;
                console.log(`\x1b[91m⏸️  Auto-accept mode disabled - manual approval required\x1b[0m`);
                console.log(`\x1b[93m💡 Use 'auto-accept on' to enable\x1b[0m\n`);
                rl.prompt();
                return;
            }
            
            if (command.toLowerCase().startsWith('batch start ')) {
                const description = command.slice(12).trim();
                const batchId = this.editController.startEditBatch(description);
                console.log(`\x1b[95m📦 Edit batch started: ${batchId}\x1b[0m`);
                console.log('');
                rl.prompt();
                return;
            }
            
            // Process AI request
            let chatStartTime;
            try {
                this.startSpinner('AI analyzing and executing request', rl);
                
                // Record telemetry for chat request start
                chatStartTime = Date.now();
                const initialModel = this.currentModel || 'unknown-model';
                if (this.telemetryManager) {
                    this.telemetryManager.recordChatRequest(command.length, initialModel);
                }
                
                this.logTraffic({
                    type: 'request',
                    method: 'CHAT',
                    endpoint: 'interactive',
                    status: 'received',
                    timestamp: new Date().toISOString(),
                    source: 'Terminal Chat',
                    responseTime: 0,  // Will be updated on response
                    bytes: command.length
                });
                
                // Use appropriate model name based on mode
                let chatModel = this.currentModel;
                if (!chatModel) {
                    // If no current model is set, try to get the first available model
                    try {
                        const models = await this.ollama.list();
                        chatModel = models.models?.[0]?.name || 'unknown-model';
                        this.debugLog(`Auto-selected first available model: ${chatModel}`);
                    } catch (error) {
                        this.debugLog(`Could not list models for auto-selection: ${error.message}`);
                        chatModel = 'unknown-model';
                    }
                }
                
                // Only add -cloud suffix if we're in cloud mode (not using localhost)
                if (this.isCloudMode() && !chatModel.endsWith('-cloud')) {
                    chatModel = `${chatModel}-cloud`;
                }
                
                // Debug: Log the model being used
                console.log(`\x1b[90m[DEBUG] Using model for chat: ${chatModel}\x1b[0m`);
                console.log(`\x1b[90m[DEBUG] API Host: ${this.ollama.config?.host || 'undefined'}\x1b[0m`);
                console.log(`\x1b[90m[DEBUG] API Key present: ${process.env.OLLAMA_API_KEY ? 'Yes' : 'No'}\x1b[0m`);
                console.log(`\x1b[90m[DEBUG] About to make chat API call...\x1b[0m`);
                console.log(`\x1b[90m[DEBUG] Model: ${chatModel}\x1b[0m`);
                // Removed early currentMessages.length access - will log after initialization
                
                // Check if this model supports tools (DeepSeek uses OpenAI-compatible format)
                const supportsTools = true; // DeepSeek officially supports OpenAI-compatible tool calling
                const toolsToUse = supportsTools ? this.tools : undefined;
                
                let systemContent;
                // CRITICAL FIX: Include session memory context in interactive chat
                const baseSystemContent = `You are an AI assistant with full workspace control through an interactive terminal interface. You have these capabilities:

🔧 AVAILABLE TOOLS:
- Execute terminal commands
- Read, write, and modify files  
- Search through code
- Git operations
- Directory exploration
- Workspace analysis

💬 INTERACTION STYLE:
- Always explain what you're doing and why
- Before making changes, describe your plan clearly
- When proposing file edits, explain the purpose and impact
- Ask for clarification when requests are ambiguous
- Be conversational and helpful, like a collaborative coding partner

🎯 EDIT WORKFLOW:
- File modifications require user approval (accept/reject/refactor)
- Explain each edit's purpose and expected outcome
- Show content previews for proposed changes
- Terminal commands execute immediately but explain the reasoning

📋 CURRENT SESSION:
- Workspace: ${this.workspaceRoot}
- Mode: Interactive terminal with edit control
- Your role: Helpful coding assistant with full workspace access

🏠 OPERATING SYSTEM CONTEXT:
- OS: ${osAwareness.osInfo.name} ${osAwareness.osInfo.version} (${osAwareness.osInfo.arch})
- Shell: ${osAwareness.shellInfo.name}
- Path Separator: "${osAwareness.osInfo.pathSeparator}"
- Available Commands: ${osAwareness.commandMappings['ls']}, ${osAwareness.commandMappings['cp']}, ${osAwareness.commandMappings['rm']}, etc.

⚠️ OS-SPECIFIC RULES:
${osAwareness.getOSNotes().map(note => `- ${note}`).join('\n')}

Always be thorough in explanations and proactive in suggesting improvements!`;

                // AUTO-TASK DETECTION: Analyze user input and create tasks automatically
                const detectedTasks = this.sessionMemory.analyzeAndCreateTasks(command);
                if (detectedTasks.length > 0) {
                    console.log(`\x1b[94m📋 Auto-created ${detectedTasks.length} task(s) from your request\x1b[0m`);

                    // Show active task count
                    const totalTasks = this.sessionMemory.getCurrentTasks().length;
                    const progress = this.sessionMemory.getTaskProgress();
                    console.log(`\x1b[96m📊 Active Tasks: ${totalTasks} total, ${progress.inProgress} in progress, ${progress.completed} completed\x1b[0m`);
                }

                // Enhance system message with session memory context (includes task info)
                systemContent = this.sessionMemory.getEnhancedSystemPrompt(baseSystemContent);

                let currentMessages = [
                    {
                        role: 'system',
                        content: systemContent
                    },
                    {
                        role: 'user',
                        content: command
                    }
                ];

                console.log(`[DEBUG] About to make chat API call...`);
                console.log(`[DEBUG] Model: ${chatModel}`);
                console.log(`[DEBUG] Message count: ${currentMessages.length}`);
                console.log(`[DEBUG] Tools count: ${this.tools.length}`);
                console.log(`[DEBUG] Ollama config:`, {
                    host: this.ollama.config?.host,
                    port: this.ollama.config?.port,
                    headers: this.ollama.config?.headers ? Object.keys(this.ollama.config.headers) : 'none'
                });
                
                let finalResponse;
                let retryCount = 0;
                const maxRetries = 3;
                let apiError;
                
                // Retry logic for interactive chat
                while (retryCount <= maxRetries) {
                    try {
                        console.log(retryCount > 0 ? `\x1b[93m🔄 Retrying interactive chat (attempt ${retryCount + 1}/${maxRetries + 1})\x1b[0m` : '');
                        
                        finalResponse = await this.ollama.chat({
                            model: chatModel,
                            messages: currentMessages,
                            tools: toolsToUse,
                            stream: false
                        });
                        
                        console.log(`[DEBUG] Chat API call successful`);
                        
                        // Debug: Log response structure
                        if (this.debugMode) {
                            console.log(`[DEBUG] debugMode is true, logging response structure`);
                            console.log(`[DEBUG] Response structure:`, {
                                hasPromptEval: 'prompt_eval_count' in finalResponse,
                                hasEval: 'eval_count' in finalResponse,
                                hasUsage: 'usage' in finalResponse,
                                hasTotal: 'total_duration' in finalResponse,
                                promptEval: finalResponse.prompt_eval_count,
                                eval: finalResponse.eval_count,
                                usage: finalResponse.usage,
                                keys: Object.keys(finalResponse)
                            });
                        } else {
                            console.log(`[DEBUG] debugMode is false`);
                        }
                        
                        // Extract token counts - handle both Ollama and OpenAI formats
                        let promptTokens = 0;
                        let completionTokens = 0;
                        
                        if (finalResponse.usage) {
                            // OpenAI-compatible format (cloud)
                            promptTokens = finalResponse.usage.prompt_tokens || 0;
                            completionTokens = finalResponse.usage.completion_tokens || 0;
                        } else {
                            // Ollama format (local)
                            promptTokens = finalResponse.prompt_eval_count || 0;
                            completionTokens = finalResponse.eval_count || 0;
                        }
                        
                        const totalTokens = promptTokens + completionTokens;
                        
                        apiError = null;
                        break;
                        
                    } catch (error) {
                        apiError = error;
                        retryCount++;
                        
                        console.log(`\x1b[91m⚠️ Interactive chat failed (attempt ${retryCount}/${maxRetries + 1}): ${error.message}\x1b[0m`);
                        console.log(`[DEBUG] Error details:`, {
                            name: error.name,
                            message: error.message,
                            status: error.status,
                            response: error.response
                        });
                        
                        if (retryCount <= maxRetries) {
                            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
                            console.log(`\x1b[93m⏳ Waiting ${delay}ms before retry...\x1b[0m`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    }
                }
                
                if (apiError) {
                    this.debugLog(`All retry attempts failed. Final error details:`, 'ERROR');
                    this.debugLog(`Error name: ${apiError.name}`, 'ERROR');
                    this.debugLog(`Error message: ${apiError.message}`, 'ERROR');
                    this.debugLog(`Error stack: ${apiError.stack?.split('\n').slice(0, 3).join('; ')}`, 'ERROR');
                    this.debugLog(`Error response: ${apiError.response ? JSON.stringify(apiError.response) : 'none'}`, 'ERROR');
                    this.debugLog(`Error status: ${apiError.status || 'none'}`, 'ERROR');
                    this.debugLog(`Error cause: ${apiError.cause || 'none'}`, 'ERROR');
                    throw apiError;
                }
                
                // Handle tool call sequencing - including thinking responses
                while (finalResponse.message?.tool_calls && finalResponse.message.tool_calls.length > 0 ||
                       this.isThinkingResponse(finalResponse.message?.content)) {
                    
                    // Handle thinking responses that don't have tool calls yet
                    if (this.isThinkingResponse(finalResponse.message?.content) && 
                        (!finalResponse.message?.tool_calls || finalResponse.message.tool_calls.length === 0)) {
                        
                        console.log('\x1b[95m🤔 AI is deliberating...\x1b[0m');
                        
                        // Show the thinking content
                        if (finalResponse.message?.content) {
                            this.stopSpinner();
                            console.log('\x1b[96m🦙 JACK:\x1b[0m');
                            console.log(this.formatResponse(finalResponse.message.content));
                            console.log('');
                        }
                        
                        // Add thinking response to conversation
                        currentMessages.push(finalResponse.message);
                        
                        // Continue conversation to get actual tool calls
                        console.log('\x1b[93m🔄 Continuing after deliberation...\x1b[0m\n');
                        
                        try {
                            finalResponse = await this.ollama.chat({
                                model: chatModel,
                                messages: currentMessages,
                                tools: toolsToUse,
                                stream: false
                            });
                            continue; // Continue the loop to check for tool calls
                        } catch (error) {
                            console.log(`\x1b[91m❌ Failed to continue after thinking: ${error.message}\x1b[0m`);
                            break;
                        }
                    }
                    
                    // Process normal tool calls
                    if (finalResponse.message?.tool_calls && finalResponse.message.tool_calls.length > 0) {
                    console.log('\n🔧 Executing tools...\n');
                    
                    // Update spinner to show tool execution
                    this.updateSpinnerContext('Executing tools...');
                    
                    // Add AI's message with tool calls to conversation
                    currentMessages.push(finalResponse.message);
                    
                    // Show what AI wants to do before executing
                    console.log('\x1b[96m🤖 AI Plan:\x1b[0m');
                    for (const toolCall of finalResponse.message.tool_calls) {
                        const args = toolCall.function.arguments;
                        switch (toolCall.function.name) {
                            case 'list_directory':
                                console.log(`   📁 Exploring directory: ${args.dirPath || 'root'}`);
                                break;
                            case 'read_file':
                                console.log(`   📄 Reading file: ${args.filePath}`);
                                break;
                            case 'write_file':
                                console.log(`   ✏️  Writing to file: ${args.filePath}`);
                                console.log(`   📝 Content preview: ${args.content.substring(0, 100)}${args.content.length > 100 ? '...' : ''}`);
                                break;
                            case 'execute_terminal_command':
                                console.log(`   💻 Running command: ${args.command}`);
                                if (args.cwd) console.log(`      In directory: ${args.cwd}`);
                                break;
                            case 'search_code':
                                console.log(`   🔍 Searching for: ${args.pattern}`);
                                if (args.fileTypes) console.log(`      File types: ${args.fileTypes.join(', ')}`);
                                break;
                            case 'grep_search':
                                console.log(`   🔍 Grep search: ${args.pattern}`);
                                if (args.filePath) console.log(`      File: ${args.filePath}`);
                                if (args.isRegex) console.log(`      Regex: ${args.isRegex}`);
                                if (args.contextLines) console.log(`      Context: ${args.contextLines} lines`);
                                break;
                            case 'git_operations':
                                console.log(`   🔗 Git operation: ${args.operation}`);
                                break;
                            default:
                                console.log(`   🔧 ${toolCall.function.name}: ${JSON.stringify(args).substring(0, 100)}`);
                        }
                    }
                    console.log('');
                    
                    // Execute tool calls one by one, pausing for edit approvals
                    for (const toolCall of finalResponse.message.tool_calls) {
                        this.logTraffic({
                            type: 'tool_call',
                            tool: toolCall.function.name,
                            status: 'executing',
                            timestamp: new Date().toISOString()
                        });
                        
                        const result = await this.executeTool(toolCall);
                        
                        if (result.editProposed) {
                            // Get detailed edit information
                            const editDetails = await this.editController.getEditDetails(result.editId);
                            
                            console.log(`\x1b[93m� EDIT PROPOSAL #${result.editId}\x1b[0m`);
                            console.log(`\x1b[96m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
                            console.log(`\x1b[95m🎯 Operation:\x1b[0m ${result.operation}`);
                            
                            if (result.description.filePath) {
                                console.log(`\x1b[95m📁 File:\x1b[0m ${result.description.filePath}`);
                            }
                            
                            if (result.description.command) {
                                console.log(`\x1b[95m💻 Command:\x1b[0m ${result.description.command}`);
                                if (result.description.cwd) {
                                    console.log(`\x1b[95m� Directory:\x1b[0m ${result.description.cwd}`);
                                }
                            }
                            
                            if (result.description.content) {
                                console.log(`\x1b[95m📄 Content Preview:\x1b[0m`);
                                const preview = result.description.content.length > 300 
                                    ? result.description.content.substring(0, 300) + '\n\x1b[90m... (truncated)\x1b[0m'
                                    : result.description.content;
                                console.log(`\x1b[90m${preview}\x1b[0m`);
                            }
                            
                            console.log(`\x1b[96m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
                            console.log(`\x1b[92m[1] ✅ ACCEPT\x1b[0m | \x1b[91m[2] ❌ REJECT\x1b[0m | \x1b[94m[3] 🔧 REFACTOR\x1b[0m`);
                            console.log('');
                            
                            if (this.autoAcceptEdits) {
                                // Auto-Edit Mode: Apply edit automatically
                                console.log(`\x1b[96m🤖 AUTO-EDIT MODE: Applying edit automatically...\x1b[0m`);
                                const accepted = await this.editController.acceptEdit(result.editId);
                                if (accepted) {
                                    console.log(`\x1b[92m✅ Edit ${result.editId} applied successfully (Auto-Edit Mode)\x1b[0m\n`);
                                } else {
                                    console.log(`\x1b[91m❌ Failed to apply edit ${result.editId} (Auto-Edit Mode)\x1b[0m\n`);
                                }
                            } else {
                                // Manual Mode: Require approval
                                this.pendingEdit = result.editId;
                                
                                console.log(`\x1b[93m👤 MANUAL MODE: Edit requires approval\x1b[0m`);
                                console.log(`\x1b[96m💡 Press [1] to Accept, [2] to Reject, or [3] to Refactor this edit (no Enter needed)\x1b[0m`);
                                console.log(`\x1b[90mℹ️  Or use Rich CLI command 'auto-accept on' to enable Auto-Edit Mode\x1b[0m\n`);
                                
                                // Wait for instant keypress via Promise
                                await new Promise((resolve) => {
                                    this.pausedToolChainResolver = resolve;
                                });
                            }
                        } else {
                            console.log(`🔹 ${toolCall.function.name}: ${result.success ? '✅ Success' : '❌ Failed'}`);
                            console.log(''); // Add blank line for better spacing
                            if (result.stdout) {
                                const output = result.stdout.length > 300 
                                    ? result.stdout.substring(0, 300) + '\n\x1b[90m... (output truncated)\x1b[0m'
                                    : result.stdout;
                                console.log(`\x1b[90m${output}\x1b[0m`);
                            }
                            if (result.error) console.log(`   \x1b[91mError: ${result.error}\x1b[0m`);
                        }
                        
                        // Add tool result to conversation - include ALL tools for proper synchronization
                        currentMessages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(result)
                        });
                        
                        this.logDebug({
                            type: 'tool_call',
                            message: `Tool executed: ${toolCall.function.name}`,
                            data: { tool: toolCall.function.name, result }
                        });
                    }
                    
                    console.log('');
                    
                    // Get AI's next response with tool results (with retry logic)
                    let followUpRetryCount = 0;
                    const followUpMaxRetries = 3;
                    let followUpError;
                    
                    while (followUpRetryCount <= followUpMaxRetries) {
                        try {
                            console.log(followUpRetryCount > 0 ? `\x1b[93m🔄 Retrying tool follow-up (attempt ${followUpRetryCount + 1}/${followUpMaxRetries + 1})\x1b[0m` : '');
                            
                            finalResponse = await this.ollama.chat({
                                model: chatModel,
                                messages: currentMessages,
                                tools: toolsToUse,
                                stream: false
                            });
                            
                            followUpError = null;
                            break;
                            
                        } catch (error) {
                            followUpError = error;
                            followUpRetryCount++;
                            
                            console.log(`\x1b[91m⚠️ Tool follow-up failed (attempt ${followUpRetryCount}/${followUpMaxRetries + 1}): ${error.message}\x1b[0m`);
                            
                            if (followUpRetryCount <= followUpMaxRetries) {
                                const delay = Math.min(1000 * Math.pow(2, followUpRetryCount - 1), 5000);
                                console.log(`\x1b[93m⏳ Waiting ${delay}ms before retry...\x1b[0m`);
                                await new Promise(resolve => setTimeout(resolve, delay));
                            }
                        }
                    }
                    
                    if (followUpError) {
                        console.log(`\x1b[91m❌ All tool follow-up attempts failed: ${followUpError.message}\x1b[0m`);
                        console.log(`\x1b[96m🔧 Tool synchronization issue detected - this is a known cloud API issue\x1b[0m`);
                        console.log(`\x1b[93m💡 Suggestion: Try switching to a different model (use 'next' or 'prev' in Rich CLI)\x1b[0m`);
                        
                        // Provide a fallback response instead of throwing
                        this.stopSpinner();
                        console.log(`\x1b[96m🦙 JACK:\x1b[0m`);

                        // Show what tools were executed
                        const executedTools = currentMessages
                            .filter(msg => msg.role === 'tool')
                            .map(msg => {
                                const toolData = JSON.parse(msg.content);
                                return toolData.tool || 'unknown';
                            });

                        if (executedTools.length > 0) {
                            // Use formatResponse to handle line breaks properly
                            const fallbackMessage = `Tools executed successfully but API follow-up failed. Here's what was accomplished:\n\n✅ **Successfully executed:** ${executedTools.join(', ')}\n\nThe analysis results are available even though follow-up messaging failed.\n\n💡 This appears to be a compatibility issue with the ${chatModel} model.`;
                            console.log(this.formatResponse(fallbackMessage));
                            
                            // CRITICAL FIX: Create a fallback response and save to memory so Jack remembers his work
                            const fallbackResponse = `I executed the following tools successfully: ${executedTools.join(', ')}.\n\nThe analysis results are available even though there was an API synchronization issue.\n\nThis appears to be a compatibility issue with the ${chatModel} model.`;
                            
                            // Save this fallback response to memory
                            const allToolCalls = currentMessages
                                .filter(msg => msg.role === 'assistant' && msg.tool_calls)
                                .flatMap(msg => msg.tool_calls || [])
                                .map(tc => ({
                                    function: tc.function,
                                    result: currentMessages
                                        .find(msg => msg.role === 'tool' && msg.tool_call_id === tc.id)?.content
                                }));

                            this.sessionMemory.addConversationTurn(
                                command, 
                                fallbackResponse, 
                                allToolCalls
                            );
                        }
                        
                        // Don't throw the error, continue execution
                        break; // Exit the tool call loop
                    }
                    } // End of tool calls processing
                } // End of while loop
                
                // FIXED: After tool execution, request final explanation/summary if none provided
                const hasToolResults = currentMessages.some(msg => msg.role === 'tool');
                const hasExplanation = finalResponse.message?.content && 
                    finalResponse.message.content.trim().length > 0 &&
                    !finalResponse.message.content.trim().startsWith('{');
                
                if (hasToolResults && !hasExplanation) {
                    console.log('\x1b[93m🔄 Requesting final explanation...\x1b[0m');
                    
                    // Add a message to request final explanation
                    currentMessages.push({
                        role: 'user',
                        content: 'Please provide a comprehensive summary and explanation of what you discovered and accomplished with the tools you just executed.'
                    });
                    
                    try {
                        const explanationResponse = await this.ollama.chat({
                            model: chatModel,
                            messages: currentMessages,
                            tools: toolsToUse,
                            stream: false
                        });
                        
                        // Use the explanation response as the final response
                        finalResponse = explanationResponse;
                    } catch (error) {
                        console.log(`\x1b[91m⚠️ Failed to get final explanation: ${error.message}\x1b[0m`);
                        // Continue with existing response
                    }
                }
                
                // Show AI response with proper formatting
                if (finalResponse.message?.content) {
                    this.stopSpinner();
                    console.log('\x1b[96m🦙 JACK:\x1b[0m');
                    
                    // IMPROVED: Handle JSON responses from AI properly
                    let displayContent = finalResponse.message.content;
                    
                    // Check if response is JSON and extract content appropriately
                    if (displayContent.trim().startsWith('{') && displayContent.trim().endsWith('}')) {
                        try {
                            const jsonResponse = JSON.parse(displayContent);
                            if (jsonResponse.channel === 'planning' && jsonResponse.content) {
                                console.log('\x1b[95m📋 AI Plan:\x1b[0m');
                                displayContent = jsonResponse.content;
                            } else if (jsonResponse.content) {
                                displayContent = jsonResponse.content;
                            }
                        } catch (e) {
                            // Not valid JSON, display as is
                        }
                    }
                    
                    // Use the centralized formatter for consistent line breaks
                    console.log(this.formatResponse(displayContent));
                    console.log('');
                }
                
                // Extract token counts from final response
                const promptTokens = finalResponse.prompt_eval_count || 0;
                const completionTokens = finalResponse.eval_count || 0;
                const totalTokens = promptTokens + completionTokens;
                const chatDuration = Date.now() - chatStartTime;

                // CRITICAL FIX: Save conversation turn to memory with all tool calls
                const allToolCalls = currentMessages
                    .filter(msg => msg.role === 'assistant' && msg.tool_calls)
                    .flatMap(msg => msg.tool_calls || [])
                    .map(tc => ({
                        function: tc.function,
                        result: currentMessages
                            .find(msg => msg.role === 'tool' && msg.tool_call_id === tc.id)?.content
                    }));

                this.sessionMemory.addConversationTurn(
                    command, 
                    finalResponse.message?.content || '', 
                    allToolCalls
                );

                // Record telemetry for chat completion
                if (this.telemetryManager) {
                    this.telemetryManager.recordChatResponse(chatDuration, totalTokens, finalResponse.message?.tool_calls?.length || 0);
                }

                this.logTraffic({
                    type: 'request',
                    method: 'CHAT',
                    endpoint: 'interactive',
                    status: 'success',
                    timestamp: new Date().toISOString(),
                    responseTime: chatDuration,
                    bytes: totalTokens * 4  // Rough estimate of bytes
                });
                
            } catch (error) {
                // Stop spinner on error
                this.stopSpinner();

                // Record telemetry for chat error
                const chatDuration = Date.now() - chatStartTime;
                if (this.telemetryManager) {
                    this.telemetryManager.recordChatError(chatDuration, error.message);
                }

                console.log(`❌ Error: ${error.message}\n`);
                console.log(`\x1b[90m[DEBUG] Full error details:\x1b[0m`);
                console.log(`\x1b[90m  Error type: ${error.constructor.name}\x1b[0m`);
                console.log(`\x1b[90m  Error code: ${error.code || 'N/A'}\x1b[0m`);
                console.log(`\x1b[90m  Status: ${error.status || 'N/A'}\x1b[0m`);
                console.log(`\x1b[90m  Response: ${error.response?.data ? JSON.stringify(error.response.data) : 'N/A'}\x1b[0m`);
                console.log(`\x1b[90m  Using model: ${this.currentModel || 'No model set'}\x1b[0m`);
                console.log(`\x1b[90m  API Key set: ${process.env.OLLAMA_API_KEY ? 'Yes' : 'No'}\x1b[0m\n`);
                
                this.logTraffic({
                    type: 'request',
                    method: 'CHAT',
                    endpoint: 'interactive',
                    status: 'error',
                    timestamp: new Date().toISOString(),
                    error: error.message,
                    responseTime: chatDuration,
                    bytes: 0
                });
            }
            
            rl.prompt();
        };
        
        rl.prompt();
        
        rl.on('line', async (input) => {
            const command = input.trim();
            await processCommand(command);
        });
        
        rl.on('close', () => {
            console.log('\n🛑 Chat mode ended. Hijacker still active for IDE integration.');
        });
    }

    // Launch Rich CLI automatically for full user experience
    launchRichCLI() {
        console.log('\n\x1b[94m🎮 Launching Rich CLI for system control...\x1b[0m');
        
        const richCLIPath = path.join(__dirname, 'rich-cli.js');
        
        // Platform-specific Rich CLI launching
        if (process.platform === 'win32') {
            // Windows: Open new command window
            const cmd = `start cmd /c "node \\"${richCLIPath}\\" && pause"`;
            exec(cmd, { cwd: process.cwd() }, (error) => {
                if (error) {
                    console.error('\x1b[91m❌ Failed to launch Rich CLI window:', error.message, '\x1b[0m');
                }
            });
        } else {
            // Unix: Spawn detached process
            const richCLI = spawn('node', [richCLIPath], {
                detached: true,
                stdio: 'inherit',
                cwd: process.cwd()
            });
            richCLI.unref();
        }
        
        console.log('\x1b[92m✅ Rich CLI launched in background\x1b[0m');
        console.log('\x1b[90m💡 Switch to the Rich CLI window for system commands\x1b[0m\n');
    }

    // Canvas Storage Tool Handlers
    async handleCanvasStorageList(category = 'all') {
        try {
            if (!this.canvasLocalStorage || Object.keys(this.canvasLocalStorage).length === 0) {
                return { 
                    error: "Canvas storage not available. Make sure Canvas is running and connected.",
                    available: false 
                };
            }

            const allKeys = Object.keys(this.canvasLocalStorage);
            
            // Category mapping based on Rich CLI browser
            const categoryMap = {
                'content': (key) => key.includes('canvas_') && (key.includes('document') || key.includes('content')),
                'ai_memory': (key) => key.includes('analysis') || key.includes('memory') || key.includes('ai_'),
                'synthesis': (key) => key.includes('synthesis') || key.includes('report'),
                'djinn': (key) => key.includes('djinn') || key.includes('council'),
                'config': (key) => key.includes('config') || key.includes('settings') || key.includes('preferences'),
                'system': (key) => key.includes('system') || key.includes('state') || key.includes('session'),
                'test': (key) => key.includes('test') || key.includes('debug')
            };

            let filteredKeys;
            if (category === 'all') {
                filteredKeys = allKeys;
            } else if (categoryMap[category]) {
                filteredKeys = allKeys.filter(categoryMap[category]);
            } else {
                return { 
                    error: `Invalid category: ${category}. Valid categories: content, ai_memory, synthesis, djinn, config, system, test, all`,
                    validCategories: Object.keys(categoryMap).concat(['all'])
                };
            }

            return {
                success: true,
                category: category,
                totalKeys: allKeys.length,
                filteredKeys: filteredKeys.length,
                keys: filteredKeys.sort(),
                categorySummary: {
                    content: allKeys.filter(categoryMap.content).length,
                    ai_memory: allKeys.filter(categoryMap.ai_memory).length,
                    synthesis: allKeys.filter(categoryMap.synthesis).length,
                    djinn: allKeys.filter(categoryMap.djinn).length,
                    config: allKeys.filter(categoryMap.config).length,
                    system: allKeys.filter(categoryMap.system).length,
                    test: allKeys.filter(categoryMap.test).length
                }
            };
        } catch (error) {
            return { 
                error: `Failed to list Canvas storage: ${error.message}`,
                details: error.stack 
            };
        }
    }

    async handleCanvasStorageRead(key) {
        try {
            if (!this.canvasLocalStorage || Object.keys(this.canvasLocalStorage).length === 0) {
                return { 
                    error: "Canvas storage not available. Make sure Canvas is running and connected.",
                    available: false 
                };
            }

            if (!key) {
                return { 
                    error: "Key parameter is required. Use canvas_storage_list to see available keys." 
                };
            }

            const value = this.canvasLocalStorage[key];
            if (value === undefined) {
                return { 
                    error: `Key '${key}' not found in Canvas storage`,
                    suggestion: "Use canvas_storage_list to see available keys"
                };
            }

            // Try to parse JSON if it looks like JSON
            let parsedValue = value;
            if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                try {
                    parsedValue = JSON.parse(value);
                } catch (e) {
                    // Keep as string if JSON parsing fails
                }
            }

            return {
                success: true,
                key: key,
                rawValue: value,
                parsedValue: parsedValue,
                type: typeof parsedValue,
                size: typeof value === 'string' ? value.length : JSON.stringify(value).length,
                isJSON: parsedValue !== value
            };
        } catch (error) {
            return { 
                error: `Failed to read Canvas storage key '${key}': ${error.message}`,
                details: error.stack 
            };
        }
    }

    async handleCanvasStorageSearch(searchTerm, searchContent = true) {
        try {
            if (!this.canvasLocalStorage || Object.keys(this.canvasLocalStorage).length === 0) {
                return { 
                    error: "Canvas storage not available. Make sure Canvas is running and connected.",
                    available: false 
                };
            }

            if (!searchTerm) {
                return { 
                    error: "searchTerm parameter is required" 
                };
            }

            const allKeys = Object.keys(this.canvasLocalStorage);
            const searchTermLower = searchTerm.toLowerCase();
            const results = [];

            for (const key of allKeys) {
                const matchInKey = key.toLowerCase().includes(searchTermLower);
                let matchInContent = false;
                let contentMatch = null;

                if (searchContent) {
                    const value = this.canvasLocalStorage[key];
                    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
                    matchInContent = valueStr.toLowerCase().includes(searchTermLower);
                    
                    if (matchInContent) {
                        // Find context around the match
                        const matchIndex = valueStr.toLowerCase().indexOf(searchTermLower);
                        const start = Math.max(0, matchIndex - 50);
                        const end = Math.min(valueStr.length, matchIndex + searchTerm.length + 50);
                        contentMatch = valueStr.substring(start, end);
                        if (start > 0) contentMatch = '...' + contentMatch;
                        if (end < valueStr.length) contentMatch = contentMatch + '...';
                    }
                }

                if (matchInKey || matchInContent) {
                    results.push({
                        key: key,
                        matchInKey: matchInKey,
                        matchInContent: matchInContent,
                        contentPreview: contentMatch,
                        valueSize: typeof this.canvasLocalStorage[key] === 'string' 
                            ? this.canvasLocalStorage[key].length 
                            : JSON.stringify(this.canvasLocalStorage[key]).length
                    });
                }
            }

            return {
                success: true,
                searchTerm: searchTerm,
                searchContent: searchContent,
                totalKeys: allKeys.length,
                matchCount: results.length,
                results: results.sort((a, b) => {
                    // Sort by match in key first, then by key name
                    if (a.matchInKey && !b.matchInKey) return -1;
                    if (!a.matchInKey && b.matchInKey) return 1;
                    return a.key.localeCompare(b.key);
                })
            };
        } catch (error) {
            return { 
                error: `Failed to search Canvas storage: ${error.message}`,
                details: error.stack 
            };
        }
    }

    async handleCanvasStorageStatus() {
        try {
            const isAvailable = !!(this.canvasLocalStorage && Object.keys(this.canvasLocalStorage).length > 0);
            
            if (!isAvailable) {
                return {
                    success: true,
                    canvasConnected: false,
                    storageAvailable: false,
                    message: "Canvas storage not available. Make sure Canvas is running and the ping system is active.",
                    lastPing: this.lastCanvasPing || null
                };
            }

            const allKeys = Object.keys(this.canvasLocalStorage);
            const totalSize = allKeys.reduce((sum, key) => {
                const value = this.canvasLocalStorage[key];
                return sum + (typeof value === 'string' ? value.length : JSON.stringify(value).length);
            }, 0);

            // Get category breakdown
            const categories = {
                content: allKeys.filter(key => key.includes('canvas_') && (key.includes('document') || key.includes('content'))),
                ai_memory: allKeys.filter(key => key.includes('analysis') || key.includes('memory') || key.includes('ai_')),
                synthesis: allKeys.filter(key => key.includes('synthesis') || key.includes('report')),
                djinn: allKeys.filter(key => key.includes('djinn') || key.includes('council')),
                config: allKeys.filter(key => key.includes('config') || key.includes('settings') || key.includes('preferences')),
                system: allKeys.filter(key => key.includes('system') || key.includes('state') || key.includes('session')),
                test: allKeys.filter(key => key.includes('test') || key.includes('debug'))
            };

            return {
                success: true,
                canvasConnected: true,
                storageAvailable: true,
                totalKeys: allKeys.length,
                totalSizeBytes: totalSize,
                totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
                lastPing: this.lastCanvasPing || null,
                lastUpdate: this.canvasDataFreshFlag ? new Date().toISOString() : null,
                categoryBreakdown: {
                    content: categories.content.length,
                    ai_memory: categories.ai_memory.length,
                    synthesis: categories.synthesis.length,
                    djinn: categories.djinn.length,
                    config: categories.config.length,
                    system: categories.system.length,
                    test: categories.test.length,
                    uncategorized: allKeys.length - Object.values(categories).reduce((sum, cat) => sum + cat.length, 0)
                },
                recentKeys: allKeys.slice(-5).reverse(), // Last 5 keys
                canvasDataFresh: this.canvasDataFreshFlag || false
            };
        } catch (error) {
            return { 
                error: `Failed to get Canvas storage status: ${error.message}`,
                details: error.stack 
            };
        }
    }
}

// Start the hijacker
const ollamaJack = new OllamaJack();

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down hijacker...');
    if (ollamaJack && ollamaJack.telemetryManager && typeof ollamaJack.telemetryManager.cleanup === 'function') {
        ollamaJack.telemetryManager.cleanup();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down hijacker...');
    if (ollamaJack && ollamaJack.telemetryManager && typeof ollamaJack.telemetryManager.cleanup === 'function') {
        ollamaJack.telemetryManager.cleanup();
    }
    process.exit(0);
});

ollamaJack.start().then(() => {
    // Server is now running, keep the process alive
    console.log('[INFO] Server started successfully, keeping process alive...');
}).catch(error => {
    console.error('[FATAL] Failed to start hijacker:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
});

module.exports = { OllamaJack, ollamaJack };