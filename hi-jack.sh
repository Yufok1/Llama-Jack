#!/bin/bash

# Ollama Jack - AI Workspace Companion
# Unix/Linux/macOS Launch Script

clear

echo ""
echo "================================================================================"
echo "=       HELLO HOOMAN! AI JACK PROTOCOL INITIALIZING - SYSTEM ENHANCEMENT     ="
echo "================================================================================"
echo ""
echo "        H     H EEEEEEE L       L        OOOOO         H     H  OOOOO    OOOOO   M     M   AAA   N     N"
echo "        H     H E       L       L       O     O        H     H O     O  O     O  MM   MM  A   A  NN    N"
echo "        HHHHHHH EEEEE   L       L       O     O        HHHHHHH O     O  O     O  M M M M  AAAAA  N N   N"
echo "        H     H E       L       L       O     O        H     H O     O  O     O  M  M  M  A   A  N  N  N"
echo "        H     H EEEEEEE LLLLLLL LLLLLLL  OOOOO         H     H  OOOOO    OOOOO   M     M  A   A  N   NNN"
echo ""
echo "                          [!] J A C K   A I   P R O T O C O L [!]"
echo "                          Advanced AI Command and Control Matrix"
echo "                       Multi-Window Neural Monitoring and Integration"
echo ""

# Cleanup existing processes
echo "[CLEANUP] Terminating existing Node.js processes..."
pkill -f "node.*hijacker" 2>/dev/null || true
pkill -f "node.*debug-monitor" 2>/dev/null || true
pkill -f "node.*traffic-monitor" 2>/dev/null || true
pkill -f "node.*rich-cli" 2>/dev/null || true

# Kill processes on specific ports
lsof -ti:11435 | xargs kill -9 2>/dev/null || true
lsof -ti:11436 | xargs kill -9 2>/dev/null || true
lsof -ti:11437 | xargs kill -9 2>/dev/null || true

sleep 2

echo "[HIJACKER] Select AI command center mode:"
echo ""
echo "[1] LOCAL COMMAND CENTER  - Use local Ollama installation"
echo "[2] CLOUD COMMAND CENTER  - Use Ollama Cloud API (recommended)"
echo ""
read -p "Enter command center mode [1/2]: " mode_choice

case $mode_choice in
    1)
        echo ""
        echo "[LOCAL] Configuring local AI command center..."
        # Create system defaults
        cat > .env << EOF
PORT=11435
DEBUG_PORT=11436
MONITOR_PORT=11437
MODE=local
EOF
        mode_arg="local"
        echo ""
        echo "[WARNING] Ensure local Ollama is running: ollama serve"
        ;;
    2)
        echo ""
        echo "[CLOUD] Configuring cloud AI command center..."
        read -p "Enter Ollama Cloud API key: " api_key
        if [ -z "$api_key" ]; then
            echo "[ERROR] API key required for cloud hijacking"
            exit 1
        fi
        # Create system defaults
        cat > .env << EOF
OLLAMA_API_KEY=$api_key
PORT=11435
DEBUG_PORT=11436
MONITOR_PORT=11437
MODE=cloud
EOF
        mode_arg="cloud"
        ;;
    *)
        echo "[ERROR] Invalid selection. Aborting hijack protocol."
        exit 1
        ;;
esac

echo ""
echo "[COMMAND CENTER] Launching multi-window AI system..."
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                    JACK AI COMMAND CENTER ONLINE                    ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Function to open new terminal windows based on the system
open_terminal() {
    local title="$1"
    local command="$2"
    
    if command -v gnome-terminal >/dev/null 2>&1; then
        # GNOME Terminal (Ubuntu, etc.)
        gnome-terminal --title="$title" -- bash -c "$command; read -p 'Press Enter to close...'"
    elif command -v xterm >/dev/null 2>&1; then
        # XTerm (fallback)
        xterm -title "$title" -e bash -c "$command; read -p 'Press Enter to close...'" &
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS Terminal
        osascript -e "tell application \"Terminal\" to do script \"cd $(pwd) && $command\""
    else
        echo "[WARNING] Could not detect terminal emulator. Running in background..."
        nohup bash -c "$command" > /dev/null 2>&1 &
    fi
}

# Launch debug monitor window
echo "[LAUNCH] Starting Debug Monitor on port 11436..."
open_terminal "Ollama Debug Monitor" "node debug-monitor.js $mode_arg"

# Launch traffic monitor window  
echo "[LAUNCH] Starting Traffic Monitor on port 11437..."
open_terminal "Traffic Monitor" "node traffic-monitor.js $mode_arg"

# Launch rich CLI interface
echo "[LAUNCH] Starting Rich CLI Interface..."
open_terminal "🦙 Jack's Rich CLI" "node rich-cli.js $mode_arg"

# Wait for companion windows to initialize
echo "[WAIT] Initializing companion systems..."
sleep 3

echo ""
echo "================================================================================"
echo "=  [!] HELLO HOOMAN! [!] JACK AI CONTROL ACTIVE [!] AI ENHANCEMENT READY   ="
echo "================================================================================"
echo ""
echo "         =============================================================="
echo "       ==     [!] JACK AI ONLINE [!]     =="
echo "       ==                                                           =="
echo "       ==  This terminal is now your AI companion interface       =="
echo "       ==  Companion windows provide system monitoring feeds      =="
echo "       ==  All workspace communications monitored and logged      =="
echo "         =============================================================="
echo ""

# Launch main hijacker
echo "[JACK] AI neural engine engaged and ready to assist..."
echo "[INFO] Debug monitoring feeds active in companion windows"
echo "[INFO] System monitoring and logging online"
echo "[INFO] Rich CLI command interface active and ready"
echo "[INFO] Workspace integration protocol executed successfully"
echo ""

# Start the main hijacker process
node hi-jack-engine.js

# Cleanup on exit
echo ""
echo "[CLEANUP] Shutting down hijack protocol..."
pkill -f "node.*debug-monitor" 2>/dev/null || true
pkill -f "node.*traffic-monitor" 2>/dev/null || true
pkill -f "node.*rich-cli" 2>/dev/null || true

echo "[HIJACK] Protocol terminated. System restored."