# 🛠️ Ollama Jack Development Guide

## Getting Started

### Prerequisites
- **Node.js**: Version 16.0.0 or higher
- **Ollama**: Local installation (optional, for local mode)
- **Git**: For version control and cloning

### Development Setup
```bash
# Clone the repository
git clone <repository-url>
cd ollama-jack

# Install dependencies
npm install

# Create development environment
cp .env.example .env.local
# Edit .env.local with your development settings

# Start development mode
npm run dev
```

## 🏗️ Project Structure Deep Dive

### Core Components

#### `hijacker.js` - Main Engine (3,294 lines)
The heart of Ollama Jack. Handles:
- AI model communication (local/cloud)
- Tool execution orchestration
- Human-in-the-loop edit control
- Multi-window interface management

**Key Classes:**
- `OllamaJack`: Main application class
- Tool execution methods
- Edit proposal system
- Monitor auto-startup logic

#### `rich-cli.js` - Control Interface (1,357 lines)
The user-facing command center providing:
- Model selection and management
- System status monitoring
- Interactive command processing
- Real-time status updates

**Key Features:**
- Command parsing and execution
- Model scanning and switching
- Status dashboard display
- Auto-retry logic for model detection

#### `edit-controller.js` - Edit Management
Human-in-the-loop edit approval system:
- File backup creation
- Diff generation and display
- User approval workflow
- Edit history tracking

### Supporting Components

#### `session-memory.js` - Context Management
- Conversation thread persistence
- Tool execution context tracking
- Memory optimization and cleanup

#### `telemetry-manager.js` - Analytics Engine
- Performance metrics collection
- Usage pattern analysis
- Error rate monitoring
- Predictive analytics for rate limits

#### Analytics & Telemetry
- `telemetry-manager.js`: Performance analytics and usage tracking
- Rich CLI status monitoring and health checks
- Session memory management and cleanup

## 🔧 Development Workflow

### 1. Local Development
```bash
# Start the main system
npm run dev

# Or run specific components
node hijacker.js
node rich-cli.js
node telemetry-manager.js
```

### 2. Testing Changes
```bash
# Test core functionality
npm test

# Manual testing
./hijack.bat  # Windows
./hijack.sh   # Linux/Mac
```

### 3. Code Quality
```bash
# Lint code
npm run lint

# Format code
npm run format

# Type checking (if TypeScript added)
npm run type-check
```

## 🛠️ Adding New Features

### Tool Integration
To add a new tool to the system:

1. **Define the tool** in `hijacker.js`:
```javascript
tools: {
    'new_tool': {
        description: 'Description of what the tool does',
        parameters: {
            type: 'object',
            properties: {
                param1: { type: 'string', description: 'Parameter description' }
            },
            required: ['param1']
        }
    }
}
```

2. **Implement the handler**:
```javascript
async new_tool(args) {
    // Tool implementation
    const result = await this.performNewToolOperation(args);
    return {
        success: true,
        result: result,
        metadata: { /* additional data */ }
    };
}
```

3. **Add to tool registry** in the constructor:
```javascript
this.availableTools.push('new_tool');
```

### Model Support
To add support for a new AI model:

1. **Update model detection** in `rich-cli.js`:
```javascript
// Add to model scanning logic
const newModels = await this.scanForModels();
// Include your new model detection
```

2. **Add model configuration**:
```javascript
const modelConfigs = {
    'your-model': {
        contextWindow: 4096,
        supportsTools: true,
        apiEndpoint: 'your-endpoint'
    }
};
```

### UI Components
To add new CLI commands:

1. **Add to command menu** in `rich-cli.js` displayMenu():
```javascript
console.log('\x1b[95m>\x1b[0m \x1b[96mnewcommand\x1b[0m - Description of new command');
```

2. **Implement command handler**:
```javascript
handleCommand(input) {
    const [command, ...args] = input.split(' ');

    switch(command) {
        case 'newcommand':
            return this.handleNewCommand(args);
        // ... other commands
    }
}
```

## 🐛 Debugging & Troubleshooting

### Debug Tools
```bash
# Enable verbose logging
DEBUG_MODE=true node hijacker.js

# Check system status via Rich CLI
node rich-cli.js

# View telemetry analytics
node telemetry-manager.js
```

### Common Issues

#### Port Conflicts
```javascript
// Ports auto-increment if busy
const port = process.env.PORT || 11435;
const maxRetries = 5;
let currentPort = port;

for(let i = 0; i < maxRetries; i++) {
    try {
        await this.startServer(currentPort);
        break;
    } catch(err) {
        currentPort++;
    }
}
```

#### Memory Management
```javascript
// Implement memory cleanup
setInterval(() => {
    this.sessionMemory.cleanup();
    this.editController.cleanup();
}, 300000); // 5 minutes
```

#### Error Handling
```javascript
try {
    const result = await this.executeTool(toolCall);
    return result;
} catch(error) {
    this.logError('Tool execution failed', error);
    return {
        success: false,
        error: error.message,
        recovery: 'Suggested recovery action'
    };
}
```

