# Adding New Vendors to n8n-nodes-netdevices

This guide explains how to add support for new network device vendors to the n8n-nodes-netdevices package. The structure follows the proven Netmiko library pattern, organized by vendor-specific directories.

## Directory Structure

The vendor structure is organized as follows:

```
nodes/NetDevices/utils/
├── base-connection.ts          # Core SSH functionality
├── connection-dispatcher.ts    # Factory for creating connections
├── index.ts                   # Main exports
├── cisco/                     # Cisco vendor implementation
│   ├── cisco-connection.ts
│   └── index.ts
├── juniper/                   # Juniper vendor implementation
│   ├── juniper-connection.ts
│   └── index.ts
├── paloalto/                  # Palo Alto Networks implementation
│   ├── paloalto-connection.ts
│   └── index.ts
└── linux/                     # Linux vendor implementation
    ├── linux-connection.ts
    └── index.ts
```

## Steps to Add a New Vendor

### 1. Create Vendor Directory

Create a new directory for your vendor under `nodes/NetDevices/utils/`:

```bash
cd nodes/NetDevices/utils
mkdir arista
```

### 2. Create Connection Class

Create the main connection class file (e.g., `arista/arista-connection.ts`):

```typescript
import { BaseConnection, DeviceCredentials, CommandResult } from '../base-connection';

export class AristaConnection extends BaseConnection {
    constructor(credentials: DeviceCredentials) {
        super(credentials);
    }

    protected async sessionPreparation(): Promise<void> {
        // Create shell channel
        await this.createAristaShellChannel();
        
        // Set terminal width
        await this.setTerminalWidth();
        
        // Disable paging
        await this.disablePaging();
        
        // Set base prompt
        await this.setBasePrompt();
    }

    private async createAristaShellChannel(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client.shell((err, channel) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.currentChannel = channel;
                this.currentChannel.setEncoding(this.encoding);
                
                // Wait a bit for the channel to be ready
                global.setTimeout(() => {
                    resolve();
                }, 1000);
            });
        });
    }

    protected async setTerminalWidth(): Promise<void> {
        try {
            await this.writeChannel('terminal width 511' + this.newline);
            await this.readChannel(2000);
        } catch (error) {
            // If this fails, it's not critical
        }
    }

    protected async disablePaging(): Promise<void> {
        try {
            await this.writeChannel('terminal length 0' + this.newline);
            await this.readChannel(2000);
        } catch (error) {
            // If this fails, it's not critical
        }
    }

    // Override vendor-specific methods as needed
    async getCurrentConfig(): Promise<CommandResult> {
        return await this.sendCommand('show running-config');
    }

    async saveConfig(): Promise<CommandResult> {
        return await this.sendCommand('write memory');
    }

    async rebootDevice(): Promise<CommandResult> {
        try {
            await this.writeChannel('reload' + this.newline);
            let output = await this.readChannel(5000);
            
            if (output.includes('[confirm]')) {
                await this.writeChannel(this.newline);
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

    protected sanitizeOutput(output: string, command: string): string {
        // Remove the command echo
        let cleanOutput = output.replace(new RegExp(command, 'g'), '');
        
        // Remove Arista-specific prompts and artifacts
        cleanOutput = cleanOutput.replace(new RegExp(this.basePrompt + '[>#$%]', 'g'), '');
        
        // Remove extra whitespace and newlines
        cleanOutput = cleanOutput.replace(/^\s+|\s+$/g, '');
        cleanOutput = cleanOutput.replace(/\r\n/g, '\n');
        cleanOutput = cleanOutput.replace(/\r/g, '\n');
        cleanOutput = cleanOutput.replace(/\n\s*\n/g, '\n');
        
        return cleanOutput;
    }
}
```

### 3. Create Vendor Index File

Create `arista/index.ts` to export the connection class:

```typescript
export { AristaConnection } from './arista-connection';

export const __all__ = ['AristaConnection'];
```

### 4. Update Connection Dispatcher

Add your new vendor to `connection-dispatcher.ts`:

```typescript
// Add import
import { AristaConnection } from './arista';

// Add to supported device types
export type SupportedDeviceType = 
    | 'cisco_ios'
    | 'cisco_ios_xe'
    | 'cisco_nxos'
    | 'cisco_asa'
    | 'juniper_junos'
    | 'juniper_srx'
    | 'linux'
    | 'arista_eos'    // Add here
    | 'generic';

// Add to connection class mapping
const CONNECTION_CLASS_MAPPING: ConnectionClassMapping = {
    'cisco_ios': CiscoConnection,
    'cisco_ios_xe': CiscoConnection,
    'cisco_nxos': CiscoConnection,
    'cisco_asa': CiscoConnection,
    'juniper_junos': JuniperConnection,
    'juniper_srx': JuniperConnection,
    'linux': LinuxConnection,
    'arista_eos': AristaConnection,    // Add here
    'generic': BaseConnection
};

// Add to device type options (in getDeviceTypeOptions method)
{
    name: 'Arista EOS',
    value: 'arista_eos',
    description: 'Arista switches running EOS'
},

// Add to display names (in getDeviceTypeDisplayName method)
'arista_eos': 'Arista EOS',

// Add detection patterns (in autoDetectDeviceType method)
if (output.includes('arista') || output.includes('eos')) {
    return 'arista_eos';
}
```

