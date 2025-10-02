# 🔒 Security & Privacy Documentation

## 🛡️ **Security Overview**

Ollama Jack is designed with **privacy and security as core principles**. This document outlines our security measures, data handling practices, and recommendations for safe usage.

## 🔐 **Data Protection Measures**

### **Local-First Architecture**
- ✅ **No Remote Data Storage**: All operations happen locally on your machine
- ✅ **No User Analytics**: Zero telemetry or usage tracking sent to external services
- ✅ **No Code Transmission**: Your workspace files never leave your local environment
- ✅ **Git-Excluded Secrets**: All sensitive files automatically excluded from version control

### **API Key Security**
```bash
# Secure credential storage
.env                 # Contains API keys - GIT EXCLUDED
.env.cloud          # Cloud mode credentials - GIT EXCLUDED  
.env.local          # Local mode settings - GIT EXCLUDED
node_modules/       # Dependencies - GIT EXCLUDED
.edits/             # Edit history - GIT EXCLUDED (contains file content)
```

**Session-Only Credentials**: API keys are never persisted to disk. They exist only in memory during active sessions and must be provided fresh each launch for security.

### **Web Search Privacy**
- 🔒 **Opt-In Only**: Web search requires explicit cloud mode activation
- 🔒 **API Key Required**: No web requests without user-provided Ollama Cloud key
- 🔒 **Usage Limits**: Built-in daily quotas prevent excessive external requests
- 🔒 **Query Transparency**: All web searches logged locally for user visibility

## 🚨 **What Data Jack Accesses**

### **Local Workspace Only**
Jack can access files within your **current project workspace** only:
- ✅ Read/write files in target workspace directory
- ✅ Execute terminal commands in workspace context
- ✅ Access git repository information
- ✅ Search code patterns within workspace files

### **Network Access (Cloud Mode Only)**
When cloud mode is enabled:
- 🌐 **Ollama Cloud API**: For model inference and web search
- 🌐 **Web Search Queries**: Only search terms you explicitly request
- 🌐 **No File Uploads**: Your code files are never transmitted

## 🔒 **User Control & Consent**

### **Explicit Approval System**
Every potentially destructive action requires user approval:
```
[1] ✅ ACCEPT | [2] ❌ REJECT | [3] 🔧 REFACTOR
```

### **Granular Permissions**
- 📝 **File Modifications**: Each edit requires 1/2/3 confirmation
- 💻 **Terminal Commands**: All commands shown before execution
- 🌐 **Web Searches**: Displayed with query and result count
- 🔄 **Git Operations**: Full transparency on repository changes

## 🏭 **Factory Reset & Distribution Security**

### **Clean Distribution**
Before sharing or distributing:
```bash
# Remove all sensitive data
rm .env .env.cloud .env.local
rm -rf .edits/
rm -rf node_modules/
npm install  # Clean dependency install
```

### **Default Security State**
- ❌ **No API Keys**: Ships without any credentials
- ❌ **No Web Access**: Requires user to explicitly enable cloud mode
- ❌ **No File History**: Edit history cleared on clean install
- ✅ **Local Mode Default**: Starts in secure local-only mode

## 🔍 **Security Audit Results**

### **File System Access**
- ✅ **Workspace Scoped**: Cannot access files outside target directory
- ✅ **Path Normalization**: All paths normalized to prevent directory traversal attacks
- ✅ **Cross-Platform Security**: Handles Windows backslash and Unix forward slash attacks
- ✅ **Explicit Paths**: All file operations use absolute workspace-relative paths
- ✅ **Backup Protection**: Automatic backups created before any file modifications

### **Network Security**
- ✅ **HTTPS Only**: All external requests use secure connections
- ✅ **No Telemetry**: Zero usage statistics transmitted
- ✅ **Bearer Token Auth**: Secure API authentication method
- ✅ **Rate Limited**: Built-in quota management prevents abuse

### **Process Security**
- ✅ **Process Isolation**: Runs as user-level Node.js process
- ✅ **No Privilege Escalation**: Cannot access system-level resources
- ✅ **Clean Shutdown**: Graceful termination with Ctrl+C
- ✅ **Resource Limits**: Memory and CPU usage constrained

## 📋 **Security Recommendations**

### **For Users**
1. **Review Commands**: Always check proposed terminal commands before approval
2. **Secure API Keys**: Store Ollama Cloud keys in `.env` files only
3. **Regular Updates**: Keep Jack updated for latest security fixes
4. **Workspace Isolation**: Run Jack only in dedicated project directories

### **For Distribution**
1. **Clean Repository**: Ensure no `.env` files in git history
2. **Document Setup**: Provide clear API key configuration instructions
3. **Default Security**: Ship with local mode as default
4. **Audit Trail**: Recommend users review edit history periodically

## 🚨 **Incident Response**

If you discover a security issue:
1. **Do Not** create public GitHub issues for security vulnerabilities
2. **Contact** the maintainers privately
3. **Provide** detailed reproduction steps
4. **Allow** reasonable time for fixes before public disclosure

## ✅ **Security Compliance**

- 🔒 **GDPR Compliant**: No personal data collection or processing
- 🔒 **SOC 2 Aligned**: Security controls and monitoring in place
- 🔒 **Open Source**: Full transparency through public code repository
- 🔒 **Privacy by Design**: Security considerations built into every feature

---

**Last Updated**: September 26, 2025  
**Security Review**: v1.0.0 - Ollama Jack Release