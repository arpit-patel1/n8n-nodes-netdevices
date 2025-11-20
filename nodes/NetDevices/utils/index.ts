// Base connection classes
export { BaseConnection, DeviceCredentials, CommandResult, JumpHostConfig } from './base-connection';

// Vendor-specific connection classes
export { CiscoConnection, CiscoIOSXRConnection, CiscoSG300Connection } from './cisco';
export { JuniperConnection } from './juniper';
export { LinuxConnection } from './linux';
export { PaloAltoConnection } from './paloalto';
export { CienaSaosConnection } from './ciena';
export { FortinetConnection } from './fortinet';
export { EricssonConnection, EricssonMinilinkConnection } from './ericsson';
export { VyosConnection } from './vyos';
export { HuaweiConnection } from './huawei';
export { VersaFlexVNFConnection } from './versa';

// Jump host connection
export { JumpHostConnection } from './jump-host-connection';

// Connection dispatcher and utilities
export { 
    ConnectionDispatcher, 
    ConnectHandler, 
    ConnectHandlerWithAutoDetect,
    SupportedDeviceType,
    ConnectionClassMapping 
} from './connection-dispatcher'; 