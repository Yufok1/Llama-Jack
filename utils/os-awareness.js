/**
 * OS Awareness Utility - Innate operating system detection and command adaptation
 * Provides Jack with comprehensive OS awareness and command translation capabilities
 */

const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const logger = require('./logger');

class OSAwareness {
    constructor() {
        this.platform = process.platform;
        this.arch = os.arch();
        this.release = os.release();
        this.uptime = os.uptime();

        // Detailed OS information
        this.osInfo = this.detectOS();
        this.commandMappings = this.initializeCommandMappings();
        this.pathSeparators = this.initializePathSeparators();
        this.shellInfo = this.detectShell();

        logger.info(`OS Awareness initialized: ${this.osInfo.name} ${this.osInfo.version} (${this.platform})`);
    }

    /**
     * Comprehensive OS detection with version and additional details
     */
    detectOS() {
        const platform = this.platform;
        const arch = this.arch;
        const release = this.release;

        let osName, version, family;

        switch (platform) {
            case 'win32':
                osName = 'Windows';
                family = 'Windows';
                // Parse Windows version from release
                if (release.startsWith('10.')) {
                    version = '10/11';
                } else if (release.startsWith('6.3')) {
                    version = '8.1';
                } else if (release.startsWith('6.2')) {
                    version = '8';
                } else if (release.startsWith('6.1')) {
                    version = '7';
                } else {
                    version = release;
                }
                break;

            case 'darwin':
                osName = 'macOS';
                family = 'Unix';
                // Parse macOS version from release
                const majorVersion = parseInt(release.split('.')[0]);
                if (majorVersion >= 21) {
                    version = '12+ (Monterey+)';
                } else if (majorVersion === 20) {
                    version = '11 (Big Sur)';
                } else if (majorVersion === 19) {
                    version = '10.15 (Catalina)';
                } else if (majorVersion === 18) {
                    version = '10.14 (Mojave)';
                } else {
                    version = release;
                }
                break;

            case 'linux':
                osName = 'Linux';
                family = 'Unix';
                version = this.detectLinuxDistribution();
                break;

            default:
                osName = platform;
                family = 'Unknown';
                version = release;
                break;
        }

        return {
            name: osName,
            family: family,
            version: version,
            platform: platform,
            arch: arch,
            release: release,
            isWindows: platform === 'win32',
            isMacOS: platform === 'darwin',
            isLinux: platform === 'linux',
            isUnix: ['darwin', 'linux', 'freebsd', 'openbsd', 'sunos'].includes(platform),
            pathSeparator: platform === 'win32' ? '\\' : '/',
            executableExtension: platform === 'win32' ? '.exe' : '',
            environmentVariables: this.getOSEnvironmentVariables()
        };
    }

    /**
     * Detect Linux distribution
     */
    detectLinuxDistribution() {
        try {
            // Try to read from common distribution files
            const fs = require('fs');

            if (fs.existsSync('/etc/os-release')) {
                const content = fs.readFileSync('/etc/os-release', 'utf8');
                const match = content.match(/^PRETTY_NAME="(.+)"$/m);
                if (match) return match[1];
            }

            if (fs.existsSync('/etc/lsb-release')) {
                const content = fs.readFileSync('/etc/lsb-release', 'utf8');
                const match = content.match(/^DISTRIB_DESCRIPTION="(.+)"$/m);
                if (match) return match[1];
            }

            return release;
        } catch (error) {
            logger.debug(`Could not detect Linux distribution: ${error.message}`);
            return release;
        }
    }

    /**
     * Get OS-specific environment variables and paths
     */
    getOSEnvironmentVariables() {
        const env = process.env;
        const platform = this.platform || process.platform;

        return {
            PATH: env.PATH || env.Path || env.path,
            HOME: env.HOME || env.USERPROFILE,
            TEMP: env.TEMP || env.TMP || env.TMPDIR || '/tmp',
            SHELL: env.SHELL || (platform === 'win32' ? 'cmd.exe' : '/bin/bash'),
            USER: env.USER || env.USERNAME,
            LANG: env.LANG || env.LC_ALL || 'en_US.UTF-8',
            NODE_ENV: env.NODE_ENV
        };
    }

