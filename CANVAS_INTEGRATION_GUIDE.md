# 🚀 Canvas + Jack Ollama Coordination Guide

## Overview
This guide shows how to configure optimal Ollama resource sharing between the Canvas AI Analysis System (5 AI agents) and Jack AI Workspace Companion.

## 🎯 **Deployment Scenarios**

### **Scenario 1: Local-Only Development**
*Best for: Development, testing, limited resources*

**Configuration:**
```bash
# Jack (.env)
MODE=local
OLLAMA_HOST=http://localhost:11434
# No OLLAMA_API_KEY needed

# Canvas (localStorage)
ollama_turbo_enabled=false
```

**Resource Usage:**
- Both systems share single local Ollama instance
- Load balancing handles 3 concurrent connections max
- Canvas AI systems get priority during analysis bursts

---

### **Scenario 2: Cloud-Only High Performance**
*Best for: Production, heavy workloads, maximum performance*

**Configuration:**
```bash
# Jack (.env)
MODE=cloud
OLLAMA_API_KEY=your_cloud_api_key_here
OLLAMA_HOST=https://api.ollama.com

# Canvas (localStorage)
ollama_turbo_enabled=true
ollama_turbo_api_key=your_cloud_api_key_here
```

**Resource Usage:**
- Both systems use cloud APIs
- Higher rate limits (10+ concurrent)
- No local resource contention
- Requires API key with sufficient quota

---

### **Scenario 3: Hybrid Load Balancing** ⭐ **RECOMMENDED**
*Best for: Production with fallback, optimal resource utilization*

**Configuration:**
```bash
# Jack (.env)
MODE=auto  # or leave blank for auto-detection
OLLAMA_API_KEY=your_cloud_api_key_here
OLLAMA_HOST=http://localhost:11434

# Canvas (localStorage)
ollama_turbo_enabled=true
ollama_turbo_api_key=your_cloud_api_key_here
```

**Resource Usage:**
- Jack: Auto-selects based on Canvas load
- Canvas: Uses turbo (cloud) for heavy analysis
- Intelligent failover between local/cloud
- Optimal cost vs performance balance

---

### **Scenario 4: Canvas Priority**
*Best for: Document analysis focus, Canvas-heavy workflows*

**Configuration:**
```bash
# Jack (.env)
MODE=auto
OLLAMA_API_KEY=your_cloud_api_key_here
JACK_CANVAS_PRIORITY=true

# Canvas (localStorage)
ollama_turbo_enabled=false  # Canvas gets local priority
```

**Resource Usage:**
- Canvas: Gets local Ollama priority
- Jack: Automatically uses cloud when Canvas is active
- Ideal for intensive document analysis sessions

---

### **Scenario 5: Jack Priority**
*Best for: Development focus, Jack-heavy workflows*

**Configuration:**
```bash
# Jack (.env)
MODE=local
OLLAMA_HOST=http://localhost:11434
JACK_CANVAS_PRIORITY=false

# Canvas (localStorage)
ollama_turbo_enabled=true  # Canvas uses cloud
ollama_turbo_api_key=your_cloud_api_key_here
```

**Resource Usage:**
- Jack: Gets local Ollama priority  
- Canvas: Uses cloud turbo mode
- Ideal for coding and workspace management

---

## ⚙️ **Configuration Details**

### **Environment Variables (Jack)**
```bash
# Core Configuration
MODE=auto|local|cloud               # Operation mode
OLLAMA_HOST=http://localhost:11434   # Local Ollama endpoint
OLLAMA_API_KEY=sk-xxx               # Cloud API key

# Bridge Configuration  
JACK_CANVAS_BRIDGE=true             # Enable Canvas integration
JACK_CANVAS_PRIORITY=auto           # auto|true|false
JACK_LOAD_BALANCE=true              # Enable load balancing

# Advanced Settings
JACK_MAX_LOCAL_CONNECTIONS=3        # Local connection limit
JACK_MAX_CLOUD_CONNECTIONS=10       # Cloud connection limit
JACK_COORDINATION_MODE=balanced     # balanced|local-prefer|cloud-prefer
```

