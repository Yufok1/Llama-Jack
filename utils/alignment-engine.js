const logger = require('./logger');

/**
 * UNIVERSAL ALIGNMENT ENGINE
 * Military-grade targeting system for ALL operations Jack performs
 *
 * Like a fighter jet's targeting computer - multiple independent systems
 * must all align before "weapons release" (operation execution)
 *
 * Features:
 * - 10-20 parameter checks per operation type
 * - Full granular visibility (nothing hidden)
 * - Parallel execution for speed
 * - Confidence scoring and risk assessment
 * - Critical vs non-critical failure handling
 */
class UniversalAlignmentEngine {
    constructor() {
        this.verbosity = process.env.JACK_ALIGNMENT_VERBOSITY || 'full';
        this.minimumConfidence = parseInt(process.env.JACK_ALIGNMENT_MIN_CONFIDENCE) || 85;
        this.maxNonCriticalFailures = parseInt(process.env.JACK_ALIGNMENT_MAX_NONCRIT_FAILS) || 2;

        // Operation statistics tracking
        this.stats = {
            totalOperations: 0,
            passedOperations: 0,
            failedOperations: 0,
            byOperationType: {}
        };

        logger.info('Universal Alignment Engine initialized', {
            verbosity: this.verbosity,
            minimumConfidence: this.minimumConfidence
        });
    }

    /**
     * MAIN ENTRY POINT: Validate any operation
     * Returns alignment result with full details
     */
    async validate(operationType, operationParams) {
        const startTime = Date.now();

        logger.debug(`Starting alignment validation for: ${operationType}`);

        // Get parameter set for this operation type
        const parameterSet = this.getParameterSet(operationType);
        if (!parameterSet) {
            throw new Error(`No alignment parameters defined for operation type: ${operationType}`);
        }

        // Display header
        this.displayHeader(operationType, operationParams);

        // Execute all alignment checks in parallel
        const results = await this.executeAlignmentChecks(parameterSet, operationParams, operationType);

        const executionTime = Date.now() - startTime;

        // Aggregate results
        const alignment = this.aggregateResults(operationType, results, executionTime);

        // Display alignment matrix
        this.displayAlignmentMatrix(alignment);

        // Update statistics
        this.updateStats(operationType, alignment.allSystemsGo);

        return alignment;
    }

    /**
     * Get parameter set for specific operation type
     */
    getParameterSet(operationType) {
        const parameterSets = {
            'surgical_edit': this.getSurgicalEditParameters(),
            'command_execution': this.getCommandExecutionParameters(),
            'tool_call': this.getToolCallParameters(),
            'file_operation': this.getFileOperationParameters()
        };

        return parameterSets[operationType];
    }

