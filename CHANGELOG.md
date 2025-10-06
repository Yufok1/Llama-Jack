# Changelog

All notable changes to Llama Jack will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-09-30

### 🚀 **MAJOR RELIABILITY & PERFORMANCE IMPROVEMENTS**

### Added
- **Enhanced Error Handling & Logging System**
  - 🎯 Centralized logger utility (`utils/logger.js`) with 5 levels: ERROR, WARN, INFO, DEBUG, TRACE
  - 🎨 Color-coded output with timestamps for better debugging
  - 🔧 Environment-controlled logging via `JACK_LOG_LEVEL` setting
  - ⏱️ Enhanced executeCommand with 30-second timeout protection
  - 📊 Duration tracking for all command executions
  - 🔍 Comprehensive error reporting with proper stderr capture

- **Accurate Token Counting System**
  - 🎯 TokenManager utility (`utils/token.js`) using tiktoken for precise token estimation
  - 📈 30%+ accuracy improvement over rough char/4 approximation  
  - 🧠 Comprehensive model context limit database (128k for Llama 3.2, 32k for 7B models, etc.)
  - 🎪 Smart fallback patterns for unknown models
  - 🔄 Cached encoder for optimal performance

- **Canvas AI Orchestration Integration**
  - 🎭 **Complete Canvas AI System**: 5-agent AI analysis (DJINN, NAZAR, NARRA, WHALE, WATCHTOWER)
  - 🌐 **Web Interface**: Document analysis and synthesis engine with live observation feeds
  - 🔄 **Bidirectional Sync**: REST API integration with data accumulation and deduplication
  - 📊 **Cross-System Intelligence**: Shared AI backend with resource coordination
  - 🗄️ **Data Persistence**: localStorage + IndexedDB with historical data accumulation
  - 🎯 **Interdependent Architecture**: Jack and Canvas work independently and together

- **Utility Infrastructure**
  - 📁 AsyncFS utility (`utils/async-fs.js`) for consistent promise-based filesystem operations
  - 💾 Integrated backup functionality into Edit Controller for streamlined operation
  - 🛡️ Safe filesystem wrappers with proper error handling
  - 📋 Backup statistics and retention management (50 max, 7-day retention)

### Improved
- **Token Budget Management**
  - 🎯 Dynamic context detection supporting up to 128k tokens for modern models
  - 📊 Accurate budget calculations using real model specifications
  - ⚠️ Smarter warning system based on precise token counts
  - 🚫 Eliminated false budget warnings from inaccurate estimation

- **Code Quality & Maintainability**
  - 🧹 Replaced 20+ scattered `console.log` statements with structured logging
  - 🏗️ Modular architecture with clean separation of concerns
  - 📖 Comprehensive inline documentation and JSDoc comments
  - 🔧 Updated `.env.example` with new configuration options

### Fixed
- **Command Execution Reliability**
  - ⏰ Timeout protection prevents hung commands
  - 🔍 Better error visibility with structured error reporting
  - 🖥️ Improved terminal window spawn error handling
  - 📊 Consistent error logging across all operations

### Technical Details
- **Performance**: TokenManager uses cached tiktoken encoder for optimal token counting
- **Reliability**: Enhanced error handling prevents system crashes from command timeouts
- **Maintainability**: Modular utilities ready for unit testing and future extension
- **User Experience**: Better error messages and system transparency through structured logging

## [1.2.3] - 2025-09-29

### 🛠️ **CRITICAL MAC/LINUX FIX**

### Fixed
- **🍎 Mac/Linux Crash Fix**: Resolved "Cannot find module hijacker.js" error
  - Updated `hi-jack.sh`: Changed `node hijacker.js` → `node hi-jack-engine.js`
  - Fixed `rich-cli.js`: Updated process monitoring and error messages to use correct filename
  - Fixed multiple windows launching issue caused by incorrect file references
  - Updated project documentation to reflect current file structure