    /**
     * Detect current shell environment
     */
    detectShell() {
        const env = process.env;

        if (this.osInfo.isWindows) {
            if (env.COMSPEC) {
                return {
                    name: 'cmd.exe',
                    type: 'windows',
                    path: env.COMSPEC
                };
            }
            if (env.PSModulePath) {
                return {
                    name: 'PowerShell',
                    type: 'windows',
                    path: 'powershell.exe'
                };
            }
            return {
                name: 'cmd.exe',
                type: 'windows',
                path: 'cmd.exe'
            };
        } else {
            const shell = env.SHELL || '/bin/bash';
            const shellName = path.basename(shell);

            return {
                name: shellName,
                type: 'unix',
                path: shell,
                isBash: shellName === 'bash',
                isZsh: shellName === 'zsh',
                isFish: shellName === 'fish'
            };
        }
    }

    /**
     * Initialize command mappings for cross-platform compatibility
     */
    initializeCommandMappings() {
        const isWindows = this.osInfo.isWindows;
        const isMacOS = this.osInfo.isMacOS;
        const isLinux = this.osInfo.isLinux;

        return {
            // File system commands
            'ls': isWindows ? 'dir' : 'ls',
            'ls -la': isWindows ? 'dir /a' : 'ls -la',
            'ls -al': isWindows ? 'dir /a' : 'ls -al',
            'dir': isWindows ? 'dir' : 'ls',
            'clear': isWindows ? 'cls' : 'clear',
            'cls': isWindows ? 'cls' : 'clear',

            // File operations
            'cp': isWindows ? 'copy' : 'cp',
            'copy': isWindows ? 'copy' : 'cp',
            'mv': isWindows ? 'move' : 'mv',
            'move': isWindows ? 'move' : 'mv',
            'rm': isWindows ? 'del' : 'rm',
            'del': isWindows ? 'del' : 'rm',
            'rmdir': isWindows ? 'rmdir' : 'rmdir',
            'rd': isWindows ? 'rd' : 'rmdir',
            'mkdir': isWindows ? 'mkdir' : 'mkdir',
            'md': isWindows ? 'md' : 'mkdir',
            'cat': isWindows ? 'type' : 'cat',
            'type': isWindows ? 'type' : 'cat',
            'echo': 'echo', // Universal
            'pwd': isWindows ? 'cd' : 'pwd',
            'cd': 'cd', // Universal

            // Process commands
            'ps': isWindows ? 'tasklist' : 'ps',
            'tasklist': isWindows ? 'tasklist' : 'ps',
            'kill': isWindows ? 'taskkill' : 'kill',
            'taskkill': isWindows ? 'taskkill' : 'kill',
            'which': isWindows ? 'where' : 'which',
            'where': isWindows ? 'where' : 'which',

            // Network commands
            'ping': 'ping', // Universal
            'curl': isWindows ? 'curl' : 'curl', // Usually available on both
            'wget': isWindows ? 'curl' : 'wget',
            'netstat': isWindows ? 'netstat' : 'netstat',

            // Development tools
            'node': 'node', // Universal
            'npm': 'npm', // Universal
            'python': isWindows ? 'python' : 'python3',
            'python3': isWindows ? 'python' : 'python3',
            'pip': isWindows ? 'pip' : 'pip3',
            'pip3': isWindows ? 'pip' : 'pip3',
            'git': 'git', // Universal

            // Text editors
            'nano': isWindows ? 'notepad' : 'nano',
            'vim': isWindows ? 'notepad' : 'vim',
            'vi': isWindows ? 'notepad' : 'vi',
            'notepad': isWindows ? 'notepad' : 'nano',
            'code': 'code', // VS Code usually available

            // Package managers
            'apt': isWindows ? 'choco' : 'apt',
            'apt-get': isWindows ? 'choco' : 'apt-get',
            'brew': isMacOS ? 'brew' : (isWindows ? 'choco' : 'apt'),
            'choco': isWindows ? 'choco' : 'brew',

            // System information
            'uname': isWindows ? 'ver' : 'uname',
            'ver': isWindows ? 'ver' : 'uname',
            'whoami': isWindows ? 'whoami' : 'whoami',
            'hostname': 'hostname', // Universal
            'date': 'date', // Universal
            'time': isWindows ? 'time' : 'date',

            // File permissions (Unix-specific)
            'chmod': isWindows ? 'echo chmod not available on Windows' : 'chmod',
            'chown': isWindows ? 'echo chown not available on Windows' : 'chown',
            'sudo': isWindows ? 'echo sudo not available on Windows (run as Administrator)' : 'sudo',

            // Archive commands
            'tar': isWindows ? 'tar' : 'tar',
            'zip': isWindows ? 'tar' : 'zip',
            'unzip': isWindows ? 'tar' : 'unzip'
        };
    }

