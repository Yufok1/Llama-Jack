# 🦙⚡ Llama Jack - AI Workspace Companion

**Your friendly AI sidekick with web search, tool integration, persistent task management, and human-in-the-loop precision**

Transform any workspace into an AI-powered development environment. Llama Jack connects to local Ollama models, searches the web for current info, maintains persistent memory of your projects, and executes complex operations with your approval.

## 🤝 Companion System: Canvas AI Orchestration

**Llama Jack works seamlessly with [Canvas AI Orchestration System](https://github.com/Yufok1/Canvas-with-observation-feeds-HTML)** - a powerful web-based AI analysis interface!

### **Why Use Both Together?**
- **Llama Jack (Terminal)**: File editing, code generation, task management, workspace exploration
- **Canvas (Web Interface)**: Document analysis with 5 specialized AI agents, synthesis engine, observation feeds

### **Shared Intelligence**
Both systems share the same Ollama AI backend with intelligent resource coordination:
- **Smart Load Balancing**: Jack backs off to cloud when Canvas analysis is heavy
- **Resource Orchestration**: Automatic distribution preventing bottlenecks
- **Unified Configuration**: Same `.env` and localStorage settings

### **Quick Integration**
```bash
# 1. Start Llama Jack (terminal workspace)
hi jack

# 2. Open Canvas (web analysis interface)
# Navigate to: http://localhost:8000/canvas-with-observation-feeds.html

# Both systems now share AI resources intelligently!
```

**See [CANVAS_INTEGRATION_GUIDE.md](CANVAS_INTEGRATION_GUIDE.md) for detailed coordination setup.**

---

## 🚀 **Quick Start (10 Minutes)**

### **Prerequisites**
- **Node.js 16+**: [Download from nodejs.org](https://nodejs.org) - Required to run Llama Jack
- **Ollama**: [Download from ollama.com](https://ollama.com) - AI model server that runs locally

### **Installation - Step by Step**

**1. Get the code:**
```bash
git clone https://github.com/Yufok1/Llama-Jack.git
cd Llama-Jack
```

**2. Install Llama Jack:**
```bash
npm install
npm install -g .
```
*This installs the required packages and makes `hi` command available from any terminal.*

**3. Configure environment:**
```bash
cp .env.example .env
```
*Edit the `.env` file with your Ollama Cloud API key and other settings.*

**4. Start using Llama Jack:**
```bash
hi jack
```
*Or for the full Windows multi-window experience:*
```bash
./hi-jack.bat   # Windows
./hi-jack.sh    # Mac/Linux
```

**That's it!** 🎉 Jack will open an interactive chat interface where you can type commands or chat with AI.

## �️ **Quick Uninstall**

**Need to remove Llama Jack? Here's the simple way:**

```bash
# Remove the global command
npm uninstall -g llama-jack

# Verify it's gone (should show "command not found")
hi jack
```

**That's it!** The global `hi` command will no longer be available.

## �🔄 **Upgrading from Previous Version**

**⚠️ Important: If you have installed Llama Jack before, you MUST remove the old global installation first to ensure the new version runs properly.**

### **Step 1: Remove Old Global Installation**
```bash
# Remove the global package (use the correct package name)
npm uninstall -g llama-jack

# Check if it's completely removed (should show no results)
npm list -g --depth=0 | findstr llama     # Windows
npm list -g --depth=0 | grep llama        # Mac/Linux
```

### **Step 2: Clear NPM Cache (Recommended)**
```bash
# Clear NPM cache to ensure clean installation
npm cache clean --force
```

### **Step 3: Verify Old Installation is Gone**
```bash
# These commands should NOT work if old version is properly removed:
hi jack        # Should show "command not found" or "not recognized"
which hi       # Should show no results (Linux/Mac)
where hi       # Should show no results (Windows)
```

### **Step 4: Install New Version**
```bash
# Now proceed with fresh installation
git pull origin main    # Get latest code (if updating existing repo)
npm install            # Install dependencies
npm install -g .       # Install global commands
```

### **Step 5: Verify New Installation**
```bash
# These should now work with the new version:
hi jack                    # Should launch new version
npm list -g --depth=0      # Should show llama-jack in the list
```

### **🔧 Troubleshooting Upgrade Issues**

**Problem: "hi jack" still runs old version**
```bash
# Solution: Check your PATH and remove old installations
echo $PATH                    # Linux/Mac - look for old Jack paths
echo $env:PATH                # Windows PowerShell - look for old Jack paths
echo %PATH%                   # Windows CMD - look for old Jack paths

# Manually remove old global installations if npm uninstall didn't work
rm -rf ~/.npm-global/lib/node_modules/llama-jack     # Linux/Mac
rmdir /s %APPDATA%\npm\node_modules\llama-jack      # Windows CMD
Remove-Item -Recurse -Force "$env:APPDATA\npm\node_modules\llama-jack"  # Windows PowerShell
```

**Problem: Permission errors during uninstall**
```bash
# Linux/Mac - use sudo if needed
sudo npm uninstall -g llama-jack

# Windows - run as Administrator
# Right-click PowerShell/CMD > "Run as Administrator"
npm uninstall -g llama-jack
```

**Problem: Multiple Node.js versions**
```bash
# Check your Node.js version and NPM global path
node --version
npm config get prefix

# Use NPM's prefix to find global installations
npm list -g --depth=0
```

### **🚀 Benefits of v1.3.0**
- **Enhanced Error Handling** - Comprehensive timeout protection prevents hung commands
- **Accurate Token Counting** - 30%+ improvement with tiktoken vs char/4 approximation
- **Centralized Logging** - Clean, structured logging with environment-controlled levels
- **Modular Utilities** - Reusable utilities for filesystem, backups, tokens, logging
- **Better Reliability** - Duration tracking, proper error reporting, automatic backups
- **Smarter Token Budgets** - Dynamic context detection up to 128k tokens for modern models

### **Quick Commands Reference**
Once running, try these:
- `help` - See all available commands
- `models` - List available AI models  
- `status` - Check system status
- `workspace` - **NEW!** IDE-style file explorer with real-time updates
- `"Hello, help me code"` - Start chatting with AI

## 🌍 **Global Commands - The Magic**

**Jack installs global commands that work from ANY directory, ANY terminal!**

### **Available Global Commands:**

**`hi jack`** - Launch the smart AI assistant (main command)
- Works from any folder on your system
- Automatically targets your current workspace
- Opens interactive chat and command interface
- Handles setup, installation, and launch automatically

### **Alternative Launch Methods:**

**`./hi-jack.bat`** (Windows) - Complete hijack protocol
- Runs the full multi-window AI command center
- Great for immersive AI workspace experience

**`./hi-jack.sh`** (Mac/Linux) - Shell script launcher
- Unix-style launch script
- Same functionality as Windows version

### **How Global Commands Work:**
```bash
# From your home directory
cd ~
hi jack  # Targets ~ as workspace

# From a project folder  
cd ~/my-awesome-project
hi jack  # Targets my-awesome-project

# From anywhere
hi jack  # Works from any location, targets current directory
```

**No more navigating to the Jack folder!** The global commands find you and adapt to your current location. 🚀

## ✨ **Current Features**

### 🚀 **Core Infrastructure** ⭐ **v1.3.0**
- **Enhanced Error Handling** - Comprehensive timeout protection and error reporting via centralized logger
- **Accurate Token Counting** - Precise tiktoken-based token estimation (30%+ accuracy improvement)
- **Centralized Logging** - 5-level logging system (ERROR, WARN, INFO, DEBUG, TRACE) with `JACK_LOG_LEVEL` control
- **Improved Reliability** - Better command execution with 30s timeout protection and duration tracking
- **Modular Utilities** - Clean utilities for async filesystem operations, token counting, OS awareness
- **Smart Token Budgets** - Dynamic context detection supporting up to 128k tokens for modern models
- **Advanced OS Awareness** - Cross-platform command adaptation and validation
- **Alignment Engine** - 20-parameter safety validation for all operations

### 🤖 **AI Integration**
- **Local Ollama Support** - Connect to any local Ollama model
- **Interactive Chat** - Natural conversation with AI models
- **Model Switching** - Change models on the fly (`use llama2`, `next`, `prev`)
- **Rich CLI Interface** - Full terminal control center

### 🛠️ **Advanced Tool System**
- **Terminal Commands** - Execute shell commands with output capture and OS-specific adaptation
- **File Operations** - Read, write, create, and modify files with surgical precision
- **Tool Call Reasoning** - End-of-tool-result analysis with commentary chains for better decision making
- **Session Memory Integration** - Automatic tool-to-task linking and action tracking
- **Multi-step Tool Chains** - Sophisticated tool orchestration with retry logic and fallback responses

### 🗂️ **IDE-Style Workspace Explorer** ⭐ **NEW!**
- **Live File Explorer** - Real-time directory tree with numbered file selection
- **Complete File Viewer** - View entire files with line numbers, no truncation
- **Real-Time Updates** - Automatically refreshes when files change
- **Smart Navigation** - `workspace` → explore, `[number]` → view file, `back` → return
- **File Monitoring** - Detects AI edits and workspace changes instantly
- **Cross-Platform** - Full Unicode support for Mac, Windows, Linux
- **Native Scrolling** - Use terminal's built-in scroll (mouse wheel, Page Up/Down)

### 📋 **Task Management & Memory**
- **Persistent Task Tracking** - Automatically detects and creates tasks from your requests
- **Cross-Session Memory** - Maintains context and goals between sessions
- **Progress Monitoring** - Tracks completion status and correlates tools to tasks
- **Auto-Task Detection** - Creates tasks from natural language (fix, implement, analyze, etc.)
- **Telemetry Integration** - Metrics and analytics for task performance
- **File-Task Linking** - Automatically associates file operations with active tasks
- **Code Search** - Pattern matching across your codebase
- **Git Integration** - Status, commit, push, and branch management

### ✏️ **Human-in-the-Loop Editing**
- **Edit Proposals** - AI suggests changes, you approve/reject
- **File Backups** - Automatic backups before modifications
- **Batch Operations** - Group related changes together
- **Edit History** - Track all modifications with timestamps

### 🔍 **Web Search (Cloud Mode)**
- **Ollama Cloud Integration** - Search web for current information
- **Usage Tracking** - Monitor daily search limits
- **Privacy Controls** - Only active with explicit API key

### 📊 **System Monitoring**
- **Rich CLI Dashboard** - Real-time system status
- **Usage Analytics** - Track model usage and performance
- **Health Checks** - Service status and diagnostics
- **Session Memory** - Conversation context persistence

### 🎨 **Canvas Integration**
- **Event-Driven Data Sync** - Automatic integration with Canvas document analysis system
- **Ollama Resource Orchestration** - Intelligent resource sharing between Canvas AI agents and Jack
- **Canvas-Jack Bridge** - Communication bridge for coordination (`utils/canvas-jack-bridge.js`)
- **Ollama Orchestrator** - Load balancing and priority management (`utils/ollama-orchestrator.js`)
- **See [CANVAS_INTEGRATION_GUIDE.md](CANVAS_INTEGRATION_GUIDE.md)** for deployment scenarios and configuration

## 🎯 **How It Works**

### **Advanced Workspace Targeting System**
Jack uses a sophisticated multi-level targeting system that works from any directory:

```bash
# Jack works globally - run from any directory
cd ~/my-project
hi jack  # Automatically targets your current workspace

# Environment variable targeting
HIJACK_TARGET_WORKSPACE=/path/to/project hi jack

# Alternative launch methods
./hi-jack.bat   # Windows multi-window experience
./hi-jack.sh    # Mac/Linux script launcher
```

**Targeting Priority:**
1. Command line argument (highest priority)
2. `HIJACK_TARGET_WORKSPACE` environment variable
3. `HIJACK_WORKSPACE` environment variable
4. Current working directory (fallback)

### **Edit Control Workflow**
```
🤖 AI > "Create a Node.js server"

🔧 AI executes tools...

📋 EDIT PROPOSAL #edit_123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Operation: write_file
📁 File: server.js
📄 Content: const express = require('express')...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ accept edit_123 | ❌ reject edit_123 | 🔧 refactor edit_123

⏸️ Waiting for your approval...
```

### **Available Commands**
```bash
# Rich CLI commands
help              # Show all commands
status            # System health check
models            # List available models
select            # Choose model interactively
use <model>       # Switch to specific model
workspace         # ⭐ NEW! Enter IDE-style file explorer
auto-accept on    # Enable automatic edit approval
usage             # Show usage statistics
mode local/cloud  # Switch operation modes

# Workspace Explorer commands (after typing 'workspace')
[number]          # View file by number (e.g., type '3' to view file #3)
back              # Return to workspace explorer from file viewer
refresh           # Manually update workspace view
[any command]     # Exit workspace mode
```

## 🛡️ **Security & Privacy**

- **Local-First Operation** - Your code never leaves your machine
- **User Approval Required** - Every file change needs confirmation
- **Workspace Isolation** - Operations restricted to target directory
- **No Data Collection** - Zero telemetry or usage tracking sent externally
- **Secure Credentials** - API keys stored locally in `.env` files

## 📁 **Project Structure**

```
├── Core Files
│   ├── hi-jack-engine.js    # Main AI system with tool execution
│   ├── rich-cli.js          # Interactive terminal interface
│   ├── hi-jack-smart.js     # Global command launcher
│   └── server.js            # API-only server mode
├── Components
│   ├── edit-controller.js                      # File editing with human approval
│   ├── session-memory.js                       # Conversation context
│   ├── telemetry-manager.js                    # Usage analytics
│   └── recursive-meta-constrain-enhancements.js  # Meta-constraint optimization
├── Utilities (utils/)
│   ├── logger.js                # 5-level centralized logging (ERROR, WARN, INFO, DEBUG, TRACE)
│   ├── token.js                 # Accurate tiktoken-based token counting
│   ├── async-fs.js              # Promise-based filesystem operations
│   ├── os-awareness.js          # Cross-platform command adaptation and safety
│   ├── alignment-engine.js      # 20-parameter safety validation system
│   ├── canvas-jack-bridge.js    # Canvas integration bridge
│   └── ollama-orchestrator.js   # Ollama resource orchestration
├── Scripts
│   ├── hi-jack.bat/sh       # Launch scripts
│   └── install.bat/sh       # Installation helpers
└── Documentation
    ├── README.md                       # This file
    ├── USAGE_GUIDE.md                  # Detailed usage
    ├── RICH_CLI_GUIDE.md               # Rich CLI interface guide
    ├── INSTALL.md                      # Installation troubleshooting
    ├── SECURITY.md                     # Security information
    ├── EDIT_CONTROL.md                 # Edit control system
    ├── ARCHITECTURE.md                 # System architecture
    ├── CHANGELOG.md                    # Version history
    ├── CANVAS_INTEGRATION_GUIDE.md     # Canvas + Jack coordination
    └── IMPLEMENTATION_STATUS.md        # Feature implementation tracking
```

## 📚 **Documentation**

- **[USAGE_GUIDE.md](USAGE_GUIDE.md)** - Complete command reference
- **[RICH_CLI_GUIDE.md](RICH_CLI_GUIDE.md)** - Master the Rich CLI
- **[INSTALL.md](INSTALL.md)** - Installation troubleshooting
- **[SECURITY.md](SECURITY.md)** - Security and privacy details
- **[EDIT_CONTROL.md](EDIT_CONTROL.md)** - Edit control system documentation
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design
- **[CHANGELOG.md](CHANGELOG.md)** - Complete version history
- **[CANVAS_INTEGRATION_GUIDE.md](CANVAS_INTEGRATION_GUIDE.md)** - Canvas + Jack coordination
- **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)** - Current implementation status

## 🆕 **Recent Updates**

### v1.3.0 - Major Reliability & Performance Improvements ⭐ **LATEST**
- 🎯 **Enhanced Error Handling & Logging System**
  - Centralized logger utility with 5 levels (ERROR, WARN, INFO, DEBUG, TRACE)
  - Color-coded output with timestamps for better debugging
  - Environment-controlled logging via `JACK_LOG_LEVEL` setting
  - Enhanced executeCommand with 30-second timeout protection
  - Duration tracking for all command executions
- 📊 **Accurate Token Counting System**
  - TokenManager utility using tiktoken for precise token estimation
  - 30%+ accuracy improvement over rough char/4 approximation
  - Comprehensive model context limit database (128k for Llama 3.2, etc.)
  - Smart fallback patterns for unknown models
- 🛠️ **Utility Infrastructure**
  - AsyncFS utility for consistent promise-based filesystem operations
  - BackupManager utility with automatic cleanup and restoration
  - Safe filesystem wrappers with proper error handling
  - Backup statistics and retention management (50 max, 7-day retention)
- 🎨 **Enhanced Features**
  - Dynamic context detection supporting up to 128k tokens for modern models
  - Modular architecture with clean separation of concerns
  - Comprehensive inline documentation and JSDoc comments

### v1.0.3 - AI Intelligence & Visual Enhancements
- 🎨 **Enhanced ASCII Spinner System** - 22+ colorful loading patterns (dots, spinners, waves, progress bars, etc.)
- 🧠 **Smarter AI Path Handling** - Automatic conversion of Linux-style paths to Windows format
- 🏠 **Workspace Auto-Discovery** - AI automatically discovers and understands project structure at startup
- 🔧 **Advanced Tool Preprocessing** - Fixes common AI model mistakes before tool execution
- 📋 **Enhanced System Prompts** - Improved AI reliability with mandatory workspace discovery protocol
- 🎯 **Platform Awareness** - AI knows your OS and uses appropriate path formats
- 🛡️ **Better Path Validation** - Catches and prevents invalid path errors early

### v1.0.2 - Tool Chain Reliability & Performance
- 🔧 **Fixed tool call/result mismatch** - Resolved critical synchronization errors in AI tool chains
- 📝 **AI response truncation** - Intelligent response length limiting (2000 chars) for better usability
- 🛡️ **Safer process cleanup** - Selective process termination prevents killing unrelated applications
- 🐛 **Commentary tool handling** - Proper separation of internal communication tools from AI conversation flow
- ⚡ **Improved error recovery** - Better handling of tool execution failures

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 **License**

MIT License - Feel free to use and enhance!

---

## 🚀 **Future Plans** (Coming Later)

### **Enhanced Global Commands**
The "hi jack" command makes the tool more approachable:
```bash
hi jack start     # Friendly way to launch
hi jack setup     # Easy setup command
```

### **Cloud Mode Enhancements**
- Expanded web search capabilities
- Advanced model selection
- Enhanced API integrations

### **Advanced Features**
- Multi-workspace management
- Plugin system for custom tools
- Enhanced analytics dashboard
- Team collaboration features

---

**🚀 HI-JACK COMPLETE** - Your terminal now has AI superpowers with human oversight! 🛡️👨‍💻
