import { CiscoConnection } from '../cisco/cisco-connection';
import { DeviceCredentials, CommandResult } from '../base-connection';

/**
 * Dell EMC Networking OS10 Connection Class
 * 
 * Dell OS10 is Dell's modern, Linux-based network operating system for data center
 * and campus switches. It uses a Cisco-like CLI with some Dell-specific commands.
 * 
 * Key characteristics:
 * - Very similar to Cisco IOS CLI
 * - Linux-based OS (can execute system commands)
 * - Config mode prompt: ")#"
 * - Save config: "copy running-configuration startup-configuration"
 * - Supports both traditional CLI and Linux shell access
 * - Enable mode supported
 * - Standard terminal width and paging commands
 */
export class DellOS10Connection extends CiscoConnection {
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
            await this.setTerminalWidth();
            await this.disablePaging();
            
            // OS10 may not always require enable mode, but try if available
            try {
                await this.checkAndEnterEnableMode();
            } catch (error) {
                // If enable mode fails, continue - OS10 may not need it
            }
        }
    }

    /**
     * Check if device is in configuration mode
     * Dell OS10 uses ")#" as config prompt (same as many Cisco-like devices)
     */
    protected async checkConfigMode(): Promise<boolean> {
        try {
            await this.writeChannel(this.returnChar);
            const output = await this.readChannel(2000);
            
            return output.includes(')#');
        } catch (error) {
            return false;
        }
    }

    /**
     * Enter configuration mode
     */
    protected async enterConfigMode(): Promise<void> {
        // Check if already in config mode
        if (await this.checkConfigMode()) {
            this.inConfigMode = true;
            return;
        }

        // OS10 may not require enable mode, but ensure we're privileged
        if (!this.inEnableMode) {
            try {
                await this.enterEnableMode();
            } catch (error) {
                // Continue if enable mode not available
            }
        }
        
        try {
            await this.writeChannel('configure terminal' + this.newline);
            const output = await this.readChannel(3000);
            
            if (output.includes(')#')) {
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
            const output = await this.readChannel(3000);
            
            if (output.includes('#') && !output.includes(')#')) {
                this.inConfigMode = false;
            } else {
                throw new Error('Failed to exit configuration mode');
            }
        } catch (error) {
            throw new Error(`Failed to exit configuration mode: ${error}`);
        }
    }

    /**
     * Get running configuration
     */
    async getCurrentConfig(): Promise<CommandResult> {
        return await this.sendCommand('show running-configuration');
    }

    /**
     * Save configuration
     * Dell OS10 uses "copy running-configuration startup-configuration"
     */
    async saveConfig(): Promise<CommandResult> {
        return await this.sendCommand('copy running-configuration startup-configuration');
    }

    /**
     * Show system version
     */
    async showVersion(): Promise<CommandResult> {
        return await this.sendCommand('show version');
    }

    /**
     * Show interfaces
     */
    async showInterfaces(): Promise<CommandResult> {
        return await this.sendCommand('show interface');
    }

    /**
     * Show system inventory
     */
    async showInventory(): Promise<CommandResult> {
        return await this.sendCommand('show system');
    }

    /**
     * Execute Linux system command
     * Dell OS10 is Linux-based and supports system commands
     */
    async systemCommand(linuxCommand: string): Promise<CommandResult> {
        return await this.sendCommand(`system "${linuxCommand}"`);
    }

    /**
     * Reboot the device
     */
    async rebootDevice(): Promise<CommandResult> {
        try {
            await this.writeChannel('reload' + this.newline);
            
            // Wait for confirmation prompt
            let output = await this.readChannel(5000);
            
            // OS10 may ask for confirmation
            if (output.toLowerCase().includes('proceed') || output.includes('[confirm]')) {
                await this.writeChannel('yes' + this.newline);
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

    /**
     * Sanitize output - Dell OS10 behaves like Cisco
     */
    protected sanitizeOutput(output: string, command: string): string {
        const lines = output.split('\n');
        
        // Remove the command echo
        if (lines[0].includes(command)) {
            lines.shift();
        }

        // Remove the prompt from the last line
        if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            const promptRegex = new RegExp(`^${this.escapeRegex(this.basePrompt)}[>#$]`);
            if (promptRegex.test(lastLine) || lastLine.includes(')#')) {
                lines.pop();
            }
        }

        return lines.join('\n').trim();
    }
}

