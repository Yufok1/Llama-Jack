# 🎯 Ollama Jack Usage Guide

## 🎮 **Rich CLI Control Center** (NEW!)

The primary interface for controlling Ollama Jack is now the **Rich CLI** - a dedicated command center that gives you complete control over the system.

### **Launch & Access**
```bash
# 1. Start the full system
./hijack.bat    # Windows
./hijack.sh     # Linux/Mac

# 2. Global commands (after npm install -g)
hijack --workspace="C:\path\to\project"
ollama-jack start

# 3. Use the Rich CLI window that opens automatically
# Or launch separately:
node rich-cli.js
```

### **Core Commands**
```bash
# System Control
auto-accept off     # Disable automatic edit approval  
status             # Complete system health dashboard
restart            # Restart all Jack services

# Model Management  
models             # Scan available AI models
select             # Interactive model selector with arrows
use gpt-oss:120b   # Switch to specific model
next               # Cycle to next model
prev               # Go to previous model

# Usage Analytics
usage              # Web search quota tracking
usage-models       # Model performance analytics  
```

## 🛡️ **Security First Setup**

Before using Jack, ensure secure configuration:

```bash
# 1. Create secure environment file
cp .env.example .env

# 2. Add your Ollama Cloud API key (optional for cloud features)
OLLAMA_API_KEY=your_key_here_only_if_needed

# 3. Start with Rich CLI control
./hijack.bat  # Full multi-window setup
```

**🔒 Privacy Notes:**
- Jack operates **entirely locally** by default
- Web search requires **explicit cloud mode** activation  
- All sensitive files are **git-excluded** automatically
- Your code **never leaves your machine** without explicit approval
- **Rich CLI provides complete system visibility**

## 🎮 Rich CLI System Dashboard

### **Complete Status Overview**
```bash
Rich CLI > status
```

**What you get:**
```
╭─────────────────── SYSTEM STATUS ─────────────────────╮
│ Status: jacked-in        │ Workspace: my-project      │
│ Mode: CLOUD              │ Port: 11435                │
│ Model: gpt-oss:120b      │ Active Terms: 3            │
├─────────────────────────────────────────────────────────┤
│ Auto-Accept: ❌ Disabled │ Edit Mode: Manual           │
├─────────────────────────────────────────────────────────┤
│ Services Status:                                        │
│   • Main Hijacker     🟢 ONLINE  (Port 11435)         │
│   • Rich CLI          🟢 ACTIVE  (Interactive)        │
│   • Telemetry Manager 🟢 ONLINE  (Analytics)          │
╰─────────────────────────────────────────────────────────╯

🔧 Active Capabilities:
  • 🤖 AI Model Communication & Tool Execution
  • 📁 Full Workspace File Access & Modification  
  • 💻 Terminal Command Execution
  • 🔍 Real-time Code Search & Analysis
  • 🧠 AI Commentary System (7 channels)

### **AI Commentary System**
Jack expresses inner thoughts through structured commentary channels:

**Available Channels:**
- **Reasoning** 🧠 - Logical analysis and problem-solving
- **Planning** 📋 - Strategy and workflow planning  
- **Learning** 📚 - Insights and lessons learned
- **Safety** 🛡️ - Security and risk assessments
- **Collaboration** 🤝 - Team coordination thoughts
- **Creativity** 🎨 - Innovative ideas and approaches
- **Meta** 🔄 - Self-reflection and system thoughts

**Commentary appears automatically during tool execution with color-coded output.**
```

### **Auto-Accept Control**
```bash
# Disable automatic edit approval (recommended for safety)
Rich CLI > auto-accept off

# Enable for rapid prototyping (use with caution)  
Rich CLI > auto-accept on
```

**What this controls:**
- **Disabled**: Every edit requires manual 1/2/3 approval
- **Enabled**: AI applies all edits automatically (dangerous!)

### **Usage Analytics**
```bash
Rich CLI > usage-models
```

**Get detailed insights:**
```
╭─────────────────── MODEL USAGE DATA ───────────────────╮
│ Reset Date: 2025-09-27 08:00           Daily Stats: 45 │
│ Overall Success Rate: 94%              Rate Limits: 2  │  
├──────────────────────────────────────────────────────────┤
│ 🟢 gpt-oss:120b     │ 23 req │ 96% │ 0 limits          │
│   └─ Tokens: 15,420 total, 670 avg/req                  │
│ 🟡 qwen3-coder:480b │ 12 req │ 83% │ 2 limits          │
│   └─ ⚠️ 2 rate limit errors detected!                   │
╰──────────────────────────────────────────────────────────╯
```

## 🚀 How to Use the Interactive Model Selector

### **Method 1: Interactive Arrow Key Selection (Rich CLI)**
```bash
Rich CLI > select
```

