#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class EditVersionController {
    constructor(workspaceRoot, dataDir = null) {
        this.workspaceRoot = workspaceRoot;
        this.dataDir = dataDir || workspaceRoot; // Use dataDir if provided, otherwise workspaceRoot
        this.pendingEdits = new Map(); // editId -> EditOperation
        this.appliedEdits = new Set();
        this.rejectedEdits = new Set();
        this.editHistory = [];
        this.currentBatch = null;
        this.editCounter = 0;

        // P1.1 FIX: Define editsDir property that was referenced but never defined
        this.editsDir = path.join(this.dataDir, '.edits');

        // SURGICAL EDIT ENHANCEMENT: Track file reads for pre-read enforcement
        this.fileReadCache = new Map(); // filePath -> { content, timestamp }
        this.readTimeoutMs = 60000; // 60 seconds - file reads expire after this time

        this.ensureEditDirectory();

        // Default chunking method: 'token' (AI), fallback to 'line' if unavailable
        this.defaultChunkMethod = 'hybrid';
        this.defaultChunkSize = 2048; // tokens or lines or bytes

        // Advanced chunking strategies
        this.chunkingStrategies = {
            semantic: this.semanticChunker.bind(this),
            structural: this.structuralChunker.bind(this),
            hybrid: this.hybridChunker.bind(this),
            adaptive: this.adaptiveChunker.bind(this)
        };

        // Chunking performance metrics
        this.chunkingMetrics = {
            totalChunksProcessed: 0,
            averageChunkTime: 0,
            chunkingMethodUsage: {},
            fileSizeDistribution: {}
        };
    }
    /**
     * Advanced chunking engine with multiple strategies for massive file handling
     * Supports semantic, structural, hybrid, and adaptive chunking methods
     */
    async readFileChunked(filePath, options = {}) {
        const startTime = Date.now();
        const method = options.method || this.defaultChunkMethod;
        const chunkSize = options.chunkSize || this.defaultChunkSize;
        const fullPath = path.resolve(this.workspaceRoot, filePath);

        // SECURITY: Validate path is within workspace
        const relativePath = path.relative(this.workspaceRoot, fullPath);
        const normalizedPath = path.normalize(relativePath);
        if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
            throw new Error(`Security violation: Path traversal detected. File path '${filePath}' resolves outside workspace: ${this.workspaceRoot}`);
        }

        let content;
        try {
            content = await fs.readFile(fullPath, 'utf8');
        } catch (err) {
            return [];
        }

        // Track file size for analytics
        const fileSize = Buffer.byteLength(content, 'utf8');
        this.trackFileSize(fileSize);

        // Use advanced chunking strategies
        let chunks;
        if (this.chunkingStrategies[method]) {
            chunks = await this.chunkingStrategies[method](content, chunkSize, options);
        } else {
            // Fallback to legacy methods
            chunks = this.fallbackChunking(content, method, chunkSize);
        }

        // Track performance metrics
        const processingTime = Date.now() - startTime;
        this.trackChunkingMetrics(method, chunks.length, processingTime, fileSize);

        return chunks;
    }

    chunkByLines(content, linesPerChunk) {
        const lines = content.split('\n');
        const chunks = [];
        for (let i = 0; i < lines.length; i += linesPerChunk) {
            chunks.push(lines.slice(i, i + linesPerChunk).join('\n'));
        }
        return chunks;
    }

    chunkByBytes(content, bytesPerChunk) {
        const chunks = [];
        let i = 0;
        while (i < content.length) {
            chunks.push(content.slice(i, i + bytesPerChunk));
            i += bytesPerChunk;
        }
        return chunks;
    }

    /**
     * TOKEN-BASED CHUNKING: Splits content based on actual token count using tiktoken
     * More accurate for AI model token limits
     */
    chunkByTokens(content, tokensPerChunk, tiktoken) {
        try {
            // Use cl100k_base encoding (used by GPT-3.5-turbo, GPT-4, and similar models)
            const encoding = tiktoken.get_encoding('cl100k_base');
            const tokens = encoding.encode(content);
            const chunks = [];
            const textDecoder = new TextDecoder('utf-8');

            for (let i = 0; i < tokens.length; i += tokensPerChunk) {
                const tokenChunk = tokens.slice(i, i + tokensPerChunk);
                const byteArray = encoding.decode(tokenChunk);
                const textChunk = textDecoder.decode(byteArray);
                chunks.push(textChunk);
            }

            encoding.free(); // Free the encoding to prevent memory leaks
            return chunks.length > 0 ? chunks : [content];
        } catch (error) {
            console.warn('[EDIT-CONTROLLER] Token chunking failed, falling back to line-based:', error.message);
            return this.chunkByLines(content, Math.ceil(tokensPerChunk / 10)); // Rough estimate
        }
    }

    /**
     * SEMANTIC CHUNKING: Splits content based on semantic meaning and context
     * Uses natural language boundaries like paragraphs, sentences, and code blocks
     */
    async semanticChunker(content, chunkSize, options = {}) {
        const lines = content.split('\n');
        const chunks = [];

        let currentChunk = '';
        let currentSize = 0;

        for (const line of lines) {
            // Detect semantic boundaries
            const isCodeBlock = line.trim().startsWith('```') || /^\s*(function|class|def|if|for|while)/.test(line);
            const isComment = line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('/*');
            const isEmpty = line.trim() === '';
            const isHeading = /^#{1,6}\s/.test(line);
            const isListItem = /^[\s]*[-*+]\s|\d+\.\s/.test(line);

            // If adding this line would exceed chunk size, save current chunk
            if (currentSize + line.length > chunkSize && currentChunk.trim()) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
                currentSize = 0;
            }

            // Add semantic separators for better context
            if (isHeading || isCodeBlock || (isEmpty && currentChunk.trim())) {
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                    currentSize = 0;
                }
            }

            currentChunk += line + '\n';
            currentSize += line.length + 1;
        }

        // Add remaining content
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks.length > 0 ? chunks : [content];
    }

    /**
     * STRUCTURAL CHUNKING: Splits based on code/file structure (functions, classes, imports)
     * Maintains logical code boundaries for better AI understanding
     */
    async structuralChunker(content, chunkSize, options = {}) {
        const lines = content.split('\n');
        const chunks = [];

        let currentChunk = '';
        let currentSize = 0;
        let braceDepth = 0;
        let inFunction = false;
        let inClass = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Track structural elements
            if (trimmed.includes('{')) braceDepth++;
            if (trimmed.includes('}')) braceDepth--;

            // Detect function/class definitions
            if (/^\s*(function|def|class|async function)/.test(trimmed)) {
                inFunction = true;
            }
            if (/^\s*class\s/.test(trimmed)) {
                inClass = true;
            }

            // Check if we should split before this line
            const shouldSplit = (
                currentSize + line.length > chunkSize ||
                (braceDepth === 0 && (inFunction || inClass) && currentChunk.trim()) ||
                /^\s*(import|from|require|export)/.test(trimmed)
            );

            if (shouldSplit && currentChunk.trim()) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
                currentSize = 0;
                inFunction = false;
                inClass = false;
            }

            currentChunk += line + '\n';
            currentSize += line.length + 1;

            // Reset flags when we close braces
            if (braceDepth === 0) {
                inFunction = false;
                inClass = false;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks.length > 0 ? chunks : [content];
    }

    /**
     * HYBRID CHUNKING: Combines semantic and structural analysis for optimal results
     * Adapts based on file type and content characteristics
     */
    async hybridChunker(content, chunkSize, options = {}) {
        const fileType = options.fileType || this.detectFileType(content);

        // Choose strategy based on file type
        if (fileType === 'code') {
            return this.structuralChunker(content, chunkSize, options);
        } else if (fileType === 'documentation') {
            return this.semanticChunker(content, chunkSize, options);
        } else {
            // For mixed content, use adaptive approach
            return this.adaptiveChunker(content, chunkSize, options);
        }
    }

    /**
     * ADAPTIVE CHUNKING: Dynamically adjusts chunking strategy based on content analysis
     * Uses machine learning-like approach to optimize for different content types
     */
    async adaptiveChunker(content, chunkSize, options = {}) {
        const analysis = this.analyzeContent(content);

        // Adaptive strategy based on content analysis
        if (analysis.codeRatio > 0.7) {
            // High code content - use structural chunking
            return this.structuralChunker(content, chunkSize * 0.8, options);
        } else if (analysis.semanticRatio > 0.6) {
            // High semantic content - use semantic chunking
            return this.semanticChunker(content, chunkSize * 1.2, options);
        } else {
            // Mixed content - use balanced approach
            const structuralChunks = await this.structuralChunker(content, chunkSize, options);
            const semanticChunks = await this.semanticChunker(content, chunkSize, options);

            // Choose the better result based on chunk quality metrics
            return structuralChunks.length <= semanticChunks.length ? structuralChunks : semanticChunks;
        }
    }

    /**
     * Analyze content to determine optimal chunking strategy
     */
    analyzeContent(content) {
        const lines = content.split('\n');
        let codeLines = 0;
        let semanticLines = 0;
        let totalLines = lines.length;

        for (const line of lines) {
            const trimmed = line.trim();

            // Code indicators
            if (/^\s*(function|class|def|if|for|while|var|let|const|import|export)/.test(trimmed) ||
                trimmed.includes('{') || trimmed.includes('}') || trimmed.includes(';')) {
                codeLines++;
            }

            // Semantic indicators
            if (/^#{1,6}\s/.test(trimmed) || // Headings
                /^[\s]*[-*+]\s|\d+\.\s/.test(trimmed) || // Lists
                trimmed.length > 100 || // Long lines (likely prose)
                /^[A-Z][^.!?]*[.!?]$/.test(trimmed)) { // Complete sentences
                semanticLines++;
            }
        }

        return {
            codeRatio: codeLines / totalLines,
            semanticRatio: semanticLines / totalLines,
            totalLines,
            avgLineLength: content.length / totalLines
        };
    }

    /**
     * Detect file type for optimal chunking strategy
     */
    detectFileType(content) {
        const firstLines = content.split('\n').slice(0, 10).join('\n');

        if (/\.(js|ts|py|java|c|cpp|cs|php|rb|go|rs)$/.test('filename') ||
            firstLines.includes('function') || firstLines.includes('class') ||
            firstLines.includes('import ') || firstLines.includes('def ')) {
            return 'code';
        }

        if (firstLines.includes('# ') || firstLines.includes('## ') ||
            /^[A-Z][^.!?]*[.!?]$/.test(firstLines)) {
            return 'documentation';
        }

        return 'mixed';
    }

    /**
     * Fallback to legacy chunking methods for backward compatibility
     */
    fallbackChunking(content, method, chunkSize) {
        switch (method) {
            case 'token':
                // Implement proper token-based chunking with tiktoken
                try {
                    const tiktoken = require('tiktoken');
                    return this.chunkByTokens(content, chunkSize, tiktoken);
                } catch (e) {
                    console.warn('[EDIT-CONTROLLER] tiktoken not available, falling back to line-based chunking:', e.message);
                    return this.chunkByLines(content, chunkSize);
                }
            case 'line':
                return this.chunkByLines(content, chunkSize);
            case 'byte':
                return this.chunkByBytes(content, chunkSize);
            default:
                return [content];
        }
    }

    /**
     * Track chunking performance metrics
     */
    trackChunkingMetrics(method, chunkCount, processingTime, fileSize) {
        this.chunkingMetrics.totalChunksProcessed += chunkCount;
        this.chunkingMetrics.averageChunkTime =
            (this.chunkingMetrics.averageChunkTime + processingTime) / 2;

        if (!this.chunkingMetrics.chunkingMethodUsage[method]) {
            this.chunkingMetrics.chunkingMethodUsage[method] = 0;
        }
        this.chunkingMetrics.chunkingMethodUsage[method]++;
    }

    /**
     * Track file size distribution for analytics
     */
    trackFileSize(fileSize) {
        const sizeCategory = fileSize < 1024 ? 'small' :
                           fileSize < 10240 ? 'medium' :
                           fileSize < 102400 ? 'large' : 'massive';

        if (!this.chunkingMetrics.fileSizeDistribution[sizeCategory]) {
            this.chunkingMetrics.fileSizeDistribution[sizeCategory] = 0;
        }
        this.chunkingMetrics.fileSizeDistribution[sizeCategory]++;
    }

    /**
     * Get chunking performance analytics
     */
    getChunkingAnalytics() {
        return {
            ...this.chunkingMetrics,
            efficiency: this.calculateChunkingEfficiency()
        };
    }

    /**
     * Calculate chunking efficiency based on processing patterns
     */
    calculateChunkingEfficiency() {
        const { chunkingMethodUsage, fileSizeDistribution } = this.chunkingMetrics;

        // Prefer hybrid and adaptive methods for better performance
        const advancedMethods = (chunkingMethodUsage.hybrid || 0) +
                               (chunkingMethodUsage.adaptive || 0) +
                               (chunkingMethodUsage.semantic || 0) +
                               (chunkingMethodUsage.structural || 0);

        const totalMethods = Object.values(chunkingMethodUsage).reduce((a, b) => a + b, 0);

        return totalMethods > 0 ? (advancedMethods / totalMethods) * 100 : 0;
    }
    
    async ensureEditDirectory() {
        // Use the centralized editsDir property
        try {
            await fs.mkdir(this.editsDir, { recursive: true });
            
            // P2.2 ENHANCEMENT: Also ensure backup subdirectory exists
            const backupDir = path.join(this.editsDir, 'backups');
            await fs.mkdir(backupDir, { recursive: true });
        } catch (error) {
            // Directory exists or creation failed - non-fatal
        }
    }
    
    generateEditId() {
        return `edit_${Date.now()}_${++this.editCounter}`;
    }
    
    startEditBatch(description) {
        this.currentBatch = {
            id: `batch_${Date.now()}`,
            description,
            edits: [],
            startTime: new Date().toISOString(),
            status: 'pending'
        };
        
        console.log(`\n\x1b[95m📝 EDIT BATCH STARTED\x1b[0m`);
        console.log(`\x1b[96mBatch ID: ${this.currentBatch.id}\x1b[0m`);
        console.log(`\x1b[96mDescription: ${description}\x1b[0m`);
        console.log(`\x1b[93m💡 Edits will be queued for your review\x1b[0m\n`);
        
        return this.currentBatch.id;
    }
    
    async proposeEdit(operation) {
        const editId = this.generateEditId();
        const edit = {
            id: editId,
            operation,
            status: 'pending',
            timestamp: new Date().toISOString(),
            batchId: this.currentBatch?.id || null,
            description: '',
            expectedOutcome: '',
            backup: null
        };
        
        // Create detailed description based on operation type
        switch (operation.type) {
            case 'write_file':
                edit.description = `Create/modify file: ${operation.filePath}`;
                edit.expectedOutcome = `File will be ${operation.mode === 'append' ? 'extended' : 'created/replaced'} with ${operation.content.length} characters`;
                break;
            case 'execute_command':
                edit.description = `Execute command: ${operation.command}`;
                edit.expectedOutcome = `Command will run in ${operation.cwd || 'workspace root'}`;
                break;
            case 'git_operation':
                edit.description = `Git ${operation.operation}: ${operation.args?.join(' ') || ''}`;
                edit.expectedOutcome = `Git repository will be modified via ${operation.operation}`;
                break;
        }
        
        // Create backup if modifying existing file
        if (operation.type === 'write_file' && operation.mode !== 'append') {
            try {
                const fullPath = path.resolve(this.workspaceRoot, operation.filePath);
                const existingContent = await fs.readFile(fullPath, 'utf8');
                edit.backup = {
                    path: operation.filePath,
                    content: existingContent,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                // File doesn't exist - no backup needed
            }
        }
        
        this.pendingEdits.set(editId, edit);
        if (this.currentBatch) {
            this.currentBatch.edits.push(editId);
        }
        
        // Display the proposed edit
        this.displayProposedEdit(edit);

        return editId;
    }

    /**
     * SURGICAL EDIT TOOL - Exact string matching for precise code modifications
     * Enforces pre-read requirement and uniqueness checking
     */
    async proposeEditSurgical(filePath, oldString, newString, options = {}) {
        const editId = this.generateEditId();

        // 1. ENFORCE: File must have been read recently
        const fileState = this.getRecentFileRead(filePath);
        if (!fileState || Date.now() - fileState.timestamp > this.readTimeoutMs) {
            throw new Error(`EDIT BLOCKED: Must read ${filePath} within last ${this.readTimeoutMs/1000} seconds before editing. Read the file first!`);
        }

        // 2. Read current file content
        const fullPath = path.resolve(this.workspaceRoot, filePath);

        // SECURITY: Validate path is within workspace
        const relativePath = path.relative(this.workspaceRoot, fullPath);
        const normalizedPath = path.normalize(relativePath);
        if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
            throw new Error(`Security violation: Path traversal detected. File path '${filePath}' resolves outside workspace: ${this.workspaceRoot}`);
        }

        let content;
        try {
            content = await fs.readFile(fullPath, 'utf8');
        } catch (err) {
            throw new Error(`EDIT FAILED: Cannot read file ${filePath}: ${err.message}`);
        }

        // 3. ENFORCE: old_string must exist exactly once (or use replace_all)
        const escapedOldString = oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
        const regex = new RegExp(escapedOldString, 'g');
        const matches = content.match(regex);
        const occurrences = matches ? matches.length : 0;

        if (occurrences === 0) {
            throw new Error(`EDIT FAILED: old_string not found in ${filePath}.\n\nSearched for:\n${oldString}\n\nMake sure the old_string matches exactly (including whitespace and line breaks).`);
        }
        if (occurrences > 1 && !options.replace_all) {
            throw new Error(`EDIT BLOCKED: old_string appears ${occurrences} times in ${filePath}. Add more surrounding context to make it unique, or use replace_all:true to change all occurrences.`);
        }

        // 4. Create backup
        const backup = {
            path: filePath,
            content: content,
            timestamp: new Date().toISOString()
        };

        // 5. Apply surgical edit
        const newContent = options.replace_all
            ? content.replaceAll(oldString, newString)
            : content.replace(oldString, newString);

        // 6. Create diff for display
        const diff = this.createSurgicalDiff(oldString, newString, content, newContent);

        // 7. Create edit proposal
        const edit = {
            id: editId,
            operation: {
                type: 'surgical_edit',
                filePath: filePath,
                oldString: oldString,
                newString: newString,
                replaceAll: options.replace_all || false,
                content: newContent  // New file content after surgery
            },
            status: 'pending',
            timestamp: new Date().toISOString(),
            batchId: this.currentBatch?.id || null,
            description: `Surgical edit: ${path.basename(filePath)}`,
            expectedOutcome: options.replace_all
                ? `Replace all ${occurrences} occurrences`
                : `Replace 1 specific occurrence`,
            backup: backup,
            diff: diff,
            surgical: true  // Flag to indicate this is a surgical edit
        };

        this.pendingEdits.set(editId, edit);
        if (this.currentBatch) {
            this.currentBatch.edits.push(editId);
        }

        // Display the surgical edit proposal
        this.displaySurgicalEdit(edit);

        return editId;
    }

    /**
     * Track file reads for pre-read enforcement
     */
    trackFileRead(filePath, content) {
        this.fileReadCache.set(filePath, {
            content: content,
            timestamp: Date.now()
        });
    }

    /**
     * Get recent file read state (for pre-read enforcement)
     */
    getRecentFileRead(filePath) {
        return this.fileReadCache.get(filePath) || null;
    }

    /**
     * Create surgical diff showing exact change
     */
    createSurgicalDiff(oldString, newString, fullOldContent, fullNewContent) {
        const oldLines = oldString.split('\n');
        const newLines = newString.split('\n');

        return {
            oldString: oldString,
            newString: newString,
            oldLines: oldLines.length,
            newLines: newLines.length,
            linesChanged: Math.abs(newLines.length - oldLines.length),
            charactersChanged: Math.abs(newString.length - oldString.length)
        };
    }

    /**
     * Display surgical edit proposal
     */
    displaySurgicalEdit(edit) {
        console.log(`\x1b[96m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
        console.log(`\x1b[93m✂️  SURGICAL EDIT: ${path.basename(edit.operation.filePath)}\x1b[0m`);
        console.log(`\x1b[96m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);

        console.log(`\x1b[94m📁 File:\x1b[0m ${edit.operation.filePath}`);
        console.log(`\x1b[94m🔧 Type:\x1b[0m ${edit.operation.replaceAll ? 'Replace All' : 'Replace Once'}`);

        // Show old string (what's being removed)
        console.log(`\n\x1b[91m❌ OLD (removing):\x1b[0m`);
        const oldLines = edit.operation.oldString.split('\n');
        oldLines.forEach((line, i) => {
            console.log(`\x1b[31m- ${(i + 1).toString().padStart(2)}: ${line}\x1b[0m`);
        });

        // Show new string (what's being added)
        console.log(`\n\x1b[92m✅ NEW (adding):\x1b[0m`);
        const newLines = edit.operation.newString.split('\n');
        newLines.forEach((line, i) => {
            console.log(`\x1b[32m+ ${(i + 1).toString().padStart(2)}: ${line}\x1b[0m`);
        });

        console.log(`\n\x1b[94m📊 Changes:\x1b[0m ${edit.diff.charactersChanged} characters, ${edit.diff.linesChanged} lines`);

        console.log('');
        console.log(`\x1b[92m[1] ✅ ACCEPT\x1b[0m | \x1b[91m[2] ❌ REJECT\x1b[0m | \x1b[94m[3] 🔧 REFACTOR\x1b[0m`);
        console.log(`\x1b[93mSurgical edit will modify ONLY the matched section\x1b[0m`);
        console.log(`\x1b[96m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
    }

    displayProposedEdit(edit) {
        console.log(`\x1b[96m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
        console.log(`\x1b[93m🎯 ${edit.operation.type.toUpperCase()}: ${edit.operation.filePath || edit.operation.command || 'System Operation'}\x1b[0m`);
        console.log(`\x1b[96m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);

        // Show operation details
        if (edit.operation.type === 'write_file') {
            const fileName = path.basename(edit.operation.filePath);
            const fileDir = path.dirname(edit.operation.filePath);
            console.log(`\x1b[94m� File:\x1b[0m ${fileName}`);
            console.log(`\x1b[94m📂 Location:\x1b[0m ${fileDir}`);

            // Show proper git-style diff visualization
            if (edit.operation.content && edit.operation.type === 'write_file') {
                this.displayFileDiff(edit.operation);
            }

            // Show key analysis for informed decisions
            if (edit.operation.verboseContext) {
                const ctx = edit.operation.verboseContext;
                const analysis = ctx.contentAnalysis || {};
                const impact = ctx.workspaceImpact || {};

                console.log(`\x1b[94m📊 Impact:\x1b[0m ${impact.scope || 'local'} scope`);

                // Show key content elements that matter
                const keyElements = [];
                if (analysis.functions) keyElements.push(`${analysis.functions} functions`);
                if (analysis.imports) keyElements.push(`${analysis.imports} imports`);
                if (analysis.elements) keyElements.push(`${analysis.elements} elements`);
                if (analysis.routes) keyElements.push(`${analysis.routes} routes`);

                if (keyElements.length > 0) {
                    console.log(`\x1b[94m🔧 Changes:\x1b[0m ${keyElements.join(', ')}`);
                }
            }

        } else if (edit.operation.type === 'execute_command') {
            console.log(`\x1b[94m💻 Command:\x1b[0m ${edit.operation.command}`);
            if (edit.operation.cwd) {
                console.log(`\x1b[94m📂 Directory:\x1b[0m ${edit.operation.cwd}`);
            }

        } else if (edit.operation.type === 'git_operation') {
            console.log(`\x1b[94m🔗 Git:\x1b[0m ${edit.operation.operation}`);
            if (edit.operation.args) {
                console.log(`\x1b[94m⚙️ Args:\x1b[0m ${edit.operation.args.join(' ')}`);
            }
        }

        console.log('');
        console.log(`\x1b[92m[1] ✅ ACCEPT\x1b[0m | \x1b[91m[2] ❌ REJECT\x1b[0m | \x1b[94m[3] 🔧 REFACTOR\x1b[0m`);
        console.log(`\x1b[93mPress key (no Enter needed) or 'auto-accept on' for auto-approval\x1b[0m`);
        console.log(`\x1b[96m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
    }
    
    async acceptEdit(editId) {
        const edit = this.pendingEdits.get(editId);
        if (!edit) {
            console.log(`\x1b[91m❌ Edit ${editId} not found\x1b[0m`);
            return false;
        }
        
        console.log(`\x1b[92m✅ ACCEPTING EDIT: ${editId}\x1b[0m`);
        
        try {
            // Execute the edit
            const result = await this.executeEdit(edit);

            // Check if the operation actually succeeded
            if (result && result.success === false) {
                edit.status = 'failed';
                edit.result = result;
                edit.error = result.error || 'Operation failed';

                console.log(`\x1b[91m💥 EDIT OPERATION FAILED: ${result.error || 'Unknown error'}\x1b[0m`);
                if (result.stderr) {
                    console.log(`\x1b[91m📄 stderr: ${result.stderr}\x1b[0m`);
                }
                return false;
            }

            edit.status = 'applied';
            edit.result = result;
            edit.appliedAt = new Date().toISOString();

            this.appliedEdits.add(editId);
            this.pendingEdits.delete(editId);
            this.editHistory.push(edit);

            // Save edit to history file
            await this.saveEditToHistory(edit);

            // Display formatted result instead of JSON blob
            this.displayAppliedEditSummary(edit, result);

            return true;
        } catch (error) {
            edit.status = 'failed';
            edit.error = error.message;
            
            console.log(`\x1b[91m💥 EDIT FAILED: ${error.message}\x1b[0m\n`);
            return false;
        }
    }
    
    async rejectEdit(editId, reason = 'User rejected') {
        const edit = this.pendingEdits.get(editId);
        if (!edit) {
            console.log(`\x1b[91m❌ Edit ${editId} not found\x1b[0m`);
            return false;
        }
        
        console.log(`\x1b[91m❌ REJECTING EDIT: ${editId}\x1b[0m`);
        console.log(`\x1b[93m📝 Reason: ${reason}\x1b[0m`);
        
        // If edit was already applied (e.g., in auto-accept mode), restore from backup
        if (edit.status === 'applied' && edit.backup) {
            try {
                const fullPath = path.resolve(this.workspaceRoot, edit.operation.filePath);
                await fs.writeFile(fullPath, edit.backup.content, 'utf8');
                console.log(`\x1b[92m💾 Backup restored: ${edit.operation.filePath}\x1b[0m`);
            } catch (error) {
                console.log(`\x1b[91m❌ Failed to restore backup: ${error.message}\x1b[0m`);
            }
        }
        
        edit.status = 'rejected';
        edit.rejectionReason = reason;
        edit.rejectedAt = new Date().toISOString();
        
        this.rejectedEdits.add(editId);
        this.pendingEdits.delete(editId);
        this.editHistory.push(edit);
        
        // Save rejection to history
        await this.saveEditToHistory(edit);
        
        console.log(`\x1b[93m🗑️  Edit discarded - no changes made\x1b[0m\n`);
        return true;
    }

    async refactorEdit(editId, modifications) {
        const edit = this.pendingEdits.get(editId);
        if (!edit) {
            console.log(`\x1b[91m❌ Edit ${editId} not found\x1b[0m`);
            return false;
        }
        
        console.log(`\x1b[96m🔧 REFACTORING EDIT: ${editId}\x1b[0m`);
        console.log(`\x1b[93m📝 Modifications: ${modifications}\x1b[0m`);
        
        // Create new edit with modifications
        const refactoredEdit = {
            ...edit,
            id: this.generateEditId(),
            status: 'pending',
            timestamp: new Date().toISOString(),
            refactoredFrom: editId,
            refactorReason: modifications,
            description: edit.description + ` (refactored: ${modifications})`
        };
        
        // Mark original as refactored
        edit.status = 'refactored';
        edit.refactoredTo = refactoredEdit.id;
        edit.refactoredAt = new Date().toISOString();
        
        // Remove original and add refactored
        this.pendingEdits.delete(editId);
        this.pendingEdits.set(refactoredEdit.id, refactoredEdit);
        this.editHistory.push(edit);
        
        // Save original to history
        await this.saveEditToHistory(edit);
        
        // Display the refactored edit
        console.log(`\x1b[96m🔄 Original edit marked as refactored\x1b[0m`);
        console.log(`\x1b[92m✨ New refactored edit created: ${refactoredEdit.id}\x1b[0m\n`);
        this.displayProposedEdit(refactoredEdit);
        
        return refactoredEdit.id;
    }
    
    async executeEdit(edit) {
        const { operation } = edit;

        switch (operation.type) {
            case 'surgical_edit':
                return await this.executeSurgicalEdit(edit);
            case 'write_file':
                return await this.executeWriteFile(edit);
            case 'execute_command':
                return await this.executeCommand(operation);
            case 'git_operation':
                return await this.executeGitOperation(operation);
            default:
                throw new Error(`Unknown operation type: ${operation.type}`);
        }
    }

    /**
     * Execute surgical edit - applies the precise string replacement
     */
    async executeSurgicalEdit(edit) {
        const operation = edit.operation;
        const fullPath = path.resolve(this.workspaceRoot, operation.filePath);

        // SECURITY: Validate path is within workspace
        const relativePath = path.relative(this.workspaceRoot, fullPath);
        const normalizedPath = path.normalize(relativePath);
        if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
            throw new Error(`Security violation: Path traversal detected`);
        }

        // Create backup
        if (edit.backup) {
            const backupPath = this.getBackupPath(operation);
            if (backupPath) {
                await fs.mkdir(path.dirname(backupPath), { recursive: true });
                await fs.writeFile(backupPath, edit.backup.content, 'utf8');
                console.log(`\x1b[90m💾 Backup created: ${backupPath}\x1b[0m`);
            }
        }

        // Write the surgically modified content
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, operation.content, 'utf8');

        return {
            success: true,
            path: operation.filePath,
            size: operation.content.length,
            mode: 'surgical',
            linesChanged: edit.diff.linesChanged,
            charactersChanged: edit.diff.charactersChanged
        };
    }
    
    async executeWriteFile(edit) {
        const operation = edit.operation;
        
        // Debug logging for path resolution issue
        if (process.env.DEBUG_MODE === 'true') {
            console.log(`\x1b[90m[DEBUG] executeWriteFile called with:\x1b[0m`);
        }
        console.log(`\x1b[90m  workspaceRoot: ${this.workspaceRoot}\x1b[0m`);
        console.log(`\x1b[90m  operation.filePath: ${operation.filePath}\x1b[0m`);
        
        // Format operation display with proper content preview
        const operationForDisplay = {
            type: operation.type,
            filePath: operation.filePath,
            mode: operation.mode,
            verboseContext: operation.verboseContext,
            sessionContext: operation.sessionContext
        };
        
        console.log(`\x1b[90m  operation: ${JSON.stringify(operationForDisplay, null, 2)}\x1b[0m`);
        
        // Show content preview with proper formatting (first 10 lines)
        if (operation.content) {
            const lines = operation.content.split('\n');
            const previewLines = lines.slice(0, 10);
            console.log(`\x1b[90m  📄 Content Preview:\x1b[0m`);
            previewLines.forEach((line, index) => {
                console.log(`\x1b[90m    ${(index + 1).toString().padStart(2)}: ${line}\x1b[0m`);
            });
            if (lines.length > 10) {
                console.log(`\x1b[90m    ... (${lines.length - 10} more lines)\x1b[0m`);
            }
            console.log(`\x1b[90m  📊 Total: ${lines.length} lines, ${operation.content.length} characters\x1b[0m`);
        }
        
        if (!this.workspaceRoot) {
            throw new Error(`workspaceRoot is not set in EditVersionController`);
        }
        
        if (!operation.filePath) {
            throw new Error(`operation.filePath is missing. Operation type: ${operation.type}, keys: ${Object.keys(operation).join(', ')}`);
        }
        
        const fullPath = path.resolve(this.workspaceRoot, operation.filePath);
        
        // SECURITY: Prevent path traversal attacks using path.relative for better validation
        const relativePath = path.relative(this.workspaceRoot, fullPath);
        const normalizedPath = path.normalize(relativePath);
        if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
            throw new Error(`Security violation: Path traversal detected. File path '${operation.filePath}' resolves outside workspace: ${this.workspaceRoot}`);
        }
        
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        
        // Create backup file if backup data exists
        let backupPath = null;
        if (edit.backup) {
            backupPath = this.getBackupPath(operation);
            if (backupPath) {
                await fs.mkdir(path.dirname(backupPath), { recursive: true });
                await fs.writeFile(backupPath, edit.backup.content, 'utf8');
                console.log(`\x1b[90m💾 Backup created: ${backupPath}\x1b[0m`);
            }
        }
        
        if (operation.mode === 'append') {
            await fs.appendFile(fullPath, operation.content);
        } else {
            await fs.writeFile(fullPath, operation.content);
        }
        
        return { 
            success: true, 
            path: operation.filePath,
            size: operation.content.length,
            mode: operation.mode,
            backupPath: backupPath
        };
    }
    
    async executeCommand(operation) {
        const { exec } = require('child_process');
        
        return new Promise((resolve) => {
            exec(operation.command, { 
                cwd: operation.cwd || this.workspaceRoot 
            }, (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    stdout: stdout || '',
                    stderr: stderr || '',
                    error: error?.message || null
                });
            });
        });
    }
    
    async executeGitOperation(operation) {
        const { exec } = require('child_process');
        const command = `git ${operation.operation} ${operation.args?.join(' ') || ''}`.trim();
        
        return new Promise((resolve) => {
            exec(command, { cwd: this.workspaceRoot }, (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    command,
                    stdout: stdout || '',
                    stderr: stderr || '',
                    error: error?.message || null
                });
            });
        });
    }
    
    async saveEditToHistory(edit) {
        const historyFile = path.join(this.workspaceRoot, '.edits', 'history.json');
        
        try {
            let history = [];
            try {
                const content = await fs.readFile(historyFile, 'utf8');
                history = JSON.parse(content);
            } catch (error) {
                // File doesn't exist or is invalid - start fresh
            }
            
            history.push(edit);
            await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
        } catch (error) {
            console.log(`\x1b[93m⚠️  Could not save edit to history: ${error.message}\x1b[0m`);
        }
    }
    
    displayPendingEdits() {
        if (this.pendingEdits.size === 0) {
            console.log(`\x1b[92m✨ No pending edits\x1b[0m`);
            return;
        }
        
        console.log(`\x1b[95m📋 PENDING EDITS (${this.pendingEdits.size})\x1b[0m`);
        console.log(`\x1b[93m💡 Use 'accept <id>' or 'reject <id>' commands\x1b[0m\n`);
        
        for (const [editId, edit] of this.pendingEdits) {
            this.displayProposedEdit(edit);
        }
    }
    
    getEditStats() {
        return {
            pending: this.pendingEdits.size,
            applied: this.appliedEdits.size,
            rejected: this.rejectedEdits.size,
            total: this.editHistory.length
        };
    }

    getEditDetails(editId) {
        const edit = this.pendingEdits.get(editId);
        if (!edit) {
            return null;
        }
        
        return {
            id: editId,
            operation: edit.operation,
            description: edit.description,
            timestamp: edit.timestamp,
            status: 'pending'
        };
    }

    displayFileDiff(operation) {
        const fs = require('fs');
        const path = require('path');

        if (operation.type === 'write_file') {
            const filePath = operation.filePath;
            const fullPath = path.resolve(this.workspaceRoot, filePath);
            
            // SECURITY: Validate path is within workspace
            const relativePath = path.relative(this.workspaceRoot, fullPath);
            const normalizedPath = path.normalize(relativePath);
            if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
                console.log(`\x1b[91mSecurity violation: Cannot display diff for path outside workspace\x1b[0m`);
                return;
            }
            
            const newContent = operation.content;

            // Read current file content if it exists
            let oldContent = '';
            const fileExists = fs.existsSync(fullPath);
            if (fileExists) {
                try {
                    oldContent = fs.readFileSync(fullPath, 'utf8');
                } catch (error) {
                    console.log(`\x1b[91mWarning: Could not read current file content for diff\x1b[0m`);
                }
            }

            const oldLines = oldContent.split('\n');
            const newLines = newContent.split('\n');

            // Show file status
            const status = fileExists ? 'MODIFIED' : 'NEW FILE';
            console.log(`\x1b[93m🔄 File Change: ${path.basename(filePath)} (${status})\x1b[0m`);
            console.log(`\x1b[90m--------------------------------------------------------------------------------\x1b[0m`);
            console.log(`\x1b[90m@@ -1,${oldLines.length} +1,${newLines.length} @@\x1b[0m`);

            // Simple line-by-line diff display with colors
            const maxLines = Math.max(oldLines.length, newLines.length);
            let contextStart = 0;
            let contextEnd = Math.min(maxLines, 25); // Show up to 25 lines of changes

            // Try to find actual differences to focus on
            let firstDiff = -1;
            let lastDiff = -1;
            for (let i = 0; i < maxLines; i++) {
                const oldLine = oldLines[i] || '';
                const newLine = newLines[i] || '';
                if (oldLine !== newLine) {
                    if (firstDiff === -1) firstDiff = i;
                    lastDiff = i;
                }
            }

            // If we found differences, show context around them
            if (firstDiff >= 0) {
                contextStart = Math.max(0, firstDiff - 2);
                contextEnd = Math.min(maxLines, lastDiff + 3);
            }

            // For new files, show first part
            if (!fileExists && newLines.length > 0) {
                contextStart = 0;
                contextEnd = Math.min(newLines.length, 20);
            }

            for (let i = contextStart; i < contextEnd; i++) {
                const oldLine = oldLines[i] || '';
                const newLine = newLines[i] || '';
                const lineNum = (i + 1).toString().padStart(3);

                if (i >= oldLines.length) {
                    // New line added
                    console.log(`\x1b[32m+${lineNum}\x1b[0m │ \x1b[32m${newLine}\x1b[0m`);
                } else if (i >= newLines.length) {
                    // Line removed
                    console.log(`\x1b[31m-${lineNum}\x1b[0m │ \x1b[31m${oldLine}\x1b[0m`);
                } else if (oldLine !== newLine) {
                    // Line changed
                    console.log(`\x1b[31m-${lineNum}\x1b[0m │ \x1b[31m${oldLine}\x1b[0m`);
                    console.log(`\x1b[32m+${lineNum}\x1b[0m │ \x1b[32m${newLine}\x1b[0m`);
                } else {
                    // Line unchanged (context)
                    console.log(`\x1b[90m ${lineNum}\x1b[0m │ \x1b[90m${oldLine}\x1b[0m`);
                }
            }

            if (contextEnd < maxLines) {
                console.log(`\x1b[90m   ... (${maxLines - contextEnd} more lines)\x1b[0m`);
            }

            // Calculate comprehensive differential statistics
            const stats = this.calculateDifferentialStats(oldLines, newLines);

            console.log(`\x1b[90m--------------------------------------------------------------------------------\x1b[0m`);
            console.log(`\x1b[36m📊 DIFFERENTIAL ANALYSIS:\x1b[0m`);
            console.log(`   \x1b[32m+${stats.linesAdded} additions\x1b[0m`);
            console.log(`   \x1b[31m-${stats.linesRemoved} removals\x1b[0m`);
            console.log(`   \x1b[33m~${stats.linesModified} modifications\x1b[0m`);
        }
    }



    displayNewFilePreview(content, filePath) {
        const lines = content.split('\n');
        
        console.log(`\x1b[92m📝 New File: ${path.basename(filePath)}\x1b[0m`);
        console.log(`\x1b[90m${'-'.repeat(80)}\x1b[0m`);
        
        const previewLines = Math.min(lines.length, 20);
        for (let i = 0; i < previewLines; i++) {
            const lineNum = (i + 1).toString().padStart(3);
            console.log(`\x1b[32m+${lineNum}\x1b[0m │ \x1b[32m${lines[i]}\x1b[0m`);
        }
        
        if (lines.length > previewLines) {
            console.log(`\x1b[90m   ... (${lines.length - previewLines} more lines)\x1b[0m`);
        }
        
        console.log(`\x1b[90m${'-'.repeat(80)}\x1b[0m`);
        console.log(`\x1b[36m📊 Summary: \x1b[32m+${lines.length} new lines\x1b[0m`);
    }

    calculateDifferentialStats(oldLines, newLines) {
        const stats = {
            linesAdded: 0,
            linesRemoved: 0,
            linesModified: 0,
            linesUnchanged: 0,
            totalChanges: 0,
            similarity: 0,
            sizeChange: newLines.length - oldLines.length,
            characterChanges: null,
            impactAnalysis: null
        };

        // Calculate character-level changes
        const oldContent = oldLines.join('\n');
        const newContent = newLines.join('\n');
        stats.characterChanges = {
            old: oldContent.length,
            new: newContent.length,
            delta: newContent.length - oldContent.length
        };

        // Line-by-line analysis
        const maxLines = Math.max(oldLines.length, newLines.length);
        let identicalLines = 0;

        for (let i = 0; i < maxLines; i++) {
            const oldLine = oldLines[i];
            const newLine = newLines[i];

            if (oldLine === undefined && newLine !== undefined) {
                // Line added
                stats.linesAdded++;
            } else if (oldLine !== undefined && newLine === undefined) {
                // Line removed
                stats.linesRemoved++;
            } else if (oldLine !== newLine) {
                // Line modified
                stats.linesModified++;
            } else {
                // Line unchanged
                stats.linesUnchanged++;
                identicalLines++;
            }
        }

        stats.totalChanges = stats.linesAdded + stats.linesRemoved + stats.linesModified;
        
        // Calculate similarity percentage
        if (maxLines > 0) {
            stats.similarity = Math.round((identicalLines / maxLines) * 100);
        }

        // Impact analysis
        stats.impactAnalysis = this.analyzeEditImpact(stats, oldLines, newLines);

        return stats;
    }

    analyzeEditImpact(stats, oldLines, newLines) {
        const changeRatio = stats.totalChanges / Math.max(oldLines.length, newLines.length, 1);
        
        let level, description;
        
        if (changeRatio >= 0.8) {
            level = "🔴 MAJOR";
            description = "Substantial rewrite - review carefully";
        } else if (changeRatio >= 0.5) {
            level = "🟡 SIGNIFICANT";
            description = "Major modifications - thorough review needed";
        } else if (changeRatio >= 0.2) {
            level = "🟠 MODERATE";
            description = "Notable changes - standard review";
        } else if (changeRatio >= 0.05) {
            level = "🟢 MINOR";
            description = "Small adjustments - quick review";
        } else {
            level = "⚪ MINIMAL";
            description = "Tiny changes - safe to apply";
        }

        // Additional context based on change types
        if (stats.linesAdded > stats.linesRemoved * 2) {
            description += " (mostly additions)";
        } else if (stats.linesRemoved > stats.linesAdded * 2) {
            description += " (mostly deletions)";
        } else if (stats.linesModified > (stats.linesAdded + stats.linesRemoved)) {
            description += " (mostly modifications)";
        }

        return { level, description };
    }

    displayVersioningInfo(operation, editId) {
        const fs = require('fs');
        const path = require('path');
        
        console.log(`\x1b[95m📋 VERSION CONTROL DATA:\x1b[0m`);
        
        // Edit metadata
        console.log(`   \x1b[94mEdit ID:\x1b[0m ${editId}`);
        console.log(`   \x1b[94mTimestamp:\x1b[0m ${new Date().toISOString()}`);
        console.log(`   \x1b[94mOperation:\x1b[0m ${operation.type}`);
        
        if (operation.type === 'write_file') {
            // File versioning info
            const filePath = operation.filePath;
            const fileName = path.basename(filePath);
            const fileDir = path.dirname(filePath);
            
            console.log(`   \x1b[94mTarget:\x1b[0m ${fileName} in ${fileDir}`);
            
            // Check if file exists and get current version info
            if (fs.existsSync(filePath)) {
                try {
                    const stats = fs.statSync(filePath);
                    console.log(`   \x1b[94mCurrent Version:\x1b[0m Modified ${stats.mtime.toISOString()}`);
                    console.log(`   \x1b[94mCurrent Size:\x1b[0m ${stats.size} bytes`);
                    console.log(`   \x1b[94mState Transition:\x1b[0m EXISTING → MODIFIED`);
                } catch (error) {
                    console.log(`   \x1b[91mVersion Error:\x1b[0m Cannot read current file state`);
                }
            } else {
                console.log(`   \x1b[94mState Transition:\x1b[0m NON-EXISTENT → NEW FILE`);
            }
            
            // Future version info
            const newSize = Buffer.byteLength(operation.content, 'utf8');
            console.log(`   \x1b[94mProposed Size:\x1b[0m ${newSize} bytes`);
            console.log(`   \x1b[94mProposed Lines:\x1b[0m ${operation.content.split('\n').length}`);
        }
        
        // Backup information
        const backupPath = this.getBackupPath(operation);
        if (backupPath) {
            console.log(`   \x1b[94mBackup Location:\x1b[0m ${backupPath}`);
            console.log(`   \x1b[94mRecovery:\x1b[0m Available if edit is rejected`);
        }
        
        console.log(`   \x1b[94mReversible:\x1b[0m ${operation.type === 'write_file' ? 'Yes (via backup)' : 'Depends on operation'}`);
    }

    getBackupPath(operation) {
        if (operation.type === 'write_file') {
            const path = require('path');
            const fileName = path.basename(operation.filePath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            // Use dated subdirectories for backups
            const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const backupDir = path.join(this.editsDir, 'backups', dateStr);
            
            // Clean up old backups before creating new ones
            this.cleanupOldBackups();
            
            return path.join(backupDir, `${fileName}.backup.${timestamp}`);
        }
        return null;
    }

    // Clean up backup directories older than 30 days
    async cleanupOldBackups() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const backupRoot = path.join(this.editsDir, 'backups');
            
            // Ensure backup root directory exists
            await fs.mkdir(backupRoot, { recursive: true });
            
            const dirs = await fs.readdir(backupRoot);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep last 30 days
            
            for (const dir of dirs) {
                const dirPath = path.join(backupRoot, dir);
                const stats = await fs.stat(dirPath);
                
                if (stats.isDirectory() && stats.mtime < cutoffDate) {
                    // Remove old backup directories
                    await fs.rm(dirPath, { recursive: true, force: true });
                    this.debugLog(`Cleaned up old backup directory: ${dir}`);
                }
            }
        } catch (error) {
            // Don't fail the operation if cleanup fails
            this.debugLog(`Backup cleanup failed: ${error.message}`);
        }
    }

    displayAppliedEditSummary(edit, result) {
        console.log('');
        console.log(`\x1b[96m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
        console.log(`\x1b[92m✅ EDIT SUCCESSFULLY APPLIED\x1b[0m`);
        console.log(`\x1b[96m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
        
        if (edit.operation.type === 'write_file') {
            console.log(`\x1b[93m📁 File:\x1b[0m ${edit.operation.filePath}`);
            console.log(`\x1b[93m💾 Size:\x1b[0m ${result.size} bytes`);
            console.log(`\x1b[93m📊 Lines:\x1b[0m ${edit.operation.content ? edit.operation.content.split('\n').length : 'N/A'}`);
            console.log(`\x1b[93m⚡ Mode:\x1b[0m ${edit.operation.mode || 'write'}`);
        } else {
            console.log(`\x1b[93m🔧 Operation:\x1b[0m ${edit.operation.type}`);
            if (edit.operation.command) {
                console.log(`\x1b[93m💻 Command:\x1b[0m ${edit.operation.command}`);
            }
        }
        
        console.log(`\x1b[93m🕒 Applied:\x1b[0m ${new Date(edit.appliedAt).toLocaleTimeString()}`);
        console.log(`\x1b[93m🆔 Edit ID:\x1b[0m ${edit.id}`);
        
        if (result.success) {
            console.log(`\x1b[92m✅ Status:\x1b[0m Operation completed successfully`);
        } else {
            console.log(`\x1b[91m❌ Status:\x1b[0m Operation failed`);
        }
        
        console.log(`\x1b[96m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
        console.log('');
    }
}

module.exports = { EditVersionController };