### Technical Details
- **Root Cause**: Shell script was still referencing old `hijacker.js` filename after refactor
- **Impact**: Mac/Linux users could not launch Jack due to module not found errors
- **Resolution**: All file references now correctly point to `hi-jack-engine.js`
- **Compatibility**: Maintained full batch file functionality for mode selection and API key entry

## [1.2.2] - 2025-09-29

### 🛠️ **DOCUMENTATION FIXES**

### Fixed
- **📝 Global Command Documentation**: Corrected command references in README
  - Fixed main global command: `hi jack` (two words, not `hijack` or `llama-jack`)
  - Clarified alternative launch methods: `./hi-jack.bat` (Windows), `./hi-jack.sh` (Mac/Linux)
  - Updated all usage examples with correct command syntax
  - Removed incorrect `llama-jack start/setup/server` command references

## [1.2.1] - 2025-09-29

### 📦 **REPOSITORY ALIGNMENT & BRANDING**

### Changed
- **🏷️ Repository Name**: Updated to align with new GitHub repository `Llama-Jack`
  - Repository URL: https://github.com/Yufok1/Llama-Jack
  - Package name updated from `ollama-jack` to `llama-jack`
  - All documentation references updated
- **📚 Documentation Updates**: All references aligned with new branding
  - README.md updated with correct repository links
  - Package.json repository URLs and metadata updated
  - Added new keywords: "llama", "ide", "file-explorer"

## [1.2.0] - 2025-09-29

### 🗂️ **IDE-STYLE WORKSPACE EXPLORER**

### Added
- **📁 Dynamic File Explorer**: Interactive workspace browser with real-time updates
  - Live directory tree with numbered file selection system
  - Visual file icons for different extensions (JS, Python, JSON, etc.)
  - Hierarchical folder display with clean Unicode tree structure
  - Smart file filtering (excludes node_modules, hidden files)
- **📄 Complete File Viewer**: Untruncated file display with native terminal scrolling
  - Full file content display without line limits or truncation
  - Line-numbered view with proper formatting
  - Real-time file monitoring with automatic refresh on changes
  - Native terminal scrolling support (mouse wheel, Page Up/Down)
- **⚡ Real-Time Workspace Monitoring**: Automatic updates when files change
  - File system watcher for instant workspace updates
  - Debounced refresh system to prevent spam from rapid changes
  - AI edit detection and automatic display refresh
  - Cross-platform file monitoring (Windows, Mac, Linux)
- **🎮 Intuitive Navigation System**: Command-driven file exploration
  - `workspace` command enters persistent explorer mode
  - Number selection for instant file viewing (`1`, `2`, `3`, etc.)
  - `back` command returns to workspace from file viewer
  - `refresh` command for manual workspace updates
  - Clean exit system - any non-workspace command exits explorer mode

### Enhanced
- **🎯 Cross-Platform Compatibility**: Enhanced Unicode and file icon support
  - Added Mac-specific file extensions (.swift, .m, .mm, .plist, .dmg)
  - Enhanced shell script support (.zsh, .bash for Mac/Linux)
  - Full Unicode tree character support across all platforms
- **📊 Workspace Analytics**: Enhanced file statistics and project insights
  - File count by extension with visual breakdown
  - Project detection and metadata display (package.json info)
  - Recent files tracking with modification timestamps
  - File size formatting and time-ago calculations

## [1.1.0] - 2025-09-29

### 🧠 **PERSISTENT TASK MANAGEMENT SYSTEM**

### Added
- **📋 Comprehensive Task Management**: Intelligent, persistent task tracking system
  - Automatic task detection from natural language requests (implement, fix, analyze, etc.)
  - Cross-session task persistence with progress tracking
  - Task categorization by type (coding, debugging, research, testing, etc.)
  - Hierarchical subtask support with parent-child relationships
  - Real-time progress monitoring (0-100% completion)
  - Task duration tracking and completion analytics
- **🔗 Smart Tool-Task Correlation**: Automatic linking of file operations and tools to relevant tasks
  - File operations automatically associated with active tasks
  - Tool usage patterns tracked and correlated to task types
  - Progress updates based on tool execution success
