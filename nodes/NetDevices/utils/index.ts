// Base connection classes
export { BaseConnection, DeviceCredentials, CommandResult } from './base-connection';

// Vendor-specific connection classes
export { CiscoConnection, CiscoIOSXRConnection, CiscoSG300Connection } from './cisco';
export { JuniperConnection } from './juniper';
export { LinuxConnection } from './linux';
export { PaloAltoConnection } from './paloalto';

// Connection dispatcher and utilities
export { 
    ConnectionDispatcher, 
    ConnectHandler, 
    ConnectHandlerWithAutoDetect,
    SupportedDeviceType,
    ConnectionClassMapping 
} from './connection-dispatcher'; 