# 🚀 Ollama Jack Installation Guide

## 📦 **Fresh Download Setup (GitHub Zip)**

### **Step 1: Download & Extract**
```bash
# Download the zip from GitHub releases
# Extract to your preferred location, e.g.:
cd ~/projects
unzip ollama-jack-v1.0.1.zip
cd ollama-jack
```

### **Step 2: Install Dependencies**
```bash
# Install all required packages
npm install
```

### **Step 3: Global Command Setup**
```bash
# Make Ollama Jack available globally on your system
npm install -g .

# Alternative: Link for development
npm link
```

### **Step 4: Initial Configuration**
```bash
# Run the automated setup
ollama-jack setup
```

**What this does:**
- ✅ Checks if Ollama is installed and running
- ✅ Creates `.env` configuration template
- ✅ Sets up default local mode configuration
- ✅ Verifies all components are ready

### **Step 5: Start Using Jack**
```bash
# Launch the full AI workspace system
ollama-jack start

# Or use the hijack command for enhanced Windows experience
hijack  # On Windows: full multi-window protocol
```

---

## 🍎 **Mac Installation (No Muss, No Fuss)**

### **Prerequisites**
- **Node.js 16+**: Download from [nodejs.org](https://nodejs.org) or use Homebrew:
  ```bash
  brew install node
  ```
- **Ollama**: Install from [ollama.ai](https://ollama.ai/download) or Homebrew:
  ```bash
  brew install ollama
  ```

### **One-Command Mac Setup**
```bash
# 1. Download and extract the zip
cd ~/Desktop
unzip ~/Downloads/ollama-jack-v1.0.1.zip
cd ollama-jack

# 2. Install globally (requires sudo for system-wide access)
sudo npm install -g .

# 3. Run setup
ollama-jack setup

# 4. Start using!
ollama-jack start
```

### **Mac Troubleshooting**
If you get permission errors:
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

If Ollama isn't found:
```bash
# Start Ollama service
brew services start ollama

# Or run manually
ollama serve
```

---

## 🔒 **Security Verification (Pre-Installation)**

### **Automatic Security Checks**
Before installation, verify these security measures:

#### **1. Environment File Security**
```bash
# Check that sensitive files are git-excluded
grep -E "\.env|api.*key|secret" .gitignore
```

**Expected output:**
```
.env
.env.local
.env.production
.env.cloud
.env.development
.env.*.local
.env.backup
.env.*
**/api-keys.json
**/secrets.json
**/.secrets
```

#### **2. No Sensitive Data in Repository**
```bash
# Ensure no API keys are committed
grep -r "OLLAMA_API_KEY\|your_api_key" --exclude-dir=node_modules .
```

**Expected:** No actual API keys found (only placeholders)

#### **3. Secure Dependencies**
```bash
# Check for known vulnerabilities
npm audit

# Update to latest secure versions
npm audit fix
```

### **Post-Installation Security**
After setup, your secure configuration includes:

- **Local Mode Default**: No external API calls unless explicitly enabled
- **Git-Ignored Secrets**: All credentials stored in `.env` (not committed)
- **User Approval Required**: Every file edit requires explicit confirmation
- **No Telemetry**: Zero usage data sent to external servers

---

## 🌍 **Cross-Platform Compatibility**

### **Windows Setup**
```cmd
# Install globally
npm install -g .

# Run setup
ollama-jack setup

# Launch
hijack.bat
```

### **Linux Setup**
```bash
# Install globally
sudo npm install -g .

# Run setup
ollama-jack setup

# Launch
./hijack.sh
```

### **Mac Setup**
```bash
# Install globally
sudo npm install -g .

# Run setup
ollama-jack setup

# Launch
./hijack.sh
```

---

## 🧪 **Verification Tests**

### **Test Global Command**
```bash
# Should show help
ollama-jack help

# Should show version
ollama-jack --version
```

### **Test Full System**
```bash
# Start the system
ollama-jack start

# In another terminal, check services
curl http://localhost:11435/health
curl http://localhost:11436/stats
curl http://localhost:11437/stats
```

### **Test Security**
```bash
# Ensure no sensitive data is exposed
find . -name "*.env*" -exec grep -l "your_api_key_here" {} \;

# Check that services are running locally only
netstat -an | grep 11435
```

---

## 🚨 **Common Issues & Solutions**

### **"Command not found"**
```bash
# Windows
refreshenv  # PowerShell
# Or restart terminal

# Mac/Linux
source ~/.bashrc
source ~/.zshrc
# Or restart terminal
```

### **Permission Errors**
```bash
# Mac/Linux
sudo npm install -g .
sudo chown -R $(whoami) ~/.npm
```

### **Ollama Not Found**
```bash
# Check if running
ollama list

# Start service
ollama serve  # Background
```

### **Port Conflicts**
```bash
# Kill existing processes
pkill -f "node.*hijacker"
pkill -f "node.*monitor"

# Or change ports in .env
PORT=11438
DEBUG_PORT=11439
MONITOR_PORT=11440
```

---

## 📋 **Post-Installation Checklist**

- [ ] `ollama-jack --version` works
- [ ] `ollama-jack setup` completed successfully
- [ ] Ollama is running (`ollama list` works)
- [ ] `.env` file created with secure defaults
- [ ] No sensitive data in repository
- [ ] All dependencies installed
- [ ] Services start on correct ports
- [ ] Global command accessible from any directory

---

## 🎯 **Quick Start Summary**

**For Fresh Downloads:**
1. Extract zip → `npm install` → `npm install -g .` → `ollama-jack setup` → `ollama-jack start`

**For Mac Users:**
1. `brew install node ollama` → Extract zip → `sudo npm install -g .` → `ollama-jack setup` → `ollama-jack start`

**Security Verified:**
- ✅ No API keys in repository
- ✅ Local-first operation
- ✅ User approval required
- ✅ Git-excluded secrets

The global command works seamlessly across Windows, Mac, and Linux with this setup! 🎉</content>
<parameter name="filePath">c:\Users\Jeff Towers\projects\ollama-tools-workspace\INSTALL.md