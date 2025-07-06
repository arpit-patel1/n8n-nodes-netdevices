# n8n-nodes-netdevices

A TypeScript-based n8n custom node that provides Netmiko-like functionality for managing network devices via SSH. This node allows you to interact with network infrastructure including Cisco and Juniper routers, switches, and Linux servers directly from n8n workflows.

## Features

- **Multi-vendor support**: Cisco IOS/IOS-XE/NX-OS/ASA, Juniper JunOS/SRX, and Linux servers
- **Secure SSH connections**: Uses the ssh2 library for reliable and secure connections
- **Vendor-specific handling**: Automatically handles device-specific behaviors like enable mode, configuration mode, and command prompts
- **TypeScript implementation**: Full TypeScript support with proper typing and error handling
- **Modular architecture**: Clean separation between base functionality and vendor-specific implementations

## Supported Device Types

### Cisco Platforms
- **Cisco IOS**: Traditional Cisco routers and switches
- **Cisco IOS-XE**: Modern Cisco devices running IOS-XE
- **Cisco IOS-XR**: Service provider routers with commit-based configuration
- **Cisco NX-OS**: Cisco Nexus data center switches
- **Cisco ASA**: Cisco ASA firewall appliances
- **Cisco SG300**: Small business switch series

### Other Vendors
- **Juniper JunOS**: Juniper routers and switches
- **Juniper SRX**: Juniper SRX firewall series
- **Linux**: Linux servers and network appliances
- **Generic**: Basic SSH connection for other devices

## Operations

### Send Command
Send a single command to the device and receive the output.
- **Use case**: Running show commands, getting device status
- **Example**: `show version`, `show interfaces`, `show ip route`

### Send Config
Send multiple configuration commands to the device.
- **Use case**: Configuring interfaces, VLANs, routing protocols
- **Example**: 
  ```
  interface GigabitEthernet1/0/1
  description Test Interface
  no shutdown
  ```

### Get Running Config
Retrieve the current running configuration from the device.
- **Use case**: Backup configurations, compliance checking

### Save Config
Save the current configuration to startup/persistent storage.
- **Use case**: Making configuration changes permanent

### Reboot Device
Restart the network device.
- **Use case**: Applying configuration changes that require a reboot

## Installation

1. Install the node package:
   ```bash
   npm install n8n-nodes-netdevices
   ```

2. Restart n8n to load the new node.

## Configuration

### Credentials
The node uses the "Net Devices API" credential type with the following fields:

- **Hostname/IP**: The IP address or hostname of the device
- **Port**: SSH port (default: 22)
- **Username**: SSH username
- **Password**: SSH password
- **Device Type**: Select from supported device types
- **Enable Password**: (Cisco only) Password for privileged mode
- **Connection Timeout**: Connection timeout in seconds
- **Keep Alive**: Whether to send keep-alive packets

### Advanced Options
- **Command Timeout**: Timeout for individual commands
- **Auto Disconnect**: Whether to disconnect after execution
- **Retry Count**: Number of connection retry attempts

## Usage Examples

### Basic Command Execution
```json
{
  "operation": "sendCommand",
  "command": "show version"
}
```

### Configuration Changes
```json
{
  "operation": "sendConfig",
  "configCommands": "interface Loopback102\ndescription ***TEST LOOPBACK 102****\nipv4 address 1.1.1.102 255.255.255.255"
}
```

```
interface Loopback102
description ***TEST LOOPBACK 102****
ipv4 address 1.1.1.102 255.255.255.255
```

```
no interface Loopback102
```

### Safe, No-Impact Config Examples (Add & Remove)

These examples are safe to use for testing and demo purposes. Each example shows how to add a test object (like a loopback, VLAN, or dummy interface) and how to remove it, so you can easily clean up after testing.

#### Cisco IOS/IOS-XE
**Add Loopback Interface**
```json
{
  "operation": "sendConfig",
  "configCommands": "interface Loopback123\ndescription n8n test loopback\nip address 10.123.123.123 255.255.255.255"
}
```
**Remove Loopback Interface**
```json
{
  "operation": "sendConfig",
  "configCommands": "no interface Loopback123"
}
```
**Add Dummy VLAN**
```json
{
  "operation": "sendConfig",
  "configCommands": "vlan 1234\nname n8n_test_vlan"
}
```
**Remove Dummy VLAN**
```json
{
  "operation": "sendConfig",
  "configCommands": "no vlan 1234"
}
```

