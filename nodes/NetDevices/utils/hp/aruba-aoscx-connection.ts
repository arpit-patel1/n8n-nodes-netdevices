import { CiscoConnection } from '../cisco/cisco-connection';
import { DeviceCredentials, CommandResult } from '../base-connection';

/**
 * Aruba AOS-CX Connection Class
 * 
 * For use with Aruba AOS-CX switches (modern Aruba switching platform).
 * AOS-CX is different from Aruba OS (which is for wireless controllers).
 * 
 * Key characteristics:
 * - Uses carriage return (\r) as default line ending
 * - Modern CLI similar to Cisco but with some differences
 * - Uses "no page" command to disable paging
 * - Config mode prompt: "(config)#"
 * - Uses ANSI escape codes
 * - REST API available but SSH still commonly used
 */
export class ArubaAosCxConnection extends CiscoConnection {
    constructor(credentials: DeviceCredentials & { enablePassword?: string }) {
        super(credentials);
        // Aruba AOS-CX uses \r as default newline
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
            
            // Disable paging
            await this.disableAosCxPaging();
            
            // Check if we need to enter enable mode (AOS-CX may not require it)
            await this.checkAndEnterEnableMode();
        }
    }

    /**
     * Disable paging on Aruba AOS-CX devices
     * AOS-CX uses "no page" command
     */
    protected async disableAosCxPaging(): Promise<void> {
        try {
            await this.writeChannel('no page' + this.newline);
            await this.readChannel(2000);
        } catch (error) {
            // If this fails, it's not critical
            // console.log('Warning: Failed to disable paging');
        }
    }

    /**
     * Check if device is in configuration mode
     * AOS-CX uses "(config)#" as config prompt
     */
    protected async checkConfigMode(): Promise<boolean> {
        try {
            await this.writeChannel(this.returnChar);
            const output = await this.readChannel(2000);
            
            return output.includes('(config)#');
        } catch (error) {
            return false;
        }
    }

    /**
     * Enter configuration mode on AOS-CX
     * Note: "configure term" not "configure terminal" (auto-complete on space)
     */
    protected async enterConfigMode(): Promise<void> {
        // Check if already in config mode
        if (await this.checkConfigMode()) {
            this.inConfigMode = true;
            return;
        }

        // AOS-CX may not always require enable mode first, but try anyway
        if (!this.inEnableMode) {
            try {
                await this.enterEnableMode();
            } catch (error) {
                // If enable fails, continue - some AOS-CX configs don't need it
                // console.log('Info: Enable mode not required or failed, continuing...');
            }
        }
        
        try {
            // Use "configure term" - Aruba auto-completes on space
            await this.writeChannel('configure term' + this.newline);
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

    /**
     * Exit configuration mode
     */
    protected async exitConfigMode(): Promise<void> {
        if (!this.inConfigMode) {
            return;
        }
        
        try {
            // Try 'end' command first (preferred on AOS-CX)
            await this.writeChannel('end' + this.newline);
            const output = await this.readChannel(3000);
            
            if (output.includes('#') && !output.includes('(config)#')) {
                this.inConfigMode = false;
            } else {
                // Try 'exit' as fallback
                await this.writeChannel('exit' + this.newline);
                const output2 = await this.readChannel(3000);
                if (output2.includes('#') && !output2.includes('(config)#')) {
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
     * AOS-CX uses "write memory"
     */
    async saveConfig(): Promise<CommandResult> {
        return await this.sendCommand('write memory');
    }

    /**
     * Show interface status
     * AOS-CX-specific format
     */
    async showInterfaces(): Promise<CommandResult> {
        return await this.sendCommand('show interface brief');
    }

    /**
     * Show VLAN information
     * AOS-CX-specific format
     */
    async showVlans(): Promise<CommandResult> {
        return await this.sendCommand('show vlan');
    }

    /**
     * Show system information
     * AOS-CX-specific format
     */
    async showSystem(): Promise<CommandResult> {
        return await this.sendCommand('show system');
    }
}

