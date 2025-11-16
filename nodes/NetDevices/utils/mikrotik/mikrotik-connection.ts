import { BaseConnection, DeviceCredentials, CommandResult } from '../base-connection';

/**
 * MikroTik RouterOS/SwitchOS Connection Class
 * 
 * MikroTik devices use a unique CLI that differs significantly from Cisco-like platforms.
 * Both RouterOS (for routers) and SwitchOS (for switches) share the same CLI characteristics.
 * 
 * Key characteristics:
 * - No enable mode required
 * - No configuration mode (changes are immediate)
 * - Unique prompt pattern: `[user@device] >`
 * - May prompt for software license acknowledgment on login
 * - Uses 'quit' command instead of 'exit'
 * - ANSI escape codes in output
 * - Can echo commands multiple times
 * - Terminal settings appended to username: +ct511w4098h
 *   (c=disable colors, t=dumb terminal, 511w=width, 4098h=height)
 */
export class MikrotikConnection extends BaseConnection {
    protected promptPattern: RegExp = /\].*>/;
    protected originalUsername: string;

    constructor(credentials: DeviceCredentials) {
        super(credentials);
        this.originalUsername = credentials.username;
        // MikroTik uses \r\n as newline
        this.newline = '\r\n';
    }

    /**
     * Modify username to include terminal settings
     * MikroTik accepts terminal parameters appended to username
     */
    protected modifyUsername(): string {
        // Append terminal settings to username
        // c: disable console colors
        // t: enable dumb terminal mode  
        // 511w: set terminal width
        // 4098h: set terminal height
        return `${this.originalUsername}+ct511w4098h`;
    }

    async connect(): Promise<void> {
        // Modify username before connection
        // Store original username and update credentials
        this.credentials.username = this.modifyUsername();
        
        // Call parent connect
        await super.connect();
        
        // Restore original username for display purposes
        this.credentials.username = this.originalUsername;
    }

    public async sessionPreparation(): Promise<void> {
        // Handle special login scenarios (license prompts)
        await this.handleSpecialLogin();
        
        // Set base prompt
        await this.setBasePrompt();
        
        // MikroTik doesn't have paging by default, no need to disable
    }

    /**
     * Handle special login prompts that MikroTik may display
     * - Software license prompt
     * - No license message
     */
    protected async handleSpecialLogin(): Promise<void> {
        try {
            // Wait a moment for any prompts
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const output = await this.readChannel(2000);
            
            // Check for "Please press Enter to continue" (no license message)
            if (output.includes('Please press "Enter" to continue')) {
                await this.writeChannel(this.returnChar);
                await this.readChannel(2000);
            }
            // Check for software license prompt
            else if (output.toLowerCase().includes('do you want to see the software license')) {
                await this.writeChannel('n' + this.newline);
                await this.readChannel(2000);
            }
        } catch (error) {
            // If no special prompts, continue
        }
    }

    protected async setBasePrompt(): Promise<void> {
        // Send a return to get the current prompt
        await this.writeChannel(this.returnChar);
        const output = await this.readChannel(3000);
        
        // Extract the base prompt from output
        // MikroTik prompt format: [user@device] >
        const lines = output.trim().split('\n');
        const lastLine = lines[lines.length - 1].trim();
        
        // Remove trailing '>' and whitespace
        this.basePrompt = lastLine.replace(/>\s*$/, '').trim();
    }

    async sendCommand(command: string): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            // Send the command
            await this.writeChannel(command + this.newline);
            
            // Wait for response
            const output = await this.readUntilPrompt(undefined, 10000);
            
            // Clean up the output (MikroTik specific)
            const cleanOutput = this.sanitizeMikrotikOutput(output, command);

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

    /**
     * MikroTik doesn't have traditional config mode
     * Commands are executed immediately and changes are live
     */
    async sendConfig(configCommands: string[]): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            let allOutput = '';
            
            // Send each command individually (no config mode)
            for (const command of configCommands) {
                const result = await this.sendCommand(command);
                if (!result.success) {
                    throw new Error(`Command failed: ${command} - ${result.error}`);
                }
                allOutput += result.output + '\n';
            }

            return {
                command: configCommands.join('; '),
                output: allOutput.trim(),
                success: true
            };

        } catch (error) {
            return {
                command: configCommands.join('; '),
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get system configuration
     * MikroTik uses 'export' command to show configuration
     */
    async getCurrentConfig(): Promise<CommandResult> {
        return await this.sendCommand('/export');
    }

    /**
     * Get system information
     */
    async getSystemInfo(): Promise<CommandResult> {
        return await this.sendCommand('/system resource print');
    }

    /**
     * Get RouterBoard information (hardware details)
     */
    async getRouterBoard(): Promise<CommandResult> {
        return await this.sendCommand('/system routerboard print');
    }

    /**
     * Save configuration
     * MikroTik changes are immediate, but can create backups
     */
    async saveConfig(): Promise<CommandResult> {
        // Create a backup of current configuration
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return await this.sendCommand(`/system backup save name=backup-${timestamp}`);
    }

    /**
     * Reboot the device
     */
    async rebootDevice(): Promise<CommandResult> {
        try {
            await this.writeChannel('/system reboot' + this.newline);
            
            // MikroTik will ask for confirmation
            let output = await this.readChannel(3000);
            
            // Check if asking for confirmation
            if (output.toLowerCase().includes('do you really want to reboot')) {
                await this.writeChannel('y' + this.newline);
                output += await this.readChannel(3000);
            }
            
            return {
                command: '/system reboot',
                output: output,
                success: true
            };
        } catch (error) {
            return {
                command: '/system reboot',
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Sanitize MikroTik output
     * MikroTik has special formatting and can echo commands multiple times
     */
    protected sanitizeMikrotikOutput(output: string, command: string): string {
        let lines = output.split('\n');
        
        // Remove command echo(es)
        // MikroTik can show: "[user@device] > command"
        lines = lines.filter(line => {
            const trimmed = line.trim();
            // Remove lines that are just the prompt + command
            if (trimmed.includes('] >') && trimmed.includes(command)) {
                return false;
            }
            return true;
        });

        // Remove the trailing prompt
        if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            if (lastLine.includes('] >') || this.promptPattern.test(lastLine)) {
                lines.pop();
            }
        }

        return lines.join('\n').trim();
    }

    /**
     * Disconnect from device
     * MikroTik uses 'quit' instead of 'exit'
     */
    async disconnect(): Promise<void> {
        if (!this.isConnected) {
            return;
        }

        try {
            // Send quit command
            await this.writeChannel('quit' + this.newline);
            await this.readChannel(1000);
        } catch (error) {
            // Ignore errors during disconnect
        } finally {
            // Close the connection
            await super.disconnect();
        }
    }
}

/**
 * MikroTik RouterOS Connection
 * For MikroTik routers running RouterOS
 */
export class MikrotikRouterOsConnection extends MikrotikConnection {
    // RouterOS uses the same implementation as base MikroTik
}

/**
 * MikroTik SwitchOS Connection  
 * For MikroTik switches running SwitchOS
 */
export class MikrotikSwitchOsConnection extends MikrotikConnection {
    // SwitchOS uses the same implementation as base MikroTik
}