#### Cisco IOS-XR
**Add Loopback Interface**
```json
{
  "operation": "sendConfig",
  "configCommands": "interface Loopback123\ndescription n8n test loopback\nipv4 address 10.123.123.123 255.255.255.255"
}
```
**Remove Loopback Interface**
```json
{
  "operation": "sendConfig",
  "configCommands": "no interface Loopback123"
}
```

#### Cisco SG300
**Add VLAN**
```json
{
  "operation": "sendConfig",
  "configCommands": "vlan database\nvlan 1234\nexit"
}
```
**Remove VLAN**
```json
{
  "operation": "sendConfig",
  "configCommands": "vlan database\nno vlan 1234\nexit"
}
```

#### Juniper JunOS
**Add Loopback Interface**
```json
{
  "operation": "sendConfig",
  "configCommands": "set interfaces lo0 unit 123 description \"n8n test loopback\"\nset interfaces lo0 unit 123 family inet address 10.123.123.123/32"
}
```
**Remove Loopback Interface**
```json
{
  "operation": "sendConfig",
  "configCommands": "delete interfaces lo0 unit 123"
}
```
**Add Dummy VLAN**
```json
{
  "operation": "sendConfig",
  "configCommands": "set vlans n8n-test-vlan vlan-id 1234"
}
```
**Remove Dummy VLAN**
```json
{
  "operation": "sendConfig",
  "configCommands": "delete vlans n8n-test-vlan"
}
```

#### Linux
**Add Dummy Network Interface (iproute2)**
```json
{
  "operation": "sendConfig",
  "configCommands": "sudo ip link add n8n-dummy0 type dummy\nsudo ip link set n8n-dummy0 up"
}
```
**Remove Dummy Network Interface**
```json
{
  "operation": "sendConfig",
  "configCommands": "sudo ip link set n8n-dummy0 down\nsudo ip link delete n8n-dummy0"
}
```

#### Generic SSH Device
**Add a Test File**
```json
{
  "operation": "sendConfig",
  "configCommands": "touch /tmp/n8n_testfile"
}
```
**Remove Test File**
```json
{
  "operation": "sendConfig",
  "configCommands": "rm -f /tmp/n8n_testfile"
}
```

### Get Device Configuration
```json
{
  "operation": "getRunningConfig"
}
```

### Platform-Specific Examples

#### Cisco IOS-XR VLAN Configuration
```json
{
  "operation": "sendConfig",
  "configCommands": "interface GigabitEthernet0/0/0/1\nencapsulation dot1q 100\nipv4 address 192.168.100.1/24\nno shutdown"
}
```

#### Cisco SG300 VLAN Creation
```json
{
  "operation": "sendConfig", 
  "configCommands": "vlan database\nvlan 100\nvlan name 100 \"Production_VLAN\"\nexit\ninterface gi1\nswitchport mode access\nswitchport access vlan 100"
}
```

## Architecture

The node is built with a modular architecture inspired by Python's Netmiko library, organized using vendor-specific directories:

### Directory Structure

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
└── linux/                     # Linux vendor implementation
    ├── linux-connection.ts
    └── index.ts
```

### Core Components

- **BaseConnection**: Core SSH functionality and common methods
- **CiscoConnection**: Cisco IOS/IOS-XE/NX-OS/ASA handling (enable mode, prompts)
- **CiscoIOSXRConnection**: Cisco IOS-XR specific handling (commit-based config)
- **CiscoSG300Connection**: Cisco SG300 series specific handling
- **JuniperConnection**: Juniper-specific handling (CLI mode, commit)
- **LinuxConnection**: Linux server management
- **ConnectionDispatcher**: Factory for creating appropriate connection types

### Adding New Vendors

See [VENDOR_GUIDE.md](VENDOR_GUIDE.md) for detailed instructions on adding support for new network device vendors following the established patterns.

## Error Handling

The node includes comprehensive error handling:
- Connection failures with retry logic
- Command execution errors
- Device-specific error detection
- Graceful disconnection on errors

## Development

### Prerequisites
- Node.js 18+
- TypeScript
- n8n development environment

### Building
```bash
npm install
npm run build
```

### Linting
```bash
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and build checks
6. Submit a pull request

## License

MIT License - see LICENSE.md for details

## Acknowledgments

This project was inspired by the Python Netmiko library and aims to bring similar functionality to the Node.js/TypeScript ecosystem for use with n8n automation workflows.