### **Canvas Configuration (localStorage)**
```javascript
// Core Ollama Settings
localStorage.setItem('ollama_turbo_enabled', 'true');
localStorage.setItem('ollama_turbo_api_key', 'your_api_key');

// Coordination Settings
localStorage.setItem('canvas_jack_bridge_enabled', 'true');
localStorage.setItem('canvas_coordination_mode', 'balanced');
localStorage.setItem('canvas_ollama_priority', 'auto');
```

## 🔄 **Dynamic Load Balancing**

### **Automatic Mode Selection**
The system automatically chooses optimal endpoints based on:

1. **Current Load**: Local vs Cloud utilization
2. **System Priority**: Canvas analysis vs Jack operations  
3. **Request Type**: Interactive vs background tasks
4. **Resource Availability**: Connection limits and quotas

### **Load Balancing Rules**
```javascript
// When Canvas has 4-5 AI systems active
jack_mode = 'cloud-prefer'    // Jack uses cloud
canvas_mode = 'local'         // Canvas uses local

// When Canvas has 0-1 systems active  
jack_mode = 'local-prefer'    // Jack uses local
canvas_mode = 'turbo'         // Canvas can use cloud

// Balanced load
jack_mode = 'auto'            // Dynamic selection
canvas_mode = 'auto'          // Dynamic selection
```

## 🛠️ **Setup Commands**

### **Quick Setup**
```bash
# 1. Configure Jack
cp .env.example .env
# Edit .env with your preferred scenario

# 2. Start Jack with Canvas bridge
hi jack --canvas-bridge

# 3. In Canvas HTML, enable coordination
localStorage.setItem('canvas_jack_bridge_enabled', 'true');
```

### **Advanced Setup**
```bash
# 1. Enable orchestration mode
export JACK_ORCHESTRATION_MODE=true

# 2. Configure load balancing
export JACK_LOAD_BALANCE=true
export JACK_CANVAS_PRIORITY=auto

# 3. Start with monitoring
hi jack --canvas-bridge --monitor
```

---

## �️ **Canvas HTML Interface Overview**

The Canvas system provides a sophisticated web-based interface that integrates seamlessly with Jack's AI workspace capabilities. The interface is organized in a responsive grid layout with specialized panels for different functions.

### **Interface Layout**

```
┌─────────────────────────────────────────────────────────┐
│                    🜂 CANVAS HEADER                      │
│         Orchestration Status & System Controls         │
├─────────────────────┬───────────────────────────────────┤
│                     │                                   │
│    📝 SOVEREIGN     │      📡 LIVE AI FEEDS & CHAT      │
│       CANVAS        │                                   │
│   (Document Editor) │   • DJINN Analysis Feed           │
│                     │   • NAZAR Pattern Recognition     │
│                     │   • NARRA Emotional Intelligence  │
│                     │   • WHALE Governance Oversight    │
│                     │   • WATCHTOWER Surveillance       │
├─────────────────────┼───────────────────────────────────┤
│                     │                                   │
│   📊 SYNTHESIS      │      🎯 JACK TERMINAL MIRROR      │
│    REPORTS          │                                   │
│   (AI Analysis)     │   • Real-time Jack Commands       │
│                     │   • Canvas Search Integration     │
│                     │   • Constraint & Commentary       │
│                     │   • Live Metrics & Status         │
└─────────────────────┴───────────────────────────────────┘
```

### **Panel Functions**

#### **🎯 Header Panel**
- **Orchestration Status**: Real-time system health and AI agent status
- **Mode Indicators**: Local/cloud operation modes, load balancing status
- **System Controls**: Quick access to configuration and monitoring

#### **📝 Sovereign Canvas (Main Editor)**
- **Rich Text Editor**: Full document editing with formatting
- **AI Integration**: Direct connection to all 5 AI agents
- **Real-time Analysis**: Live feedback from AI systems during editing
- **Data Persistence**: Automatic saving to localStorage and IndexedDB

#### **📡 Live AI Feeds & Chat**
- **Agent Feeds**: Real-time output from all AI agents (DJINN, NAZAR, NARRA, WHALE, WATCHTOWER)
- **Interactive Chat**: Direct communication with individual AI agents
- **Feed Filtering**: Filter by agent, content type, or time range
- **Live Updates**: Continuous streaming of AI analysis and insights

