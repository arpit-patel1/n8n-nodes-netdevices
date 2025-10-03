# n8n-nodes-netdevices

A powerful, TypeScript-based n8n custom node for managing network devices via SSH. Inspired by Python's Netmiko, this node brings robust network automation capabilities to your n8n workflows, allowing you to interact with a wide range of network infrastructure directly.

## Key Features

-   **Multi-Vendor Support**: Manage devices from Cisco, Juniper, Palo Alto, Fortinet, Ericsson, and more.
-   **Secure Connections**: Utilizes the battle-tested `ssh2` library for secure and reliable SSH sessions.
-   **Flexible Authentication**: Supports both password and SSH key-based authentication, including passphrase-protected keys.
-   **Jump Host Support**: Securely connect to devices in enterprise environments through bastion servers.
-   **Intelligent Operation**: Automatically handles vendor-specific behaviors like enable modes, configuration prompts, and paging.
-   **Performance Optimized**: Features connection pooling, fast mode, and optimized SSH algorithms for high-speed execution.
-   **Modular & Extensible**: Built with a clean, modular architecture that makes it easy to add support for new vendors.

## Supported Platforms

The node supports a wide variety of network operating systems across multiple vendors.

| Vendor | Platform | Description |
| :--- | :--- | :--- |
| **Cisco** | `Cisco IOS` | Traditional Cisco routers and switches. |
| | `Cisco IOS-XE` | Modern Cisco devices running the IOS-XE platform. |
| | `Cisco IOS-XR` | Service provider routers with a commit-based configuration model. |
| | `Cisco NX-OS` | Cisco Nexus data center switches. |
| | `Cisco ASA` | Cisco ASA firewall appliances. |
| | `Cisco SG300` | Small business switch series. |
| **Juniper** | `Juniper JunOS` | Juniper routers and switches. |
| | `Juniper SRX` | Juniper SRX series firewalls. |
| **Palo Alto** | `Palo Alto PAN-OS` | Palo Alto Networks firewalls (PA-series, VM-series). |
| **Fortinet** | `Fortinet FortiGate` | Fortinet FortiGate firewalls and security appliances. |
| **Ericsson** | `Ericsson IPOS` | Ericsson IPOS-based devices. |
| | `Ericsson MiniLink`| Ericsson's microwave radio systems. |
| **VyOS** | `VyOS` | Open-source router and firewall platform. |
| **Huawei** | `Huawei VRP` | Huawei routers |
| **Linux** | `Linux` | Standard Linux servers and network appliances. |
| **Generic** | `Generic` | A basic SSH connection for other compatible devices. |

## Core Operations

The node provides a set of core operations to manage your network devices.

| Operation | Description | Use Case |
| :--- | :--- | :--- |
| **Send Command** | Executes a single command and returns the output. | Running `show` commands, checking device status. |
| **Send Config** | Applies a set of configuration commands. | Configuring interfaces, VLANs, routing protocols. |
| **Get Running Config**| Retrieves the device's current running configuration. | Backing up configurations, performing compliance checks. |
| **Save Config** | Saves the running configuration to persistent storage. | Making configuration changes permanent. |
| **Reboot Device** | Restarts the network device. | Applying updates or changes that require a reboot. |

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

## Development & Contribution

This project is open to contributions. If you'd like to add support for a new vendor or improve the existing functionality, please see the following guides:

-   [How to Add a New Vendor](VENDOR_GUIDE.md)
-   [Contribution Guidelines](CONTRIBUTING.md)

## License

This project is licensed under the MIT License. See the [LICENSE.md](LICENSE.md) file for details.
