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

## 🚨 **Troubleshooting**

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