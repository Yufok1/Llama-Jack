// session-memory.js - Comprehensive memory system for Jack's conversation context

const fs = require('fs');
const path = require('path');

class SessionMemory {
    constructor(dataDir, workspaceRoot, telemetryManager = null) {
        this.dataDir = dataDir;
        this.workspaceRoot = workspaceRoot;
        this.telemetryManager = telemetryManager;
        this.memoryDir = path.join(dataDir, '.memory');
        this.sessionFile = path.join(this.memoryDir, 'session.json');
        this.contextFile = path.join(this.memoryDir, 'context.json');
        
        this.session = {
            sessionId: this.generateSessionId(),
            startTime: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            conversationHistory: [],
            currentProject: null,
            activeFiles: new Set(),
            toolCallChain: [],
            userIntent: null,
            projectGoals: [],
            recentActions: [],
            contextSummary: ""
        };
        
        this.context = {
            workspace: {
                type: 'unknown',
                language: 'unknown',
                framework: 'unknown',
                structure: {},
                dependencies: {}
            },
            recentEdits: [],
            buildStatus: 'unknown',
            currentTasks: [],
            completedTasks: [],
            knownIssues: [],
            userPreferences: {}
        };
        
        this.ensureMemoryDir();
        this.loadSession();
        this.detectWorkspaceType();
    }
    
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    ensureMemoryDir() {
        if (!fs.existsSync(this.memoryDir)) {
            fs.mkdirSync(this.memoryDir, { recursive: true });
        }
    }
    
    loadSession() {
        try {
            if (fs.existsSync(this.sessionFile)) {
                const saved = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
                // Only load if session is less than 1 hour old
                const sessionAge = Date.now() - new Date(saved.lastActivity).getTime();
                if (sessionAge < 3600000) { // 1 hour
                    this.session = { ...this.session, ...saved };
                    this.session.conversationHistory = saved.conversationHistory || [];
                    this.session.activeFiles = new Set(saved.activeFiles || []);
                    console.log(`[MEMORY] Restored session ${this.session.sessionId.slice(-9)}`);
                }
            }
            
            if (fs.existsSync(this.contextFile)) {
                const saved = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
                this.context = { ...this.context, ...saved };
                console.log(`[MEMORY] Restored workspace context`);
            }
        } catch (error) {
            console.log(`[MEMORY] Failed to load session: ${error.message}`);
        }
    }
    
    saveSession() {
        try {
            this.session.lastActivity = new Date().toISOString();
            
            // Create a serializable copy of the session
            const sessionCopy = {
                ...this.session,
                activeFiles: Array.from(this.session.activeFiles)
            };
            
            fs.writeFileSync(this.sessionFile, JSON.stringify(sessionCopy, null, 2));
            fs.writeFileSync(this.contextFile, JSON.stringify(this.context, null, 2));
        } catch (error) {
            console.log(`[MEMORY] Failed to save session: ${error.message}`);
        }
    }
    
