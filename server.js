#!/usr/bin/env node

// Simple Express server for Ollama Jack
// This is an alternative entry point that only starts the main hijacker service
// Use this if you want just the API server without the full multi-window UI

const express = require('express');
const path = require('path');
const { OllamaJack } = require('./hi-jack-engine');

// Load environment from the Ollama Jack project directory
const jackProjectRoot = path.dirname(__filename);
require('dotenv').config({ path: path.join(jackProjectRoot, '.env'), override: true });

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

console.log('🦙⚡ Starting Ollama Jack Server...');

// Start the main Jack hi-jack engine first
const jack = new OllamaJack();
jack.start();

// Simple health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Ollama Jack Server',
        timestamp: new Date().toISOString()
    });
});

// Telemetry dashboard endpoint
app.get('/telemetry', (req, res) => {
    try {
        const telemetryData = jack.telemetryManager.getDashboardData();
        res.json(telemetryData);
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to retrieve telemetry data',
            message: error.message 
        });
    }
});

// Start the simple server on a different port
app.listen(PORT, () => {
    console.log(`🌐 Ollama Jack Server running on port ${PORT}`);
    console.log(`📡 Main hijacker running on port ${jack.port || 11435}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Ollama Jack Server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Ollama Jack Server...');
    process.exit(0);
});