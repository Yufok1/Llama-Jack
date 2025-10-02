@echo off
setlocal enabledelayedexpansion

:: Ollama Jack - One-Click Installation Script for Windows

:: Colors (using color codes)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

echo.
echo %BLUE%🦙⚡ OLLAMA JACK INSTALLER ⚡🦙%NC%
echo %BLUE%================================%NC%
echo.

:: Check Node.js
echo %YELLOW%📋 Checking Node.js...%NC%
node --version >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Node.js not found!%NC%
    echo.
    echo %YELLOW%Please install Node.js 16+ first:%NC%
    echo   Download from: https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
set NODE_VERSION=%NODE_VERSION:v=%
echo %GREEN%✅ Node.js %NODE_VERSION% found%NC%

:: Check npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ npm not found!%NC%
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo %GREEN%✅ npm %NPM_VERSION% found%NC%

:: Check Ollama
echo.
echo %YELLOW%📋 Checking Ollama...%NC%
ollama --version >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Ollama not found!%NC%
    echo.
    echo %YELLOW%Please install Ollama first:%NC%
    echo   Download from: https://ollama.ai/download
    echo.
    echo %YELLOW%Then start Ollama service%NC%
    pause
    exit /b 1
)

:: Try to start Ollama if not running
ollama list >nul 2>&1
if errorlevel 1 (
    echo %YELLOW%🔄 Starting Ollama service...%NC%
    start /B ollama serve
    timeout /t 3 /nobreak >nul
)

ollama list >nul 2>&1
if not errorlevel 1 (
    echo %GREEN%✅ Ollama is running%NC%
) else (
    echo %YELLOW%⚠️  Ollama detected but not responding. You may need to start it manually.%NC%
)

:: Install dependencies
echo.
echo %YELLOW%📦 Installing dependencies...%NC%
call npm install
if errorlevel 1 (
    echo %RED%❌ Failed to install dependencies%NC%
    pause
    exit /b 1
)
echo %GREEN%✅ Dependencies installed%NC%

:: Install globally
echo.
echo %YELLOW%🌍 Installing Ollama Jack globally...%NC%

:: Check if already installed
ollama-jack --version >nul 2>&1
if not errorlevel 1 (
    echo %YELLOW%⚠️  Ollama Jack already installed globally. Updating...%NC%
)

:: Try global install
call npm install -g .
if not errorlevel 1 (
    echo %GREEN%✅ Global installation successful%NC%
) goto :setup
)

:: Try npm link as fallback
echo %YELLOW%Trying alternative installation method...%NC%
call npm link
if not errorlevel 1 (
    echo %GREEN%✅ Linked successfully (alternative method)%NC%
) else (
    echo %RED%❌ All installation methods failed%NC%
    echo.
    echo %YELLOW%Manual installation:%NC%
    echo   npm install -g .
    echo   # or
    echo   npm link
    pause
    exit /b 1
)

:setup
:: Run setup
echo.
echo %YELLOW%🔧 Running initial setup...%NC%
call ollama-jack setup
if errorlevel 1 (
    echo %RED%❌ Setup failed%NC%
    pause
    exit /b 1
)

:: Verify installation
echo.
echo %YELLOW%🧪 Verifying installation...%NC%
ollama-jack --version >nul 2>&1
if not errorlevel 1 (
    echo %GREEN%✅ ollama-jack command available%NC%

    :: Test help command
    ollama-jack help >nul 2>&1
    if not errorlevel 1 (
        echo %GREEN%✅ Command working correctly%NC%
    ) else (
        echo %YELLOW%⚠️  Command available but help failed%NC%
    )
) else (
    echo %RED%❌ ollama-jack command not found%NC%
    pause
    exit /b 1
)

echo.
echo %GREEN%🎉 INSTALLATION COMPLETE!%NC%
echo.
echo %BLUE%🚀 To start using Ollama Jack:%NC%
echo %GREEN%  ollama-jack start%NC%
echo.
echo %BLUE%📚 For help:%NC%
echo %GREEN%  ollama-jack help%NC%
echo.
echo %BLUE%🛡️  Security:%NC%
echo %GREEN%  • Local-first operation%NC%
echo %GREEN%  • No data collection%NC%
echo %GREEN%  • User approval required%NC%
echo.

:: Offer to start immediately
set /p "response=Would you like to start Ollama Jack now? (y/n): "
if /i "!response!"=="y" (
    echo %BLUE%🚀 Starting Ollama Jack...%NC%
    call ollama-jack start
) else (
    echo %BLUE%👋 You can start anytime with: ollama-jack start%NC%
)

goto :eof</content>
<parameter name="filePath">c:\Users\Jeff Towers\projects\ollama-tools-workspace\install.bat