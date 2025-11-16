# n8n-nodes-netdevices

![npm version](https://img.shields.io/npm/v/n8n-nodes-netdevices)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Network Coverage](https://img.shields.io/badge/Market_Coverage-73%25-brightgreen)
![Vendors](https://img.shields.io/badge/Vendors-13+-blue)

A powerful, TypeScript-based n8n custom node for managing network devices via SSH. Inspired by Python's Netmiko, this node brings robust network automation capabilities to your n8n workflows, allowing you to interact with a wide range of network infrastructure directly.

**🎉 Now supports Arista, HP, Aruba, and Ubiquiti - covering ~73% of production network devices!**

---

## Table of Contents
- [Key Features](#key-features)
- [Supported Platforms](#supported-platforms)
- [Core Operations](#core-operations)
- [Vendor-Specific Capabilities](#vendor-specific-capabilities)
- [Installation](#installation)
- [Configuration](#configuration)
- [Quick Start Examples](#quick-start-examples)
- [Use Case Scenarios](#use-case-scenarios)

---

## Key Features

-   **Extensive Multi-Vendor Support**: Manage devices from Cisco, Arista, Juniper, HP, Aruba, Ubiquiti, Palo Alto, Fortinet, Ericsson, and more - covering **~73% of network devices** in production.
-   **Secure Connections**: Utilizes the battle-tested `ssh2` library for secure and reliable SSH sessions.
-   **Flexible Authentication**: Supports both password and SSH key-based authentication, including passphrase-protected keys.
-   **Jump Host Support**: Securely connect to devices in enterprise environments through bastion servers.
-   **Intelligent Operation**: Automatically handles vendor-specific behaviors like enable modes, configuration prompts, and paging.
-   **Performance Optimized**: Features connection pooling, fast mode, and optimized SSH algorithms for high-speed execution.
-   **Modular & Extensible**: Built with a clean, modular architecture that makes it easy to add support for new vendors.

## Supported Platforms

The node supports a wide variety of network operating systems across multiple vendors, covering the majority of network equipment in production environments.

### Data Center & Enterprise Core

| Vendor | Platform | Description |
| :--- | :--- | :--- |
| **Cisco** | `Cisco IOS` | Traditional Cisco routers and switches. |
| | `Cisco IOS-XE` | Modern Cisco devices running the IOS-XE platform. |
| | `Cisco IOS-XR` | Service provider routers with a commit-based configuration model. |
| | `Cisco NX-OS` | Cisco Nexus data center switches. |
| | `Cisco ASA` | Cisco ASA firewall appliances. |
| | `Cisco SG300` | Small business switch series. |
| **Arista** 🆕 | `Arista EOS` | Arista EOS data center switches (leaf-spine, cloud-scale deployments). |
| **Juniper** | `Juniper JunOS` | Juniper routers and switches. |
| | `Juniper SRX` | Juniper SRX series firewalls. |

### Enterprise Campus & Wireless

| Vendor | Platform | Description |
| :--- | :--- | :--- |
| **HP** 🆕 | `HP ProCurve` | HP ProCurve switches (legacy campus switching). |
| **Aruba** 🆕 | `Aruba OS` | Aruba OS Mobility Controllers (wireless LAN controllers). |
| | `Aruba AOS-CX` | Aruba AOS-CX switches (modern campus switching platform). |

### SMB, Branch & ISP

| Vendor | Platform | Description |
| :--- | :--- | :--- |
| **Ubiquiti** 🆕 | `Ubiquiti EdgeSwitch` | EdgeSwitch series (Cisco-like switches). |
| | `Ubiquiti EdgeRouter` | EdgeRouter series with EdgeOS (VyOS-based routing). |
| | `Ubiquiti UniFi Switch` | UniFi managed switches. |
| **VyOS** | `VyOS` | Open-source router and firewall platform. |

### Security & Firewalls

| Vendor | Platform | Description |
| :--- | :--- | :--- |
| **Palo Alto** | `Palo Alto PAN-OS` | Palo Alto Networks firewalls (PA-series, VM-series). |
| **Fortinet** | `Fortinet FortiOS` | Fortinet FortiGate firewalls and security appliances. |

### Service Provider & Telecom

| Vendor | Platform | Description |
| :--- | :--- | :--- |
| **Ericsson** | `Ericsson IPOS` | Ericsson IPOS-based service provider devices. |
| | `Ericsson MiniLink` | Ericsson's microwave radio systems. |
| **Huawei** | `Huawei VRP` | Huawei NE/AR/S series routers (including NE8000). |
| **Ciena** | `Ciena SAOS` | Ciena SAOS switches and carrier ethernet platforms. |

### General Purpose

| Vendor | Platform | Description |
| :--- | :--- | :--- |
| **Linux** | `Linux` | Standard Linux servers and network appliances. |
| **Generic** | `Generic SSH` | Basic SSH connection for other compatible devices. |

> 🆕 **Latest Update**: Added support for Arista EOS, HP ProCurve, Aruba (OS & AOS-CX), and Ubiquiti (EdgeSwitch, EdgeRouter, UniFi) - expanding coverage to ~73% of network devices in production!

## Core Operations

The node provides a set of core operations to manage your network devices.

| Operation | Description | Use Case |
| :--- | :--- | :--- |
| **Send Command** | Executes a single command and returns the output. | Running `show` commands, checking device status. |
| **Send Config** | Applies a set of configuration commands. | Configuring interfaces, VLANs, routing protocols. |
| **Get Running Config**| Retrieves the device's current running configuration. | Backing up configurations, performing compliance checks. |
| **Save Config** | Saves the running configuration to persistent storage. | Making configuration changes permanent. |
| **Reboot Device** | Restarts the network device. | Applying updates or changes that require a reboot. |

## Vendor-Specific Capabilities

### 🆕 Arista EOS
Perfect for modern data center automation:
- **JSON Output**: Native support for `show version | json` and other structured commands
- **Bash Shell Access**: Execute Linux commands via `bash` for advanced troubleshooting
- **High Performance**: Optimized for leaf-spine architectures and cloud-scale deployments
- **Use Cases**: Data center fabric automation, EVPN/VXLAN configuration, streaming telemetry setup

### 🆕 HP ProCurve
Legacy campus switch management made easy:
- **Automatic Prompt Handling**: Manages "Press any key to continue" prompts
- **Safe Logout**: Handles save configuration prompts during disconnect
- **Enable Mode Support**: Full support for privileged exec mode
- **Use Cases**: Campus network maintenance, configuration backups, VLAN management

### 🆕 Aruba OS (Mobility Controllers)
Wireless infrastructure automation:
- **Controller Management**: Configure mobility controllers and masters
- **AP Operations**: View and manage access points with `show ap database`
- **Client Monitoring**: Track wireless clients with `show user-table`
- **Use Cases**: Wireless network provisioning, AP configuration, client troubleshooting

### 🆕 Aruba AOS-CX
Modern campus switching:
- **Latest Platform**: Support for Aruba's next-generation switching OS
- **Flexible Authentication**: Works with or without enable mode
- **API-Ready**: Complements REST API automation with CLI access
- **Use Cases**: Campus modernization, VSX configuration, network segmentation

### 🆕 Ubiquiti EdgeSwitch
Cost-effective SMB switching:
- **Cisco-Like CLI**: Familiar commands for easy adoption
- **Smart Save**: Handles confirmation prompts automatically
- **SMB Focus**: Perfect for small-medium business deployments
- **Use Cases**: Branch office automation, SMB network management, MSP deployments

### 🆕 Ubiquiti EdgeRouter
VyOS-based routing for ISPs and enterprises:
- **Commit-Based**: Vyatta/VyOS workflow with commit and save
- **EdgeOS Support**: Full support for EdgeRouter's operating system
- **Configuration Management**: Rollback-capable configuration changes
- **Use Cases**: ISP CPE automation, branch routing, BGP configuration

### 🆕 Ubiquiti UniFi Switch
Managed switching for UniFi ecosystems:
- **Dual-Stage Access**: Automatically handles SSH → telnet localhost connection
- **UniFi Integration**: Works alongside UniFi controller automation
- **Simplified Management**: Perfect for UniFi network deployments
- **Use Cases**: UniFi network automation, VLAN provisioning, port configuration

## Installation

1.  **Install the Package**:
    ```bash
    npm install n8n-nodes-netdevices
    ```
2.  **Restart n8n**:
    Restart your n8n instance to load the new node.

## Configuration

The node uses the "Net Devices API" credential type, which includes fields for the device's hostname, port, username, and authentication details. It also includes advanced options for connection timeouts, jump hosts, and performance tuning.

For detailed guides on advanced configuration, please see:
-   [Jump Host Configuration Guide](JUMP_HOST_GUIDE.md)
-   [Performance Optimization Guide](PERFORMANCE_OPTIMIZATION_GUIDE.md)

## Quick Start Examples

### Arista EOS - Get Structured Data
```javascript
// Use Arista's native JSON output
{
  "operation": "sendCommand",
  "deviceType": "arista_eos",
  "command": "show version | json"
}
// Returns structured JSON data instead of text
```

### Ubiquiti EdgeRouter - Configuration with Commit
```javascript
// EdgeRouter uses commit-based configuration
{
  "operation": "sendConfig",
  "deviceType": "ubiquiti_edgerouter",
  "commands": [
    "set interfaces ethernet eth0 description 'WAN Link'",
    "set interfaces ethernet eth0 address dhcp",
    "commit",
    "save"
  ]
}
```

### Aruba Wireless - Monitor APs
```javascript
// Get access point status from Aruba controller
{
  "operation": "sendCommand",
  "deviceType": "aruba_os",
  "command": "show ap database"
}
```

### HP ProCurve - VLAN Configuration
```javascript
// Configure VLANs on HP ProCurve switches
{
  "operation": "sendConfig",
  "deviceType": "hp_procurve",
  "commands": [
    "vlan 100",
    "name Engineering",
    "untagged 1-24"
  ]
}
```

## Use Case Scenarios

### 🏢 Data Center Automation (Arista)
Automate Arista leaf-spine fabrics:
- Deploy EVPN/VXLAN configurations across spine switches
- Configure BGP peering for underlay networks
- Retrieve JSON-formatted operational data for monitoring
- Execute Linux commands for advanced diagnostics

### 🏫 Campus Network Management (HP/Aruba)
Manage enterprise campus networks:
- Provision VLANs across HP ProCurve access switches
- Configure Aruba AOS-CX distribution switches
- Monitor wireless clients on Aruba controllers
- Backup configurations across mixed HP/Aruba environments

### 🏪 SMB & Branch Automation (Ubiquiti)
Deploy and manage branch networks:
- Configure EdgeRouter BGP for multi-site connectivity
- Provision VLANs on EdgeSwitch and UniFi switches
- Mass-deploy configurations to multiple sites
- MSP multi-tenant management

## Device Type Auto-Detection

The node includes intelligent auto-detection for most platforms:

```javascript
// Automatically detects device type
const detectedType = await autoDetectDeviceType(credentials);

// Supports detection for:
// - Cisco (IOS, IOS-XE, IOS-XR, NX-OS, ASA)
// - Arista EOS
// - Juniper JunOS
// - HP ProCurve
// - Aruba (OS, AOS-CX)
// - Ubiquiti (EdgeRouter, EdgeSwitch, UniFi)
// - Palo Alto PAN-OS
// - Fortinet FortiOS
// - And more...
```

## Development & Contribution

This project is open to contributions. If you'd like to add support for a new vendor or improve the existing functionality, please see the following guides:

-   [How to Add a New Vendor](VENDOR_GUIDE.md)
-   [Contribution Guidelines](CONTRIBUTING.md)

## License

This project is licensed under the MIT License. See the [LICENSE.md](LICENSE.md) file for details.
