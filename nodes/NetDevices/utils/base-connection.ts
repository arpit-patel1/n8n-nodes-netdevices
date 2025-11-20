import { Client, ConnectConfig } from 'ssh2';
import { EventEmitter } from 'events';

// Add logging support
let Logger: any;
try {
    // Try to import n8n's LoggerProxy for proper logging
    const { LoggerProxy } = require('n8n-workflow');
    Logger = LoggerProxy;
} catch (error) {
    // Fallback to console logging if n8n LoggerProxy is not available
    Logger = {
        debug: console.log,
        info: console.log,
        warn: console.warn,
        error: console.error
    };
}

/**
 * Utility function to format SSH private key properly
 * @param privateKey The raw private key content
 * @returns Properly formatted private key
 */
export function formatSSHPrivateKey(privateKey: string): string {
    if (!privateKey) {
        throw new Error('Private key is required');
    }

    // Trim whitespace
    let formattedKey = privateKey.trim();

    // Normalize line endings
    formattedKey = formattedKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Remove any extra whitespace at the beginning and end
    formattedKey = formattedKey.trim();

    // Check if key already has proper format
    if (formattedKey.includes('-----BEGIN') && formattedKey.includes('-----END')) {
        // Key appears to be in PEM format, validate and clean it
        const lines = formattedKey.split('\n');
        
        // Check if this is a single-line key that needs to be properly formatted
        if (lines.length === 1) {
            // Handle single-line RSA key
            if (formattedKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
                const beginMatch = formattedKey.match(/-----BEGIN RSA PRIVATE KEY-----(.*)-----END RSA PRIVATE KEY-----/);
                if (beginMatch) {
                    const content = beginMatch[1].trim().replace(/\s/g, '');
                    const wrappedContent = content.match(/.{1,64}/g)?.join('\n') || content;
                    formattedKey = `-----BEGIN RSA PRIVATE KEY-----\n${wrappedContent}\n-----END RSA PRIVATE KEY-----`;
                }
            }
            // Handle single-line OpenSSH key
            else if (formattedKey.includes('-----BEGIN OPENSSH PRIVATE KEY-----')) {
                const beginMatch = formattedKey.match(/-----BEGIN OPENSSH PRIVATE KEY-----(.*)-----END OPENSSH PRIVATE KEY-----/);
                if (beginMatch) {
                    const content = beginMatch[1].trim().replace(/\s/g, '');
                    const wrappedContent = content.match(/.{1,64}/g)?.join('\n') || content;
                    formattedKey = `-----BEGIN OPENSSH PRIVATE KEY-----\n${wrappedContent}\n-----END OPENSSH PRIVATE KEY-----`;
                }
            }
            // Handle other single-line key formats
            else if (formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
                const beginMatch = formattedKey.match(/-----BEGIN PRIVATE KEY-----(.*)-----END PRIVATE KEY-----/);
                if (beginMatch) {
                    const content = beginMatch[1].trim().replace(/\s/g, '');
                    const wrappedContent = content.match(/.{1,64}/g)?.join('\n') || content;
                    formattedKey = `-----BEGIN PRIVATE KEY-----\n${wrappedContent}\n-----END PRIVATE KEY-----`;
                }
            }
        } else {
            // Multi-line key - validate and clean
            const beginIndex = lines.findIndex(line => line.includes('-----BEGIN'));
            const endIndex = lines.findIndex(line => line.includes('-----END'));

            if (beginIndex !== -1 && endIndex !== -1 && endIndex > beginIndex) {
                // Extract the key content between BEGIN and END markers
                const keyLines = lines.slice(beginIndex, endIndex + 1);
                
                // Clean up each line - remove extra whitespace but preserve content
                const cleanedLines = keyLines.map(line => {
                    if (line.includes('-----BEGIN') || line.includes('-----END')) {
                        return line.trim();
                    } else {
                        // For content lines, preserve the base64 content but trim whitespace
                        return line.trim();
                    }
                });
                
                // Reconstruct the key with proper formatting
                formattedKey = cleanedLines.join('\n');
                
                // Ensure there's a newline at the end
                if (!formattedKey.endsWith('\n')) {
                    formattedKey += '\n';
                }
            }
        }
        
        return formattedKey;
    }

    // If key doesn't have proper format, try to add it
    // This handles cases where users might paste just the key content
    if (!formattedKey.includes('-----BEGIN')) {
        // Try to detect key type and add appropriate headers
        if (formattedKey.length > 1000) {
            // Likely an RSA key
            formattedKey = '-----BEGIN RSA PRIVATE KEY-----\n' + formattedKey + '\n-----END RSA PRIVATE KEY-----';
        } else {
            // Likely an OpenSSH format key
            formattedKey = '-----BEGIN OPENSSH PRIVATE KEY-----\n' + formattedKey + '\n-----END OPENSSH PRIVATE KEY-----';
        }
    }

    return formattedKey;
}

/**
 * Utility function to validate SSH private key format
 * @param privateKey The private key to validate
 * @returns true if valid, throws error if invalid
 */