    /**
     * Initialize path separator information
     */
    initializePathSeparators() {
        return {
            separator: this.osInfo.pathSeparator,
            opposite: this.osInfo.pathSeparator === '\\' ? '/' : '\\',
            regex: this.osInfo.pathSeparator === '\\' ? /\\\\/g : /\//g,
            pathJoin: (...paths) => path.join(...paths),
            pathNormalize: (pathString) => path.normalize(pathString),
            pathRelative: (from, to) => path.relative(from, to),
            pathResolve: (...paths) => path.resolve(...paths)
        };
    }

    /**
     * Adapt a command for the current operating system
     */
    adaptCommand(command) {
        if (!command || typeof command !== 'string') {
            return command;
        }

        // Strip leading/trailing whitespace
        let adaptedCommand = command.trim();

        // Handle path separators in file paths
        adaptedCommand = this.adaptPathsInCommand(adaptedCommand);

        // Command-specific adaptations
        adaptedCommand = this.adaptSpecificCommands(adaptedCommand);

        // Handle environment variables
        adaptedCommand = this.adaptEnvironmentVariables(adaptedCommand);

        // Handle shell-specific syntax
        adaptedCommand = this.adaptShellSyntax(adaptedCommand);

        return adaptedCommand;
    }

    /**
     * Adapt file paths in commands
     */
    adaptPathsInCommand(command) {
        if (this.osInfo.isWindows) {
            // Convert Unix paths to Windows paths
            command = command.replace(/\/([a-zA-Z])\//g, '$1:\\'); // /c/ -> C:\
            command = command.replace(/\//g, '\\'); // All other / -> \

            // Handle Windows drive letters if needed
            command = command.replace(/([a-zA-Z]):\\/g, '$1:\\');
        } else {
            // Convert Windows paths to Unix paths
            command = command.replace(/([a-zA-Z]):\\/g, '/$1/'); // C:\ -> /c/
            command = command.replace(/\\/g, '/'); // All \ -> /
        }

        return command;
    }

    /**
     * Adapt specific commands for the current OS
     */
    adaptSpecificCommands(command) {
        // Get the base command (first word)
        const baseCommand = command.split(' ')[0];

        // Check if we have a mapping for this command
        if (this.commandMappings[baseCommand]) {
            const adaptedBase = this.commandMappings[baseCommand];

            // Preserve arguments and flags
            const args = command.slice(baseCommand.length).trim();

            if (args) {
                // Some commands need argument adaptation too
                const adaptedArgs = this.adaptCommandArguments(baseCommand, args);
                return `${adaptedBase} ${adaptedArgs}`;
            } else {
                return adaptedBase;
            }
        }

        // Handle complex command patterns
        return this.adaptComplexCommandPatterns(command);
    }

    /**
     * Adapt command arguments for specific commands
     */
    adaptCommandArguments(baseCommand, args) {
        if (this.osInfo.isWindows) {
            switch (baseCommand) {
                case 'ls':
                case 'dir':
                    // Convert Unix-style flags to Windows dir flags
                    if (args.includes('-la') || args.includes('-al')) {
                        return '/a';
                    }
                    return args;

                case 'cp':
                case 'copy':
                    // Convert recursive flag
                    return args.replace(/-r/g, '').replace(/-R/g, '');

                case 'del':
                case 'rm':
                    // Convert recursive and force flags
                    return args.replace(/-rf/g, '').replace(/-r/g, '').replace(/-f/g, '');
            }
        } else {
            switch (baseCommand) {
                case 'dir':
                    // Convert Windows dir flags to Unix ls flags
                    if (args.includes('/a')) {
                        return '-la';
                    }
                    return '-la';
            }
        }

        return args;
    }

    /**
     * Adapt complex command patterns
     */
    adaptComplexCommandPatterns(command) {
        if (this.osInfo.isWindows) {
            // Handle Windows-specific patterns
            command = command.replace(/sudo\s+/g, ''); // Remove sudo
            command = command.replace(/sudo$/g, '');

            // Handle pipe and redirection differences
            command = command.replace(/\|/g, '|'); // Pipes are the same

            // Handle environment variable syntax
            command = command.replace(/\$([A-Z_]+)/g, '%$1%');
        } else {
            // Handle Unix-specific patterns
            command = command.replace(/%([A-Z_]+)%/g, '$$$1'); // %VAR% -> $VAR
        }

        return command;
    }

    /**
     * Adapt environment variables in commands
     */
    adaptEnvironmentVariables(command) {
        if (this.osInfo.isWindows) {
            // Convert Unix-style environment variables to Windows
            command = command.replace(/\$HOME/g, '%USERPROFILE%');
            command = command.replace(/\$PATH/g, '%PATH%');
            command = command.replace(/\$USER/g, '%USERNAME%');
            command = command.replace(/\$TMP/g, '%TEMP%');
            command = command.replace(/\$TMPDIR/g, '%TEMP%');
        } else {
            // Convert Windows-style environment variables to Unix
            command = command.replace(/%USERPROFILE%/g, '$HOME');
            command = command.replace(/%PATH%/g, '$PATH');
            command = command.replace(/%USERNAME%/g, '$USER');
            command = command.replace(/%TEMP%/g, '$TMP');
            command = command.replace(/%TMPDIR%/g, '$TMP');
        }

        return command;
    }

    /**
     * Adapt shell-specific syntax
     */
    adaptShellSyntax(command) {
        if (this.osInfo.isWindows) {
            // Remove Unix-specific shell operators that don't work in cmd
            command = command.replace(/&&/g, '&'); // Unix && -> Windows &

            // Handle quoting differences
            command = command.replace(/'/g, '"'); // Single quotes to double quotes

        } else {
            // Windows-specific adaptations for Unix shells
            // Windows & -> Unix &&
            command = command.replace(/([^&])&([^&])/g, '$1&&$2');

            // Handle PowerShell-specific syntax
            command = command.replace(/Get-ChildItem/g, 'ls');
            command = command.replace(/Set-Location/g, 'cd');
        }

        return command;
    }

    /**
     * Get comprehensive OS context for system prompts
     */
    getOSContext() {
        return {
            name: this.osInfo.name,
            version: this.osInfo.version,
            platform: this.osInfo.platform,
            architecture: this.osInfo.arch,
            family: this.osInfo.family,

            // Shell information
            shell: {
                name: this.shellInfo.name,
                type: this.shellInfo.type,
                isBash: this.shellInfo.isBash,
                isPowerShell: this.shellInfo.name.includes('PowerShell')
            },

            // Path conventions
            paths: {
                separator: this.osInfo.pathSeparator,
                executableExtension: this.osInfo.executableExtension,
                home: this.osInfo.environmentVariables.HOME,
                temp: this.osInfo.environmentVariables.TEMP
            },

            // Command conventions
            commands: {
                listFiles: this.commandMappings['ls'],
                copyFile: this.commandMappings['cp'],
                moveFile: this.commandMappings['mv'],
                deleteFile: this.commandMappings['rm'],
                makeDirectory: this.commandMappings['mkdir'],
                removeDirectory: this.commandMappings['rmdir'],
                viewFile: this.commandMappings['cat'],
                clearScreen: this.commandMappings['clear'],
                showProcesses: this.commandMappings['ps'],
                findCommand: this.commandMappings['which']
            },

            // Development tools
            development: {
                node: 'node',
                npm: 'npm',
                python: this.osInfo.isWindows ? 'python' : 'python3',
                pip: this.osInfo.isWindows ? 'pip' : 'pip3',
                git: 'git',
                codeEditor: this.osInfo.isWindows ? 'notepad' : 'nano'
            },

            // Important notes
            notes: this.getOSNotes()
        };
    }

    /**
     * Get OS-specific notes for the AI
     */
    getOSNotes() {
        const notes = [];

        if (this.osInfo.isWindows) {
            notes.push('Uses backslashes (\\) for file paths');
            notes.push('Commands use Windows syntax (dir, copy, del)');
            notes.push('Environment variables use %VAR% syntax');
            notes.push('No sudo command - run as Administrator for privileged operations');
            notes.push('Uses PowerShell or cmd.exe for shell operations');
            notes.push('File extensions are important (.exe, .bat, .cmd)');
        } else if (this.osInfo.isMacOS) {
            notes.push('Uses forward slashes (/) for file paths');
            notes.push('Commands use Unix syntax (ls, cp, rm)');
            notes.push('Environment variables use $VAR syntax');
            notes.push('Use sudo for privileged operations');
            notes.push('Can use Homebrew for package management: brew install');
            notes.push('Uses bash or zsh for shell operations');
        } else if (this.osInfo.isLinux) {
            notes.push('Uses forward slashes (/) for file paths');
            notes.push('Commands use Unix syntax (ls, cp, rm)');
            notes.push('Environment variables use $VAR syntax');
            notes.push('Use sudo for privileged operations');
            notes.push('Package manager varies by distribution (apt, yum, pacman, etc.)');
            notes.push('Uses bash, zsh, or other Unix shells');
        }

        return notes;
    }

    /**
     * Validate if a command is appropriate for the current OS
     */
    validateCommand(command) {
        const warnings = [];
        const errors = [];

        if (!command || typeof command !== 'string') {
            errors.push('Invalid command: command must be a non-empty string');
            return { valid: false, warnings, errors };
        }

        // Check for Unix-only commands on Windows
        if (this.osInfo.isWindows) {
            const unixOnlyCommands = ['chmod', 'chown', 'sudo', 'apt', 'apt-get', 'yum', 'pacman'];
            const baseCommand = command.split(' ')[0];

            if (unixOnlyCommands.includes(baseCommand)) {
                errors.push(`Command '${baseCommand}' is not available on Windows. Use alternative approach.`);
            }
        }

        // Check for Windows-only commands on Unix
        if (!this.osInfo.isWindows) {
            const windowsOnlyCommands = ['dir', 'copy', 'del', 'move', 'cls', 'type', 'where', 'tasklist', 'taskkill'];
            const baseCommand = command.split(' ')[0];

            if (windowsOnlyCommands.includes(baseCommand)) {
                warnings.push(`Command '${baseCommand}' is Windows-specific. Consider using Unix equivalent.`);
            }
        }

        // Check for dangerous commands
        const dangerousPatterns = [
            /rm\s+-rf\s+\//,  // rm -rf /
            /del\s+\/s\s+\/q/, // del /s /q
            /format\s+c:/,     // format c:
            /rmdir \/s \/q/,   // rmdir /s /q
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(command.toLowerCase())) {
                errors.push('Potentially dangerous command detected - execution blocked for safety');
                break;
            }
        }

        return {
            valid: errors.length === 0,
            warnings,
            errors
        };
    }

    /**
     * Get a summary of OS capabilities and limitations
     */
    getCapabilities() {
        return {
            platform: this.osInfo.platform,
            name: this.osInfo.name,
            version: this.osInfo.version,

            // File system capabilities
            fileSystem: {
                caseSensitive: !this.osInfo.isWindows,
                pathSeparator: this.osInfo.pathSeparator,
                maxPathLength: this.osInfo.isWindows ? 260 : 4096,
                supportsSymlinks: !this.osInfo.isWindows || this.osInfo.version >= '6.0'
            },

            // Command capabilities
            commands: {
                supportsUnixCommands: !this.osInfo.isWindows,
                supportsPowerShell: this.osInfo.isWindows,
                supportsBash: !this.osInfo.isWindows,
                hasSudo: !this.osInfo.isWindows,
                hasAdminRights: this.osInfo.isWindows // Can run as Administrator
            },

            // Development environment
            development: {
                nodeAvailable: true, // Since Jack runs on Node.js
                npmAvailable: true,
                gitAvailable: true, // Likely available
                pythonAvailable: true, // Usually available
                packageManager: this.osInfo.isWindows ? 'npm/choco' : (this.osInfo.isMacOS ? 'npm/brew' : 'npm/apt')
            }
        };
    }
}

// Export singleton instance
module.exports = new OSAwareness();