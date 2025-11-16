import { CiscoConnection } from '../cisco/cisco-connection';
import { DeviceCredentials, CommandResult } from '../base-connection';

/**
 * Ubiquiti EdgeSwitch Connection Class
 * 
 * Implements support for Ubiquiti EdgeSwitch devices.
 * EdgeSwitch mostly conforms to Cisco IOS style syntax with minor changes.
 * 
 * Key characteristics:
 * - Similar to Cisco IOS CLI
 * - Uses "configure" instead of "configure terminal"
 * - Config mode prompt: ")#"
 * - Save config may prompt: "Are you sure you want to save? (y/n)"
 * - Requires enable mode
 * 
 * Note: This is NOT for EdgeRouter devices (those use VyOS-based CLI).
 */
export class UbiquitiEdgeSwitchConnection extends CiscoConnection {
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
            await this.checkAndEnterEnableMode();
            await this.setBasePrompt(); // Set prompt again after enable
            await this.setTerminalWidth();
            await this.disablePaging();
            
            // Small delay to clear buffer
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    /**
     * Check if device is in configuration mode
     * EdgeSwitch uses ")#" as config prompt
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
     * Enter configuration mode on EdgeSwitch
     * EdgeSwitch uses "configure" not "configure terminal"
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
            await this.writeChannel('configure' + this.newline);
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
     * Get current configuration
     */
    async getCurrentConfig(): Promise<CommandResult> {
        return await this.sendCommand('show running-config');
    }

    /**
     * Save configuration
     * EdgeSwitch may prompt: "Are you sure you want to save? (y/n)"
     */
    async saveConfig(): Promise<CommandResult> {
        try {
            if (!this.isConnected || !this.currentChannel) {
                throw new Error('Not connected to device');
            }

            // Make sure we're in enable mode
            if (!this.inEnableMode) {
                await this.enterEnableMode();
            }

            // Send write memory command
            await this.writeChannel('write memory' + this.newline);
            
            // Wait for response - may be prompt or confirmation
            let output = await this.readChannel(5000);
            
            // Check if asking for confirmation
            if (output.toLowerCase().includes('are you sure')) {
                // Respond with 'y'
                await this.writeChannel('y' + this.newline);
                const additionalOutput = await this.readChannel(5000);
                output += additionalOutput;
            }
            
            return {
                command: 'write memory',
                output: this.sanitizeOutput(output, 'write memory'),
                success: true
            };
        } catch (error) {
            return {
                command: 'write memory',
                output: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Exit enable mode
     */
    async exitEnableMode(): Promise<CommandResult> {
        try {
            if (!this.inEnableMode) {
                return {
                    command: 'exit',
                    output: 'Already in user mode',
                    success: true
                };
            }

            await this.writeChannel('exit' + this.newline);
            const output = await this.readChannel(3000);
            
            this.inEnableMode = false;
            
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
}