### 5. Update Main Index

Add your vendor export to `utils/index.ts`:

```typescript
// Vendor-specific connection classes
export { CiscoConnection } from './cisco';
export { JuniperConnection } from './juniper';
export { LinuxConnection } from './linux';
export { AristaConnection } from './arista';  // Add here
```

### 6. Test Your Implementation

Build and test your new vendor support:

```bash
npm run build
npm run lint
```

## Required Methods

Your vendor class should support the following methods (most can be inherited from BaseConnection):

### Core Methods
- `constructor(credentials: DeviceCredentials)`
- `connect(): Promise<void>`
- `disconnect(): Promise<void>`
- `sendCommand(command: string): Promise<CommandResult>`
- `sendConfig(commands: string[]): Promise<CommandResult>`

### Vendor-Specific Methods
- `sessionPreparation(): Promise<void>` - Setup after connection
- `setTerminalWidth(): Promise<void>` - Configure terminal width
- `disablePaging(): Promise<void>` - Disable command paging
- `getCurrentConfig(): Promise<CommandResult>` - Get running config
- `saveConfig(): Promise<CommandResult>` - Save configuration
- `rebootDevice(): Promise<CommandResult>` - Restart device

### Helper Methods
- `sanitizeOutput(output: string, command: string): string` - Clean command output
- `enterConfigMode(): Promise<void>` - Enter configuration mode (if applicable)
- `exitConfigMode(): Promise<void>` - Exit configuration mode (if applicable)

## Design Principles

1. **Inherit from BaseConnection**: Reuse as much functionality as possible
2. **Override only what's necessary**: Only implement vendor-specific behaviors
3. **Handle errors gracefully**: Always provide meaningful error messages
4. **Follow naming conventions**: Use consistent method and property names
5. **Add proper TypeScript types**: Ensure type safety throughout

## Testing

When adding a new vendor:

1. Test basic connectivity
2. Test command execution
3. Test configuration commands
4. Test error handling
5. Test auto-detection (if applicable)
6. Verify prompt handling and output sanitization

## Common Vendor Differences

Different vendors may require handling for:

- **Prompts**: Different prompt formats (#, >, $, etc.)
- **Enable mode**: Some require privileged mode access
- **Configuration mode**: Different commands to enter/exit config
- **Paging**: Different commands to disable output paging
- **Terminal settings**: Different width/length commands
- **Command syntax**: Vendor-specific command formats
- **Error patterns**: Different error message formats

## Cisco Platform Implementations

The project includes comprehensive Cisco platform support with specialized classes:

### CiscoConnection (cisco-connection.ts)
- **Supports**: IOS, IOS-XE, NX-OS, ASA
- **Features**: Enable mode, configuration mode, error handling
- **Use Cases**: Traditional routers, switches, firewalls

### CiscoIOSXRConnection (cisco-ios-xr-connection.ts)
- **Supports**: IOS-XR platform
- **Features**: Commit-based configuration, service provider features
- **Use Cases**: Service provider routers, high-end routing platforms

### CiscoSG300Connection (cisco-sg300-connection.ts)
- **Supports**: SG300 series switches
- **Features**: Small business switch management
- **Use Cases**: Small business networking equipment

### PaloAltoConnection (paloalto-connection.ts)
- **Supports**: PAN-OS firewalls, PA-VM virtual firewalls
- **Features**: Operational and configuration modes, commit-based configuration
- **Use Cases**: Enterprise firewalls, security appliances
- **Special Handling**: 
  - Operational mode detection and management
  - Configuration mode with commit workflow
  - Shell mode support for advanced operations

## Example Vendors to Add

Some vendors that could be added following this pattern:

- **Arista EOS**: Similar to Cisco IOS
- **HP/HPE**: ProCurve and Comware variants
- **F5**: BIG-IP load balancers
- **Fortinet**: FortiGate firewalls
- **Mikrotik**: RouterOS devices
- **Extreme Networks**: Various switch families

## Implemented Vendors

The following vendors are currently supported:

- **Cisco**: IOS, IOS-XE, IOS-XR, NX-OS, ASA, SG300
- **Juniper**: JunOS, SRX
- **Palo Alto Networks**: PAN-OS, PA-VM
- **Linux**: Generic Linux servers and appliances

## References

- [Python Netmiko Vendor Guide](https://ktbyers.github.io/netmiko/VENDOR.html)
- [Multi-vendor Python Examples](https://github.com/JulioPDX/multi-vendor-python)
- [SSH2 TypeScript Documentation](https://github.com/mscdex/ssh2) 