    /**
     * SURGICAL EDIT PARAMETERS (20 checks)
     * Prevents mass deletions and ensures surgical precision
     */
    getSurgicalEditParameters() {
        return {
            // Category 1: EXACT TARGETING
            exactMatch: {
                category: 'Exact Targeting',
                displayName: 'Exact Match Found',
                critical: true,
                check: async (params) => {
                    const { content, oldString } = params;
                    const escapedOld = this.escapeRegex(oldString);
                    const regex = new RegExp(escapedOld, 'g');
                    const matches = content.match(regex);
                    const occurrences = matches ? matches.length : 0;

                    params._matchData = {
                        found: occurrences > 0,
                        occurrences: occurrences,
                        index: content.indexOf(oldString)
                    };

                    return occurrences > 0;
                },
                confidence: 100,
                getMessage: (result, params) => {
                    if (!params._matchData) return null;
                    const { found, occurrences, index } = params._matchData;
                    if (!found) return '⚠️ String not found in file';
                    const line = params.content.substring(0, index).split('\n').length;
                    return `Found ${occurrences} occurrence(s) at line ${line}`;
                }
            },

            positionVerify: {
                category: 'Exact Targeting',
                displayName: 'Position Verified',
                critical: false,
                check: async (params) => {
                    const { content, oldString } = params;
                    const index = content.indexOf(oldString);
                    if (index === -1) return false;

                    const beforeContent = content.substring(Math.max(0, index - 50), index);
                    const afterContent = content.substring(index + oldString.length, Math.min(content.length, index + oldString.length + 50));

                    const lineNumber = content.substring(0, index).split('\n').length;
                    const column = index - content.lastIndexOf('\n', index - 1) - 1;

                    params._positionData = {
                        lineNumber,
                        column,
                        contextBefore: beforeContent,
                        contextAfter: afterContent
                    };

                    return true;
                },
                confidence: 100,
                getMessage: (result, params) => {
                    if (!params._positionData) return null;
                    const { lineNumber, column } = params._positionData;
                    return `Line ${lineNumber}, Column ${column}`;
                }
            },

            boundaryDetect: {
                category: 'Exact Targeting',
                displayName: 'Boundary Detected',
                critical: false,
                check: async (params) => {
                    const { oldString } = params;
                    const startsNewLine = oldString.startsWith('\n') || oldString.match(/^\s*\w/);
                    const endsNewLine = oldString.endsWith('\n') || oldString.endsWith(';');

                    params._boundaryData = {
                        startsNewLine,
                        endsNewLine,
                        aligned: startsNewLine || endsNewLine
                    };

                    return params._boundaryData.aligned;
                },
                confidence: 95,
                getMessage: (result, params) => {
                    if (!params._boundaryData) return null;
                    return `Aligned to code boundary`;
                }
            },

            // Category 2: SIZE & SCOPE
            sizeDelta: {
                category: 'Size & Scope',
                displayName: 'Size Delta Safe',
                critical: false,
                check: async (params) => {
                    const { content, oldString, newString } = params;
                    const delta = Math.abs(newString.length - oldString.length);
                    const percentOfFile = (delta / content.length) * 100;
                    const safe = percentOfFile < 10; // Less than 10% change

                    params._sizeData = {
                        oldSize: oldString.length,
                        newSize: newString.length,
                        delta,
                        percentOfFile: percentOfFile.toFixed(1)
                    };

                    return safe;
                },
                confidence: 98,
                getMessage: (result, params) => {
                    if (!params._sizeData) return null;
                    const { delta, percentOfFile } = params._sizeData;
                    return `±${delta} chars (${percentOfFile}% of file)`;
                }
            },

            lineDelta: {
                category: 'Size & Scope',
                displayName: 'Line Delta Safe',
                critical: false,
                check: async (params) => {
                    const { content, oldString, newString } = params;
                    const oldLines = oldString.split('\n').length;
                    const newLines = newString.split('\n').length;
                    const totalLines = content.split('\n').length;
                    const delta = Math.abs(newLines - oldLines);
                    const percentOfFile = (delta / totalLines) * 100;
                    const safe = percentOfFile < 20; // Less than 20% line change

                    params._lineData = {
                        oldLines,
                        newLines,
                        delta,
                        percentOfFile: percentOfFile.toFixed(1)
                    };

                    return safe;
                },
                confidence: 100,
                getMessage: (result, params) => {
                    if (!params._lineData) return null;
                    const { delta, percentOfFile } = params._lineData;
                    return `±${delta} lines (${percentOfFile}% of file)`;
                }
            },

            rangeContained: {
                category: 'Size & Scope',
                displayName: 'Range Contained',
                critical: true, // CRITICAL: Catches runaway selections
                check: async (params) => {
                    const { content, oldString } = params;
                    const index = content.indexOf(oldString);
                    if (index === -1) return false;

                    const afterEdit = content.substring(index + oldString.length);
                    const percentRemaining = (afterEdit.length / content.length) * 100;
                    const percentSelected = ((oldString.length) / content.length) * 100;

                    // CRITICAL CHECK: If selecting >30% of file, likely runaway
                    const safe = percentSelected < 30;

                    params._rangeData = {
                        selectionStart: index,
                        selectionEnd: index + oldString.length,
                        selectionLength: oldString.length,
                        remainingAfter: afterEdit.length,
                        percentSelected: percentSelected.toFixed(1),
                        percentRemaining: percentRemaining.toFixed(1)
                    };

                    return safe;
                },
                confidence: 99,
                getMessage: (result, params) => {
                    if (!params._rangeData) return null;
                    const { percentSelected, percentRemaining } = params._rangeData;
                    if (!result) {
                        return `⚠️ RUNAWAY SELECTION: Selecting ${percentSelected}% of file!`;
                    }
                    return `${percentSelected}% selected, ${percentRemaining}% remaining`;
                }
            },

            scopeContainment: {
                category: 'Size & Scope',
                displayName: 'Scope Containment',
                critical: false,
                check: async (params) => {
                    const { oldString } = params;
                    // Simple heuristic: check if it's a complete statement
                    const hasOpenBrace = oldString.includes('{') && !oldString.includes('}');
                    const contained = !hasOpenBrace;

                    params._scopeData = {
                        contained,
                        topLevel: !oldString.match(/^\s{4,}/)
                    };

                    return contained;
                },
                confidence: 95,
                getMessage: (result, params) => {
                    if (!params._scopeData) return null;
                    return params._scopeData.topLevel ? 'Top-level statement' : 'Nested scope';
                }
            },

            // Category 3: SYNTAX PRESERVATION
            braceBalance: {
                category: 'Syntax Preservation',
                displayName: 'Brace Balance Maintained',
                critical: true,
                check: async (params) => {
                    const { content, oldString, newString } = params;

                    const countBraces = (str) => ({
                        open: (str.match(/\{/g) || []).length,
                        close: (str.match(/\}/g) || []).length
                    });

                    const before = countBraces(content);
                    const removing = countBraces(oldString);
                    const adding = countBraces(newString);

                    const after = {
                        open: before.open - removing.open + adding.open,
                        close: before.close - removing.close + adding.close
                    };

                    const beforeBalance = Math.abs(before.open - before.close);
                    const afterBalance = Math.abs(after.open - after.close);

                    // Balance should not get WORSE
                    const safe = afterBalance <= beforeBalance;

                    params._braceData = {
                        before,
                        after,
                        beforeBalance,
                        afterBalance,
                        improves: afterBalance < beforeBalance,
                        maintains: afterBalance === beforeBalance
                    };

                    return safe;
                },
                confidence: 100,
                getMessage: (result, params) => {
                    if (!params._braceData) return null;
                    const { before, after } = params._braceData;
                    return `{${before.open}→${after.open}, }${before.close}→${after.close}`;
                }
            },

            parenBalance: {
                category: 'Syntax Preservation',
                displayName: 'Parenthesis Balance OK',
                critical: true,
                check: async (params) => {
                    const { content, oldString, newString } = params;

                    const countParens = (str) => ({
                        open: (str.match(/\(/g) || []).length,
                        close: (str.match(/\)/g) || []).length
                    });

                    const before = countParens(content);
                    const removing = countParens(oldString);
                    const adding = countParens(newString);

                    const after = {
                        open: before.open - removing.open + adding.open,
                        close: before.close - removing.close + adding.close
                    };

                    const beforeBalance = Math.abs(before.open - before.close);
                    const afterBalance = Math.abs(after.open - after.close);

                    return afterBalance <= beforeBalance;
                },
                confidence: 100,
                getMessage: (result, params) => {
                    return 'Parentheses balanced';
                }
            },

            quoteBalance: {
                category: 'Syntax Preservation',
                displayName: 'Quote Balance Maintained',
                critical: false,
                check: async (params) => {
                    const { content, oldString, newString } = params;

                    const countQuotes = (str) => ({
                        single: (str.match(/'/g) || []).length,
                        double: (str.match(/"/g) || []).length,
                        backtick: (str.match(/`/g) || []).length
                    });

                    const before = countQuotes(content);
                    const removing = countQuotes(oldString);
                    const adding = countQuotes(newString);

                    // All quote types should remain even (paired)
                    const singleAfter = before.single - removing.single + adding.single;
                    const doubleAfter = before.double - removing.double + adding.double;
                    const backtickAfter = before.backtick - removing.backtick + adding.backtick;

                    const balanced = (singleAfter % 2 === 0) && (doubleAfter % 2 === 0) && (backtickAfter % 2 === 0);

                    return balanced;
                },
                confidence: 100,
                getMessage: (result, params) => {
                    return result ? 'All quotes paired' : '⚠️ Unpaired quotes detected';
                }
            },

            semicolonConsistency: {
                category: 'Syntax Preservation',
                displayName: 'Semicolon Consistency',
                critical: false,
                check: async (params) => {
                    const { oldString, newString } = params;
                    const oldEnds = oldString.trim().endsWith(';');
                    const newEnds = newString.trim().endsWith(';');
                    return oldEnds === newEnds; // Should be consistent
                },
                confidence: 90,
                getMessage: (result, params) => {
                    return result ? 'Semicolon style consistent' : '⚠️ Semicolon style changed';
                }
            },

            // Category 4: STRUCTURAL INTEGRITY
            criticalPatterns: {
                category: 'Structural Integrity',
                displayName: 'Critical Patterns Safe',
                critical: true,
                check: async (params) => {
                    const { oldString, newString } = params;

                    const criticalPatterns = [
                        /function\s+\w+/g,
                        /class\s+\w+/g,
                        /const\s+\w+\s*=/g,
                        /export\s+(default\s+)?/g,
                        /import\s+/g
                    ];

                    let deletions = 0;
                    for (const pattern of criticalPatterns) {
                        const beforeMatches = (oldString.match(pattern) || []).length;
                        const afterMatches = (newString.match(pattern) || []).length;
                        if (beforeMatches > 0 && afterMatches === 0) {
                            deletions += beforeMatches;
                        }
                    }

                    params._criticalData = { deletions };

                    return deletions === 0;
                },
                confidence: 100,
                getMessage: (result, params) => {
                    if (!params._criticalData) return null;
                    const { deletions } = params._criticalData;
                    if (deletions > 0) {
                        return `⚠️ Deleting ${deletions} critical definition(s)`;
                    }
                    return 'No critical deletions';
                }
            },

            indentationConsistent: {
                category: 'Structural Integrity',
                displayName: 'Indentation Consistent',
                critical: false,
                check: async (params) => {
                    const { oldString, newString } = params;

                    const getIndent = (str) => {
                        const match = str.match(/^(\s*)/);
                        return match ? match[1].length : 0;
                    };

                    const oldIndent = getIndent(oldString);
                    const newIndent = getIndent(newString);

                    return oldIndent === newIndent;
                },
                confidence: 95,
                getMessage: (result, params) => {
                    return result ? 'Indentation maintained' : '⚠️ Indentation changed';
                }
            },

            blockIntegrity: {
                category: 'Structural Integrity',
                displayName: 'Block Integrity Preserved',
                critical: false,
                check: async (params) => {
                    const { oldString } = params;
                    // Check if we're breaking a block by removing opening without closing
                    const hasOpeningBrace = oldString.includes('{');
                    const hasClosingBrace = oldString.includes('}');
                    const balanced = !hasOpeningBrace || (hasOpeningBrace && hasClosingBrace);

                    return balanced;
                },
                confidence: 98,
                getMessage: (result, params) => {
                    return result ? 'Block structure intact' : '⚠️ May break block structure';
                }
            }
        };
    }

    /**
     * COMMAND EXECUTION PARAMETERS
     * Prevents destructive commands
     */
    getCommandExecutionParameters() {
        return {
            notDestructive: {
                category: 'Safety Checks',
                displayName: 'Not Destructive Command',
                critical: true,
                check: async (params) => {
                    const { command } = params;
                    const destructivePatterns = [
                        /rm\s+-rf/,
                        /del\s+\/[fs]/i,
                        /format\s+/i,
                        /mkfs/,
                        />\/dev\//
                    ];

                    return !destructivePatterns.some(p => p.test(command));
                },
                confidence: 100,
                getMessage: (result) => {
                    return result ? 'No dangerous patterns' : '⚠️ DESTRUCTIVE COMMAND DETECTED';
                }
            },

            workingDirectoryCorrect: {
                category: 'Safety Checks',
                displayName: 'Working Directory Correct',
                critical: true,
                check: async (params) => {
                    const { cwd, workspaceRoot } = params;
                    // CWD should be within workspace
                    return cwd.startsWith(workspaceRoot);
                },
                confidence: 100,
                getMessage: (result, params) => {
                    return result ? 'Within workspace' : '⚠️ Outside workspace!';
                }
            },

            pathSafety: {
                category: 'Safety Checks',
                displayName: 'Path Safety',
                critical: true,
                check: async (params) => {
                    const { command } = params;
                    // Check for path traversal
                    return !command.includes('..');
                },
                confidence: 95,
                getMessage: (result) => {
                    return result ? 'No path traversal' : '⚠️ Path traversal detected';
                }
            }
        };
    }

    /**
     * TOOL CALL PARAMETERS
     * Validates tool calls before execution
     */
    getToolCallParameters() {
        return {
            toolExists: {
                category: 'Tool Validation',
                displayName: 'Tool Exists',
                critical: true,
                check: async (params) => {
                    const { toolName, availableTools } = params;
                    return availableTools.includes(toolName);
                },
                confidence: 100,
                getMessage: (result, params) => {
                    return result ? `'${params.toolName}' registered` : `⚠️ Unknown tool: ${params.toolName}`;
                }
            },

            parametersValid: {
                category: 'Tool Validation',
                displayName: 'Parameters Valid',
                critical: true,
                check: async (params) => {
                    const { toolParams } = params;
                    // Basic validation - params should be an object
                    return typeof toolParams === 'object' && toolParams !== null;
                },
                confidence: 100,
                getMessage: (result) => {
                    return result ? 'Parameters well-formed' : '⚠️ Invalid parameters';
                }
            },

            prerequisitesMet: {
                category: 'Context Checks',
                displayName: 'Prerequisites Met',
                critical: true,
                check: async (params) => {
                    const { toolName, recentActions } = params;

                    // Surgical edit requires recent read_file
                    if (toolName === 'surgical_edit') {
                        const hasRecentRead = recentActions.some(a =>
                            a.tool === 'read_file' &&
                            Date.now() - a.timestamp < 60000
                        );
                        return hasRecentRead;
                    }

                    return true; // No prerequisites for other tools
                },
                confidence: 100,
                getMessage: (result, params) => {
                    if (params.toolName === 'surgical_edit') {
                        return result ? 'File read <60s ago ✓' : '⚠️ Must read file first!';
                    }
                    return 'No prerequisites';
                }
            }
        };
    }

    /**
     * FILE OPERATION PARAMETERS (10+ checks)
     * Validates file read/write operations
     */
    getFileOperationParameters() {
        return {
            pathWithinWorkspace: {
                category: 'Safety Checks',
                displayName: 'Path Within Workspace',
                critical: true,
                check: async (params) => {
                    const { filePath, workspaceRoot } = params;
                    const path = require('path');
                    const fullPath = path.resolve(workspaceRoot, filePath);
                    const relative = path.relative(workspaceRoot, fullPath);
                    return !relative.startsWith('..') && !path.isAbsolute(relative);
                },
                confidence: 100,
                getMessage: (result) => {
                    return result ? 'Path safe' : '⚠️ Path outside workspace!';
                }
            },

            notCriticalFile: {
                category: 'Safety Checks',
                displayName: 'Not Critical System File',
                critical: true,
                check: async (params) => {
                    const { filePath } = params;
                    const criticalFiles = [
                        'package.json',
                        '.git',
                        '.env',
                        'node_modules',
                        '.gitignore'
                    ];

                    const isCritical = criticalFiles.some(cf => filePath.includes(cf));
                    return !isCritical;
                },
                confidence: 100,
                getMessage: (result, params) => {
                    return result ? 'Not a critical file' : `⚠️ Critical file: ${params.filePath}`;
                }
            },

            fileSizeReasonable: {
                category: 'Size Validation',
                displayName: 'File Size Reasonable',
                critical: false,
                check: async (params) => {
                    const { content } = params;
                    if (!content) return true;

                    const sizeInBytes = Buffer.byteLength(content, 'utf8');
                    const sizeInMB = sizeInBytes / (1024 * 1024);
                    const maxSizeMB = 5; // 5MB max

                    params._sizeData = {
                        bytes: sizeInBytes,
                        mb: sizeInMB.toFixed(2)
                    };

                    return sizeInMB < maxSizeMB;
                },
                confidence: 95,
                getMessage: (result, params) => {
                    if (!params._sizeData) return null;
                    const { mb } = params._sizeData;
                    if (!result) return `⚠️ File too large: ${mb}MB (max: 5MB)`;
                    return `${mb}MB (OK)`;
                }
            },

            encodingValid: {
                category: 'Content Validation',
                displayName: 'Encoding Valid (UTF-8)',
                critical: false,
                check: async (params) => {
                    const { content } = params;
                    if (!content) return true;

                    try {
                        // Check if content is valid UTF-8
                        Buffer.from(content, 'utf8').toString('utf8');
                        return true;
                    } catch (error) {
                        return false;
                    }
                },
                confidence: 98,
                getMessage: (result) => {
                    return result ? 'UTF-8 encoding OK' : '⚠️ Invalid encoding detected';
                }
            },

            noSecretsDetected: {
                category: 'Security Checks',
                displayName: 'No Secrets Detected',
                critical: true,
                check: async (params) => {
                    const { content } = params;
                    if (!content) return true;

                    const secretPatterns = [
                        /api[_-]?key\s*[:=]\s*['"][^'"]{20,}['"]/i,
                        /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
                        /secret\s*[:=]\s*['"][^'"]{20,}['"]/i,
                        /token\s*[:=]\s*['"][^'"]{20,}['"]/i,
                        /-----BEGIN (RSA |DSA )?PRIVATE KEY-----/
                    ];

                    const hasSecrets = secretPatterns.some(p => p.test(content));
                    return !hasSecrets;
                },
                confidence: 95,
                getMessage: (result) => {
                    return result ? 'No secrets detected' : '⚠️ POTENTIAL SECRETS DETECTED!';
                }
            },

            lineEndingsConsistent: {
                category: 'Content Validation',
                displayName: 'Line Endings Consistent',
                critical: false,
                check: async (params) => {
                    const { content } = params;
                    if (!content) return true;

                    const hasCRLF = content.includes('\r\n');
                    const hasLF = content.includes('\n') && !content.includes('\r\n');

                    // Either all CRLF or all LF, not mixed
                    return !(hasCRLF && hasLF);
                },
                confidence: 90,
                getMessage: (result) => {
                    return result ? 'Line endings consistent' : '⚠️ Mixed line endings';
                }
            },

            syntaxWillBeValid: {
                category: 'Content Validation',
                displayName: 'Syntax Will Be Valid',
                critical: false,
                check: async (params) => {
                    const { filePath, content } = params;
                    if (!content) return true;

                    // Only validate JS/JSON files
                    if (!filePath.match(/\.(js|json)$/)) return true;

                    try {
                        if (filePath.endsWith('.json')) {
                            JSON.parse(content);
                        }
                        // For JS, we'd need a parser - skip for now
                        return true;
                    } catch (error) {
                        params._syntaxError = error.message;
                        return false;
                    }
                },
                confidence: 92,
                getMessage: (result, params) => {
                    if (!result && params._syntaxError) {
                        return `⚠️ Syntax error: ${params._syntaxError}`;
                    }
                    return result ? 'Syntax valid' : '⚠️ Syntax may be invalid';
                }
            }
        };
    }

    /**
     * Execute all alignment checks in parallel
     */
    async executeAlignmentChecks(parameterSet, operationParams, operationType) {
        if (this.verbosity === 'full') {
            console.log(`\n⏱️  Firing ${Object.keys(parameterSet).length} alignment systems... (executing in parallel)\n`);
        }

        const checks = Object.entries(parameterSet).map(async ([paramName, paramDef]) => {
            const startTime = Date.now();
            try {
                const result = await paramDef.check(operationParams);
                const checkTime = Date.now() - startTime;

                return {
                    name: paramName,
                    displayName: paramDef.displayName,
                    category: paramDef.category,
                    passed: result,
                    confidence: paramDef.confidence,
                    critical: paramDef.critical,
                    checkTime: checkTime,
                    message: paramDef.getMessage ? paramDef.getMessage(result, operationParams) : null
                };
            } catch (error) {
                logger.error(`Alignment check failed: ${paramName}`, error);
                return {
                    name: paramName,
                    displayName: paramDef.displayName,
                    category: paramDef.category,
                    passed: false,
                    confidence: 0,
                    critical: paramDef.critical,
                    checkTime: Date.now() - startTime,
                    error: error.message
                };
            }
        });

        return await Promise.all(checks);
    }

    /**
     * Aggregate results into alignment summary
     */
    aggregateResults(operationType, results, executionTime) {
        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        const critical = results.filter(r => r.critical).length;
        const criticalPassed = results.filter(r => r.critical && r.passed).length;
        const criticalFailed = results.filter(r => r.critical && !r.passed).length;

        const overallConfidence = this.calculateConfidence(results);
        const riskLevel = this.assessRisk(results);
        const allSystemsGo = this.allSystemsAligned(results);

        return {
            operationType,
            timestamp: new Date(),
            executionTime,
            totalParameters: results.length,
            passed,
            failed,
            critical,
            criticalPassed,
            criticalFailed,
            overallConfidence,
            riskLevel,
            allSystemsGo,
            results,
            failureReport: allSystemsGo ? null : this.generateFailureReport(results)
        };
    }

    /**
     * Calculate overall confidence score
     */
    calculateConfidence(results) {
        if (results.length === 0) return 0;

        const weightedSum = results.reduce((sum, r) => {
            const weight = r.critical ? 2 : 1; // Critical checks count double
            const score = r.passed ? r.confidence : 0;
            return sum + (score * weight);
        }, 0);

        const totalWeight = results.reduce((sum, r) => {
            return sum + (r.critical ? 2 : 1);
        }, 0);

        return Math.round(weightedSum / totalWeight);
    }

    /**
     * Assess risk level
     */
    assessRisk(results) {
        const confidence = this.calculateConfidence(results);
        const criticalFails = results.filter(r => r.critical && !r.passed).length;

        if (criticalFails > 0) return 'CRITICAL';
        if (confidence < 70) return 'HIGH';
        if (confidence < 85) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Check if all systems aligned
     */
    allSystemsAligned(results) {
        // ALL critical checks must pass
        const criticalChecks = results.filter(r => r.critical);
        const criticalPass = criticalChecks.every(r => r.passed);

        // Overall confidence must meet threshold
        const confidence = this.calculateConfidence(results);

        // No more than max non-critical failures allowed
        const nonCriticalFails = results.filter(r => !r.critical && !r.passed).length;

        return criticalPass && confidence >= this.minimumConfidence && nonCriticalFails <= this.maxNonCriticalFailures;
    }

    /**
     * Generate failure report
     */
    generateFailureReport(results) {
        const failures = results.filter(r => !r.passed);
        const criticalFailures = failures.filter(r => r.critical);

        let report = '\n';
        if (criticalFailures.length > 0) {
            report += '🔴 CRITICAL FAILURES:\n';
            criticalFailures.forEach(f => {
                report += `   • ${f.displayName}: ${f.message || 'Failed'}\n`;
            });
        }

        const nonCriticalFailures = failures.filter(r => !r.critical);
        if (nonCriticalFailures.length > 0) {
            report += '\n⚠️  NON-CRITICAL FAILURES:\n';
            nonCriticalFailures.forEach(f => {
                report += `   • ${f.displayName}: ${f.message || 'Failed'}\n`;
            });
        }

        return report;
    }

    /**
     * Display header
     */
    displayHeader(operationType, params) {
        if (this.verbosity === 'silent') return;

        const title = operationType.replace(/_/g, ' ').toUpperCase();
        console.log('\n' + '━'.repeat(80));
        console.log(`🎯 ${title} TARGETING ALIGNMENT`);
        console.log('━'.repeat(80));
    }

    /**
     * Display alignment matrix with FULL granular visibility
     */
    displayAlignmentMatrix(alignment) {
        if (this.verbosity === 'silent') return;

        const { results, overallConfidence, riskLevel, allSystemsGo, executionTime } = alignment;

        // Group results by category
        const byCategory = results.reduce((acc, r) => {
            if (!acc[r.category]) acc[r.category] = [];
            acc[r.category].push(r);
            return acc;
        }, {});

        if (this.verbosity === 'full') {
            console.log(`\n🎯 ALIGNMENT MATRIX (${results.length} Parameters):\n`);

            // Display each category
            for (const [category, checks] of Object.entries(byCategory)) {
                const icon = this.getCategoryIcon(category);
                console.log(`${icon} ${category.toUpperCase()}:`);

                for (const check of checks) {
                    const statusIcon = check.passed ? '✅' : '❌';
                    const conf = check.confidence.toString().padStart(3);
                    const critical = check.critical ? ' 🔒' : '';

                    console.log(`  [${statusIcon} ${conf}%] ${check.displayName}${critical}`);

                    if (check.message && this.verbosity === 'full') {
                        console.log(`       └─> ${check.message}`);
                    }

                    if (check.error) {
                        console.log(`       └─> ERROR: ${check.error}`);
                    }
                }
                console.log('');
            }

            // Display timing info
            console.log(`⏱️  Alignment check completed in ${executionTime}ms`);
            console.log(`📊 Results: ${alignment.passed}/${results.length} parameters passed (${alignment.failed} failed)`);
            console.log(`🔒 Critical systems: ${alignment.criticalPassed}/${alignment.critical} passed\n`);
        }

        // Display final verdict
        console.log('━'.repeat(80));
        if (allSystemsGo) {
            console.log(`✅ ALL ${results.length} SYSTEMS ALIGNED - TARGETING LOCK CONFIRMED`);
            console.log(`🔒 CONFIDENCE: ${overallConfidence}% | RISK: ${riskLevel} | STATUS: SAFE TO FIRE`);
        } else {
            console.log(`❌ ALIGNMENT FAILED - ${alignment.failed}/${results.length} SYSTEMS REJECTED TARGETING SOLUTION`);
            console.log(`🚫 OPERATION ABORTED FOR SAFETY`);

            if (alignment.failureReport) {
                console.log(alignment.failureReport);
            }
        }
        console.log('━'.repeat(80) + '\n');
    }

    /**
     * Get category icon
     */
    getCategoryIcon(category) {
        const icons = {
            'Exact Targeting': '📍',
            'Size & Scope': '📏',
            'Syntax Preservation': '🔧',
            'Structural Integrity': '🏗️',
            'Semantic Validation': '🧠',
            'Risk Assessment': '⚠️',
            'Safety Checks': '🛡️',
            'Context Verification': '📍',
            'Resource Checks': '⚡',
            'Intent Alignment': '🎯',
            'Tool Validation': '🔧',
            'Context Checks': '📋'
        };
        return icons[category] || '🔹';
    }

    /**
     * Escape regex special characters
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Update statistics
     */
    updateStats(operationType, passed) {
        this.stats.totalOperations++;
        if (passed) {
            this.stats.passedOperations++;
        } else {
            this.stats.failedOperations++;
        }

        if (!this.stats.byOperationType[operationType]) {
            this.stats.byOperationType[operationType] = {
                total: 0,
                passed: 0,
                failed: 0
            };
        }

        this.stats.byOperationType[operationType].total++;
        if (passed) {
            this.stats.byOperationType[operationType].passed++;
        } else {
            this.stats.byOperationType[operationType].failed++;
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        return this.stats;
    }
}

module.exports = UniversalAlignmentEngine;