export function validateSSHPrivateKey(privateKey: string): boolean {
    if (!privateKey) {
        throw new Error('Private key is required');
    }

    const trimmedKey = privateKey.trim();
    
    // Check for BEGIN marker
    if (!trimmedKey.includes('-----BEGIN')) {
        throw new Error('Private key must start with -----BEGIN marker');
    }

    // Check for END marker (various types)
    const hasRsaEnd = trimmedKey.includes('-----END RSA PRIVATE KEY-----');
    const hasPrivateKeyEnd = trimmedKey.includes('-----END PRIVATE KEY-----');
    const hasOpenSshEnd = trimmedKey.includes('-----END OPENSSH PRIVATE KEY-----');
    const hasEcEnd = trimmedKey.includes('-----END EC PRIVATE KEY-----');
    const hasDsaEnd = trimmedKey.includes('-----END DSA PRIVATE KEY-----');

    if (!(hasRsaEnd || hasPrivateKeyEnd || hasOpenSshEnd || hasEcEnd || hasDsaEnd)) {
        throw new Error('Private key must end with proper -----END marker');
    }

    // Check for reasonable key length (should be at least 1000 characters for most keys)
    if (trimmedKey.length < 500) {
        throw new Error('Private key appears to be too short. Please ensure you have copied the complete key including BEGIN and END markers.');
    }

    return true;
}

export interface JumpHostConfig {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
    authMethod: 'password' | 'privateKey';
    timeout?: number;
}

export interface DeviceCredentials {
    host: string;
    port: number;
    username: string;
    password?: string;
    authMethod: 'password' | 'privateKey';
    privateKey?: string;
    passphrase?: string;
    deviceType: string;
    timeout?: number;
    keepAlive?: boolean;
    fastMode?: boolean;
    commandTimeout?: number;
    reuseConnection?: boolean;
    connectionPooling?: boolean;
    // Jump host configuration (now at root level)
    useJumpHost?: boolean;
    jumpHostHost?: string;
    jumpHostPort?: number;
    jumpHostUsername?: string;
    jumpHostAuthMethod?: 'password' | 'privateKey';
    jumpHostPassword?: string;
    jumpHostPrivateKey?: string;
    jumpHostPassphrase?: string;
}

export interface CommandResult {
    command: string;
    output: string;
    success: boolean;
    error?: string;
}

export class BaseConnection extends EventEmitter {
    public client: Client;
    public credentials: DeviceCredentials;
    public isConnected: boolean = false;
    public currentChannel: any;
    protected basePrompt: string = '';
    protected enabledPrompt: string = '';
    protected configPrompt: string = '';
    protected timeout: number = 10000;
    protected encoding: string = 'utf8';
    protected newline: string = '\n';
    protected returnChar: string = '\r';
    protected fastMode: boolean = false;
    protected commandTimeout: number = 8000;
    protected reuseConnection: boolean = false;
    protected connectionPooling: boolean = false;
    protected lastActivity: number = 0;
    protected lastSuccessfulAlgorithmIndex: number = 0;

    // Static connection pool for reusing connections
    private static connectionPool: Map<string, BaseConnection> = new Map();
    private static poolCleanupInterval: NodeJS.Timeout | null = null;

    constructor(credentials: DeviceCredentials, fastMode: boolean = false, connectionPooling: boolean = false, reuseConnection: boolean = false) {
        super();
        this.credentials = credentials;
        this.fastMode = fastMode;
        this.connectionPooling = connectionPooling;
        this.reuseConnection = reuseConnection;
        this.timeout = (credentials.timeout || 10) * 1000;
        this.commandTimeout = (credentials.commandTimeout || 10) * 1000;
        this.lastActivity = Date.now();
        this.currentChannel = null;
        this.client = new Client();
        this.setupEventHandlers();
        this.setupConnectionPooling();
    }

    private setupEventHandlers(): void {
        this.client.on('ready', () => {
            this.isConnected = true;
            this.emit('ready');
        });

        this.client.on('error', (error) => {
            this.isConnected = false;
            this.emit('error', error);
        });

        this.client.on('end', () => {
            this.isConnected = false;
            this.emit('end');
        });

        this.client.on('close', () => {
            this.isConnected = false;
            this.emit('close');
        });
    }

