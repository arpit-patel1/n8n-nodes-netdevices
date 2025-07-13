import { BaseConnection, DeviceCredentials, CommandResult } from '../base-connection';

export class PaloAltoConnection extends BaseConnection {
    private inOperationalMode: boolean = false;
    private inConfigMode: boolean = false;
    private inShellMode: boolean = false;

    constructor(credentials: DeviceCredentials) {
        super(credentials);
    }

    protected async sessionPreparation(): Promise<void> {
        // Create shell channel
        await this.createPaloAltoShellChannel();
        
        if (this.fastMode) {
            // Fast mode: minimal setup
            await this.setBasePrompt();
        } else {
            // Standard mode: full setup
            // Enter operational mode if we're in shell
            await this.enterOperationalMode();
            
            // Run terminal setup in parallel
            await Promise.all([
                this.setTerminalWidth(),
                this.disablePaging(),
            ]);
            
            // Set base prompt
            await this.setBasePrompt();
        }
    }

    private async createPaloAltoShellChannel(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client.shell((err: Error | undefined, channel: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.currentChannel = channel;
                this.currentChannel.setEncoding(this.encoding);
                
                // Optimized wait time for faster channel setup
                const waitTime = this.fastMode ? 200 : 500;
                setTimeout(() => {
                    resolve();
                }, waitTime);
            });
        });
    }

    private async enterOperationalMode(): Promise<void> {
        // Check if we're already in operational mode
        await this.writeChannel(this.returnChar);
        let output = await this.readChannel(3000);
        
        const mode = this.determineMode(output);
        
        if (mode === 'shell') {
            this.inShellMode = true;
            this.inOperationalMode = false;
            
            // Enter operational mode
            await this.writeChannel('cli' + this.newline);
            output = await this.readChannel(3000);
            
            if (output.includes('>') || output.includes('#')) {
                this.inOperationalMode = true;
                this.inShellMode = false;
            }
        } else if (mode === 'operational') {
            this.inOperationalMode = true;
            this.inShellMode = false;
        } else if (mode === 'config') {
            this.inOperationalMode = false;
            this.inConfigMode = true;
        }
    }

    private determineMode(data: string): 'shell' | 'operational' | 'config' {
        // Shell patterns: root@hostname, %, $
        if (data.match(/root@/) || data.match(/%/) || data.match(/\$/)) {
            return 'shell';
        }
        // Config patterns: [edit], [set], [delete]
        if (data.includes('[edit]') || data.includes('[set]') || data.includes('[delete]')) {
            return 'config';
        }
        // Operational patterns: > or # (but not in config mode)
        if (data.includes('>') || data.includes('#')) {
            return 'operational';
        }
        return 'operational'; // Default to operational
    }

    protected async setTerminalWidth(): Promise<void> {
        try {
            await this.writeChannel('set cli terminal width 511' + this.newline);
            const output = await this.readChannel(2000);
            
            // Check for success message or error
            if (output.includes('Unknown command') || output.includes('Error')) {
                // Try alternate command format
                await this.writeChannel('set cli screen-width 511' + this.newline);
                await this.readChannel(2000);
            }
        } catch (error) {
            // If this fails, it's not critical
        }
    }

    protected async disablePaging(): Promise<void> {
        try {
            // Disable paging for show commands
            await this.writeChannel('set cli pager off' + this.newline);
            await this.readChannel(2000);
            
            // Set screen length to 0 (disable paging)
            await this.writeChannel('set cli screen-length 0' + this.newline);
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
        
        // Set enabled and config prompts based on base prompt
        this.enabledPrompt = this.basePrompt + '>';
        this.configPrompt = this.basePrompt + '#';
    }

    protected async enterConfigMode(): Promise<void> {
        if (!this.inOperationalMode) {
            await this.enterOperationalMode();
        }
        
        try {
            await this.writeChannel('configure' + this.newline);
            const output = await this.readChannel(3000);
            
            if (output.includes('Entering configuration mode') || output.includes('[edit]')) {
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
            let output = await this.readChannel(3000);
            
            // Check for uncommitted changes
            if (output.includes('Exit with uncommitted changes')) {
                await this.writeChannel('yes' + this.newline);
                output = await this.readChannel(3000);
            }
            
            if (output.includes('>') && !output.includes('[edit]')) {
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

            // In fast mode, skip operational mode check for simple commands
            if (!this.fastMode) {
                // Ensure we're in operational mode
                if (!this.inOperationalMode && !this.inConfigMode) {
                    await this.enterOperationalMode();
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
                error: error instanceof Error ? error.message : String(error)
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
                
                // Check for errors
                if (output.includes('Error:') || output.includes('Invalid syntax')) {
                    throw new Error(`Configuration command failed: ${command}. Output: ${output}`);
                }
            }

            // Exit configuration mode
            await this.exitConfigMode();

            // Clean up the output
            const cleanOutput = this.sanitizeOutput(allOutput, configCommands.join('\n'));

            return {
                command: configCommands.join('\n'),
                output: cleanOutput,
                success: true
            };
        } catch (error) {
            // Try to exit config mode if we're still in it
            if (this.inConfigMode) {
                try {
                    await this.exitConfigMode();
                } catch (exitError) {
                    // Ignore exit errors
                }
            }

            return {
                command: configCommands.join('\n'),
                output: '',
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    async commitConfig(comment?: string): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            // Ensure we're in operational mode
            if (!this.inOperationalMode) {
                await this.enterOperationalMode();
            }

            // Commit the configuration
            const commitCommand = comment ? `commit description "${comment}"` : 'commit';
            await this.writeChannel(commitCommand + this.newline);
            
            const output = await this.readUntilPrompt(undefined, 30000); // Longer timeout for commit
            
            // Check for commit success
            if (output.includes('Configuration committed successfully') || 
                output.includes('Configuration committed') ||
                output.includes('>')) {
                return {
                    command: commitCommand,
                    output: this.sanitizeOutput(output, commitCommand),
                    success: true
                };
            } else {
                throw new Error('Configuration commit failed');
            }
        } catch (error) {
            return {
                command: 'commit',
                output: '',
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    async getCurrentConfig(): Promise<CommandResult> {
        return this.sendCommand('show config running');
    }

    async saveConfig(): Promise<CommandResult> {
        return this.sendCommand('save config to running');
    }

    async rebootDevice(): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            // Ensure we're in operational mode
            if (!this.inOperationalMode) {
                await this.enterOperationalMode();
            }

            // Send reboot command
            await this.writeChannel('request restart system' + this.newline);
            
            // Wait for confirmation prompt
            const output = await this.readChannel(5000);
            
            if (output.includes('Reboot the system')) {
                // Confirm reboot
                await this.writeChannel('yes' + this.newline);
                const finalOutput = await this.readChannel(5000);
                
                return {
                    command: 'request restart system',
                    output: this.sanitizeOutput(finalOutput, 'request restart system'),
                    success: true
                };
            } else {
                throw new Error('Reboot command failed - no confirmation prompt received');
            }
        } catch (error) {
            return {
                command: 'request restart system',
                output: '',
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    protected sanitizeOutput(output: string, command: string): string {
        // Remove the command itself from the output
        let cleanOutput = output.replace(new RegExp(`^${command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'm'), '');
        
        // Remove common prompt patterns
        cleanOutput = cleanOutput.replace(/\r\n/g, '\n');
        cleanOutput = cleanOutput.replace(/\r/g, '\n');
        
        // Remove trailing prompt
        cleanOutput = cleanOutput.replace(/\n[^\n]*[>#$%]\s*$/m, '');
        
        // Remove leading/trailing whitespace
        cleanOutput = cleanOutput.trim();
        
        // Remove empty lines at the beginning and end
        cleanOutput = cleanOutput.replace(/^\n+/, '').replace(/\n+$/, '');
        
        return cleanOutput;
    }

    isInOperationalMode(): boolean {
        return this.inOperationalMode;
    }

    isInConfigMode(): boolean {
        return this.inConfigMode;
    }

    isInShellMode(): boolean {
        return this.inShellMode;
    }

    async enterShellMode(): Promise<void> {
        if (!this.inShellMode) {
            try {
                await this.writeChannel('debug cli on' + this.newline);
                const output = await this.readChannel(3000);
                
                if (output.includes('$') || output.includes('%')) {
                    this.inShellMode = true;
                    this.inOperationalMode = false;
                    this.inConfigMode = false;
                }
            } catch (error) {
                throw new Error(`Failed to enter shell mode: ${error}`);
            }
        }
    }

    async returnToOperationalMode(): Promise<void> {
        if (this.inShellMode) {
            try {
                await this.writeChannel('exit' + this.newline);
                const output = await this.readChannel(3000);
                
                if (output.includes('>') || output.includes('#')) {
                    this.inShellMode = false;
                    this.inOperationalMode = true;
                }
            } catch (error) {
                throw new Error(`Failed to return to operational mode: ${error}`);
            }
        }
    }
}