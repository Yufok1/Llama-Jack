# 🔧 Edit Version Control System

## Overview

The **Edit Version Control System** provides granular control over all workspace modifications made by AI agents. Instead of immediately executing potentially destructive operations, the system proposes edits that you can review, accept, or reject individually.

## 🎮 **Rich CLI Integration** (NEW!)

The edit control system now integrates with **Rich CLI** for centralized management:

- **`auto-accept on/off`** - Toggle automatic edit approval from Rich CLI
- **System status** - View auto-accept mode in Rich CLI `status` command  
- **Centralized control** - All system commands unified in Rich CLI interface
- **Legacy support** - Direct hijacker commands still work for backwards compatibility

## 🎯 Key Features

### ✨ **Edit Proposals**
- Every workspace-modifying operation becomes a **proposed edit**
- Each edit gets a unique ID and detailed description
- **Expected outcomes** are clearly explained before execution
- **Automatic backups** are created for file modifications

### 🔍 **Granular Review Process**
- **Individual edit control** - accept or reject each operation separately
- **Batch operations** - group related edits for bulk review
- **Non-blocking workflow** - AI continues proposing while you review
- **Detailed logging** - complete audit trail of all edits

### 🛡️ **Safety & Recovery**
- **Automatic backups** before file modifications
- **Rollback capabilities** for applied edits
- **Edit history** preserved in `.edits/history.json`
- **Zero-risk browsing** - read operations execute immediately

---

## 🚀 Quick Start

### 1. **Start the Hijacker**
```bash
.\hijack.bat
```

### 2. **Begin Versioned Chat**  
```
🤖 AI Hijacker > can you add a new function to my code?
```

### 3. **Review Proposed Edits**
```
╭─── PROPOSED EDIT: edit_1632847291_1 ───╮
│ 📄 Description: Create/modify file: src/utils.js
│ 🎯 Expected:   File will be created with 245 characters  
│ ✅ Accept:     accept edit_1632847291_1
│ ❌ Reject:     reject edit_1632847291_1
│ 💾 Backup:     Created for existing file
╰─────────────────────────────────────────╯
```

### 4. **Control Individual Edits**
```
🤖 AI Hijacker > accept edit_1632847291_1
✅ ACCEPTING EDIT: edit_1632847291_1
🎉 EDIT APPLIED SUCCESSFULLY
```

---

## 📋 Commands Reference

### 🎮 **Rich CLI Commands** (Recommended)
| Command | Description | Example |
|---------|-------------|---------|
| `auto-accept on` | Enable automatic edit approval | `auto-accept on` |
| `auto-accept off` | Disable automatic edit approval | `auto-accept off` |
| `status` | Complete system status with edit mode | `status` |

### **Edit Management** (Main Terminal)
| Command | Description | Example |
|---------|-------------|---------|
| `edits` | Show all pending edits | `edits` |
| `accept <id>` | Apply a specific edit | `accept edit_1632847291_1` |
| `reject <id> [reason]` | Reject edit with optional reason | `reject edit_1632847291_1 unnecessary` |
| `batch start <desc>` | Start grouping edits | `batch start "Add logging system"` |

### **System Commands** (Main Terminal)
| Command | Description | Example |
|---------|-------------|---------|
| `status` | Show system and edit statistics | `status` |
| `auto-accept on/off` | Toggle automatic approval (legacy) | `auto-accept off` |
| `help` | Show all available commands | `help` |
| `clear` | Clear terminal screen | `clear` |
| `exit` | Exit chat mode | `exit` |

---

## 🔄 Edit Types & Operations

### **🗂️ File Operations**
- **File Creation**: New files proposed before writing
- **File Modification**: Existing files backed up automatically  
- **File Append**: Content additions clearly marked
- **Expected**: File size, content type, modification scope

### **⚡ Command Execution**
- **Terminal Commands**: Shell operations queued for approval
- **Git Operations**: Repository changes managed individually
- **Expected**: Command output, working directory, potential effects

### **🔧 System Changes**
- **Configuration Updates**: Settings modifications tracked
- **Dependency Installation**: Package manager operations controlled
- **Expected**: Installation targets, configuration changes

---

## 🎨 Visual Interface

### **Edit Status Indicators**
```
🔹 write_file: 📝 Edit Proposed
   Edit ID: edit_1632847291_1
   Use 'accept edit_1632847291_1' or 'reject edit_1632847291_1' to control this edit

✅ EDIT APPLIED SUCCESSFULLY
📊 Result: {"success":true,"path":"src/utils.js","size":245,"mode":"write"}
```

### **Batch Processing**
```
📝 EDIT BATCH STARTED
Batch ID: batch_1632847291
Description: Add comprehensive logging system
💡 Edits will be queued for your review

📦 Edit batch started: batch_1632847291
```

### **Statistics Display**
```
📊 Edit Stats: 3 pending, 12 applied, 1 rejected
```

---

## 🛠️ Advanced Features

### **🔐 Safety Mechanisms**
- **Pre-execution validation** of all operations
- **Atomic operations** - edits succeed completely or fail safely
- **Conflict detection** for concurrent modifications
- **Automatic cleanup** of failed operations

### **📚 Edit History & Audit Trail**
- **Complete logs** stored in `.edits/history.json`
- **Timestamp tracking** for all operations
- **User attribution** for accepts/rejects
- **Rollback information** for applied edits

### **⚡ Performance Optimizations**
- **Non-blocking proposals** - AI doesn't wait for approval
- **Parallel processing** of read-only operations
- **Efficient diff generation** for file modifications
- **Minimal memory footprint** for edit storage

---

## 🔧 Configuration & Customization

### **Environment Variables**
```bash
EDIT_HISTORY_SIZE=1000        # Maximum edit history entries
EDIT_AUTO_BACKUP=true         # Enable automatic backups
EDIT_BATCH_TIMEOUT=300        # Batch timeout in seconds
EDIT_PROMPT_FORMAT=detailed   # Edit display format
```

### **Customization Options**
```javascript
const editController = new EditVersionController(workspaceRoot, {
    maxHistorySize: 1000,
    autoBackup: true,
    batchTimeout: 300000,
    promptFormat: 'detailed'
});
```

---

## 🆘 Troubleshooting

### **Common Issues**

**Q: Edits aren't being proposed**
A: Check that versioning is enabled with `status` command

**Q: Can't accept an edit**  
A: Verify the edit ID with `edits` command - it may have expired

**Q: System seems slow**
A: Large edit backlogs can impact performance - review pending edits

**Q: Lost edit history**
A: Check `.edits/history.json` file permissions and disk space

### **Emergency Recovery**
```bash
# Clear all pending edits
rm -rf .edits/

# Reset edit controller
🤖 AI Hijacker > status
# System will reinitialize automatically
```

---

## 🎉 Benefits

✅ **Complete Control** - Never lose work to unwanted changes  
✅ **Transparent Process** - See exactly what will happen before it does  
✅ **Audit Trail** - Full history of all workspace modifications  
✅ **Safety First** - Automatic backups and rollback capabilities  
✅ **Productivity** - AI continues working while you review  
✅ **Confidence** - Make decisions with full context and information  

---

*The Edit Version Control System transforms AI assistance from "hope it works" to "know it works" - giving you complete confidence in AI-driven development workflows.*