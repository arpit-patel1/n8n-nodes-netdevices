import { CiscoConnection } from '../cisco/cisco-connection';
import { DeviceCredentials, CommandResult } from '../base-connection';

/**
 * Arista EOS Connection Class
 * 
 * Arista EOS devices are very similar to Cisco IOS, so we extend CiscoConnection.
 * However, there are some key differences in terminal setup and behavior.
 * 
 * Key Differences from Cisco IOS:
 * - Terminal width command: "terminal width 511"
 * - Pagination disable: confirms with "Pagination disabled"
 * - Prompt pattern can include $ in addition to # and >
 * - May duplicate command echo if device falls behind
 * - In config mode, may show (s1) or (s2) in prompt
 * - Has bash shell access via "bash" command
 */
export class AristaConnection extends CiscoConnection {
    protected promptPattern: RegExp = /[$>#]/;

    constructor(credentials: DeviceCredentials & { enablePassword?: string }) {
        super(credentials);
    }

    public async sessionPreparation(): Promise<void> {
        // Create shell channel
        await this.createCiscoShellChannel();
        
        if (this.fastMode) {
            // Fast mode: minimal setup
            await this.setBasePrompt();
        } else {
            // Standard mode: full setup
            // Arista-specific terminal setup
            await this.setAristaTerminalWidth();
            await this.disableAristaPaging();
            
            await this.setBasePrompt();
            
            // Check if we need to enter enable mode
            await this.checkAndEnterEnableMode();
        }
    }

    /**
     * Set terminal width for Arista devices
     * Arista uses "terminal width 511" and responds with "Width set to"
     */
    protected async setAristaTerminalWidth(): Promise<void> {
        try {
            await this.writeChannel('terminal width 511' + this.newline);
            const output = await this.readChannel(2000);
            
            // Arista should respond with "Width set to 511"
            if (!output.includes('Width set to')) {
                // Not critical, continue anyway
                // console.log('Warning: Terminal width may not have been set correctly');
            }
        } catch (error) {
            // If this fails, it's not critical
            // console.log('Warning: Failed to set terminal width');
        }
    }

    /**
     * Disable pagination for Arista devices
     * Arista responds with "Pagination disabled"
     */
    protected async disableAristaPaging(): Promise<void> {
        try {
            await this.writeChannel('terminal length 0' + this.newline);
            const output = await this.readChannel(2000);
            
            // Arista should respond with "Pagination disabled"
            if (!output.includes('Pagination disabled')) {
                // Not critical, continue anyway
                // console.log('Warning: Pagination may not have been disabled correctly');
            }
        } catch (error) {
            // If this fails, it's not critical
            // console.log('Warning: Failed to disable pagination');
        }
    }

    /**
     * Check if device is in configuration mode
     * Arista may show (s1) or (s2) in the prompt which needs to be handled
     */
    protected async checkConfigMode(): Promise<boolean> {
        try {
            await this.writeChannel(this.returnChar);
            let output = await this.readChannel(2000);
            
            // Remove Arista-specific prompt artifacts (s1) or (s2)
            output = output.replace(/\(s1\)/g, '');
            output = output.replace(/\(s2\)/g, '');
            
            return output.includes('(config)#');
        } catch (error) {
            return false;
        }
    }

    /**
     * Enter configuration mode on Arista device
     * Override to handle Arista-specific prompt patterns
     */
    protected async enterConfigMode(): Promise<void> {
        // Check if already in config mode
        if (await this.checkConfigMode()) {
            this.inConfigMode = true;
            return;
        }

        if (!this.inEnableMode) {
            await this.enterEnableMode();
        }
        
        try {
            await this.writeChannel('configure terminal' + this.newline);
            const output = await this.readChannel(3000);
            
            // Remove (s1)/(s2) before checking
            const cleanOutput = output.replace(/\(s1\)/g, '').replace(/\(s2\)/g, '');
            
            if (cleanOutput.includes('(config)#')) {
                this.inConfigMode = true;
            } else {
                throw new Error('Failed to enter configuration mode');
            }
        } catch (error) {
            throw new Error(`Failed to enter configuration mode: ${error}`);
        }
    }

    /**
     * Find the current prompt
     * Arista sometimes duplicates the command echo if they fall behind, so we need to be careful
     */
    async findPrompt(): Promise<string> {
        try {
            await this.writeChannel(this.returnChar);
            const output = await this.readChannel(2000);
            
            const lines = output.trim().split('\n');
            const lastLine = lines[lines.length - 1].trim();
            
            return lastLine;
        } catch (error) {
            return '';
        }
    }

    /**
     * Enter Bash shell on Arista device
     * Arista EOS provides access to underlying Linux system
     */
    async enterBashShell(): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            await this.writeChannel('bash' + this.newline);
            const output = await this.readChannel(3000);
            
            return {
                command: 'bash',
                output: output,
                success: true
            };
        } catch (error) {
            return {
                command: 'bash',
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Exit Bash shell and return to CLI
     */
    async exitBashShell(): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            await this.writeChannel('exit' + this.newline);
            const output = await this.readChannel(3000);
            
            return {
                command: 'exit',
                output: output,
                success: true
            };
        } catch (error) {
            return {
                command: 'exit',
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get Arista version information in JSON format
     * Arista EOS supports native JSON output for many commands
     */
    async getVersionJson(): Promise<CommandResult> {
        return await this.sendCommand('show version | json');
    }

    /**
     * Get running configuration
     * Arista uses the same command as Cisco
     */
    async getCurrentConfig(): Promise<CommandResult> {
        return await this.sendCommand('show running-config');
    }

    /**
     * Save configuration
     * Arista uses "write" or "write memory"
     */
    async saveConfig(): Promise<CommandResult> {
        return await this.sendCommand('write memory');
    }

    /**
     * Reboot the Arista device
     */
    async rebootDevice(): Promise<CommandResult> {
        try {
            // Send reload command
            await this.writeChannel('reload now' + this.newline);
            
            // Wait for confirmation or response
            const output = await this.readChannel(5000);
            
            return {
                command: 'reload now',
                output: output,
                success: true
            };
        } catch (error) {
            return {
                command: 'reload now',
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Sanitize output - handle Arista-specific quirks
     * Arista may duplicate command echo if device falls behind
     */
    protected sanitizeOutput(output: string, command: string): string {
        const lines = output.split('\n');
        
        // Remove duplicate command echoes (Arista-specific issue)
        let cleanLines = lines.filter((line, index) => {
            // If this line matches the command and the previous line also matched, skip it
            if (index > 0 && line.trim() === command.trim() && lines[index - 1].trim() === command.trim()) {
                return false;
            }
            return true;
        });

        // Remove the first command echo
        if (cleanLines.length > 0 && cleanLines[0].includes(command)) {
            cleanLines.shift();
        }

        // Remove the prompt from the last line
        if (cleanLines.length > 0) {
            const lastLine = cleanLines[cleanLines.length - 1];
            // Remove (s1) or (s2) before checking for prompt
            const cleanLastLine = lastLine.replace(/\(s1\)/g, '').replace(/\(s2\)/g, '');
            const promptRegex = new RegExp(`^${this.escapeRegex(this.basePrompt)}[>#$]`);
            if (promptRegex.test(cleanLastLine)) {
                cleanLines.pop();
            }
        }

        return cleanLines.join('\n').trim();
    }
}

