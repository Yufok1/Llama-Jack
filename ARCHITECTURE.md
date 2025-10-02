# 🏗️ Ollama Jack Architecture Guide

## Overview

Ollama Jack is a sophisticated AI development assistant built with a modular architecture designed for security, reliability, and human-in-the-loop precision.

## 🏛️ Core Architecture

### Workspace Targeting System

Jack uses a sophisticated multi-level workspace targeting system that allows operation from any directory:

```
┌─────────────────────────────────────────────────────────────┐
│                 Targeting Priority System                  │
│                                                             │
│  1. Command Line Arguments (highest priority)              │
│  2. HIJACK_TARGET_WORKSPACE environment variable           │
│  3. HIJACK_WORKSPACE environment variable                  │
│  4. Current working directory (fallback)                   │
│                                                             │
│  Implementation: hi-jack-engine.js:108-110                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ this.workspaceRoot =                               │   │
│  │   this.targetWorkspace ||                           │   │
│  │   process.env.HIJACK_TARGET_WORKSPACE ||            │   │
│  │   process.env.HIJACK_WORKSPACE ||                   │   │
│  │   process.cwd();                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Batch Script Integration
Windows (`hi-jack.bat`) and Unix (`hi-jack.sh`) scripts:
- Capture current directory: `set TARGET_WORKSPACE=%CD%`
- Pass to engine: `node hi-jack-engine.js "%TARGET_WORKSPACE%"`
- Set environment: `set HIJACK_TARGET_WORKSPACE=%TARGET_WORKSPACE%`

### System Flow Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                     │
│  ┌─────────────────┐                                        │
│  │   Rich CLI       │  ← Interactive Control Center         │
│  │   (Terminal)     │    • Model Selection & Management      │
│  │                 │    • System Status & Analytics          │
│  │ • Command Input │    • Real-time Monitoring              │
│  │ • Status Display│                                        │
│  └─────────────────┘                                        │
└─────────────────────┼───────────────────────────────────────┘
                      │ HTTP API (Port 11435)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Core Processing Layer                     │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │ Main Hijacker   │    │ Edit Controller │                 │
│  │ (Port 11435)    │◄──►│ (Approval Sys)  │                 │
│  │                 │    │                 │                 │
│  │ • AI Engine     │    │ • Human-in-Loop │                 │
│  │ • Tool Execution│    │ • File Backups  │                 │
│  │ • Session Mgmt  │    │ • Change Review │                 │
│  └─────────────────┘    └─────────────────┘                 │
│           ▲                       ▲                        │
│           │                       │                        │
│           └──────────┬────────────┼────────────┬───────────┘
│                      │            │            │
│             ┌────────▼────┐  ┌────▼────┐  ┌────▼────┐       │
│             │Session Mem │  │Telemetry│  │AI Models│       │
│             │& Task Mgmt │  │& Task   │  │(Ollama) │       │
│             │            │  │Analytics│  │         │       │
│             └───────────┘  └─────────┘  └─────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │   Workspace │
                       │  (Target Dir) │
                       └─────────────┘
```

## 📦 Component Breakdown

### 1. **Rich CLI** (`rich-cli.js`)
**Purpose**: Primary user interface and system control center
**Responsibilities**:
- Model selection and management
- System status monitoring
- Configuration management
- Interactive command processing

**Key Features**:
- Real-time status updates
- Model switching (local ↔ cloud)
- Auto-accept mode toggle
- Usage analytics display

### 2. **Main Hijacker** (`hijacker.js`)
**Purpose**: Core AI engine and tool execution orchestrator
**Responsibilities**:
- AI model communication (Ollama local/cloud)
- Tool call execution and sequencing
- Human-in-the-loop edit control
- Session management

**Key Features**:
- Web search integration (cloud mode)
- Terminal command execution
- File system operations
- Git repository management
- Advanced tool call reasoning and result analysis

## 🧠 Tool Call Reasoning System