- **💾 Enhanced Session Memory**: Deep context preservation across sessions
  - Active tasks included in AI system prompts for goal continuity
  - Recent completions tracking to prevent duplicate work
  - Cross-session memory restoration for long-term projects
- **📊 Task Analytics & Telemetry**: Performance metrics for task management
  - Task creation/completion rates and success metrics
  - Duration analysis by task type and complexity
  - Task type frequency analytics for productivity insights
  - Bounded storage with automatic cleanup
- **🎯 Intelligent Context Integration**: Tasks seamlessly integrated into AI processing
  - Task information automatically included in enhanced system prompts
  - Visual feedback for task creation and progress updates
  - Persistent goal awareness across model switches and sessions

### Enhanced
- **Session Memory System**: Now includes comprehensive task lifecycle management
- **Telemetry Manager**: Extended with task performance and completion analytics
- **Enhanced System Prompts**: Include active tasks, progress, and completion history
- **Memory Guidelines**: Updated to emphasize task focus and progress tracking

### Technical
- **New Methods**: `addTask()`, `updateTask()`, `completeTask()`, `analyzeAndCreateTasks()`
- **Auto-Detection**: Regex-based task creation from user requests
- **Cross-System Integration**: Task data flows between memory, telemetry, and AI systems
- **Data Persistence**: Task data stored in `.memory/context.json` with telemetry in `.telemetry/metrics.json`

---

## [1.0.5] - 2025-09-29

### 🔧 **CONSTRAIN TOOL RESTORATION & TOOL CHAIN RELIABILITY IMPROVEMENTS**

### Added
- **🎛️ Constrain tool restored**: Full functionality for setting operational constraints, limits, and execution parameters
  - Support for operation-specific constraints (search_code, file operations, etc.)
  - Configurable priority levels (advisory, recommended, required, critical)
  - Duration settings (single-use, session, persistent)
  - Rich constraint logging with visual indicators
- **🛡️ Enhanced tool follow-up error handling**: Better resilience for cloud API tool chain issues
  - Graceful fallback when tool result follow-up fails
  - Clear user feedback about tool execution success despite API issues
  - Model-specific compatibility suggestions

### Changed
- **Tool execution flow**: Improved error handling prevents tool chain termination
- **Error messaging**: More informative messages when cloud models have tool synchronization issues
- **Tool result handling**: Better preservation of executed tool results even when follow-up messaging fails

### Fixed
- **Tool follow-up failures**: No longer terminates entire tool chains when cloud API has synchronization issues
- **Missing constrain tool**: Restored full constraint functionality that was accidentally removed
- **Cloud model compatibility**: Better handling of "mismatch between tool calls and tool results" errors

### Technical Details
- Added `handleConstrain()` method with full constraint management
- Enhanced tool follow-up retry logic with fallback response generation
- Improved tool result synchronization for cloud API models
- Added `activeConstraints` Map for session-based constraint storage

## [1.0.4] - 2025-09-29

### 🔧 **ROBUST ERROR HANDLING & TOOL CHAIN IMPROVEMENTS**

### Added
- **🛡️ Graceful tool failure handling**: Individual tool failures no longer stop the entire analysis chain
- **🧠 Smart error suggestions**: Context-aware error messages that help users resolve issues
- **🔄 Enhanced retry mechanisms**: Tools fail gracefully and provide actionable feedback
- **📊 Improved error telemetry**: Failed tool calls are logged for debugging and pattern analysis
- **🦙 Icon integration support**: Window titles now include llama branding for better visual identity

### Changed
- **Tool execution flow**: Wrapped `executeTool()` calls in try-catch to prevent chain interruption
- **Error context preservation**: Failed tool results are still passed to AI for analysis and solutions
- **Conversation continuity**: AI can now see what went wrong and propose alternative approaches
- **Rich CLI branding**: Enhanced visual elements with Jack's personality throughout interface