#### **📊 Synthesis Reports**
- **Contextual Reports**: AI-generated analysis reports with developmental continuity
- **Round-based Organization**: Synthesis reports organized by analysis sessions
- **Search Integration**: Full grep-level search capabilities via Jack
- **Historical Analysis**: Build-up of insights across multiple sessions

#### **🎯 Jack Terminal Mirror**
- **Live Command Interface**: Real-time mirroring of Jack's Rich CLI
- **Canvas Search Commands**: Direct access to `canvas_grep_synthesis` and `canvas_grep_feeds`
- **Constraint Controls**: Apply search constraints and view commentary
- **System Integration**: Seamless workflow between Canvas and Jack operations

### **Key Integration Features**

#### **🔄 Real-time Synchronization**
- **Bidirectional Data Flow**: Canvas data automatically syncs with Jack's workspace
- **Live Updates**: Changes in either system reflect immediately in both
- **State Persistence**: All data persists across browser sessions and system restarts

#### **🔍 Advanced Search Integration**
- **Grep-level Precision**: Search through synthesis reports and AI feeds with regex support
- **Constraint System**: Apply limits, filters, and operational constraints
- **Automatic Commentary**: AI-powered analysis assessment and planning
- **Rich CLI Access**: Full terminal control over Canvas search operations

#### **⚡ Performance Optimization**
- **Load Balancing**: Automatic distribution between local and cloud Ollama instances
- **Resource Prioritization**: Intelligent allocation based on current workload
- **Background Processing**: Non-blocking AI operations and data synchronization

### **Quick Start with Interface**

1. **Open Canvas HTML**: Navigate to `canvas/canvas-with-observation-feeds.html`
2. **Enable Coordination**: Set `localStorage.setItem('canvas_jack_bridge_enabled', 'true')`
3. **Start Jack**: Launch with `hi jack --canvas-bridge`
4. **Begin Analysis**: Start typing in the Canvas editor to trigger AI analysis
5. **Monitor Feeds**: Watch real-time AI insights in the Live Feeds panel
6. **Search & Analyze**: Use Jack's terminal to perform advanced searches through accumulated data

---

## �🔍 **Enhanced Canvas Search Integration** 🚀

**NEW: Jack now provides advanced search capabilities through Canvas data with full constraint and commentary integration.**

### **Available Canvas Search Tools**

**1. `canvas_grep_synthesis`** - Search through synthesis reports
```javascript
// Basic search
canvas_grep_synthesis({ pattern: "machine learning" })

// Advanced search with constraints
constrain({
  operation: "canvas_grep_synthesis",
  constraints: { maxResults: 5, contextLines: 2, dateRange: "last_24h" }
})
canvas_grep_synthesis({ 
  pattern: "quantum.*entanglement", 
  isRegex: true,
  roundId: "round_001" 
})
```

**2. `canvas_grep_feeds`** - Search through AI feeds
```javascript
// Search all AI feeds
canvas_grep_feeds({ pattern: "error" })

// Agent-specific search
canvas_grep_feeds({ 
  pattern: "analysis", 
  agentFilter: ["DJINN", "WATCHTOWER"],
  contentType: "governance",
  maxResults: 10
})
```

### **Search Capabilities**

| Feature | canvas_grep_synthesis | canvas_grep_feeds |
|---------|----------------------|-------------------|
| **Regex Support** | ✅ Full regex patterns | ✅ Full regex patterns |
| **Case Sensitivity** | ✅ Configurable | ✅ Configurable |
| **Context Lines** | ✅ Before/after matches | ❌ (single line results) |
| **Date Filtering** | ✅ last_24h, last_week, custom | ✅ last_24h, last_week |
| **Agent Filtering** | ❌ N/A | ✅ Specific AI agents |
| **Content Type Filter** | ❌ N/A | ✅ governance, emotional, pattern, analysis, operational |
| **Round ID Filter** | ✅ Specific synthesis rounds | ❌ N/A |
| **Constraint Integration** | ✅ Full constrain tool support | ✅ Full constrain tool support |
| **Automatic Commentary** | ✅ Analysis assessment | ✅ Feed analysis |

### **Constraint Integration Examples**

