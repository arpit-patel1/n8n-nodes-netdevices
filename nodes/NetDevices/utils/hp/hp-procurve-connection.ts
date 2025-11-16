import { CiscoConnection } from '../cisco/cisco-connection';
import { DeviceCredentials, CommandResult } from '../base-connection';

/**
 * HP ProCurve Connection Class
 * 
 * HP ProCurve switches are similar to Cisco IOS but have several important differences:
 * - Often show "Press any key to continue" message after connection
 * - Require enable mode to disable paging
 * - Use "no page" instead of "terminal length 0"
 * - Config mode prompt uses ")#" instead of "(config)#"
 * - Logout may prompt to save configuration
 * - Use VT100 escape codes
 */
export class HPProcurveConnection extends CiscoConnection {
    constructor(credentials: DeviceCredentials & { enablePassword?: string }) {
        super(credentials);
        // HP ProCurve connections can be slower
        // Note: Connection timeout is handled in base connection
    }

    public async sessionPreparation(): Promise<void> {
        // Create shell channel
        await this.createCiscoShellChannel();
        
        if (this.fastMode) {
            // Fast mode: minimal setup
            await this.handleContinuePrompt();
            await this.setBasePrompt();
        } else {
            // Standard mode: full setup
            // Handle "Press any key to continue" prompt
            await this.handleContinuePrompt();
            
            await this.setBasePrompt();
            
            // HP ProCurve requires enable mode to disable paging
            await this.checkAndEnterEnableMode();
            
            // Now setup terminal
            await this.setTerminalWidth();
            await this.disableHPPaging();
        }
    }

    /**
     * Handle the "Press any key to continue" prompt that HP ProCurve shows
     */
    private async handleContinuePrompt(): Promise<void> {
        try {
            // Wait briefly to see if there's a continue prompt
            const output = await this.readChannel(2000);
            
            if (output.toLowerCase().includes('any key to continue')) {
                // Press any key to continue
                await this.writeChannel(this.returnChar);
                // Wait for prompt
                await this.readChannel(3000);
            }
        } catch (error) {
            // If this fails, it's not critical - device may not show this prompt
            // console.log('Info: No continue prompt detected');
        }
    }

    /**
     * Disable paging on HP ProCurve devices
     * HP ProCurve uses "no page" instead of "terminal length 0"
     */
    protected async disableHPPaging(): Promise<void> {
        try {
            await this.writeChannel('no page' + this.newline);
            await this.readChannel(2000);
        } catch (error) {
            // If this fails, it's not critical
            // console.log('Warning: Failed to disable paging');
        }
    }

    /**
     * Set terminal width for HP ProCurve devices
     */
    protected async setTerminalWidth(): Promise<void> {
        try {
            await this.writeChannel('terminal width 511' + this.newline);
            await this.readChannel(2000);
        } catch (error) {
            // If this fails, it's not critical
        }
    }

    /**
     * Check if device is in configuration mode
     * HP ProCurve uses ")#" as config prompt
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
     * Enter configuration mode on HP ProCurve
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
     * HP ProCurve uses "write memory"
     */
    async saveConfig(): Promise<CommandResult> {
        return await this.sendCommand('write memory');
    }

    /**
     * Graceful disconnect with logout
     * HP ProCurve may prompt to save configuration on logout
     */
    async disconnect(): Promise<void> {
        if (!this.isConnected) {
            return;
        }

        try {
            // Exit config mode if we're in it
            if (this.inConfigMode) {
                await this.exitConfigMode();
            }

            // Send logout command
            await this.writeChannel('logout' + this.newline);
            
            // Handle potential "Do you want to save" prompt
            let output = await this.readChannel(2000);
            
            if (output.toLowerCase().includes('do you want to save')) {
                // Answer 'n' to not save automatically
                await this.writeChannel('n' + this.newline);
                output = await this.readChannel(2000);
            }
            
            if (output.toLowerCase().includes('do you want to log out')) {
                // Confirm logout
                await this.writeChannel('y' + this.newline);
            }
        } catch (error) {
            // Ignore errors during disconnect
            // console.log(`Disconnect error (ignoring): ${error}`);
        } finally {
            // Close the connection
            await super.disconnect();
        }
    }
}