### Fixed
- **Tool chain interruption**: No more complete stops when a single tool fails (like missing files)
- **Missing file handling**: Better error messages when files don't exist with suggestions
- **Permission error guidance**: Clear feedback for access denied scenarios
- **Command not found errors**: Helpful suggestions for missing executables

### Technical Details
- Added `generateErrorSuggestion()` method for contextual error help
- Enhanced tool failure logging with timestamp and error classification
- Improved conversation context handling for failed operations
- Better visual feedback for tool execution status and failures

## [1.0.3] - 2025-09-28

### 🎉 **MAJOR REBRANDING & SMART COMMAND UPDATE**

### Added
- **🧠 Smart "hi jack" command**: One intelligent command that handles everything
  - Automatically checks and installs dependencies
  - Automatically configures environment if missing
  - Verifies Ollama is running before starting
  - Preserves original mode selection (Local/Cloud)
  - Launches full multi-window system with Rich CLI
- **🛡️ Improved error handling**: Better telemetry cleanup and null checks
- **📋 Enhanced documentation**: Updated all docs to reflect new command structure

### Changed
- **🏷️ Complete rebranding**: "hijack" → "hi-jack" throughout entire codebase
- **📁 File restructuring**: 
  - `hijacker.js` → `hi-jack-engine.js`
  - `hijack.bat` → `hi-jack.bat` 
  - `hijack.sh` → `hi-jack.sh`
- **🎨 Friendlier messaging**: Removed aggressive/hacking terminology
  - "SYSTEM BREACH" → "SYSTEM ENHANCEMENT" 
  - "HIJACKING COMPLETE" → "HI-JACK COMPLETE"
  - "Surveillance feeds" → "Monitoring feeds"
  - "Intercepted" → "Monitored"
- **🎯 Simplified global commands**: Only `hi jack` command needed (via `hi` global)

### Removed
- **❌ All old global commands**: `hijack`, `ollama-jack`, `hi-jack` variants removed
- **❌ Complex command options**: No more `setup` vs `start` vs `server` confusion
- **❌ Manual configuration steps**: Everything automated in smart command

### Fixed
- **🔧 Telemetry cleanup errors**: Proper null checking for cleanup functions
- **🚀 Rich CLI launching**: Restored proper multi-window system launch
- **⚙️ Mode selection**: Preserved original Local/Cloud selection interface
- **🔄 Process management**: Better cleanup of existing processes on startup

### Security
- **🛡️ Path validation**: Enhanced security in file operations
- **🔐 Environment isolation**: Better workspace scoping
- **✅ User approval**: Maintained human-in-the-loop edit control system

## [1.0.2] - 2025-09-28

### Fixed
- **Tool call/result mismatch**: Resolved critical synchronization errors in AI tool chains by properly filtering commentary tools
- **AI response truncation**: Added intelligent response length limiting (2000 characters) for better usability
- **Process cleanup safety**: Made Windows hijack script more selective to prevent killing unrelated applications
- **Commentary tool handling**: Proper separation of internal communication tools from AI conversation flow
- **Error recovery**: Improved handling of tool execution failures

### Changed
- Enhanced tool execution logic to prevent conversation mismatches
- Improved response formatting with smart truncation
- More selective process cleanup in startup scripts

## [1.0.1] - 2025-09-XX

### Fixed
- **fs-extra dependency**: Resolved runtime crashes caused by missing dependency
- **Path security**: Enhanced validation to prevent directory traversal attacks
- **Runtime debug toggle**: Dynamic debug mode control via environment variables

### Added
- **Web search persistence**: Usage tracking across application restarts
- **Code cleanup**: Removed duplicates and obsolete files

### Security
- Enhanced path traversal protection
- Improved input validation

## [1.0.0] - 2025-09-XX

### Added
- Initial release of Ollama Jack
- AI workspace companion with web search capabilities
- Tool integration and human-in-the-loop precision
- Multi-window interface support
- Local and cloud Ollama model support
- Rich CLI interface
- Edit control system
- Session memory management
- Telemetry and analytics