Jack implements sophisticated end-of-tool-result reasoning that goes beyond simple tool execution:

### Tool Result Analysis Chain
```
Tool Execution → Result Processing → Commentary Chain → Next Action Decision
```

### Implementation (hi-jack-engine.js:2450-2470)
After each tool execution, Jack automatically analyzes results:

**File Operations:**
```javascript
// After write_file/surgical_edit:
commentary({
    channel: "learning",
    content: "Edit tool returned: [result]. Let me verify by reading the file..."
});
```

**Command Execution:**
```javascript
// After execute_terminal_command:
commentary({
    channel: "meta",
    content: "Command output shows: [observation]. This means..."
});
```

**Pre-edit Analysis:**
```javascript
// Before making changes:
commentary({
    channel: "planning",
    content: "I see [what] on line [X]. I'll change just that section..."
});
```

### Session Memory Integration
- **Tool Call Tracking**: `this.sessionMemory.addToolCall(toolName, args, result)`
- **Task Correlation**: `this.linkToolToActiveTasks(toolName, args, result)`
- **Action History**: `this.trackAction(toolName, params, result)`

### Multi-step Tool Orchestration
- **Retry Logic**: Up to 3 retries with exponential backoff
- **Fallback Responses**: Graceful degradation when AI follow-up fails
- **Synchronization**: Proper tool call/result ordering to prevent mismatches

### 3. **Edit Controller** (`edit-controller.js`)
**Purpose**: Human-in-the-loop edit approval system
**Responsibilities**:
- Edit proposal generation and display
- File backup creation before modifications
- User approval workflow management
- Edit history tracking

**Key Features**:
- Pre-edit file backups
- Colored diff visualization
- Accept/Reject/Refactor workflow
- Edit batching and sequencing

### 4. **Session Memory & Task Management** (`session-memory.js`)
**Purpose**: Conversation context, state persistence, and intelligent task tracking
**Responsibilities**:
- Chat history storage and retrieval
- Tool execution context tracking
- Workspace state management
- **Automatic task detection and creation from user requests**
- **Persistent task tracking across sessions**
- **Progress monitoring and completion analytics**
- **File and tool correlation to active tasks**
- **Cross-session goal continuity**
- Memory cleanup and optimization

**Key Features**:
- Persistent conversation threads
- Tool call result caching
- Memory usage optimization
- Context-aware responses

### 5. **Telemetry Manager** (`telemetry-manager.js`)
**Purpose**: Performance analytics, usage tracking, and task metrics
**Responsibilities**:
- API call monitoring and analytics
- Model performance metrics
- Error pattern detection
- **Task creation and completion tracking**
- **Task duration and success rate analytics**
- **Task type frequency analysis**
- **Progress trend monitoring**
- Usage quota management

**Key Features**:
- Real-time performance monitoring
- Predictive analytics for rate limits
- Error classification and reporting
- Daily usage tracking

## 🏗️ Architecture Layers

### **User Interface Layer**
The Rich CLI provides the primary interaction point for users:
- **Command Processing**: Interprets user commands and routes them to appropriate handlers
- **Status Display**: Shows real-time system status, model information, and analytics
- **Model Management**: Handles model selection, switching between local/cloud modes
- **Configuration**: Manages system settings and environment variables

### **Core Processing Layer**
The Main Hijacker and Edit Controller form the heart of the system:
- **AI Orchestration**: Manages communication with Ollama models and tool execution
- **Edit Control**: Implements human-in-the-loop approval for file modifications
- **Session Management**: Maintains conversation context and state persistence
- **Tool Integration**: Executes terminal commands, file operations, and Git commands

### **Supporting Services**
Background services that enhance system functionality:
- **Telemetry**: Tracks performance metrics and usage analytics
- **Session Memory**: Provides persistent context across sessions
- **AI Models**: External Ollama instances (local or cloud-based)

### **Workspace Integration**
Direct interaction with the target development environment:
- **File System Access**: Read/write operations with user approval
- **Terminal Execution**: Shell command execution with output capture
- **Git Operations**: Repository management and version control

