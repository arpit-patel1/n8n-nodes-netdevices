import { BaseConnection, DeviceCredentials } from './base-connection';
import { CiscoConnection, CiscoIOSXRConnection, CiscoSG300Connection } from './cisco';
import { JuniperConnection } from './juniper';
import { LinuxConnection } from './linux';
import { PaloAltoConnection } from './paloalto';
import { CienaSaosConnection } from './ciena';
import { FortinetConnection } from './fortinet';
import { EricssonConnection, EricssonMinilinkConnection } from './ericsson';
import { DeviceSpecificJumpHostConnection } from './device-specific-jump-host-connection';
import { VyosConnection } from './vyos';
import { HuaweiConnection } from './huawei';

export type SupportedDeviceType =
    | 'cisco_ios'
    | 'cisco_ios_xe'
    | 'cisco_ios_xr'
    | 'cisco_nxos'
    | 'cisco_asa'
    | 'cisco_sg300'
    | 'juniper_junos'
    | 'juniper_srx'
    | 'paloalto_panos'
    | 'ciena_saos'
    | 'fortinet_fortios'
    | 'ericsson_ipos'
    | 'ericsson_mltn'
    | 'linux'
    | 'generic'
    | 'vyos'
    | 'huawei_vrp';

export interface ConnectionClassMapping {
    [key: string]: typeof BaseConnection;
}

// Mapping of device types to connection classes
const CONNECTION_CLASS_MAPPING: ConnectionClassMapping = {
    'cisco_ios': CiscoConnection,
    'cisco_ios_xe': CiscoConnection,
    'cisco_ios_xr': CiscoIOSXRConnection,
    'cisco_nxos': CiscoConnection,
    'cisco_asa': CiscoConnection,
    'cisco_sg300': CiscoSG300Connection,
    'juniper_junos': JuniperConnection,
    'juniper_srx': JuniperConnection,
    'paloalto_panos': PaloAltoConnection,
    'ciena_saos': CienaSaosConnection,
    'fortinet_fortios': FortinetConnection,
    'ericsson_ipos': EricssonConnection,
    'ericsson_mltn': EricssonMinilinkConnection,
    'linux': LinuxConnection,
    'generic': BaseConnection,
    'vyos': VyosConnection,
    'huawei_vrp': HuaweiConnection,
};

export class ConnectionDispatcher {
    /**
     * Create a connection instance based on device type
     * @param credentials Device credentials including device type
     * @returns Connection instance
     */
    static createConnection(credentials: DeviceCredentials): BaseConnection {
        const deviceType = credentials.deviceType.toLowerCase();
        const ConnectionClass = CONNECTION_CLASS_MAPPING[deviceType];

        if (!ConnectionClass) {
            throw new Error(`Unsupported device type: ${deviceType}. Supported types: ${Object.keys(CONNECTION_CLASS_MAPPING).join(', ')}`);
        }

        // Create the device-specific connection instance first
        const deviceConnection = new ConnectionClass(credentials);

        // If jump host is required, wrap the device connection in a jump host connection
        if (credentials.useJumpHost && credentials.jumpHostHost && credentials.jumpHostPort && credentials.jumpHostUsername && credentials.jumpHostAuthMethod) {
            return new DeviceSpecificJumpHostConnection(credentials, deviceConnection);
        }
        
        // Otherwise, return the direct device connection
        return deviceConnection;
    }

    /**
     * Get list of supported device types
     * @returns Array of supported device types
     */
    static getSupportedDeviceTypes(): string[] {
        return Object.keys(CONNECTION_CLASS_MAPPING);
    }

    /**
     * Check if a device type is supported
     * @param deviceType Device type to check
     * @returns True if supported, false otherwise
     */
    static isDeviceTypeSupported(deviceType: string): boolean {
        return Object.keys(CONNECTION_CLASS_MAPPING).includes(deviceType.toLowerCase());
    }

    /**
     * Get device type display name for UI
     * @param deviceType Device type
     * @returns Display name
     */
    static getDeviceTypeDisplayName(deviceType: string): string {
        const displayNames: { [key: string]: string } = {
            'cisco_ios': 'Cisco IOS',
            'cisco_ios_xe': 'Cisco IOS-XE',
            'cisco_ios_xr': 'Cisco IOS-XR',
            'cisco_nxos': 'Cisco NX-OS',
            'cisco_asa': 'Cisco ASA',
            'cisco_sg300': 'Cisco SG300',
            'juniper_junos': 'Juniper JunOS',
            'juniper_srx': 'Juniper SRX',
            'paloalto_panos': 'Palo Alto PAN-OS',
            'ciena_saos': 'Ciena SAOS',
            'fortinet_fortios': 'Fortinet FortiOS',
            'ericsson_ipos': 'Ericsson IPOS',
            'ericsson_mltn': 'Ericsson MiniLink',
            'linux': 'Linux Server',
            'generic': 'Generic SSH',
            'vyos': 'VyOS',
            'huawei_vrp': 'Huawei VRP',
        };
        
        return displayNames[deviceType.toLowerCase()] || deviceType;
    }