**Time-based synthesis search:**
```javascript
constrain({
  operation: "canvas_grep_synthesis",
  constraints: { 
    maxResults: 3, 
    dateRange: "last_week",
    contextLines: 1 
  }
})
canvas_grep_synthesis({ pattern: "neural network" })
```

**Agent-focused feed analysis:**
```javascript
constrain({
  operation: "canvas_grep_feeds", 
  constraints: { 
    maxResults: 5,
    agentFilter: ["NAZAR", "NARRA"]
  }
})
canvas_grep_feeds({ pattern: "pattern", contentType: "pattern" })
```

### **Commentary Integration**

**Automatic commentary provides analysis between search operations:**
```javascript
// After synthesis search:
commentary({
    channel: "analysis",
    content: "Found 3 matches in synthesis reports about neural networks..."
})

// After feed search:
commentary({
    channel: "analysis", 
    content: "AI feed search revealed pattern analysis from NAZAR and NARRA..."
})
```

### **Workflow Integration**

**Canvas search follows the same planning/continuation pattern as workspace operations:**
```
1. Set constraints for Canvas search operation
2. Execute Canvas search with parameters
3. Automatic commentary assessment of results
4. Decision point: continue, refine, or analyze
5. Next action based on commentary insights
```

This provides **grep-level precision** for Canvas data with the same **intelligent workflow** used for file operations.

## 📊 **Monitoring Commands**

```bash
# Check system status
jack> ollama-balance

# View coordination status  
jack> canvas-status

# Orchestrate systems
jack> system-orchestrate balance
jack> system-orchestrate priority-canvas
jack> system-orchestrate priority-jack
```

## � **Data Synchronization & Accumulation**

### **Cross-System Data Flow**
Canvas and Jack maintain synchronized intelligence through automatic data accumulation:

**Data Types Synchronized:**
- **Analysis History**: AI agent responses and insights
- **Synthesis Reports**: Collaborative AI synthesis outputs  
- **AI Feeds**: Live observation data from all 5 agents
- **Session State**: Configuration and context persistence

**Synchronization Process:**
```
Canvas Analysis → localStorage → Jack API → IndexedDB Storage
       ↓              ↓              ↓              ↓
   AI Insights   State Persistence  Deduplication  Historical Archive
       ↓              ↓              ↓              ↓
   Meta-Analysis Cross-Session Correlation Evolutionary Synthesis
```

### **Monitoring Data Accumulation**
```bash
# Check Canvas-Jack data status
jack> canvas-status

# View accumulated data summary
# Shows: localStorage keys, IndexedDB stores, total records
```

### **Data Persistence**
- **Session Continuity**: Data persists across browser refreshes
- **Cross-Session Accumulation**: Historical data builds over time
- **Deduplication**: Prevents duplicate entries during sync
- **Rich CLI Access**: All accumulated data accessible via terminal

### **Meta-Analysis Capabilities**
Jack can perform meta-analysis on accumulated Canvas data:
- **Trend Analysis**: Patterns across multiple analysis sessions
- **Evolutionary Insights**: How AI understanding develops over time
- **Correlation Discovery**: Relationships between different AI perspectives
- **Synthesis Optimization**: Improving collaborative AI outputs

## �🚨 **Troubleshooting**

### **Common Issues**

**"Local Ollama at capacity"**
```bash
# Solution: Enable cloud fallback
export OLLAMA_API_KEY=your_key
export MODE=auto
```

**"Canvas systems not responding"**
```bash
# Solution: Check bridge connection
jack> canvas-status
jack> system-orchestrate sync
```

**"High API usage costs"**
```bash
# Solution: Prefer local mode
export MODE=local
# Or set Canvas to local-only
localStorage.setItem('ollama_turbo_enabled', 'false');
```

## 🎯 **Best Practices**

1. **Start with Hybrid Mode** - Best balance of performance and cost
2. **Monitor Resource Usage** - Use `ollama-balance` command regularly  
3. **Set Appropriate Priorities** - Match your primary workflow
4. **Use Auto-Detection** - Let the system optimize automatically
5. **Have Fallbacks** - Always configure both local and cloud access

---

**Result: Seamless Canvas + Jack operation with optimal Ollama resource utilization! 🚀**