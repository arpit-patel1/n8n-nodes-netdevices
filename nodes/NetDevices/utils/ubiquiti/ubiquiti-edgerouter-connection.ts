import { BaseConnection, DeviceCredentials, CommandResult } from '../base-connection';

/**
 * Ubiquiti EdgeRouter Connection Class
 * 
 * EdgeRouter runs EdgeOS, which is based on VyOS (which in turn is based on Vyatta).
 * Therefore, it uses a VyOS-like CLI with commit/save workflow.
 * 
 * Key characteristics:
 * - VyOS-based CLI
 * - Uses "configure" to enter config mode
 * - Config mode shows [edit] prompt
 * - Changes must be committed: "commit"
 * - Configuration saved with: "save" (responds with "Done")
 * - No enable mode required
 * - Uses standard Linux-style terminal commands
 */
export class UbiquitiEdgeRouterConnection extends BaseConnection {
    protected inConfigMode: boolean = false;

    constructor(credentials: DeviceCredentials) {
        super(credentials);
    }

    public async sessionPreparation(): Promise<void> {
        // Create shell channel
        await this.createShellChannel();
        
        if (this.fastMode) {
            // Fast mode: minimal setup
            await this.setBasePrompt();
        } else {
            // Standard mode: full setup
            await this.setBasePrompt();
            await this.setEdgeRouterTerminalWidth();
            await this.disableEdgeRouterPaging();
            
            // Small delay to clear buffer
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    /**
     * Set terminal width for EdgeRouter
     */
    protected async setEdgeRouterTerminalWidth(): Promise<void> {
        try {
            await this.writeChannel('terminal width 512' + this.newline);
            await this.readChannel(2000);
        } catch (error) {
            // If this fails, it's not critical
        }
    }

    /**
     * Disable paging for EdgeRouter
     */
    protected async disableEdgeRouterPaging(): Promise<void> {
        try {
            await this.writeChannel('terminal length 0' + this.newline);
            await this.readChannel(2000);
        } catch (error) {
            // If this fails, it's not critical
        }
    }

    /**
     * Enter configuration mode
     * EdgeRouter uses VyOS-style "configure" command
     */
    protected async enterConfigMode(): Promise<void> {
        if (this.inConfigMode) {
            return;
        }

        try {
            await this.writeChannel('configure' + this.newline);
            const output = await this.readChannel(3000);

            if (output.includes('[edit]')) {
                this.inConfigMode = true;
            } else {
                throw new Error('Failed to enter configuration mode');
            }
        } catch (error) {
            throw new Error(`Failed to enter configuration mode: ${error}`);
        }
    }

    /**
     * Exit configuration mode
     */
    protected async exitConfigMode(): Promise<void> {
        if (!this.inConfigMode) {
            return;
        }

        try {
            await this.writeChannel('exit' + this.newline);
            let output = await this.readChannel(3000);

            // If config was modified, may need to discard
            if (output.includes('Cannot exit: configuration modified')) {
                await this.writeChannel('exit discard' + this.newline);
                output = await this.readChannel(3000);
            }

            if (!output.includes('[edit]')) {
                this.inConfigMode = false;
            } else {
                throw new Error('Failed to exit configuration mode');
            }
        } catch (error) {
            throw new Error(`Failed to exit configuration mode: ${error}`);
        }
    }

    /**
     * Send configuration commands and commit
     */
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
                if (output.includes('Invalid') || output.includes('Error')) {
                    throw new Error(`Configuration error on command "${command}": ${output}`);
                }
            }
            
            // Commit the configuration
            await this.writeChannel('commit' + this.newline);
            const commitOutput = await this.readChannel(10000); // Commit can take time
            allOutput += commitOutput;
            
            if (commitOutput.includes('Failed to generate committed config') || 
                commitOutput.includes('Commit failed')) {
                throw new Error(`Commit failed: ${commitOutput}`);
            }
            
            // Exit configuration mode
            await this.exitConfigMode();
            
            return {
                command: configCommands.join('; '),
                output: this.sanitizeOutput(allOutput, configCommands.join('; ')),
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
                command: configCommands.join('; '),
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Save configuration
     * EdgeRouter uses "save" command which responds with "Done"
     */
    async saveConfig(): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            await this.writeChannel('save' + this.newline);
            const output = await this.readChannel(5000);
            
            if (!output.includes('Done')) {
                throw new Error(`Save failed with following errors:\n\n${output}`);
            }
            
            return {
                command: 'save',
                output: this.sanitizeOutput(output, 'save'),
                success: true
            };
        } catch (error) {
            return {
                command: 'save',
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get current configuration
     */
    async getCurrentConfig(): Promise<CommandResult> {
        return await this.sendCommand('show configuration');
    }

    /**
     * Show system information
     */
    async showSystem(): Promise<CommandResult> {
        return await this.sendCommand('show system');
    }

    /**
     * Show interfaces
     */
    async showInterfaces(): Promise<CommandResult> {
        return await this.sendCommand('show interfaces');
    }
}