## 🔄 Data Flow Architecture

### Layered Communication Flow
```
User Interface Layer     Core Processing Layer     Supporting Services     Workspace Layer
     │                           │                           │                     │
     ▼                           ▼                           ▼                     ▼
┌─────────┐  HTTP API  ┌─────────┐  Internal  ┌─────────┐  Direct  ┌─────────────┐
│ Rich CLI │◄─────────►│Main Hijk│◄─────────►│Telemetry│◄────────►│  Workspace  │
│         │            │acker    │            │Manager  │          │             │
│ • Input │            │• AI Eng │            │• Metrics│          │ • Files     │
│ • Display│            │• Tools  │            │• Analytics│        │ • Terminal  │
└─────────┘            └─────────┘            └─────────┘          └─────────────┘
     ▲                           ▲                           ▲
     │                           │                           │
     └──────────────┬────────────┼─────────────┬─────────────┘
                    │            │             │
            ┌───────▼────┐  ┌────▼─────┐  ┌────▼─────┐
            │Session Mem │  │Edit Ctrl │  │AI Models │
            │ory Manager │  │(Approval)│  │(Ollama) │
            └────────────┘  └──────────┘  └─────────┘
```

### Request Processing Pipeline
```
1. User Command → Rich CLI (Parsing & Validation)
2. Rich CLI → Main Hijacker (HTTP API Call)
3. Main Hijacker → AI Model (Ollama API)
4. AI Response → Tool Execution (if needed)
5. Tool Results → Edit Controller (Approval Required)
6. User Decision → File System (Apply Changes)
7. Telemetry → Analytics (Track Everything)
```

