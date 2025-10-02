# 🎮 Rich CLI Control Center Guide

## 🚀 Overview

The **Rich CLI** is Ollama Jack's centralized command and control center. Think of it as your **mission control** for the entire AI workspace system - you can monitor, configure, and control everything from this single interface.

## 📋 Complete Command Reference

### 🤖 **AI Models**
```bash
models           # Scan and list all available AI models
select           # Interactive model selector with arrow keys
use <model>      # Switch to specific model directly
next             # Cycle to next available model
prev             # Cycle to previous available model
chat             # Start direct AI conversation
generate <text>  # Generate AI text response
```

### 🔧 **System Controls**
```bash
auto-accept on   # Enable automatic edit approval (dangerous!)
auto-accept off  # Disable automatic edit approval (recommended)
status           # Complete system health dashboard
restart          # Restart all Ollama Jack services
debug            # Toggle debug analysis mode
clear            # Clear terminal and reset display
help             # Show complete command reference
exit             # Exit Rich CLI interface
```

### 📊 **Analytics & Monitoring**
```bash
usage            # Web search usage tracking and limits
usage-models     # Detailed model performance analytics
monitor          # Show system monitoring status
tokenomics       # Display API resource usage
```

### 🌐 **Mode & Configuration**
```bash
mode             # Show available operation modes
mode local       # Switch to local Ollama operation
mode cloud       # Switch to cloud Ollama operation
local            # Quick switch to local mode
cloud            # Quick switch to cloud mode
```

### 🛠️ **Workspace Operations**
```bash
ide-info         # Show current IDE information
workspace        # Analyze workspace structure
tools            # List available AI tools
```

### 📦 **Model Management**
```bash
pull <model>     # Download AI model from Ollama
push <model>     # Upload model to Ollama cloud
rm <model>       # Remove local AI model
```

## 🎯 Key Features

### 📊 **System Status Dashboard**
The `status` command provides a comprehensive overview:

```
╭─────────────────── SYSTEM STATUS ─────────────────────╮
│ Status: jacked-in        │ Workspace: my-project      │
│ Mode: CLOUD              │ Port: 11435                │
│ Model: gpt-oss:120b      │ Active Terms: 3            │
├─────────────────────────────────────────────────────────┤
│ Auto-Accept: ❌ Disabled │ Edit Mode: Manual           │
├─────────────────────────────────────────────────────────┤
│ Web Searches: 15/100 used (85 remaining)               │
│ Reset Time: 2025-09-28T00:00:00Z │ Daily Budget: 15%  │
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
  • 📊 Usage Tracking & Performance Monitoring
  • ⚡ Multi-model Cloud & Local Support
```

### 🤖 **Interactive Model Selector**
The `select` command opens a visual model picker:

```
╭─────────── MODEL SELECTOR ───────────╮
│   gpt-oss:20b      [20B params]      │
│ 🎯 gpt-oss:120b    [120B params]     │ ← Selected
│   deepseek-v3.1    [671B params]     │
│   qwen3-coder      [480B params]     │
│   kimi-k2          [1T params]       │
╰───────────────────────────────────────╯

↑↓ Navigate  ENTER Select  ESC Cancel
```

### 📈 **Model Usage Analytics**
The `usage-models` command shows detailed performance data:

```
╭─────────────────── MODEL USAGE DATA ───────────────────╮
│ Reset Date: 2025-09-27 08:00         Daily Stats: 45   │
│ Overall Success Rate: 94%            Rate Limits: 2    │  
├──────────────────────────────────────────────────────────┤
│ 🟢 gpt-oss:120b     │ 23 req │ 96% │ 0 limits          │
│   └─ Tokens: 15,420 total, 670 avg/req                  │
│   └─ Max consecutive tool calls: 8                       │
│ 🟡 qwen3-coder:480b │ 12 req │ 83% │ 2 limits          │
│   └─ ⚠️ 2 rate limit errors detected!                   │
│   └─ Tool call #4 failed at 14:23:45                    │
╰──────────────────────────────────────────────────────────╯

💡 Some models have limits on consecutive tool calls - 
    consider switching models for long sequences!
```

## 🛡️ **Safety & Security Features**

### 🎮 **Auto-Accept Control**
The most important safety feature - control whether AI edits are applied automatically:

```bash
# RECOMMENDED: Manual approval for all edits
Rich CLI > auto-accept off
⏸️  Auto-accept mode disabled - manual approval required
💡 Use 'auto-accept on' to enable

# DANGEROUS: Automatic edit approval (use with caution)
Rich CLI > auto-accept on  
🤖 Auto-accept mode enabled - edits will be applied automatically
💡 Use 'auto-accept off' to disable
```

### 📊 **Service Health Monitoring**
Rich CLI continuously monitors all system components:
- **Main Hijacker** (Port 11435) - Core AI system and tool execution
- **Telemetry Manager** - Analytics and performance tracking
- **Session Memory** - Conversation context and state management
- **Edit Controller** - Human-in-the-loop approval system

### 🔄 **Auto-Loading Models**
Rich CLI automatically loads model lists when needed:
- No more empty model selectors
- Smart caching of model data
- Fallback to cached data if API is unavailable

## 🚀 **Advanced Capabilities** (Theoretical)

The Rich CLI architecture supports complete remote control of the hijacker via API endpoints:

### 🎯 **Available API Control Points**
- `/hijack/execute` - Execute any tool directly
- `/hijack/switch-mode` - Change operation modes
- `/jack/auto-accept` - Toggle edit approval
- `/v1/chat/completions` - Send AI messages
- `/api/model` - Switch models

### 💥 **Potential Remote Operations**
- **File Operations** - Read/write any workspace file
- **Terminal Commands** - Execute shell commands remotely
- **AI Chat** - Send messages to AI from Rich CLI
- **Tool Execution** - Use any available tool directly
- **Workspace Analysis** - Full codebase scanning

## 🎯 **Best Practices**

### 🛡️ **Security Recommendations**
1. **Always use `auto-accept off`** unless rapid prototyping
2. **Monitor system status regularly** with `status` command
3. **Check model usage** to avoid rate limits with `usage-models`
4. **Use `next`/`prev` to switch models** when hitting limits

### ⚡ **Performance Tips**
1. **Use `select` for visual model picking** - faster than typing names
2. **Check `usage` before intensive operations** - avoid quota limits
3. **Use `restart` if services become unresponsive**
4. **Monitor with `status`** to catch issues early

### 🎮 **Workflow Optimization**
1. **Start with `models`** to see what's available
2. **Use `select`** to pick optimal model for your task
3. **Enable `auto-accept on`** only for trusted operations
4. **Check `usage-models`** to understand model performance patterns

---

**🎮 Rich CLI = Complete System Control** - Your AI workspace, your rules! 🛡️⚡