    /**
     * Get device type options for n8n node configuration
     * @returns Array of device type options
     */
    static getDeviceTypeOptions(): Array<{ name: string; value: string; description: string }> {
        return [
            {
                name: 'Cisco IOS',
                value: 'cisco_ios',
                description: 'Cisco IOS routers and switches'
            },
            {
                name: 'Cisco IOS-XE',
                value: 'cisco_ios_xe',
                description: 'Cisco IOS-XE devices'
            },
            {
                name: 'Cisco IOS-XR',
                value: 'cisco_ios_xr',
                description: 'Cisco IOS-XR routers (service provider)'
            },
            {
                name: 'Cisco NX-OS',
                value: 'cisco_nxos',
                description: 'Cisco Nexus switches'
            },
            {
                name: 'Cisco ASA',
                value: 'cisco_asa',
                description: 'Cisco ASA firewalls'
            },
            {
                name: 'Cisco SG300',
                value: 'cisco_sg300',
                description: 'Cisco SG300 series switches'
            },
            {
                name: 'Juniper JunOS',
                value: 'juniper_junos',
                description: 'Juniper routers and switches'
            },
            {
                name: 'Juniper SRX',
                value: 'juniper_srx',
                description: 'Juniper SRX firewalls'
            },
            {
                name: 'Palo Alto PAN-OS',
                value: 'paloalto_panos',
                description: 'Palo Alto Networks firewalls'
            },
            {
                name: 'Ciena SAOS',
                value: 'ciena_saos',
                description: 'Ciena SAOS switches and platforms'
            },
            {
                name: 'Fortinet FortiOS',
                value: 'fortinet_fortios',
                description: 'Fortinet FortiOS firewalls and security appliances'
            },
            {
                name: 'Ericsson IPOS',
                value: 'ericsson_ipos',
                description: 'Ericsson IPOS devices'
            },
            {
                name: 'Ericsson MiniLink',
                value: 'ericsson_mltn',
                description: 'Ericsson MiniLink devices'
            },
            {
                name: 'Linux Server',
                value: 'linux',
                description: 'Linux servers and appliances'
            },
            {
                name: 'Generic SSH',
                value: 'generic',
                description: 'Generic SSH connection'
            },
            {
                name: 'VyOS',
                value: 'vyos',
                description: 'VyOS routers'
            },
            {
                name: 'Huawei VRP (NE series)',
                value: 'huawei_vrp',
                description: 'Huawei NE/AR/S series running VRP (incl. NE8000)',
              },
        ];
    }

    /**
     * Auto-detect device type based on SSH banner or initial response
     * @param credentials Device credentials
     * @returns Promise with detected device type or null if couldn't detect
     */
    static async autoDetectDeviceType(credentials: DeviceCredentials): Promise<string | null> {
        // Create a generic connection to probe the device
        const tempCredentials = { ...credentials, deviceType: 'generic' };
        const connection = new BaseConnection(tempCredentials);
        
        try {
            await connection.connect();
            
            // Send a return and read the response
            const response = await connection.sendCommand('');
            const output = response.output.toLowerCase();
            
            // Cisco detection patterns
            if (output.includes('cisco') || output.includes('ios') || output.includes('nx-os')) {
                if (output.includes('nx-os') || output.includes('nexus')) {
                    return 'cisco_nxos';
                } else if (output.includes('asa')) {
                    return 'cisco_asa';
                } else if (output.includes('ios-xr') || output.includes('iosxr')) {
                    return 'cisco_ios_xr';
                } else if (output.includes('ios-xe')) {
                    return 'cisco_ios_xe';
                } else if (output.includes('sg300') || output.includes('small business')) {
                    return 'cisco_sg300';
                } else {
                    return 'cisco_ios';
                }
            }
            
            // Juniper detection patterns
            if (output.includes('junos') || output.includes('juniper')) {
                if (output.includes('srx')) {
                    return 'juniper_srx';
                } else {
                    return 'juniper_junos';
                }
            }

            // Ciena detection patterns
            if (output.includes('ciena') || output.includes('saos')) {
                return 'ciena_saos';
            }
            
            // Fortinet detection patterns
            if (output.includes('fortinet') || output.includes('fortios') || 
                output.includes('fortigate')) {
                return 'fortinet_fortios';
            }
            
            // Palo Alto detection patterns
            if (output.includes('palo alto') || output.includes('pan-os') || 
                output.includes('panos') || output.includes('paloalto')) {
                return 'paloalto_panos';
            }

            // Ericsson detection patterns
            if (output.includes('ericsson') || output.includes('ipos')) {
                return 'ericsson_ipos';
            }
            if (output.includes('minilink')) {
                return 'ericsson_mltn';
            }

            // Linux detection patterns
            if (output.includes('linux') || output.includes('ubuntu') || 
                output.includes('centos') || output.includes('redhat') || 
                output.includes('debian') || output.includes('bash') ||
                output.includes('$') || output.includes('~')) {
                return 'linux';
            }

            if (
                output.includes('huawei') ||
                output.includes('vrp') ||
                output.includes('versatile routing platform') ||
                output.includes('ne8000')
              ) {
                return 'huawei_vrp';
              }
            
            return null; // Couldn't detect
            
        } catch (error) {
            return null; // Error during detection
        } finally {
            await connection.disconnect();
        }
    }
}

/**
 * Convenience function to create a connection - similar to Netmiko's ConnectHandler
 * @param credentials Device credentials
 * @returns Connection instance
 */
export function ConnectHandler(credentials: DeviceCredentials): BaseConnection {
    return ConnectionDispatcher.createConnection(credentials);
}

/**
 * Convenience function to create a connection with auto-detection
 * @param credentials Device credentials (deviceType will be auto-detected)
 * @returns Promise with connection instance
 */
export async function ConnectHandlerWithAutoDetect(credentials: Omit<DeviceCredentials, 'deviceType'>): Promise<BaseConnection> {
    const tempCredentials = { ...credentials, deviceType: 'generic' };
    const detectedType = await ConnectionDispatcher.autoDetectDeviceType(tempCredentials);
    
    if (!detectedType) {
        throw new Error('Could not auto-detect device type');
    }
    
    const finalCredentials = { ...credentials, deviceType: detectedType };
    return ConnectionDispatcher.createConnection(finalCredentials);
} 