### Communication Protocols
- **Rich CLI ↔ Main Hijacker**: HTTP REST API (Port 11435)
- **Main Hijacker ↔ AI Models**: Ollama API (local: http://localhost:11434, cloud: provider APIs)
- **Main Hijacker ↔ Edit Controller**: Internal method calls and file system
- **Telemetry Manager ↔ All Components**: Event-driven data collection
- **Session Memory ↔ Main Hijacker**: JSON file persistence
    ↓
User Decision (Accept/Reject/Refactor)
    ↓
File System (Apply Changes)
```

## 🗂️ Data Storage Architecture

### Directory Structure
```
ollama-tools-workspace/
├── .edits/           # Edit history and file backups
│   ├── edit_*.json   # Individual edit records
│   └── *.backup      # Pre-edit file backups
├── .memory/          # Session context storage
│   ├── session_*.json # Conversation threads
│   └── context_*.json # Tool execution context
├── .telemetry/       # Performance metrics and logs
│   ├── usage_*.json  # Daily usage statistics
│   ├── errors_*.log  # Error logs
│   └── perf_*.json   # Performance metrics
└── .env*             # Configuration files (gitignored)
```

### Data Persistence Strategy
- **Edit History**: JSON files with full before/after content
- **Session Memory**: Compressed conversation threads with TTL
- **Telemetry**: Rolling log files with automatic cleanup
- **Configuration**: Environment variables with secure storage

## 🔧 Error Handling & Reliability

### Robust Tool Chain Execution
- **Graceful Failures**: Individual tool errors don't stop the entire analysis
- **Contextual Error Messages**: Smart suggestions based on error type and context
- **Conversation Continuity**: AI sees what went wrong and can propose alternatives
- **Retry Mechanisms**: Multi-layer retry logic for API calls and tool execution

### Error Classification & Recovery
```
File Not Found → Suggests using list_directory to check available files
Permission Denied → Explains potential permission/lock issues  
Command Not Found → Recommends checking PATH and installation
Directory Errors → Provides directory-specific guidance
```

## 🔒 Security Architecture

### Privacy Controls
- **Local-First**: All operations default to local mode
- **Cloud Opt-in**: Web search requires explicit cloud mode activation
- **No Data Collection**: Code never transmitted without user approval
- **Secure Storage**: API keys encrypted and git-excluded

### Access Control
- **File System**: Read/write operations require user approval
- **Terminal Commands**: Shell execution with output capture and review
- **Network Access**: HTTP requests logged and monitored
- **Model Access**: Local models prioritized over cloud

## 🚀 Startup Sequence

### System Launch Process
1. **CLI Setup** (`cli.js`): Global installation and command registration
2. **Rich CLI** (`rich-cli.js`): User interface initialization and model detection
3. **Main Hijacker** (`hijacker.js`): AI engine startup and session loading
4. **Edit Controller** (`edit-controller.js`): Approval system initialization
5. **Telemetry Manager** (`telemetry-manager.js`): Analytics system startup
6. **Workspace Analysis**: Target directory scanned and analyzed

### Service Dependencies
```
Rich CLI → Main Hijacker → Edit Controller
    ↓              ↓              ↓
Session Memory ← Telemetry ← File System
    ↑              ↑              ↑
Configuration ← User Settings ← Environment
```

## 🔧 Configuration Management

### Environment Variables
```bash
# Core Configuration
MODE=local|cloud          # Operation mode
OLLAMA_HOST=http://localhost:11434  # Local Ollama endpoint
OLLAMA_API_KEY=your_key   # Cloud API key (optional)

# System Settings
PORT=11435                # Main hijacker port
DEBUG_MODE=true|false     # Debug logging
AUTO_ACCEPT=false         # Edit approval mode

# Workspace Targeting
HIJACK_TARGET_WORKSPACE=/path/to/project
HIJACK_PROJECT_TYPE=node|python|generic
```

### Runtime Configuration
- **Dynamic Mode Switching**: Local ↔ cloud without restart
- **Model Hot-Swapping**: Change AI models during session
- **Workspace Retargeting**: Switch target directories
- **Auto-accept Toggle**: Enable/disable edit approval

## 📊 Performance Characteristics

### Memory Usage
- **Base Footprint**: ~50MB for core system
- **Per Session**: ~10MB for conversation memory
- **Edit Storage**: ~5MB per 1000 edits
- **Telemetry**: ~2MB per day of usage

### Network Usage
- **Local Mode**: Minimal (model downloads only)
- **Cloud Mode**: Variable based on usage
- **Monitoring**: ~1KB per API call for telemetry

### Scalability Limits
- **Concurrent Sessions**: Limited by system memory
- **Edit History**: Automatic cleanup after 30 days
- **Log Retention**: Rolling logs with size limits
- **Model Cache**: Intelligent model loading/unloading

## 🐛 Debugging & Troubleshooting

### Debug Tools
- **Rich CLI Status**: Real-time system monitoring and health checks
- **Telemetry Analytics**: Performance metrics and usage tracking
- **Edit History**: Change tracking and rollback capability
- **Session Logs**: Conversation debugging and error analysis
- **File Backups**: Pre-edit file restoration capability

### Common Issues
- **Port Conflicts**: Automatic port selection (11435-11439)
- **Model Loading**: Fallback to smaller models on memory issues
- **Network Timeouts**: Automatic retry with exponential backoff
- **File Permissions**: Graceful degradation with user notification
- **Memory Usage**: Automatic cleanup of old sessions and telemetry

## 🔄 Update & Maintenance

### Automatic Updates
- **Version Checking**: Startup version comparison
- **Hot Reloading**: Component updates without full restart
- **Configuration Migration**: Automatic config file updates
- **Dependency Management**: npm audit and update automation

### Manual Maintenance
- **Log Rotation**: Automatic cleanup of old log files
- **Cache Clearing**: Memory and disk cache management
- **Database Optimization**: Edit history and telemetry compaction
- **Security Updates**: Regular dependency vulnerability scanning</content>
<parameter name="filePath">c:\Users\Jeff Towers\projects\ollama-tools-workspace\ARCHITECTURE.md