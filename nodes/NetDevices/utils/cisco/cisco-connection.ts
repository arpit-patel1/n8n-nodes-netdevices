import { BaseConnection, DeviceCredentials, CommandResult } from '../base-connection';

export class CiscoConnection extends BaseConnection {
    private enablePassword: string = '';
    protected inEnableMode: boolean = false;
    protected inConfigMode: boolean = false;

    constructor(credentials: DeviceCredentials & { enablePassword?: string }) {
        super(credentials);
        this.enablePassword = credentials.enablePassword || credentials.password || '';
    }

    public async sessionPreparation(): Promise<void> {
        // Create shell channel
        await this.createCiscoShellChannel();
        
        if (this.fastMode) {
            // Fast mode: minimal setup
            await this.setBasePrompt();
            // Skip enable mode check in fast mode for simple commands
        } else {
            // Standard mode: full setup in parallel
            await Promise.all([
                this.setTerminalWidth(),
                this.disablePaging(),
            ]);
            
            await this.setBasePrompt();
            
            // Check if we need to enter enable mode
            await this.checkAndEnterEnableMode();
        }
    }

    protected async createCiscoShellChannel(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client.shell((err, channel) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.currentChannel = channel;
                this.currentChannel.setEncoding(this.encoding);
                
                // Optimized wait time for faster channel setup
                const waitTime = this.fastMode ? 200 : 600;
                setTimeout(() => {
                    resolve();
                }, waitTime);
            });
        });
    }

    protected async setTerminalWidth(): Promise<void> {
        try {
            await this.writeChannel('terminal width 511' + this.newline);
            await this.readChannel(2000);
        } catch (error) {
            // If this fails, it's not critical
        }
    }

    protected async disablePaging(): Promise<void> {
        try {
            await this.writeChannel('terminal length 0' + this.newline);
            await this.readChannel(2000);
        } catch (error) {
            // If this fails, it's not critical
        }
    }

    protected async setBasePrompt(): Promise<void> {
        // Send a return to get the current prompt
        await this.writeChannel(this.returnChar);
        const output = await this.readChannel(3000);
        
        // Extract the base prompt from the output
        const lines = output.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        
        // Remove common prompt terminators to get base prompt
        this.basePrompt = lastLine.replace(/[>#$%]\s*$/, '').trim();
        
        // Cisco IOS abbreviates prompts at 20 chars in config mode
        if (this.basePrompt.length > 16) {
            this.basePrompt = this.basePrompt.substring(0, 16);
        }
        
        // Set enabled and config prompts based on base prompt
        this.enabledPrompt = this.basePrompt + '#';
        this.configPrompt = this.basePrompt + '(config)#';
    }

    protected async checkAndEnterEnableMode(): Promise<void> {
        // Check current prompt to see if we're already in enable mode
        await this.writeChannel(this.returnChar);
        const output = await this.readChannel(2000);
        
        if (output.includes('#')) {
            this.inEnableMode = true;
            return;
        }
        
        // Try to enter enable mode
        await this.enterEnableMode();
    }

    protected async enterEnableMode(): Promise<void> {
        try {
            await this.writeChannel('enable' + this.newline);
            
            // Wait for password prompt or enable prompt
            let output = await this.readChannel(3000);
            
            // If we see "Password:" or "password:", send the enable password
            if (output.toLowerCase().includes('password:') || output.toLowerCase().includes('password')) {
                await this.writeChannel(this.enablePassword + this.newline);
                output = await this.readChannel(3000);
            }
            
            // Check if we're now in enable mode
            if (output.includes('#')) {
                this.inEnableMode = true;
            } else {
                throw new Error('Failed to enter enable mode');
            }
        } catch (error) {
            throw new Error(`Failed to enter enable mode: ${error}`);
        }
    }

    protected async enterConfigMode(): Promise<void> {
        if (!this.inEnableMode) {
            await this.enterEnableMode();
        }
        
        try {
            await this.writeChannel('configure terminal' + this.newline);
            const output = await this.readChannel(3000);
            
            if (output.includes('(config)#')) {
                this.inConfigMode = true;
            } else {
                throw new Error('Failed to enter configuration mode');
            }
        } catch (error) {
            throw new Error(`Failed to enter configuration mode: ${error}`);
        }
    }

    protected async exitConfigMode(): Promise<void> {
        if (!this.inConfigMode) {
            return;
        }
        
        try {
            await this.writeChannel('exit' + this.newline);
            const output = await this.readChannel(3000);
            
            if (output.includes('#') && !output.includes('(config)#')) {
                this.inConfigMode = false;
            } else {
                throw new Error('Failed to exit configuration mode');
            }
        } catch (error) {
            throw new Error(`Failed to exit configuration mode: ${error}`);
        }
    }

    async sendCommand(command: string): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            // In fast mode, skip enable mode check for show commands
            if (!this.fastMode) {
                // Ensure we're in enable mode for most commands
                if (!this.inEnableMode && !command.startsWith('show') && command !== 'enable') {
                    await this.enterEnableMode();
                }
            }

            // Send the command
            await this.writeChannel(command + this.newline);
            
            // Use optimized timeout - reduced from 15000
            const timeout = this.fastMode ? 5000 : 10000;
            
            // Wait for response with appropriate timeout
            const output = await this.readUntilPrompt(undefined, timeout);
            
            // Clean up the output
            const cleanOutput = this.sanitizeOutput(output, command);

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
            
            // Send each configuration command
            for (const command of configCommands) {
                await this.writeChannel(command + this.newline);
                const output = await this.readChannel(3000);
                allOutput += output;
                
                // Check for configuration errors
                if (output.includes('Invalid input') || output.includes('% ')) {
                    throw new Error(`Configuration error on command "${command}": ${output}`);
                }
            }
            
            // Exit configuration mode
            await this.exitConfigMode();
            
            // Clean up the output
            const cleanOutput = this.sanitizeOutput(allOutput, configCommands.join('; '));

            return {
                command: configCommands.join('; '),
                output: cleanOutput,
                success: true
            };

        } catch (error) {
            // Try to exit config mode if we're still in it
            if (this.inConfigMode) {
                try {
                    await this.exitConfigMode();
                } catch (exitError) {
                    // Ignore exit errors if we're already handling an error
                }
            }
            
            return {
                command: configCommands.join('; '),
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async getCurrentConfig(): Promise<CommandResult> {
        return await this.sendCommand('show running-config');
    }

    async saveConfig(): Promise<CommandResult> {
        return await this.sendCommand('write memory');
    }

    async rebootDevice(): Promise<CommandResult> {
        try {
            // Send reload command
            await this.writeChannel('reload' + this.newline);
            
            // Wait for confirmation prompt
            let output = await this.readChannel(5000);
            
            // If we see a confirmation prompt, respond with yes
            if (output.includes('[confirm]') || output.includes('?')) {
                await this.writeChannel(this.newline);
                output += await this.readChannel(5000);
            }
            
            return {
                command: 'reload',
                output: output,
                success: true
            };
        } catch (error) {
            return {
                command: 'reload',
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    protected sanitizeOutput(output: string, command: string): string {
        const lines = output.split('\n');
        // Remove the command echo, which is usually the first line
        if (lines[0].includes(command)) {
            lines.shift();
        }

        // Remove the prompt, which is the last line
        if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            const promptRegex = new RegExp(`^${this.escapeRegex(this.basePrompt)}[>#$]`);
            if (promptRegex.test(lastLine)) {
                lines.pop();
            }
        }

        return lines.join('\n').trim();
    }

    // Cisco-specific utility methods
    isInEnableMode(): boolean {
        return this.inEnableMode;
    }

    isInConfigMode(): boolean {
        return this.inConfigMode;
    }
} 