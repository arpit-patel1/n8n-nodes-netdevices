import { CiscoConnection } from '../cisco/cisco-connection';
import { DeviceCredentials, CommandResult } from '../base-connection';

/**
 * Extreme Networks ExtremeXOS Connection Class
 * 
 * Designed for EXOS >= 15.0
 * ExtremeXOS is used on Extreme's data center and campus switches.
 * 
 * Key characteristics:
 * - No traditional configuration mode (changes are immediate)
 * - No enable mode required
 * - Unique prompt with incrementing ID: `hostname.1 #`, `hostname.2 #`, etc.
 * - Unsaved config shows `* ` prefix: `* hostname.4 #`
 * - Disable paging: `disable clipaging`
 * - Disable CLI prompting: `disable cli prompting`
 * - Save config: `save configuration primary`
 * - Similar to Cisco CLI but with key differences
 */
export class ExtremeExosConnection extends CiscoConnection {
    protected promptIdPattern: RegExp = /[\*\s]*(.*)\.\d+/;

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
            await this.setBasePrompt();
            await this.disableExosPaging();
            await this.disableExosPrompting();
        }
    }

    /**
     * Set base prompt for Extreme EXOS
     * 
     * Extreme attaches an incrementing ID to the prompt that needs to be stripped.
     * Examples:
     *   testhost.1 #
     *   testhost.2 #
     *   * testhost.3 #  (asterisk indicates unsaved config)
     */
    protected async setBasePrompt(): Promise<void> {
        // Get the current prompt
        await this.writeChannel(this.returnChar);
        const output = await this.readChannel(3000);
        
        const lines = output.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        
        // Remove trailing prompt terminator
        let prompt = lastLine.replace(/[>#$]\s*$/, '').trim();
        
        // Strip off any leading * or whitespace; strip off trailing period and digits
        // Match pattern: optional asterisk/whitespace, hostname, period, digits
        const match = prompt.match(this.promptIdPattern);
        if (match) {
            this.basePrompt = match[1];
        } else {
            // Fallback if pattern doesn't match
            this.basePrompt = prompt;
        }
    }

    /**
     * Disable paging on Extreme EXOS
     */
    protected async disableExosPaging(): Promise<void> {
        try {
            await this.writeChannel('disable clipaging' + this.newline);
            await this.readChannel(2000);
        } catch (error) {
            // If this fails, it's not critical
        }
    }

    /**
     * Disable CLI prompting on Extreme EXOS
     * This prevents confirmation prompts for commands
     */
    protected async disableExosPrompting(): Promise<void> {
        try {
            await this.writeChannel('disable cli prompting' + this.newline);
            await this.readChannel(2000);
        } catch (error) {
            // If this fails, it's not critical
        }
    }

    /**
     * Send command with Extreme-specific handling
     * Refreshes base prompt before sending command due to incrementing ID
     */
    async sendCommand(command: string): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            // Refresh base prompt (it increments with each command)
            await this.setBasePrompt();

            // Send the command
            await this.writeChannel(command + this.newline);
            
            // Wait for response
            const output = await this.readUntilPrompt(undefined, 10000);
            
            // Clean up the output
            const cleanOutput = this.sanitizeExosOutput(output, command);

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
     * Send configuration commands
     * EXOS doesn't have traditional config mode - changes are immediate
     */
    async sendConfig(configCommands: string[]): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            let allOutput = '';
            
            // Send each command individually (no config mode in EXOS)
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
     * Get current configuration
     */
    async getCurrentConfig(): Promise<CommandResult> {
        return await this.sendCommand('show configuration');
    }

    /**
     * Save configuration
     * EXOS uses "save configuration primary"
     */
    async saveConfig(): Promise<CommandResult> {
        return await this.sendCommand('save configuration primary');
    }

    /**
     * Show switch information
     */
    async showSwitch(): Promise<CommandResult> {
        return await this.sendCommand('show switch');
    }

    /**
     * Show system information
     */
    async showSystem(): Promise<CommandResult> {
        return await this.sendCommand('show version');
    }

    /**
     * Reboot the device
     */
    async rebootDevice(): Promise<CommandResult> {
        try {
            await this.writeChannel('reboot' + this.newline);
            
            // EXOS may ask for confirmation if prompting is enabled
            const output = await this.readChannel(3000);
            
            return {
                command: 'reboot',
                output: output,
                success: true
            };
        } catch (error) {
            return {
                command: 'reboot',
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Sanitize Extreme EXOS output
     * Remove command echo and prompts with incrementing IDs
     */
    protected sanitizeExosOutput(output: string, command: string): string {
        const lines = output.split('\n');
        
        // Remove the command echo (first line usually)
        if (lines.length > 0 && lines[0].includes(command)) {
            lines.shift();
        }

        // Remove the trailing prompt (which includes the incremented ID)
        if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            // Match prompt with incrementing ID: "hostname.123 #" or "* hostname.123 #"
            if (this.promptIdPattern.test(lastLine) || lastLine.includes('#') || lastLine.includes('>')) {
                lines.pop();
            }
        }

        return lines.join('\n').trim();
    }
}