    async connect(): Promise<void> {
        Logger.debug('Starting SSH connection process', {
            host: this.credentials.host,
            port: this.credentials.port,
            username: this.credentials.username,
            authMethod: this.credentials.authMethod,
            deviceType: this.credentials.deviceType,
            timeout: (this.credentials.timeout || 10) * 1000,
            fastMode: this.fastMode,
            hasPrivateKey: !!this.credentials.privateKey,
            hasPassphrase: !!this.credentials.passphrase,
            hasPassword: !!this.credentials.password
        });

        try {
            // Validate credentials first
            this.validateCredentials();

            // Try to connect with different algorithm configurations
            await this.tryConnect();

            Logger.info('SSH connection established successfully', {
                host: this.credentials.host,
                port: this.credentials.port,
                username: this.credentials.username,
                authMethod: this.credentials.authMethod,
                algorithmIndex: this.lastSuccessfulAlgorithmIndex
            });

        } catch (error) {
            Logger.error('SSH connection failed', {
                host: this.credentials.host,
                port: this.credentials.port,
                username: this.credentials.username,
                authMethod: this.credentials.authMethod,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private validateCredentials(): void {
        Logger.debug('Validating credentials', {
            host: this.credentials.host,
            port: this.credentials.port,
            username: this.credentials.username,
            authMethod: this.credentials.authMethod
        });

        if (!this.credentials.host) {
            throw new Error('Host is required for SSH connection');
        }

        if (!this.credentials.username) {
            throw new Error('Username is required for SSH connection');
        }

        if (this.credentials.authMethod === 'privateKey') {
            if (!this.credentials.privateKey) {
                throw new Error('SSH private key is required for private key authentication');
            }
            
            try {
                // Validate the private key format
                validateSSHPrivateKey(this.credentials.privateKey);
                Logger.debug('Private key validation passed', {
                    keyLength: this.credentials.privateKey.length,
                    hasPassphrase: !!this.credentials.passphrase,
                    passphraseLength: this.credentials.passphrase ? this.credentials.passphrase.length : 0
                });
            } catch (keyError) {
                Logger.error('Private key validation failed during credential validation', {
                    error: keyError instanceof Error ? keyError.message : String(keyError),
                    keyLength: this.credentials.privateKey.length,
                    hasBeginMarker: this.credentials.privateKey.includes('-----BEGIN'),
                    hasEndMarker: this.credentials.privateKey.includes('-----END')
                });
                throw keyError;
            }
        } else {
            if (!this.credentials.password) {
                throw new Error('Password is required for password authentication');
            }
            Logger.debug('Password authentication validation passed', {
                passwordLength: this.credentials.password.length
            });
        }

        // Validate jump host configuration if enabled
        if (this.credentials.useJumpHost) {
            this.validateJumpHostConfig();
        }
    }

    private validateJumpHostConfig(): void {
        Logger.debug('Validating jump host config', {
            useJumpHost: this.credentials.useJumpHost,
            hasJumpHostHost: !!this.credentials.jumpHostHost,
            hasJumpHostUsername: !!this.credentials.jumpHostUsername,
            jumpHostAuthMethod: this.credentials.jumpHostAuthMethod
        });

        if (!this.credentials.jumpHostHost) {
            throw new Error('Jump host hostname/IP is required when useJumpHost is enabled');
        }
        if (!this.credentials.jumpHostPort) {
            throw new Error('Jump host port is required when useJumpHost is enabled');
        }
        if (!this.credentials.jumpHostUsername) {
            throw new Error('Jump host username is required when useJumpHost is enabled');
        }
        if (!this.credentials.jumpHostAuthMethod) {
            throw new Error('Jump host authentication method is required when useJumpHost is enabled');
        }
        if (this.credentials.jumpHostAuthMethod === 'privateKey') {
            if (!this.credentials.jumpHostPrivateKey) {
                throw new Error('Jump host SSH private key is required for private key authentication');
            }
            try {
                // Validate the jump host private key format
                validateSSHPrivateKey(this.credentials.jumpHostPrivateKey);
                Logger.debug('Jump host private key validation passed', {
                    keyLength: this.credentials.jumpHostPrivateKey.length,
                    hasPassphrase: !!this.credentials.jumpHostPassphrase,
                    passphraseLength: this.credentials.jumpHostPassphrase ? this.credentials.jumpHostPassphrase.length : 0
                });
            } catch (keyError) {
                Logger.error('Jump host private key validation failed during credential validation', {
                    error: keyError instanceof Error ? keyError.message : String(keyError),
                    keyLength: this.credentials.jumpHostPrivateKey.length,
                    hasBeginMarker: this.credentials.jumpHostPrivateKey.includes('-----BEGIN'),
                    hasEndMarker: this.credentials.jumpHostPrivateKey.includes('-----END')
                });
                throw keyError;
            }
        } else {
            if (!this.credentials.jumpHostPassword) {
                throw new Error('Jump host password is required for password authentication');
            }
        }
    }

    private async tryConnect(): Promise<void> {
        // Use optimized algorithms for faster connection
        const algorithmConfigs = this.getOptimizedAlgorithms();
        Logger.debug('Trying SSH connection with algorithm configurations', {
            algorithmCount: algorithmConfigs.length,
            authMethod: this.credentials.authMethod
        });

        for (let i = 0; i < algorithmConfigs.length; i++) {
            try {
                Logger.debug(`Attempting connection with algorithm config ${i + 1}/${algorithmConfigs.length}`, {
                    algorithms: algorithmConfigs[i]
                });
                
                await this.tryConnectWithConfig(algorithmConfigs[i]);
                
                // Session preparation with separate timeout after successful SSH connection
                await this.sessionPreparationWithTimeout();
                
                Logger.info('SSH connection established successfully', {
                    host: this.credentials.host,
                    port: this.credentials.port,
                    username: this.credentials.username,
                    authMethod: this.credentials.authMethod,
                    algorithmIndex: i + 1
                });
                
                // Add to connection pool if enabled
                if (this.connectionPooling) {
                    const connectionKey = this.getConnectionKey();
                    BaseConnection.connectionPool.set(connectionKey, this);
                    Logger.debug('Added connection to pool', { connectionKey });
                }
                
                this.lastSuccessfulAlgorithmIndex = i;
                return;
            } catch (error) {
                Logger.warn(`Connection attempt ${i + 1}/${algorithmConfigs.length} failed`, {
                    error: error instanceof Error ? error.message : String(error),
                    host: this.credentials.host,
                    port: this.credentials.port,
                    authMethod: this.credentials.authMethod
                });
                
                if (i === algorithmConfigs.length - 1) {
                    Logger.error('All connection attempts failed', {
                        host: this.credentials.host,
                        port: this.credentials.port,
                        username: this.credentials.username,
                        authMethod: this.credentials.authMethod,
                        finalError: error instanceof Error ? error.message : String(error)
                    });
                    throw error;
                }
                // Continue to next algorithm configuration
            }
        }
    }

    private async tryConnectWithConfig(algorithms: any): Promise<void> {
        return new Promise((resolve, reject) => {
            // Use faster timeout for connection attempts
            const connectionTimeout = this.fastMode ? 
                Math.min(this.timeout, 8000) : this.timeout;

            Logger.debug('Preparing SSH connection configuration', {
                host: this.credentials.host,
                port: this.credentials.port,
                username: this.credentials.username,
                connectionTimeout,
                authMethod: this.credentials.authMethod,
                algorithms
            });

            const connectConfig: ConnectConfig = {
                host: this.credentials.host,
                port: this.credentials.port,
                username: this.credentials.username,
                readyTimeout: connectionTimeout,
                keepaliveInterval: this.credentials.keepAlive ? 
                    (this.fastMode ? 60000 : 30000) : undefined,
                algorithms: algorithms,
                // Optimize settings for faster connection
                hostHash: 'md5',
                // Add debug option for troubleshooting
                debug: process.env.SSH_DEBUG === 'true' ? 
                    (msg: string) => Logger.debug('SSH2 Debug: ' + msg) : undefined
            };

            // Configure authentication method
            if (this.credentials.authMethod === 'privateKey') {
                if (!this.credentials.privateKey) {
                    Logger.error('SSH private key is missing for private key authentication');
                    reject(new Error('SSH private key is required for private key authentication'));
                    return;
                }
                
                try {
                    // Validate and format the private key
                    validateSSHPrivateKey(this.credentials.privateKey);
                    const normalizedKey = formatSSHPrivateKey(this.credentials.privateKey);
                    
                    Logger.debug('Private key validation and formatting successful', {
                        originalLength: this.credentials.privateKey.length,
                        formattedLength: normalizedKey.length,
                        hasBeginMarker: normalizedKey.includes('-----BEGIN'),
                        hasEndMarker: normalizedKey.includes('-----END')
                    });
                    
                    connectConfig.privateKey = normalizedKey;
                } catch (keyError) {
                    Logger.error('Private key validation failed', {
                        error: keyError instanceof Error ? keyError.message : String(keyError),
                        keyLength: this.credentials.privateKey.length,
                        hasBeginMarker: this.credentials.privateKey.includes('-----BEGIN'),
                        hasEndMarker: this.credentials.privateKey.includes('-----END')
                    });
                    reject(new Error(`SSH private key validation failed: ${keyError instanceof Error ? keyError.message : String(keyError)}`));
                    return;
                }
                
                // Handle passphrase - only add if it's not empty
                if (this.credentials.passphrase && this.credentials.passphrase.trim() !== '') {
                    connectConfig.passphrase = this.credentials.passphrase;
                    Logger.debug('Using passphrase for private key', {
                        passphraseLength: this.credentials.passphrase.length
                    });
                } else {
                    Logger.debug('No passphrase provided for private key');
                }
                
                // For key-based auth, try to disable password auth to avoid prompts
                connectConfig.tryKeyboard = false;
                
                Logger.debug('Configured SSH private key authentication', {
                    keyLength: this.credentials.privateKey.length,
                    hasPassphrase: !!connectConfig.passphrase,
                    tryKeyboard: connectConfig.tryKeyboard
                });
            } else {
                if (!this.credentials.password) {
                    Logger.error('Password is missing for password authentication');
                    reject(new Error('Password is required for password authentication'));
                    return;
                }
                connectConfig.password = this.credentials.password;
                
                Logger.debug('Configured SSH password authentication', {
                    passwordLength: this.credentials.password.length
                });
            }

            // Set up timeout for the entire connection process
            const timeoutId = setTimeout(() => {
                Logger.error('SSH connection timeout reached', {
                    host: this.credentials.host,
                    port: this.credentials.port,
                    timeout: connectionTimeout,
                    authMethod: this.credentials.authMethod
                });
                this.client.removeAllListeners();
                reject(new Error(`Connection timeout after ${connectionTimeout}ms`));
            }, connectionTimeout);

            // Handle connection events
            this.client.once('ready', () => {
                Logger.info('SSH connection ready', {
                    host: this.credentials.host,
                    port: this.credentials.port,
                    username: this.credentials.username,
                    authMethod: this.credentials.authMethod
                });
                
                clearTimeout(timeoutId);
                this.lastActivity = Date.now();
                this.isConnected = true;
                resolve();
            });

            this.client.once('error', (error) => {
                Logger.error('SSH connection error', {
                    error: error.message,
                    host: this.credentials.host,
                    port: this.credentials.port,
                    username: this.credentials.username,
                    authMethod: this.credentials.authMethod,
                    level: error.level || 'unknown'
                });
                
                clearTimeout(timeoutId);
                
                // Provide more specific error messages for common issues
                let enhancedError = error;
                if (error.message.includes('All configured authentication methods failed')) {
                    enhancedError = new Error(`Authentication failed: ${error.message}. Please check your ${this.credentials.authMethod === 'privateKey' ? 'SSH private key and passphrase' : 'password'}.`);
                } else if (error.message.includes('connect ECONNREFUSED')) {
                    enhancedError = new Error(`Connection refused: Cannot connect to ${this.credentials.host}:${this.credentials.port}. Please check if SSH service is running and the host/port are correct.`);
                } else if (error.message.includes('connect ETIMEDOUT')) {
                    enhancedError = new Error(`Connection timed out: Cannot reach ${this.credentials.host}:${this.credentials.port}. Please check network connectivity and firewall settings.`);
                } else if (error.message.includes('getaddrinfo ENOTFOUND')) {
                    enhancedError = new Error(`Host not found: Cannot resolve hostname ${this.credentials.host}. Please check the hostname or IP address.`);
                }
                
                reject(enhancedError);
            });

            // Handle keyboard-interactive authentication for some servers
            this.client.once('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
                Logger.debug('Received keyboard-interactive authentication request', {
                    name,
                    instructions,
                    promptCount: prompts.length,
                    authMethod: this.credentials.authMethod
                });
                
                if (this.credentials.authMethod === 'password' && this.credentials.password) {
                    Logger.debug('Responding to keyboard-interactive with password');
                    // Respond to keyboard-interactive with password
                    finish([this.credentials.password]);
                } else {
                    Logger.warn('Rejecting keyboard-interactive authentication for key-based auth');
                    // Reject keyboard-interactive if using key auth
                    finish([]);
                }
            });

            // Handle banner messages
            this.client.once('banner', (message) => {
                Logger.debug('Received SSH banner', {
                    banner: message.trim(),
                    host: this.credentials.host
                });
            });

            try {
                Logger.debug('Initiating SSH connection', {
                    host: this.credentials.host,
                    port: this.credentials.port,
                    username: this.credentials.username
                });
                
                this.client.connect(connectConfig);
            } catch (error) {
                Logger.error('Failed to initiate SSH connection', {
                    error: error instanceof Error ? error.message : String(error),
                    host: this.credentials.host,
                    port: this.credentials.port
                });
                
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    async disconnect(): Promise<void> {
        return new Promise((resolve) => {
            // If connection pooling is enabled, don't actually disconnect
            if (this.connectionPooling && this.isAlive()) {
                this.lastActivity = Date.now();
                resolve();
                return;
            }

            // Graceful channel closure
            if (this.currentChannel) {
                this.currentChannel.end();
                this.currentChannel = null;
            }

            if (this.client) {
                // Set a timeout for disconnect operation
                const disconnectTimeout = setTimeout(() => {
                    this.isConnected = false;
                    resolve();
                }, this.fastMode ? 2000 : 5000);

                this.client.once('close', () => {
                    clearTimeout(disconnectTimeout);
                    this.isConnected = false;
                    
                    // Remove from connection pool if it exists
                    if (this.connectionPooling) {
                        const connectionKey = this.getConnectionKey();
                        BaseConnection.connectionPool.delete(connectionKey);
                    }
                    
                    resolve();
                });

                this.client.end();
            } else {
                resolve();
            }
        });
    }

    public async sessionPreparation(): Promise<void> {
        // Create shell channel
        await this.createShellChannel();
        
        if (this.fastMode) {
            // Fast mode: minimal setup for better performance
            await this.setBasePrompt();
        } else {
            // Standard mode: full setup
            // Run setup operations in parallel for better performance
            await Promise.all([
                this.setBasePrompt(),
                this.disablePaging(),
                this.setTerminalWidth(),
            ]);
        }
    }

    protected async createShellChannel(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client.shell((err, channel) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.currentChannel = channel;
                this.currentChannel.setEncoding(this.encoding);
                
                // Reduced wait time for faster channel setup
                const waitTime = this.fastMode ? 200 : 500;
                setTimeout(() => {
                    resolve();
                }, waitTime);
            });
        });
    }

    protected async setBasePrompt(): Promise<void> {
        // Send a return to get the current prompt
        await this.writeChannel(this.returnChar);
        const output = await this.readChannel();
        
        // Extract the base prompt from the output
        const lines = output.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        
        // Remove common prompt terminators to get base prompt
        this.basePrompt = lastLine.replace(/[>#$%]\s*$/, '');
        
        // Set enabled and config prompts based on base prompt
        this.enabledPrompt = this.basePrompt + '#';
        this.configPrompt = this.basePrompt + '(config)#';
    }

    protected async disablePaging(): Promise<void> {
        // Default implementation - override in vendor classes
        // This is a stub that can be overridden
    }

    protected async setTerminalWidth(): Promise<void> {
        // Default implementation - override in vendor classes
        // This is a stub that can be overridden
    }

    protected async writeChannel(data: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.currentChannel && this.currentChannel.writable) {
                Logger.debug('writeChannel: Writing to channel', { data: data.replace('\n', '\\n').replace('\r', '\\r') });
                this.currentChannel.write(data, this.encoding, (err?: Error) => {
                    if (err) {
                        Logger.error('writeChannel: Channel write error', { error: err.message, stack: err.stack });
                        reject(err);
                    } else {
                        Logger.debug('writeChannel: Channel write successful');
                        // Small delay to ensure data is processed by the remote end
                        setTimeout(resolve, 50);
                    }
                });
            } else {
                const msg = 'writeChannel: Cannot write to channel, it is not writable or does not exist.';
                Logger.error(msg, {
                    isChannel: !!this.currentChannel,
                    isWritable: this.currentChannel ? this.currentChannel.writable : false,
                    isReadable: this.currentChannel ? this.currentChannel.readable : false,
                    isDestroyed: this.currentChannel ? this.currentChannel.destroyed : false,
                });
                reject(new Error(msg));
            }
        });
    }

    protected async readChannel(timeout: number = 3000): Promise<string> {
        return new Promise((resolve) => {
            let buffer = '';
            let timeoutId: NodeJS.Timeout;

            const onData = (data: string) => {
                buffer += data;
            };

            const cleanup = () => {
                if (this.currentChannel) {
                    this.currentChannel.removeListener('data', onData);
                }
                if (timeoutId) {
                    global.clearTimeout(timeoutId);
                }
            };

            timeoutId = global.setTimeout(() => {
                cleanup();
                resolve(buffer);
            }, timeout);

            if (this.currentChannel) {
                this.currentChannel.on('data', onData);
            } else {
                cleanup();
                resolve('');
            }
        });
    }

    protected async readUntilPrompt(expectedPrompt?: string, timeout: number = 10000): Promise<string> {
        return new Promise((resolve, reject) => {
            let buffer = '';
            let timeoutId: NodeJS.Timeout;
            let debounceId: NodeJS.Timeout | null = null;
            const actualTimeout = this.fastMode ? Math.min(timeout, 5000) : timeout;

            // List of universal prompt endings
            const promptPatterns = [
                /^\S+[>#$]\s*$/, // Common prompt format (e.g., router>, router#)
                /^\S+\(config\)#\s*$/, // Cisco config mode
                /^\S+\(config-if\)#\s*$/, // Cisco interface config mode
                /^\[\S+@\S+\s+\S+\][#$]\s*$/, // Linux prompt (e.g., [user@host ~]$)
            ];

            const cleanup = () => {
                if (this.currentChannel) {
                    this.currentChannel.removeListener('data', onData);
                    this.currentChannel.removeListener('error', onError);
                }
                if (timeoutId) clearTimeout(timeoutId);
                if (debounceId) clearTimeout(debounceId);
            };

            const onData = (data: string) => {
                buffer += data;
                if (debounceId) clearTimeout(debounceId);

                debounceId = setTimeout(() => {
                    const lines = buffer.trim().split('\n');
                    const lastLine = lines[lines.length - 1].trim();

                    // Check if the last line matches any known prompt pattern
                    const isPrompt = promptPatterns.some(pattern => pattern.test(lastLine));

                    if (isPrompt) {
                        cleanup();
                        resolve(buffer);
                    }
                }, 150); // Debounce for 150ms
            };

            const onError = (error: Error) => {
                cleanup();
                reject(error);
            };

            timeoutId = setTimeout(() => {
                cleanup();
                // If we time out, resolve with the buffer we have.
                // The calling function can then decide if the output is valid.
                resolve(buffer);
            }, actualTimeout);

            if (this.currentChannel) {
                this.currentChannel.on('data', onData);
                this.currentChannel.on('error', onError);
            } else {
                cleanup();
                reject(new Error('No active channel available'));
            }
        });
    }

    async sendCommand(command: string): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            // Update activity timestamp for connection pooling
            this.lastActivity = Date.now();

            // Send the command
            await this.writeChannel(command + this.newline);
            
            // Use optimized timeout based on mode
            const timeout = this.fastMode ? Math.min(this.commandTimeout, 5000) : this.commandTimeout;
            
            // Wait for response with timeout
            const output = await this.readUntilPrompt(undefined, timeout);
            
            // Clean up the output
            const cleanOutput = this.sanitizeOutput(output, command);

            // In fast mode, skip extensive error checking for simple commands
            if (this.fastMode && command.startsWith('show')) {
                return {
                    command,
                    output: cleanOutput,
                    success: true
                };
            }

            // Check for common error patterns in output
            const errorPatterns = [
                /invalid command/i,
                /command not found/i,
                /syntax error/i,
                /unknown command/i,
                /access denied/i,
                /permission denied/i,
                /authentication failed/i,
                /connection lost/i,
                /timeout/i,
                /error:/i,
                /failed/i
            ];

            const hasError = errorPatterns.some(pattern => pattern.test(cleanOutput));
            
            if (hasError) {
                return {
                    command,
                    output: cleanOutput,
                    success: false,
                    error: 'Command execution returned an error'
                };
            }

            return {
                command,
                output: cleanOutput,
                success: true
            };

        } catch (error) {
            return {
                command,
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async sendConfig(configCommands: string[]): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            // Enter configuration mode
            await this.enterConfigMode();
            
            let allOutput = '';
            let hasError = false;
            let errorMessage = '';
            
            // Send each configuration command
            for (const command of configCommands) {
                try {
                    await this.writeChannel(command + this.newline);
                    const output = await this.readUntilPrompt(undefined, this.timeout);
                    allOutput += output;
                    
                    // Check for error patterns in each command output
                    const errorPatterns = [
                        /invalid command/i,
                        /syntax error/i,
                        /unknown command/i,
                        /access denied/i,
                        /permission denied/i,
                        /error:/i,
                        /failed/i,
                        /incomplete command/i,
                        /ambiguous command/i
                    ];
                    
                    if (errorPatterns.some(pattern => pattern.test(output))) {
                        hasError = true;
                        errorMessage = `Error in command: ${command}`;
                        break;
                    }
                } catch (cmdError) {
                    hasError = true;
                    errorMessage = `Failed to execute command: ${command} - ${cmdError}`;
                    break;
                }
            }
            
            // Always try to exit configuration mode
            try {
                await this.exitConfigMode();
            } catch (exitError) {
                // If we can't exit config mode, this is a serious error
                hasError = true;
                errorMessage = errorMessage || `Failed to exit configuration mode: ${exitError}`;
            }
            
            // Clean up the output
            const cleanOutput = this.sanitizeOutput(allOutput, configCommands.join('; '));

            return {
                command: configCommands.join('; '),
                output: cleanOutput,
                success: !hasError,
                error: hasError ? errorMessage : undefined
            };

        } catch (error) {
            // Try to exit config mode on error
            try {
                await this.exitConfigMode();
            } catch (exitError) {
                // Ignore exit errors during error handling
            }
            
            return {
                command: configCommands.join('; '),
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    protected async enterConfigMode(): Promise<void> {
        // Default implementation - override in vendor classes
        await this.writeChannel('configure terminal' + this.newline);
        await this.readUntilPrompt();
    }

    protected async exitConfigMode(): Promise<void> {
        // Default implementation - override in vendor classes
        await this.writeChannel('exit' + this.newline);
        await this.readUntilPrompt();
    }

    protected escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    protected sanitizeOutput(output: string, command: string): string {
        // Escape special regex characters in the command
        const escapedCommand = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Remove the command echo
        let cleanOutput = output.replace(new RegExp(escapedCommand, 'g'), '');
        
        // Remove prompts (escape special chars in prompts too)
        const escapedBasePrompt = this.basePrompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedEnabledPrompt = this.enabledPrompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedConfigPrompt = this.configPrompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        cleanOutput = cleanOutput.replace(new RegExp(escapedBasePrompt + '[>#$%]', 'g'), '');
        cleanOutput = cleanOutput.replace(new RegExp(escapedEnabledPrompt, 'g'), '');
        cleanOutput = cleanOutput.replace(new RegExp(escapedConfigPrompt, 'g'), '');
        
        // Remove extra whitespace and newlines
        cleanOutput = cleanOutput.replace(/^\s+|\s+$/g, '');
        cleanOutput = cleanOutput.replace(/\r\n/g, '\n');
        cleanOutput = cleanOutput.replace(/\r/g, '\n');
        
        return cleanOutput;
    }

    async getCurrentConfig(): Promise<CommandResult> {
        // Default implementation - override in vendor classes
        return await this.sendCommand('show configuration');
    }

    async saveConfig(): Promise<CommandResult> {
        // Default implementation - override in vendor classes
        return await this.sendCommand('save configuration');
    }

    async rebootDevice(): Promise<CommandResult> {
        // Default implementation - override in vendor classes
        return await this.sendCommand('reboot');
    }

    // Utility methods
    isAlive(): boolean {
        return this.isConnected && this.currentChannel && !this.currentChannel.destroyed;
    }

    async healthCheck(): Promise<boolean> {
        try {
            if (!this.isAlive()) {
                return false;
            }
            
            // Send a simple command to check if the connection is responsive
            await this.writeChannel(this.returnChar);
            const response = await this.readChannel(5000);
            
            // If we get any response, the connection is alive
            return response.length > 0;
        } catch (error) {
            return false;
        }
    }

    getDeviceType(): string {
        return this.credentials.deviceType;
    }

    getHost(): string {
        return this.credentials.host;
    }

    getConnectionInfo(): { host: string; port: number; deviceType: string; connected: boolean } {
        return {
            host: this.credentials.host,
            port: this.credentials.port,
            deviceType: this.credentials.deviceType,
            connected: this.isAlive()
        };
    }

    private setupConnectionPooling(): void {
        // Start cleanup interval if not already running
        if (this.connectionPooling && !BaseConnection.poolCleanupInterval) {
            BaseConnection.poolCleanupInterval = setInterval(() => {
                this.cleanupConnectionPool();
            }, 300000); // Clean up every 5 minutes
        }
    }

    private cleanupConnectionPool(): void {
        const now = Date.now();
        const maxIdleTime = 600000; // 10 minutes

        for (const [key, connection] of BaseConnection.connectionPool.entries()) {
            if (now - connection.lastActivity > maxIdleTime) {
                connection.disconnect();
                BaseConnection.connectionPool.delete(key);
            }
        }
    }

    private getConnectionKey(): string {
        return `${this.credentials.host}:${this.credentials.port}:${this.credentials.username}`;
    }

    // Get optimized SSH algorithms for faster connection
    /**
     * Get optimized SSH algorithm configurations with fallbacks for legacy devices.
     * 
     * Includes support for older devices (Juniper, Cisco, etc.) that may require
     * legacy algorithms like diffie-hellman-group-exchange-sha1, ssh-dss, etc.
     * 
     * The method returns multiple algorithm configurations that are tried in order:
     * 1. Modern, secure algorithms
     * 2. Legacy algorithms for older devices
     * 3. Ultra-legacy fallback for very old equipment
     */
    protected getOptimizedAlgorithms(): any[] {
        if (this.fastMode) {
            // Ultra-fast algorithms for speed-critical operations
            return [
                {
                    serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256'],
                    cipher: ['aes128-ctr', 'aes128-cbc'],
                    hmac: ['hmac-sha1'],
                    kex: ['diffie-hellman-group14-sha1', 'ecdh-sha2-nistp256']
                }
            ];
        } else {
            // Optimized algorithms for SSH key authentication
            const keyBasedAlgorithms = {
                serverHostKey: [
                    'ssh-rsa', 'rsa-sha2-256', 'rsa-sha2-512',
                    'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521',
                    'ssh-ed25519'
                ],
                cipher: [
                    'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
                    'aes128-gcm@openssh.com', 'aes256-gcm@openssh.com',
                    'aes128-cbc', 'aes192-cbc'
                ],
                hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1'],
                kex: [
                    'curve25519-sha256', 'curve25519-sha256@libssh.org',
                    'diffie-hellman-group16-sha512', 'diffie-hellman-group18-sha512',
                    'diffie-hellman-group14-sha256', 'ecdh-sha2-nistp256',
                    'diffie-hellman-group14-sha1'
                ]
            };

            // Password-based algorithms (more conservative)
            const passwordBasedAlgorithms = {
                serverHostKey: [
                    'ssh-rsa', 'rsa-sha2-256', 'ecdsa-sha2-nistp256', 
                    'ecdsa-sha2-nistp384', 'ssh-ed25519'
                ],
                cipher: [
                    'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
                    'aes128-cbc', 'aes192-cbc'
                ],
                hmac: ['hmac-sha2-256', 'hmac-sha1'],
                kex: [
                    'diffie-hellman-group14-sha256', 'ecdh-sha2-nistp256',
                    'diffie-hellman-group14-sha1'
                ]
            };

            // Choose algorithm set based on authentication method
            const primaryAlgorithms = this.credentials.authMethod === 'privateKey' 
                ? keyBasedAlgorithms 
                : passwordBasedAlgorithms;

            return [
                primaryAlgorithms,
                // Fallback for older systems (e.g., older Juniper, Cisco devices)
                {
                    serverHostKey: ['ssh-rsa', 'ssh-dss'],
                    cipher: ['aes128-cbc', 'aes256-cbc', '3des-cbc', 'aes192-cbc'],
                    hmac: ['hmac-sha1', 'hmac-sha1-96', 'hmac-md5'],
                    kex: [
                        'diffie-hellman-group-exchange-sha256',
                        'diffie-hellman-group-exchange-sha1',
                        'diffie-hellman-group14-sha1',
                        'diffie-hellman-group1-sha1'
                    ]
                },
                // Ultra-legacy fallback for very old devices
                {
                    serverHostKey: ['ssh-rsa', 'ssh-dss'],
                    cipher: ['3des-cbc', 'aes128-cbc', 'aes256-cbc'],
                    hmac: ['hmac-md5', 'hmac-sha1'],
                    kex: [
                        'diffie-hellman-group1-sha1',
                        'diffie-hellman-group14-sha1'
                    ]
                }
            ];
        }
    }

    // Static method to force cleanup connection pool
    static forceCleanupConnectionPool(): void {
        for (const [key, connection] of BaseConnection.connectionPool.entries()) {
            connection.disconnect();
            BaseConnection.connectionPool.delete(key);
        }
        
        if (BaseConnection.poolCleanupInterval) {
            clearInterval(BaseConnection.poolCleanupInterval);
            BaseConnection.poolCleanupInterval = null;
        }
    }

    // Static method to get connection pool status
    static getConnectionPoolStatus(): { totalConnections: number; connections: string[] } {
        return {
            totalConnections: BaseConnection.connectionPool.size,
            connections: Array.from(BaseConnection.connectionPool.keys())
        };
    }

    private async sessionPreparationWithTimeout(): Promise<void> {
        const sessionTimeout = this.fastMode ? 5000 : 10000; // Separate timeout for session prep
        
        Logger.debug('Starting session preparation with timeout', {
            timeout: sessionTimeout,
            fastMode: this.fastMode
        });

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                Logger.error('Session preparation timeout', {
                    timeout: sessionTimeout,
                    host: this.credentials.host
                });
                reject(new Error(`Session preparation timeout after ${sessionTimeout}ms`));
            }, sessionTimeout);

            this.sessionPreparation()
                .then(() => {
                    clearTimeout(timeoutId);
                    Logger.debug('Session preparation completed successfully');
                    resolve();
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    Logger.error('Session preparation failed', {
                        error: error instanceof Error ? error.message : String(error)
                    });
                    reject(error);
                });
        });
    }
} 