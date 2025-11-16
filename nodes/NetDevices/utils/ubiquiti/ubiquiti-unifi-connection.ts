import { UbiquitiEdgeSwitchConnection } from './ubiquiti-edgeswitch-connection';
import { DeviceCredentials } from '../base-connection';

/**
 * Ubiquiti UniFi Switch Connection Class
 * 
 * UniFi switches have a unique connection method:
 * - SSH initially connects to a Linux shell
 * - Must run "telnet localhost" to access the switch CLI
 * - Once in CLI, behaves like EdgeSwitch (Cisco-like)
 * - On disconnect, must exit the telnet session first
 * 
 * Key characteristics:
 * - Two-stage connection: SSH -> telnet localhost
 * - Initial prompt after telnet: "(UBNT) >"
 * - Then similar to EdgeSwitch CLI
 * - Config mode prompt: ")#"
 * - Requires enable mode
 */
export class UbiquitiUnifiSwitchConnection extends UbiquitiEdgeSwitchConnection {
    private inTelnetSession: boolean = false;

    constructor(credentials: DeviceCredentials & { enablePassword?: string }) {
        super(credentials);
    }

    public async sessionPreparation(): Promise<void> {
        // Create shell channel (starts in Linux shell)
        await this.createCiscoShellChannel();
        
        // Get the Linux prompt first
        await this.setBasePrompt();
        
        // Enter the switch CLI via telnet localhost
        await this.enterSwitchCli();
        
        if (this.fastMode) {
            // Fast mode: minimal setup
            await this.setBasePrompt();
        } else {
            // Standard mode: full setup
            await this.setBasePrompt();
            await this.checkAndEnterEnableMode();
            await this.disablePaging();
            
            // Small delay to clear buffer
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    /**
     * Enter the switch CLI via telnet localhost
     * This is unique to UniFi switches
     */
    private async enterSwitchCli(): Promise<void> {
        try {
            // Send telnet localhost command
            await this.writeChannel('telnet localhost' + this.newline);
            
            // Wait for the UBNT prompt: "(UBNT) >"
            const output = await this.readChannel(5000);
            
            if (output.includes('(UBNT)') || output.includes('>')) {
                this.inTelnetSession = true;
            } else {
                throw new Error('Failed to enter switch CLI. Expected (UBNT) prompt not found.');
            }
        } catch (error) {
            throw new Error(`Failed to telnet to switch CLI: ${error}`);
        }
    }

    /**
     * Exit the switch CLI (telnet session)
     * This should be done before disconnecting SSH
     */
    private async exitSwitchCli(): Promise<void> {
        if (!this.inTelnetSession) {
            return;
        }

        try {
            // Exit config mode if in it
            if (this.inConfigMode) {
                await this.exitConfigMode();
            }

            // Exit the telnet session
            await this.writeChannel('exit' + this.newline);
            await this.readChannel(2000);
            
            this.inTelnetSession = false;
        } catch (error) {
            // Log but don't throw - we're disconnecting anyway
            // console.log(`Failed to exit switch CLI: ${error}`);
        }
    }

    /**
     * Override disconnect to properly exit telnet session first
     */
    async disconnect(): Promise<void> {
        if (!this.isConnected) {
            return;
        }

        try {
            // Exit the telnet session first
            await this.exitSwitchCli();
        } catch (error) {
            // Ignore errors during disconnect
            // console.log(`Error exiting telnet session (ignoring): ${error}`);
        }

        // Now disconnect SSH
        await super.disconnect();
    }

    /**
     * Graceful cleanup
     */
    protected async cleanup(): Promise<void> {
        try {
            // Exit config mode if in it
            if (this.inConfigMode) {
                await this.exitConfigMode();
            }

            // Exit the telnet session
            await this.exitSwitchCli();
        } catch (error) {
            // Ignore cleanup errors
            // console.log(`Cleanup error (ignoring): ${error}`);
        }
    }
}

