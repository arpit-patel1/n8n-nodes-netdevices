import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';
import { ConnectionDispatcher } from '../nodes/NetDevices/utils/index';

export class NetDevicesApi implements ICredentialType {
	name = 'netDevicesApi';
	displayName = 'Net Devices API';

	documentationUrl = 'https://github.com/arpit-patel1/n8n-nodes-netdevices';
	icon: Icon = 'file:netdevices-icon.svg';
	properties: INodeProperties[] = [
		{
			displayName: 'Hostname/IP',
			name: 'host',
			type: 'string',
			default: '',
			required: true,
			description: 'The hostname or IP address of the network device',
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			default: 22,
			required: true,
			description: 'The SSH port number (default: 22)',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'The username for SSH authentication',
		},
		{
			displayName: 'Authentication Method',
			name: 'authMethod',
			type: 'options',
			options: [
				{
					name: 'Password',
					value: 'password',
				},
				{
					name: 'SSH Private Key',
					value: 'privateKey',
				},
			],
			default: 'password',
			required: true,
			description: 'The authentication method to use for SSH connection',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			displayOptions: {
				show: {
					authMethod: ['password'],
				},
			},
			description: 'The password for SSH authentication',
		},
		{
			displayName: 'SSH Private Key',
			name: 'privateKey',
			type: 'string',
			typeOptions: { 
				password: true,
				rows: 5,
			},
			default: '',
			required: true,
			displayOptions: {
				show: {
					authMethod: ['privateKey'],
				},
			},
			description: 'The complete SSH private key content (paste the entire key including -----BEGIN and -----END lines)',
		},
		{
			displayName: 'Private Key Passphrase',
			name: 'passphrase',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: false,
			displayOptions: {
				show: {
					authMethod: ['privateKey'],
				},
			},
			description: 'The passphrase for the SSH private key (leave empty if no passphrase)',
		},
		{
			displayName: 'Device Type',
			name: 'deviceType',
			type: 'options',
			options: ConnectionDispatcher.getDeviceTypeOptions(),
			default: 'cisco_ios',
			required: true,
			description: 'The type of network device',
		},
		{
			displayName: 'Enable Password',
			name: 'enablePassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			displayOptions: {
				show: {
					deviceType: ['cisco_ios', 'cisco_ios_xe', 'cisco_nxos', 'cisco_asa'],
				},
			},
			description: 'The enable password for Cisco devices (optional, uses login password if not provided)',
		},
		{
			displayName: 'Connection Timeout',
			name: 'timeout',
			type: 'number',
			default: 30,
			description: 'Connection timeout in seconds (default: 30)',
		},
		{
			displayName: 'Keep Alive',
			name: 'keepAlive',
			type: 'boolean',
			default: true,
			description: 'Send keep-alive packets to maintain the connection',
		},
		{
			displayName: 'Use Jump Host',
			name: 'useJumpHost',
			type: 'boolean',
			default: false,
			description: 'Whether to connect through a jump host (bastion server)',
		},
		{
			displayName: 'Jump Host Hostname/IP',
			name: 'jumpHostHost',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { useJumpHost: [true] } },
			description: 'The hostname or IP address of the jump host',
		},
		{
			displayName: 'Jump Host Port',
			name: 'jumpHostPort',
			type: 'number',
			default: 22,
			required: true,
			displayOptions: { show: { useJumpHost: [true] } },
			description: 'The SSH port number for the jump host',
		},
		{
			displayName: 'Jump Host Username',
			name: 'jumpHostUsername',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { useJumpHost: [true] } },
			description: 'The username for jump host SSH authentication',
		},
		{
			displayName: 'Jump Host Authentication Method',
			name: 'jumpHostAuthMethod',
			type: 'options',
			options: [
				{ name: 'Password', value: 'password' },
				{ name: 'SSH Private Key', value: 'privateKey' },
			],
			default: 'password',
			required: true,
			displayOptions: { show: { useJumpHost: [true] } },
			description: 'The authentication method for jump host',
		},
		{
			displayName: 'Jump Host Password',
			name: 'jumpHostPassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			displayOptions: { show: { useJumpHost: [true], jumpHostAuthMethod: ['password'] } },
			description: 'The password for jump host SSH authentication',
		},
		{
			displayName: 'Jump Host SSH Private Key',
			name: 'jumpHostPrivateKey',
			type: 'string',
			typeOptions: { password: true, rows: 5 },
			default: '',
			required: true,
			displayOptions: { show: { useJumpHost: [true], jumpHostAuthMethod: ['privateKey'] } },
			description: 'The SSH private key for jump host authentication',
		},
		{
			displayName: 'Jump Host Private Key Passphrase',
			name: 'jumpHostPassphrase',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: false,
			displayOptions: { show: { useJumpHost: [true], jumpHostAuthMethod: ['privateKey'] } },
			description: 'The passphrase for jump host SSH private key (leave empty if no passphrase)',
		},
	];
}
