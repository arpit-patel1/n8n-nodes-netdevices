import { CiscoConnection } from '../cisco/cisco-connection';
import { DeviceCredentials, CommandResult } from '../base-connection';

/**
 * Aruba OS Connection Class
 * 
 * For use with Aruba OS Mobility Controllers (not AOS-CX switches).
 * Aruba OS is the operating system for Aruba wireless LAN controllers.
 * 
 * Key characteristics:
 * - Uses carriage return (\r) as default line ending
 * - Has auto-complete on space which can be problematic
 * - Requires enable mode to disable paging
 * - Uses "no paging" command
 * - Config mode prompt: "(<controller-name>) (config) #"
 * - Uses ANSI escape codes
 */
export class ArubaOsConnection extends CiscoConnection {
    constructor(credentials: DeviceCredentials & { enablePassword?: string }) {
        super(credentials);
        // Aruba OS uses \r as default newline
        this.newline = '\r';
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
            
            // Aruba requires enable mode to disable paging
            await this.checkAndEnterEnableMode();
            
            // Disable paging after entering enable mode
            await this.disableArubaPaging();
        }
    }

    /**
     * Disable paging on Aruba OS devices
     * Aruba uses "no paging" command
     */
    protected async disableArubaPaging(): Promise<void> {
        try {
            await this.writeChannel('no paging' + this.newline);
            await this.readChannel(2000);
        } catch (error) {
            // If this fails, it's not critical
            // console.log('Warning: Failed to disable paging');
        }
    }

    /**
     * Check if device is in configuration mode
     * Aruba OS uses "(<controller-name>) (config) #" as config prompt
     */
    protected async checkConfigMode(): Promise<boolean> {
        try {
            await this.writeChannel(this.returnChar);
            const output = await this.readChannel(2000);
            
            return output.includes('(config) #');
        } catch (error) {
            return false;
        }
    }

    /**
     * Enter configuration mode on Aruba OS
     * Note: "configure term" not "configure terminal" (auto-complete on space)
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
            // Use "configure term" - Aruba auto-completes on space
            await this.writeChannel('configure term' + this.newline);
            const output = await this.readChannel(3000);
            
            if (output.includes('(config) #')) {
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
            
            if (output.includes('#') && !output.includes('(config) #')) {
                this.inConfigMode = false;
            } else {
                // Try 'end' command as alternative
                await this.writeChannel('end' + this.newline);
                const output2 = await this.readChannel(3000);
                if (output2.includes('#') && !output2.includes('(config) #')) {
                    this.inConfigMode = false;
                } else {
                    throw new Error('Failed to exit configuration mode');
                }
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
     * Aruba OS uses "write memory"
     */
    async saveConfig(): Promise<CommandResult> {
        return await this.sendCommand('write memory');
    }

    /**
     * Show wireless access points
     * Aruba-specific command
     */
    async showAccessPoints(): Promise<CommandResult> {
        return await this.sendCommand('show ap database');
    }

    /**
     * Show wireless clients
     * Aruba-specific command
     */
    async showClients(): Promise<CommandResult> {
        return await this.sendCommand('show user-table');
    }

    /**
     * Show controller configuration (brief)
     * Aruba-specific command
     */
    async showController(): Promise<CommandResult> {
        return await this.sendCommand('show switches');
    }
}