## 📊 Performance Optimization

### Memory Optimization
- **Session cleanup**: Remove old conversation threads
- **Edit history**: Compress and archive old edits
- **Cache management**: Implement LRU caching for frequent operations

### Network Optimization
- **Connection pooling**: Reuse HTTP connections
- **Request batching**: Combine multiple API calls
- **Response caching**: Cache frequent queries

### CPU Optimization
- **Async operations**: Use non-blocking I/O
- **Worker threads**: Offload heavy computations
- **Lazy loading**: Load components on demand

## 🧪 Testing Strategy

### Unit Tests
```javascript
// Example test structure
describe('EditController', () => {
    test('should create backup before edit', async () => {
        const controller = new EditVersionController();
        const result = await controller.createBackup('test.js');
        expect(result.success).toBe(true);
    });
});
```

### Integration Tests
```javascript
describe('Full Workflow', () => {
    test('should handle complete edit cycle', async () => {
        // Setup
        const jack = new OllamaJack();

        // Execute workflow
        const result = await jack.processUserRequest('create a hello world app');

        // Verify results
        expect(result.edits).toHaveLength(1);
        expect(result.success).toBe(true);
    });
});
```

### E2E Tests
```bash
# Test full system integration
npm run test:e2e

# Test with different models
npm run test:models

# Performance testing
npm run test:perf
```

## 🚀 Deployment & Distribution

### NPM Package
```json
{
    "name": "ollama-jack",
    "version": "1.0.1",
    "bin": {
        "ollama-jack": "./cli.js"
    },
    "preferGlobal": true
}
```

### Global Installation
```bash
# Install globally
npm install -g ollama-jack

# Verify installation
ollama-jack --version

# Run setup
ollama-jack setup
```

### Platform-Specific Builds
```bash
# Windows
npm run build:win

# Linux
npm run build:linux

# macOS
npm run build:mac
```

## 📚 API Documentation

### Internal APIs

#### Tool Execution API
```javascript
/**
 * Execute a tool with given parameters
 * @param {string} toolName - Name of the tool to execute
 * @param {object} parameters - Tool parameters
 * @returns {Promise<object>} Tool execution result
 */
async executeTool(toolName, parameters) {
    // Implementation
}
```

#### Edit Management API
```javascript
/**
 * Create an edit proposal
 * @param {string} operation - Edit operation type
 * @param {string} filePath - Target file path
 * @param {string} content - New content
 * @returns {Promise<object>} Edit proposal
 */
async createEditProposal(operation, filePath, content) {
    // Implementation
}
```

## 🤝 Contributing

### Code Standards
- **ESLint**: Follow provided linting rules
- **Prettier**: Use consistent code formatting
- **JSDoc**: Document all public methods
- **Error Handling**: Implement comprehensive error handling

### Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Update documentation
5. Submit pull request

### Commit Conventions
```bash
feat: add new tool integration
fix: resolve port conflict issue
docs: update API documentation
refactor: optimize memory usage
test: add unit tests for edit controller
```

## 🔒 Security Considerations

### Code Review Checklist
- [ ] No hardcoded secrets or API keys
- [ ] Input validation on all user inputs
- [ ] Secure file operations with permission checks
- [ ] Network requests use HTTPS where possible
- [ ] Error messages don't leak sensitive information

### Security Testing
```bash
# Run security audit
npm audit

# Check for known vulnerabilities
npm run security-check

# Test with malicious inputs
npm run test:security
```

## 📈 Monitoring & Analytics

### Telemetry Integration
```javascript
// Track feature usage
this.telemetry.track('tool_executed', {
    tool: toolName,
    success: result.success,
    duration: Date.now() - startTime
});
```

### Performance Metrics
```javascript
// Monitor response times
const startTime = Date.now();
const result = await this.executeOperation();
this.telemetry.recordMetric('operation_duration', Date.now() - startTime);
```

## 🔄 Version Management

### Semantic Versioning
- **MAJOR**: Breaking changes
- **MINOR**: New features
- **PATCH**: Bug fixes

### Release Process
1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag
4. Publish to npm
5. Update documentation

## 📞 Support & Community

### Getting Help
- **Issues**: GitHub issue tracker
- **Discussions**: GitHub discussions
- **Documentation**: Wiki and guides
- **Community**: Discord/Slack channels

### Reporting Bugs
```markdown
## Bug Report Template

**Version:** v1.0.2
**Environment:** Windows 11, Node 18.17.0
**Mode:** Local/Cloud

**Steps to reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected behavior:**
What should happen

**Actual behavior:**
What actually happens

**Error logs:**
```
Paste error output here
```

**Additional context:**
Any other relevant information
```

This development guide provides a comprehensive overview of the Ollama Jack codebase, development workflow, and contribution guidelines. Use this as your roadmap for understanding and extending the system.</content>
<parameter name="filePath">c:\Users\Jeff Towers\projects\ollama-tools-workspace\DEVELOPMENT.md