    detectWorkspaceType() {
        try {
            const files = fs.readdirSync(this.workspaceRoot);
            
            if (files.includes('package.json')) {
                const pkg = JSON.parse(fs.readFileSync(path.join(this.workspaceRoot, 'package.json'), 'utf8'));
                this.context.workspace.type = 'node';
                this.context.workspace.language = 'javascript';
                this.context.workspace.dependencies = pkg.dependencies || {};
                
                if (pkg.dependencies?.react) this.context.workspace.framework = 'react';
                else if (pkg.dependencies?.express) this.context.workspace.framework = 'express';
                else if (pkg.dependencies?.vue) this.context.workspace.framework = 'vue';
                else if (pkg.dependencies?.next) this.context.workspace.framework = 'nextjs';
            }
            
            if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
                this.context.workspace.type = 'python';
                this.context.workspace.language = 'python';
            }
            
            if (files.includes('index.html')) {
                if (!this.context.workspace.type || this.context.workspace.type === 'unknown') {
                    this.context.workspace.type = 'web';
                    this.context.workspace.language = 'html';
                }
            }
            
            this.context.workspace.structure = this.analyzeStructure(files);
            
        } catch (error) {
            console.log(`[MEMORY] Failed to detect workspace type: ${error.message}`);
        }
    }
    
    analyzeStructure(files) {
        const structure = {
            sourceFiles: files.filter(f => f.match(/\.(js|ts|py|html|css|json)$/)).length,
            configFiles: files.filter(f => f.match(/\.(json|yml|yaml|toml|ini|env)$/)).length,
            directories: files.filter(f => {
                try {
                    return fs.statSync(path.join(this.workspaceRoot, f)).isDirectory();
                } catch { return false; }
            }),
            totalFiles: files.length
        };
        
        return structure;
    }
    
    addConversationTurn(userMessage, aiResponse, toolCalls = []) {
        const turn = {
            timestamp: new Date().toISOString(),
            userMessage: userMessage, // REMOVE TRUNCATION - keep full message
            aiResponse: aiResponse, // REMOVE TRUNCATION - keep full response
            toolCalls: toolCalls.map(tc => ({
                tool: tc.function?.name || tc.tool, // Support both formats
                args: tc.function?.arguments || tc.args || '', // Store as object, not stringified
                result: tc.result, // Store as object, not stringified
                success: !tc.result?.error
            })),
            turnId: `turn_${Date.now()}`
        };
        
        this.session.conversationHistory.push(turn);
        
        // Keep more conversation history for better context - increased from 20 to 100
        if (this.session.conversationHistory.length > 100) {
            this.session.conversationHistory = this.session.conversationHistory.slice(-100);
        }
        
        this.updateContextSummary();
        this.saveSession();
    }
    
    addToolCall(toolName, args, result) {
        const toolCall = {
            timestamp: new Date().toISOString(),
            tool: toolName,
            args: args, // Store as object, not stringified
            result: result, // Store as object, not stringified
            success: !result?.error
        };
        
        this.session.toolCallChain.push(toolCall);
        
        // Keep more tool calls for better context - increased from 50 to 200
        if (this.session.toolCallChain.length > 200) {
            this.session.toolCallChain = this.session.toolCallChain.slice(-200);
        }
        
        // Track active files
        if (toolName === 'write_file' && args.filePath) {
            this.session.activeFiles.add(args.filePath);
        }
        
        this.saveSession();
    }
    
    addRecentAction(action, details) {
        const actionRecord = {
            timestamp: new Date().toISOString(),
            action,
            details,
            id: `action_${Date.now()}`
        };
        
        this.session.recentActions.push(actionRecord);
        
        // Keep more recent actions for better context - increased from 10 to 50
        if (this.session.recentActions.length > 50) {
            this.session.recentActions = this.session.recentActions.slice(-50);
        }
        
        this.saveSession();
    }
    
    setUserIntent(intent, goals = []) {
        this.session.userIntent = intent;
        this.session.projectGoals = goals;
        this.addRecentAction('user_intent_set', { intent, goals });
    }

    updateUserIntent(intent, goals = []) {
        return this.setUserIntent(intent, goals);
    }

    // TASK MANAGEMENT SYSTEM - Core methods for persistent task tracking
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    addTask(description, priority = 'medium', type = 'general', parentTaskId = null) {
        const task = {
            id: this.generateTaskId(),
            description: description.trim(),
            type: type, // 'coding', 'analysis', 'research', 'debugging', 'testing', etc.
            priority: priority, // 'high', 'medium', 'low'
            status: 'pending', // 'pending', 'in_progress', 'completed', 'blocked', 'cancelled'
            progress: 0, // 0-100 percentage
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            estimatedDuration: null, // minutes
            actualDuration: null, // minutes
            parentTaskId: parentTaskId,
            subtasks: [],
            relatedFiles: [],
            toolsUsed: [],
            dependencies: [],
            notes: []
        };

        this.context.currentTasks.push(task);
        this.saveSession();
        this.addRecentAction('task_created', { taskId: task.id, description, type, priority });

        // Record telemetry for task creation
        if (this.telemetryManager) {
            this.telemetryManager.recordTaskCreation(task.id, type, priority, description);
        }

        return task.id;
    }

    updateTask(taskId, updates) {
        const task = this.context.currentTasks.find(t => t.id === taskId);
        if (!task) return false;

        // Update fields
        Object.assign(task, updates, {
            updatedAt: new Date().toISOString()
        });

        // Handle status changes
        if (updates.status === 'completed') {
            task.progress = 100;
            task.actualDuration = task.actualDuration || this.calculateTaskDuration(task);
            this.completeTask(taskId);
            return true;
        }

        this.saveSession();
        this.addRecentAction('task_updated', { taskId, updates });
        return true;
    }

    completeTask(taskId, result = null) {
        const taskIndex = this.context.currentTasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return false;

        const task = this.context.currentTasks[taskIndex];
        task.status = 'completed';
        task.progress = 100;
        task.completedAt = new Date().toISOString();
        task.actualDuration = this.calculateTaskDuration(task);

        if (result) {
            task.result = result;
        }

        // Move to completed tasks
        this.context.completedTasks.push(task);
        this.context.currentTasks.splice(taskIndex, 1);

        // Keep only last 50 completed tasks
        if (this.context.completedTasks.length > 50) {
            this.context.completedTasks = this.context.completedTasks.slice(-50);
        }

        this.saveSession();
        this.addRecentAction('task_completed', { taskId, description: task.description, duration: task.actualDuration });

        // Record telemetry for task completion
        if (this.telemetryManager) {
            this.telemetryManager.recordTaskCompletion(taskId, task.type, task.actualDuration, true, result);
        }

        return true;
    }

    calculateTaskDuration(task) {
        if (!task.createdAt) return null;
        const created = new Date(task.createdAt);
        const now = new Date();
        return Math.round((now - created) / 1000 / 60); // minutes
    }

    getCurrentTasks() {
        return this.context.currentTasks.slice(); // Return copy
    }

    getActiveTasksByType(type) {
        return this.context.currentTasks.filter(t => t.type === type && t.status !== 'completed');
    }

    getTaskProgress() {
        const current = this.context.currentTasks;
        const total = current.length;
        const completed = current.filter(t => t.status === 'completed').length;
        const inProgress = current.filter(t => t.status === 'in_progress').length;

        return {
            total,
            completed,
            inProgress,
            pending: total - completed - inProgress,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }

    addSubtask(parentTaskId, description, priority = 'medium') {
        const parentTask = this.context.currentTasks.find(t => t.id === parentTaskId);
        if (!parentTask) return null;

        const subtaskId = this.addTask(description, priority, parentTask.type, parentTaskId);
        parentTask.subtasks.push(subtaskId);
        this.saveSession();

        return subtaskId;
    }

    linkFileToTask(taskId, filePath) {
        const task = this.context.currentTasks.find(t => t.id === taskId);
        if (task && !task.relatedFiles.includes(filePath)) {
            task.relatedFiles.push(filePath);
            this.saveSession();
        }
    }

    linkToolToTask(taskId, toolName, args = null) {
        const task = this.context.currentTasks.find(t => t.id === taskId);
        if (task) {
            task.toolsUsed.push({
                tool: toolName,
                args: args,
                timestamp: new Date().toISOString()
            });
            this.saveSession();
        }
    }

    addTaskNote(taskId, note) {
        const task = this.context.currentTasks.find(t => t.id === taskId);
        if (task) {
            task.notes.push({
                note: note,
                timestamp: new Date().toISOString()
            });
            this.saveSession();
        }
    }

    // AUTO-TASK DETECTION - Analyze user input to automatically create tasks
    analyzeAndCreateTasks(userMessage) {
        const tasks = [];
        const message = userMessage.toLowerCase();

        // Task detection patterns
        const patterns = [
            { regex: /implement|create|build|add|write/i, type: 'coding', priority: 'high' },
            { regex: /fix|debug|resolve|solve/i, type: 'debugging', priority: 'high' },
            { regex: /test|verify|validate|check/i, type: 'testing', priority: 'medium' },
            { regex: /analyze|review|examine|investigate/i, type: 'analysis', priority: 'medium' },
            { regex: /research|find|search|explore/i, type: 'research', priority: 'medium' },
            { regex: /optimize|improve|enhance|refactor/i, type: 'optimization', priority: 'medium' },
            { regex: /document|explain|describe/i, type: 'documentation', priority: 'low' }
        ];

        // Extract task descriptions from sentences
        const sentences = userMessage.split(/[.!?]+/).filter(s => s.trim().length > 10);

        for (const sentence of sentences) {
            for (const pattern of patterns) {
                if (pattern.regex.test(sentence)) {
                    const taskId = this.addTask(
                        sentence.trim(),
                        pattern.priority,
                        pattern.type
                    );
                    tasks.push(taskId);
                    break; // One task per sentence
                }
            }
        }

        return tasks;
    }

    trackConversation(type, content) {
        const record = {
            type,
            content,
            timestamp: new Date().toISOString()
        };
        
        this.session.conversationHistory.push(record);
        
        // Keep more conversation history for better context - using same limit as addConversationTurn
        if (this.session.conversationHistory.length > 100) {
            this.session.conversationHistory = this.session.conversationHistory.slice(-100);
        }
        
        this.saveSession();
    }

    trackAction(action, details, success = true) {
        const actionRecord = {
            timestamp: new Date().toISOString(),
            action,
            details,
            success,
            id: `action_${Date.now()}`
        };
        
        this.session.recentActions.push(actionRecord);
        
        // Keep more recent actions for better context - increased from 10 to 50  
        if (this.session.recentActions.length > 50) {
            this.session.recentActions = this.session.recentActions.slice(-50);
        }
        
        this.saveSession();
    }
    
    setCurrentProject(projectInfo) {
        this.session.currentProject = {
            name: projectInfo.name,
            type: projectInfo.type,
            description: projectInfo.description,
            status: projectInfo.status || 'in_progress',
            startedAt: new Date().toISOString()
        };
        this.addRecentAction('project_started', projectInfo);
    }
    
    updateContextSummary() {
        const recent = this.session.conversationHistory.slice(-5);
        const recentTools = this.session.toolCallChain.slice(-10);
        
        let summary = `Current workspace: ${this.context.workspace.type} (${this.context.workspace.language})`;
        
        if (this.session.currentProject) {
            summary += `\nActive project: ${this.session.currentProject.name} - ${this.session.currentProject.description}`;
        }
        
        if (this.session.userIntent) {
            summary += `\nUser intent: ${this.session.userIntent}`;
        }
        
        if (this.session.activeFiles.size > 0) {
            summary += `\nRecently modified files: ${Array.from(this.session.activeFiles).slice(-5).join(', ')}`;
        }
        
        if (recentTools.length > 0) {
            const toolSummary = recentTools.map(t => `${t.tool}(${t.success ? '✓' : '✗'})`).join(', ');
            summary += `\nRecent tools: ${toolSummary}`;
        }
        
        this.session.contextSummary = summary;
    }
    
    getContextForAI() {
        this.updateContextSummary();
        
        const context = {
            sessionInfo: {
                sessionId: this.session.sessionId.slice(-9),
                duration: this.getSessionDuration(),
                summary: this.session.contextSummary
            },
            workspace: this.context.workspace,
            currentProject: this.session.currentProject,
            userIntent: this.session.userIntent,
            recentActions: this.session.recentActions.slice(-5),
            recentToolCalls: this.session.toolCallChain.slice(-10),
            activeFiles: Array.from(this.session.activeFiles),
            conversationContext: this.session.conversationHistory.slice(-3)
        };
        
        return context;
    }
    
    getSessionDuration() {
        const start = new Date(this.session.startTime);
        const now = new Date();
        const duration = Math.round((now - start) / 1000 / 60); // minutes
        return `${duration}m`;
    }

    /**
     * Get enhanced system prompt with session memory integration
     * @param {string} basePrompt - The original system prompt
     * @returns {string} Enhanced prompt with context
     */
    getEnhancedSystemPrompt(basePrompt) {
        const sessionContext = this.getContextForAI();
        const workspaceFiles = Array.from(this.session.activeFiles).slice(-10);
        
        let enhancedPrompt = basePrompt + '\n\n';
        enhancedPrompt += '## 🧠 SESSION MEMORY & CONTEXT AWARENESS\n';
        enhancedPrompt += 'You have persistent memory of this conversation session. Remember what you\'ve built, what the user is working on, and maintain context across tool chains.\n\n';
        
        enhancedPrompt += `**Session:** ${sessionContext.sessionInfo.sessionId} (${sessionContext.sessionInfo.duration})\n`;
        enhancedPrompt += `**Context:** ${sessionContext.sessionInfo.summary}\n\n`;
        
        if (sessionContext.currentProject) {
            enhancedPrompt += `**Current Project:** ${sessionContext.currentProject.name} (${sessionContext.currentProject.type})\n`;
            enhancedPrompt += `**Description:** ${sessionContext.currentProject.description}\n\n`;
        }
        
        if (sessionContext.userIntent) {
            enhancedPrompt += `**User Intent:** ${sessionContext.userIntent}\n\n`;
        }
        
        if (sessionContext.recentActions.length > 0) {
            enhancedPrompt += '**Recent Actions:**\n';
            sessionContext.recentActions.forEach(action => {
                const status = action.success ? '✅' : '❌';
                enhancedPrompt += `- ${status} ${action.action}: ${action.details}\n`;
            });
            enhancedPrompt += '\n';
        }
        
        // CRITICAL FIX: Include recent tool calls so Jack remembers what he just did
        if (sessionContext.recentToolCalls.length > 0) {
            enhancedPrompt += '**Recent Tool Executions:**\n';
            sessionContext.recentToolCalls.forEach(toolCall => {
                const status = toolCall.success ? '✅' : '❌';
                const truncatedResult = toolCall.result && toolCall.result.length > 100 
                    ? toolCall.result.substring(0, 100) + '...' 
                    : toolCall.result;
                enhancedPrompt += `- ${status} ${toolCall.tool}: ${truncatedResult}\n`;
            });
            enhancedPrompt += '\n';
        }
        
        if (workspaceFiles.length > 0) {
            enhancedPrompt += '**Active Files:**\n';
            workspaceFiles.forEach(file => {
                enhancedPrompt += `- ${file}\n`;
            });
            enhancedPrompt += '\n';
        }

        // CRITICAL FIX: Include recent conversation context so Jack remembers what was discussed
        if (sessionContext.conversationContext.length > 0) {
            enhancedPrompt += '**Recent Conversation:**\n';
            sessionContext.conversationContext.forEach(turn => {
                enhancedPrompt += `- User: ${turn.userMessage.substring(0, 150)}${turn.userMessage.length > 150 ? '...' : ''}\n`;
                enhancedPrompt += `- AI: ${turn.aiResponse.substring(0, 150)}${turn.aiResponse.length > 150 ? '...' : ''}\n`;
            });
            enhancedPrompt += '\n';
        }

        // TASK MANAGEMENT: Include current tasks and progress so Jack maintains focus
        const currentTasks = this.getCurrentTasks();
        if (currentTasks.length > 0) {
            enhancedPrompt += '**Active Tasks:**\n';
            currentTasks.slice(-5).forEach(task => {
                const status = task.status === 'completed' ? '✅' :
                             task.status === 'in_progress' ? '🔄' :
                             task.status === 'blocked' ? '🚫' : '⏳';
                enhancedPrompt += `- ${status} [${task.type}] ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''} (${task.progress}%)\n`;
            });

            const progress = this.getTaskProgress();
            enhancedPrompt += `- **Progress**: ${progress.completed}/${progress.total} completed (${progress.completionRate}%)\n\n`;
        }

        // COMPLETED TASKS: Show recent completions so Jack knows what's been finished
        if (this.context.completedTasks.length > 0) {
            enhancedPrompt += '**Recently Completed:**\n';
            this.context.completedTasks.slice(-3).forEach(task => {
                enhancedPrompt += `- ✅ [${task.type}] ${task.description.substring(0, 80)}${task.description.length > 80 ? '...' : ''}\n`;
            });
            enhancedPrompt += '\n';
        }

        enhancedPrompt += '## 🎯 MEMORY & TASK GUIDELINES\n';
        enhancedPrompt += '- Remember your previous work and build upon it coherently\n';
        enhancedPrompt += '- Reference what you\'ve already created when suggesting modifications\n';
        enhancedPrompt += '- Maintain context between tool calls and conversations\n';
        enhancedPrompt += '- Stay focused on active tasks and track your progress\n';
        enhancedPrompt += '- Update task status as you complete work (use session memory task methods)\n';
        enhancedPrompt += '- Link files and tools to relevant tasks to maintain correlation\n';
        enhancedPrompt += '- Ask clarifying questions if you\'ve lost context about the project\n';
        enhancedPrompt += '- Use verbose, detailed descriptions when proposing edits\n';
        enhancedPrompt += '- Never run inappropriate commands (like pytest on HTML projects)\n';
        enhancedPrompt += '- Always consider workspace type and project context before suggesting tools\n\n';
        
        return enhancedPrompt;
    }
    
    getVerboseEditContext(operation, filePath, content) {
        const fileSize = content ? content.length : 0;
        const lineCount = content ? content.split('\n').length : 0;
        
        let analysis = {
            fileInfo: {
                path: filePath,
                size: fileSize,
                lines: lineCount,
                type: path.extname(filePath).substring(1) || 'unknown'
            },
            operationDetails: {
                operation,
                timestamp: new Date().toISOString(),
                contextualRelevance: this.getFileRelevance(filePath)
            },
            workspaceImpact: this.analyzeWorkspaceImpact(filePath, operation),
            previousHistory: this.getFileHistory(filePath)
        };
        
        // Add content analysis for different file types
        if (content) {
            analysis.contentAnalysis = this.analyzeContent(content, filePath);
        }
        
        return analysis;
    }
    
    getFileRelevance(filePath) {
        const recent = this.session.toolCallChain.slice(-10);
        const relatedCalls = recent.filter(tc => {
            const argsStr = typeof tc.args === 'object' ? JSON.stringify(tc.args) : String(tc.args || '');
            const resultStr = typeof tc.result === 'object' ? JSON.stringify(tc.result) : String(tc.result || '');
            return argsStr.includes(filePath) || resultStr.includes(filePath);
        });
        
        return {
            recentlyModified: this.session.activeFiles.has(filePath),
            relatedToolCalls: relatedCalls.length,
            projectRole: this.determineFileRole(filePath)
        };
    }
    
    determineFileRole(filePath) {
        const filename = path.basename(filePath);
        const ext = path.extname(filePath);
        
        if (filename === 'index.html') return 'main_entry_point';
        if (filename === 'package.json') return 'project_config';
        if (filename === 'README.md') return 'documentation';
        if (ext === '.css') return 'styling';
        if (ext === '.js') return 'functionality';
        if (ext === '.json') return 'data_config';
        
        return 'supporting_file';
    }
    
    analyzeContent(content, filePath) {
        const ext = path.extname(filePath);
        const analysis = {
            characterCount: content.length,
            lineCount: content.split('\n').length,
            isEmpty: content.trim().length === 0
        };
        
        if (ext === '.js') {
            analysis.functions = (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length;
            analysis.imports = (content.match(/import\s+.*from|require\(/g) || []).length;
            analysis.hasEventListeners = content.includes('addEventListener');
            analysis.hasAsyncCode = content.includes('async') || content.includes('await');
        }
        
        if (ext === '.html') {
            analysis.elements = (content.match(/<[^/][^>]*>/g) || []).length;
            analysis.scripts = (content.match(/<script/g) || []).length;
            analysis.stylesheets = (content.match(/<link.*stylesheet/g) || []).length;
        }
        
        if (ext === '.css') {
            analysis.rules = (content.match(/[^}]*{[^}]*}/g) || []).length;
            analysis.selectors = (content.match(/[^{}]+(?={)/g) || []).length;
        }
        
        return analysis;
    }
    
    analyzeWorkspaceImpact(filePath, operation) {
        const impact = {
            scope: 'file_level',
            affectedSystems: [],
            dependencies: [],
            potentialSideEffects: []
        };
        
        const filename = path.basename(filePath);
        
        if (filename === 'package.json') {
            impact.scope = 'project_level';
            impact.affectedSystems.push('dependency_management', 'build_system');
        }
        
        if (filename === 'index.html') {
            impact.scope = 'application_level';
            impact.affectedSystems.push('user_interface', 'application_structure');
        }
        
        if (path.extname(filePath) === '.js') {
            impact.affectedSystems.push('application_logic');
            if (filename.includes('server') || filename.includes('app')) {
                impact.scope = 'system_level';
            }
        }
        
        return impact;
    }
    
    getFileHistory(filePath) {
        const history = this.session.toolCallChain.filter(tc => {
            if (tc.tool !== 'write_file') return false;
            const argsStr = typeof tc.args === 'object' ? JSON.stringify(tc.args) : String(tc.args || '');
            return argsStr.includes(filePath);
        });
        
        return history.slice(-3).map(h => ({
            timestamp: h.timestamp,
            success: h.success,
            summary: `${h.tool} - ${h.success ? 'successful' : 'failed'}`
        }));
    }

    /**
     * Get recent activity for Jack Perspective Mode
     */
    getRecentActivity(limit = 50) {
        const recentToolCalls = this.session.toolCallChain.slice(-limit).map(tc => ({
            name: tc.tool,
            timestamp: tc.timestamp,
            args: tc.args,
            result: tc.result,
            success: tc.success
        }));

        return {
            toolCalls: recentToolCalls,
            recentActions: this.session.recentActions.slice(-limit)
        };
    }

    /**
     * Get tool call statistics for perspective mode
     */
    getToolCallStats() {
        const toolCounts = {};
        let totalCalls = 0;
        let successfulCalls = 0;

        this.session.toolCallChain.forEach(tc => {
            toolCounts[tc.tool] = (toolCounts[tc.tool] || 0) + 1;
            totalCalls++;
            if (tc.success) successfulCalls++;
        });

        const sortedTools = Object.entries(toolCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        return {
            totalCalls,
            successfulCalls,
            successRate: totalCalls > 0 ? (successfulCalls / totalCalls * 100).toFixed(1) : 0,
            toolCounts,
            mostUsedTools: sortedTools,
            uniqueTools: Object.keys(toolCounts).length
        };
    }
}

module.exports = SessionMemory;