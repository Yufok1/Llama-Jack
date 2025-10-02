#!/bin/bash

# Ollama Jack - One-Click Installation Script
# Works on macOS, Linux, and Windows (via Git Bash)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin)
            echo "macos"
            ;;
        Linux)
            echo "linux"
            ;;
        CYGWIN*|MINGW32*|MSYS*|MINGW*)
            echo "windows"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

OS=$(detect_os)

echo -e "${BLUE}🦙⚡ OLLAMA JACK INSTALLER ⚡🦙${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check Node.js
echo -e "${YELLOW}📋 Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found!${NC}"
    echo ""
    echo -e "${YELLOW}Please install Node.js 16+ first:${NC}"
    case $OS in
        macos)
            echo "  brew install node"
            echo "  # Or download from: https://nodejs.org"
            ;;
        linux)
            echo "  # Ubuntu/Debian:"
            echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
            echo "  sudo apt-get install -y nodejs"
            echo ""
            echo "  # Or download from: https://nodejs.org"
            ;;
        windows)
            echo "  Download from: https://nodejs.org"
            ;;
    esac
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_VERSION="16.0.0"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    echo -e "${GREEN}✅ Node.js $NODE_VERSION found${NC}"
else
    echo -e "${RED}❌ Node.js $NODE_VERSION is too old. Need 16.0.0+${NC}"
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm --version) found${NC}"

# Check Ollama
echo ""
echo -e "${YELLOW}📋 Checking Ollama...${NC}"
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}❌ Ollama not found!${NC}"
    echo ""
    echo -e "${YELLOW}Please install Ollama first:${NC}"
    case $OS in
        macos)
            echo "  brew install ollama"
            ;;
        linux)
            echo "  curl -fsSL https://ollama.ai/install.sh | sh"
            ;;
        windows)
            echo "  Download from: https://ollama.ai/download"
            ;;
    esac
    echo ""
    echo -e "${YELLOW}Then start Ollama:${NC}"
    echo "  ollama serve"
    exit 1
fi

# Try to start Ollama if not running
if ! ollama list &> /dev/null; then
    echo -e "${YELLOW}🔄 Starting Ollama service...${NC}"
    case $OS in
        macos)
            brew services start ollama 2>/dev/null || ollama serve &
            ;;
        linux)
            sudo systemctl start ollama 2>/dev/null || ollama serve &
            ;;
        windows)
            # On Windows, user needs to start manually
            echo -e "${YELLOW}Please start Ollama manually in another terminal: ollama serve${NC}"
            ;;
    esac
    sleep 3
fi

if ollama list &> /dev/null; then
    echo -e "${GREEN}✅ Ollama is running${NC}"
else
    echo -e "${YELLOW}⚠️  Ollama detected but not responding. You may need to start it manually.${NC}"
fi

# Install dependencies
echo ""
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
if ! npm install; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Install globally
echo ""
echo -e "${YELLOW}🌍 Installing Ollama Jack globally...${NC}"

# Check if already installed
if command -v ollama-jack &> /dev/null; then
    echo -e "${YELLOW}⚠️  Ollama Jack already installed globally. Updating...${NC}"
fi

# Try global install
if npm install -g .; then
    echo -e "${GREEN}✅ Global installation successful${NC}"
else
    echo -e "${RED}❌ Global installation failed${NC}"
    echo ""
    echo -e "${YELLOW}Trying alternative installation methods...${NC}"

    # Try npm link as fallback
    if npm link; then
        echo -e "${GREEN}✅ Linked successfully (alternative method)${NC}"
    else
        echo -e "${RED}❌ All installation methods failed${NC}"
        echo ""
        echo -e "${YELLOW}Manual installation:${NC}"
        echo "  sudo npm install -g ."
        echo "  # or"
        echo "  npm link"
        exit 1
    fi
fi

# Run setup
echo ""
echo -e "${YELLOW}🔧 Running initial setup...${NC}"
if ! ollama-jack setup; then
    echo -e "${RED}❌ Setup failed${NC}"
    exit 1
fi

# Verify installation
echo ""
echo -e "${YELLOW}🧪 Verifying installation...${NC}"
if command -v ollama-jack &> /dev/null; then
    echo -e "${GREEN}✅ ollama-jack command available${NC}"

    # Test help command
    if ollama-jack help &> /dev/null; then
        echo -e "${GREEN}✅ Command working correctly${NC}"
    else
        echo -e "${YELLOW}⚠️  Command available but help failed${NC}"
    fi
else
    echo -e "${RED}❌ ollama-jack command not found${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 INSTALLATION COMPLETE!${NC}"
echo ""
echo -e "${BLUE}🚀 To start using Ollama Jack:${NC}"
echo -e "${GREEN}  ollama-jack start${NC}"
echo ""
echo -e "${BLUE}📚 For help:${NC}"
echo -e "${GREEN}  ollama-jack help${NC}"
echo ""
echo -e "${BLUE}🛡️  Security:${NC}"
echo -e "${GREEN}  • Local-first operation${NC}"
echo -e "${GREEN}  • No data collection${NC}"
echo -e "${GREEN}  • User approval required${NC}"
echo ""

# Offer to start immediately
echo -e "${YELLOW}Would you like to start Ollama Jack now? (y/n)${NC}"
read -r response
case $response in
    [Yy]*)
        echo -e "${BLUE}🚀 Starting Ollama Jack...${NC}"
        ollama-jack start
        ;;
    *)
        echo -e "${BLUE}👋 You can start anytime with: ollama-jack start${NC}"
        ;;
esac</content>
<parameter name="filePath">c:\Users\Jeff Towers\projects\ollama-tools-workspace\install.sh