**What happens:**
- Shows **real Ollama Cloud models** (not random small models!)
- Use **↑** and **↓** arrow keys to navigate
- **Current model highlighted in GREEN**
- **Press ENTER** to select 
- **Press ESC** to cancel

**Visual Interface:**
```
╭─────────── MODEL SELECTOR ───────────╮
│   llama3.2:90b     [Meta flagship]   │
│ 🎯 qwen2.5:72b     [Alibaba power]   │ ← Selected
│   mixtral:8x7b     [Expert mixture]  │
│   codellama:70b    [Code specialist] │
╰───────────────────────────────────────╯

↑↓ Navigate  ENTER Select  ESC Cancel
```

---

### **Method 2: Direct Model Switch**
```bash
Rich CLI > use gpt-oss:120b
```

**What happens:**
- **Instantly switches** to specified model
- **Confirms switch** with visual feedback
- **Updates all future chats** to use new model

---

### **Method 3: List All Available Models**
```bash
Rich CLI > models
```

**What you get:**
- **Complete list** of Ollama Cloud models
- **Model descriptions** and capabilities
- **Current active model** clearly marked
- **Usage instructions** for each model

---

## 🎭 **Canvas AI Orchestration System**

**Canvas** is a powerful web-based AI analysis interface that works independently or with Jack for comprehensive document analysis.

### **Launch Canvas**
```bash
# Open Canvas in your web browser
# Navigate to: canvas/canvas-with-observation-feeds.html
# Or use the launch script:
./canvas/launch-canvas.bat  # Windows
```

### **Canvas AI Agents**
Canvas features **5 specialized AI agents** for comprehensive analysis:

- **🎭 DJINN**: Governance & decision-making analysis
- **🔮 NAZAR**: Emotional intelligence & empathy analysis  
- **🌊 NARRA**: Pattern recognition & narrative analysis
- **🐋 WHALE**: Deep contextual analysis & memory
- **🔱 WATCHTOWER**: Operational monitoring & oversight

### **Canvas-Jack Data Integration**
```bash
# Check Canvas integration status
Rich CLI > canvas-status

# View accumulated analysis data
# Shows: localStorage keys, IndexedDB stores, total records
```

**Data Accumulation:**
- **Analysis History**: AI agent responses accumulate over sessions
- **Synthesis Reports**: Collaborative AI outputs build historically  
- **AI Feeds**: Live observation data persists and grows
- **Cross-Session Correlation**: Jack performs meta-analysis on accumulated data

### **Interdependent Operation**
- ✅ **Canvas works without Jack**: Full AI analysis capabilities
- ✅ **Jack works without Canvas**: Complete terminal AI assistance
- 🔗 **Together**: Unified AI ecosystem with shared intelligence and data accumulation

---

## 🔧 **Edit Control with Refactor**

Now you have **3 edit control options**:

### **✅ Accept Edit**
```bash
🤖 AI Hijacker > accept edit_1234567890_1
```
- **Applies edit immediately** to workspace
- **Shows detailed results** of the operation
- **Saves to edit history** for audit trail

### **❌ Reject Edit**  
```bash
🤖 AI Hijacker > reject edit_1234567890_1 not needed
```
- **Discards edit completely** - no changes made
- **Optional reason** for rejection (saved to history)
- **Maintains audit trail** of rejected edits

### **🔧 Refactor Edit**
```bash
🤖 AI Hijacker > refactor edit_1234567890_1 use async/await instead
```
- **Creates new modified edit** based on your feedback
- **Original edit marked as refactored** (preserved in history)
- **New edit gets fresh ID** for accept/reject cycle
- **Lets you fine-tune** AI suggestions before applying

---

## 🎯 **Why This Fixes Your Cloud Model Issue**

**Before (Broken):**
- Rich CLI showed **hardcoded fake models**
- Models like "gpt-oss:120b-cloud" that don't exist
- **No connection** to real Ollama Cloud registry

**After (Fixed):**
- **Fetches live models** from Ollama Cloud API
- **Real models** like llama3.2:90b, qwen2.5:72b
- **Fallback list** of actual cloud models if API fails
- **Proper model descriptions** and capabilities

---

## 🎮 **Quick Start Workflow**

1. **Launch the system:**
   ```bash
   .\hijack.bat
   ```

2. **Choose Cloud mode:** `2`

3. **In Rich CLI window, select model:**
   ```bash
   🤖 Ollama CLI > select
   # Use ↑↓ keys, press ENTER on your choice
   ```

4. **Start chatting with version control:**
   ```bash
   🤖 AI Hijacker > can you add error handling to my code?
   # AI proposes edits, you control them:
   🤖 AI Hijacker > accept edit_123  # or reject/refactor
   ```

Now you get **real cloud models** and **granular edit control**! 🚀