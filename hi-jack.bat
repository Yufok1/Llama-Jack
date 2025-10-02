@echo off
setlocal enabledelayedexpansion
cls

if "%1"=="no-kill-node" set SKIP_NODE_KILL=1

echo.
color 0C
echo ================================================================================
echo =       HELLO HOOMAN! AI JACK PROTOCOL INITIALIZING - SYSTEM ENHANCEMENT      =
echo ================================================================================
echo.
echo        H     H EEEEEEE L       L        OOOOO         H     H  OOOOO    OOOOO   M     M   AAA   N     N
echo        H     H E       L       L       O     O        H     H O     O  O     O  MM   MM  A   A  NN    N
echo        HHHHHHH EEEEE   L       L       O     O        HHHHHHH O     O  O     O  M M M M  AAAAA  N N   N
echo        H     H E       L       L       O     O        H     H O     O  O     O  M  M  M  A   A  N  N  N
echo        H     H EEEEEEE LLLLLLL LLLLLLL  OOOOO         H     H  OOOOO    OOOOO   M     M  A   A  N   NNN
echo.
echo                          [!] J A C K   A I   P R O T O C O L [!]
echo                          Advanced AI Command and Control Matrix
echo                       Multi-Window Neural Monitoring and Integration
echo.

:: Cleanup existing processes (be more selective)
echo [CLEANUP] Terminating existing hi-jack engine processes...
if not defined SKIP_NODE_KILL (
    echo [DEBUG] Killing node.exe processes running hi-jack-engine.js...
    for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" /fo list ^| findstr /c:"node.exe"') do (
        for /f "tokens=*" %%b in ('wmic process where "processid=%%a" get commandline /value 2^>nul ^| findstr /c:"hi-jack-engine.js"') do (
            echo [DEBUG] Killing hi-jack engine process PID %%a
            taskkill /f /pid %%a
        )
    )
) else (
    echo [DEBUG] Skipping node.exe kill (launched from global command)
)
echo [DEBUG] Killing processes on port 11435...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :11435') do (
    echo [DEBUG] Killing PID %%a on port 11435
    taskkill /f /pid %%a 2>nul
)
echo [DEBUG] Killing processes on port 11436...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :11436') do (
    echo [DEBUG] Killing PID %%a on port 11436
    taskkill /f /pid %%a 2>nul
)
echo [DEBUG] Killing processes on port 11437...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :11437') do (
    echo [DEBUG] Killing PID %%a on port 11437
    taskkill /f /pid %%a 2>nul
)
echo [DEBUG] Deleting .env if exists...
if exist ".env" del ".env"
echo [DEBUG] Cleanup complete.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js required for hi-jack operation
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

:: Store the script directory and target workspace
set "SCRIPT_DIR=%~dp0"
set "TARGET_WORKSPACE=%CD%"
echo [TARGET] Hi-Jack targeting workspace: %TARGET_WORKSPACE%

:: Change to hi-jack project directory for all operations
pushd "%SCRIPT_DIR%"

:: Install dependencies in hi-jack directory
if not exist "node_modules" (
    echo [INSTALL] Installing hi-jack dependencies...
    npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

echo [HI-JACK] Select AI command center mode:
echo.
echo [1] LOCAL COMMAND CENTER  - Use local Ollama installation
echo [2] CLOUD COMMAND CENTER  - Use Ollama Cloud API (recommended)
echo.

:mode_select
set /p mode="Enter command center mode [1/2]: "

if "%mode%"=="1" goto local_hi_jack
if "%mode%"=="2" goto cloud_hi_jack
echo [ERROR] Invalid selection
goto mode_select

:local_hi_jack
echo.
echo [LOCAL] Configuring local AI command center...
:: Create system defaults
(
echo OLLAMA_HOST=http://localhost:11434
echo PORT=11435
echo DEBUG_PORT=11436
echo MONITOR_PORT=11437
echo MODE=local
) > .env
set mode_arg=local
echo.
echo [WARNING] Ensure local Ollama is running: ollama serve
goto launch_command_center

:cloud_hi_jack
echo.
echo [CLOUD] Configuring cloud AI command center...
set /p api_key="Enter Ollama Cloud API key: "
if "%api_key%"=="" (
    echo [ERROR] API key required for cloud hi-jack
    goto cloud_hi_jack
)
:: Create system defaults (API key not saved to disk for security)
(
echo PORT=11435
echo DEBUG_PORT=11436
echo MONITOR_PORT=11437
echo MODE=cloud
) > .env
:: Set API key as environment variable for this session only
set OLLAMA_API_KEY=%api_key%
set mode_arg=cloud
echo [SECURITY] API key set for this session only - not saved to disk
goto launch_command_center

:launch_command_center
echo.
echo [COMMAND CENTER] Launching multi-window AI system...
echo.
echo ╔══════════════════════════════════════════════════════════════════════╗
echo ║                    JACK AI COMMAND CENTER ONLINE                    ║
echo ╚══════════════════════════════════════════════════════════════════════╝
echo.

:: Launch rich CLI interface in hijacker directory, passing workspace path
echo [LAUNCH] Starting Rich CLI Interface...

:: Launch Rich CLI in new window (original working approach)
start "🦙 Jack's Rich CLI Interface" cmd /c "title 🦙 Jack's Rich CLI Interface && node rich-cli.js %mode_arg% \"%TARGET_WORKSPACE%\" && pause"

:: Wait for companion windows to initialize
echo [WAIT] Initializing companion systems...
timeout /t 2 /nobreak >nul

:: Transform this terminal into main arterial chat
title [!] OLLAMA HI-JACK - SYSTEM ENHANCED [!]
color 0C
echo.
echo ================================================================================
echo =  [!] HELLO HOOMAN! [!] JACK AI CONTROL ACTIVE [!] AI ENHANCEMENT READY   =
echo ================================================================================
echo.
echo          ==============================================================
echo        ==     [!] JACK AI ONLINE [!]     ==
echo        ==                                                           ==
echo        ==  This terminal is now your AI companion interface       ==
echo        ==  Companion windows provide system monitoring feeds      ==  
echo        ==  All workspace communications monitored and logged      ==
echo          ==============================================================
echo.
echo [JACK] AI neural engine engaged and ready to assist...
echo [INFO] Debug monitoring feeds active in companion windows
echo [INFO] System monitoring and logging online
echo [INFO] Rich CLI command interface active and ready
echo [INFO] Workspace integration protocol executed successfully
echo.

:: Launch the main hi-jack engine targeting the specified workspace - this will keep this terminal active as chat interface
set HIJACK_TARGET_WORKSPACE=%TARGET_WORKSPACE%
node hi-jack-engine.js "%TARGET_WORKSPACE%"

echo.
echo [HI-JACK] Command center session ended
echo [CLEANUP] Shutting down companion windows...
popd
taskkill /f /im node.exe >nul 2>&1
pause