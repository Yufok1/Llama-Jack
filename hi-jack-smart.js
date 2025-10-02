#!/usr/bin/env node

// Smart "hi jack" command - does the right thing automatically
// Usage: hi jack (that's it!)

const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

// Get the directory where this script is located
const scriptDir = path.dirname(__filename);

// Utility functions
function checkNodeVersion() {
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split('.')[0]);
    return majorVersion >= 16;
}

function checkOllama() {
    return new Promise((resolve) => {
        exec('ollama list', (error) => {
            resolve(!error);
        });
    });
}

function checkEnvFile() {
    const envPath = path.join(process.cwd(), '.env');
    return fs.existsSync(envPath);
}

function checkDependencies() {
    const nodeModulesPath = path.join(scriptDir, 'node_modules');
    return fs.existsSync(nodeModulesPath);
}

async function installDependencies() {
    return new Promise((resolve, reject) => {
        console.log('📦 Installing dependencies...');
        const npm = spawn('npm', ['install'], { 
            cwd: scriptDir, 
            stdio: 'inherit' 
        });
        
        npm.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Dependencies installed');
                resolve();
            } else {
                reject(new Error('Failed to install dependencies'));
            }
        });
    });
}

async function setupEnvironment() {
    return new Promise((resolve) => {
        console.log('🔧 Setting up environment...');
        
        const envPath = path.join(process.cwd(), '.env');
        const envTemplate = `# Ollama Jack Configuration
OLLAMA_HOST=http://localhost:11434
PORT=11435
DEBUG_PORT=11436
MONITOR_PORT=11437
MODE=local

# GPU Optimization Settings
OLLAMA_NUM_GPU=1
OLLAMA_GPU_LAYERS=-1
OLLAMA_GPU_MEMORY_FRACTION=0.85
`;
        
        fs.writeFileSync(envPath, envTemplate);
        console.log('✅ Environment configured');
        resolve();
    });
}

async function startHiJack() {
    return new Promise((resolve, reject) => {
        console.log('🚀 Starting Hi-Jack...');
        
        // Use the proper hi-jack.bat launcher on Windows, hi-jack.sh on others
        let launcher, args;
        if (process.platform === 'win32') {
            launcher = 'cmd';
            args = ['/c', path.join(scriptDir, 'hi-jack.bat'), 'no-kill-node'];
        } else {
            launcher = 'bash';
            args = [path.join(scriptDir, 'hi-jack.sh')];
        }
        
        const hiJack = spawn(launcher, args, {
            stdio: 'inherit',
            cwd: process.cwd()
        });
        
        hiJack.on('close', (code) => {
            resolve(code);
        });
        
        hiJack.on('error', (error) => {
            reject(error);
        });
    });
}

// Main intelligent command handler
async function main() {
    const args = process.argv.slice(2);
    
    // Only accept "jack" as the second argument, or no arguments
    if (args.length > 0 && args[0].toLowerCase() !== 'jack') {
        console.log('🦙 Did you mean: hi jack?');
        console.log('Usage: hi jack');
        return;
    }
    
    console.log('🦙⚡ Hi Jack - AI Workspace Companion ⚡🦙\n');
    
    try {
        // Step 1: Check Node.js version
        if (!checkNodeVersion()) {
            console.log('❌ Node.js 16+ required. Please update Node.js');
            process.exit(1);
        }
        console.log('✅ Node.js version compatible');
        
        // Step 2: Check and install dependencies
        if (!checkDependencies()) {
            console.log('⏳ Dependencies missing, installing...');
            await installDependencies();
        } else {
            console.log('✅ Dependencies ready');
        }
        
        // Step 3: Check Ollama
        const ollamaReady = await checkOllama();
        if (!ollamaReady) {
            console.log('❌ Ollama not running. Please start Ollama:');
            console.log('   ollama serve');
            console.log('   OR install from: https://ollama.ai/download');
            process.exit(1);
        }
        console.log('✅ Ollama is ready');
        
        // Step 4: Check and setup environment
        if (!checkEnvFile()) {
            console.log('⏳ Environment not configured, setting up...');
            await setupEnvironment();
        } else {
            console.log('✅ Environment configured');
        }
        
        // Step 5: Start the system
        console.log('\n🎉 Everything ready! Launching Hi-Jack...\n');
        await startHiJack();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);