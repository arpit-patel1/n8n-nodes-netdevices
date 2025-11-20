import { BaseConnection, CommandResult } from '../base-connection';
import { NoEnable } from '../no-enable';

/**
 * Connection class for Versa Networks FlexVNF devices.
 * 
 * FlexVNF is Versa's SD-WAN/NFV platform running VOS (Versa Operating System).
 * It uses a commit-based configuration workflow similar to Juniper.
 * 
 * Key characteristics:
 * - May boot into shell mode, requires entering CLI mode
 * - Uses commit-based configuration
 * - No enable mode required
 * - Config mode indicated by "]" prompt
 */
class VersaFlexVNFConnectionBase extends BaseConnection {
	protected inConfigMode: boolean = false;

	/**
	 * Prepare the session for Versa FlexVNF devices.
	 */
	public async sessionPreparation(): Promise<void> {
		await this.createShellChannel();

		// Enter CLI mode if we're at a shell prompt
		await this.enterCliMode();

		await this.setBasePrompt();

		// Set terminal parameters
		await Promise.all([
			this.setTerminalWidth(),
			this.disablePaging(),
		]);
	}

	/**
	 * Override setTerminalWidth for FlexVNF.
	 */
	protected async setTerminalWidth(): Promise<void> {
		try {
			await this.writeChannel('set screen width 511' + this.newline);
			await this.readChannel(2000);
		} catch (error) {
			// If this fails, it's not critical
		}
	}

	/**
	 * Override disablePaging for FlexVNF.
	 */
	protected async disablePaging(): Promise<void> {
		try {
			await this.writeChannel('set screen length 0' + this.newline);
			await this.readChannel(2000);
		} catch (error) {
			// If this fails, it's not critical
		}
	}

	/**
	 * Check if at shell prompt and enter CLI mode if necessary.
	 * FlexVNF may boot into a shell prompt (admin@hostname or $) and requires
	 * entering CLI mode with the 'cli' command.
	 */
	private async enterCliMode(): Promise<void> {
		let attempts = 0;
		const maxAttempts = 50;

		while (attempts < maxAttempts) {
			await this.writeChannel(this.returnChar);
			
			// Small delay
			await new Promise(resolve => setTimeout(resolve, 100));

			const output = await this.readChannel(1000);

			// Check if we're at a shell prompt
			if (output.includes('admin@') || /\$\s*$/.test(output.trim())) {
				// Enter CLI mode
				await this.writeChannel('cli' + this.newline);
				
				// Wait before clearing
				await new Promise(resolve => setTimeout(resolve, 300));
				
				// Clear any remaining data from channel
				await this.readChannel(500);
				break;
			} else if (output.includes('>') || output.includes('%')) {
				// Already in CLI mode
				break;
			}

			attempts++;
		}
	}

	/**
	 * Check if the device is in configuration mode.
	 * FlexVNF uses "]" to indicate config mode.
	 */
	public async checkConfigMode(): Promise<boolean> {
		await this.writeChannel(this.returnChar);
		const output = await this.readChannel(2000);
		return output.includes(']');
	}

	/**
	 * Enter configuration mode.
	 */
	protected async enterConfigMode(): Promise<void> {
		if (await this.checkConfigMode()) {
			this.inConfigMode = true;
			return;
		}

		try {
			await this.writeChannel('configure' + this.newline);
			const output = await this.readUntilPrompt(undefined, 3000);

			if (!output.includes(']')) {
				throw new Error('Failed to enter configuration mode');
			}

			this.inConfigMode = true;
		} catch (error) {
			throw new Error(`Failed to enter configuration mode: ${error}`);
		}
	}

	/**
	 * Exit configuration mode.
	 */
	protected async exitConfigMode(): Promise<void> {
		if (!(await this.checkConfigMode())) {
			this.inConfigMode = false;
			return;
		}

		try {
			await this.writeChannel('exit configuration-mode' + this.newline);
			let output = await this.readChannel(3000);

			// Handle uncommitted changes
			if (output.includes('uncommitted changes')) {
				await this.writeChannel('yes' + this.newline);
				output = await this.readUntilPrompt(undefined, 3000);
			}

			if (await this.checkConfigMode()) {
				throw new Error('Failed to exit configuration mode');
			}

			this.inConfigMode = false;
		} catch (error) {
			throw new Error(`Failed to exit configuration mode: ${error}`);
		}
	}

	/**
	 * Commit the configuration with advanced options.
	 * 
	 * @param options - Commit options
	 * @param options.check - Validate configuration without committing
	 * @param options.confirm - Use commit confirmed (auto-rollback)
	 * @param options.confirmDelay - Delay in minutes for auto-rollback (requires confirm: true)
	 * @param options.comment - Add a comment to the commit
	 * @param options.andQuit - Exit config mode after commit
	 * @param options.timeout - Read timeout in milliseconds (default: 120000)
	 */
	public async commit(options: {
		check?: boolean;
		confirm?: boolean;
		confirmDelay?: number;
		comment?: string;
		andQuit?: boolean;
		timeout?: number;
	} = {}): Promise<string> {
		const {
			check = false,
			confirm = false,
			confirmDelay,
			comment = '',
			andQuit = false,
			timeout = 120000,
		} = options;

		// Validate arguments
		if (check && (confirm || confirmDelay || comment)) {
			throw new Error('Invalid arguments: cannot use check with confirm, confirmDelay, or comment');
		}

		if (confirmDelay && !confirm) {
			throw new Error('Invalid arguments: confirmDelay requires confirm to be true');
		}

		// Build command string
		let commandString = 'commit';
		let commitMarker = 'Commit complete.';

		if (check) {
			commandString = 'commit check';
			commitMarker = 'Validation complete';
		} else if (confirm) {
			if (confirmDelay) {
				commandString = `commit confirmed ${confirmDelay}`;
			} else {
				commandString = 'commit confirmed';
			}
			commitMarker = 'commit confirmed will be automatically rolled back in';
		}

		// Add comment if provided
		if (comment) {
			if (comment.includes('"')) {
				throw new Error('Invalid comment: contains double quote');
			}
			commandString += ` comment "${comment}"`;
		}

		// Add and-quit option
		if (andQuit) {
			commandString += ' and-quit';
		}

		try {
			// Enter config mode
			await this.enterConfigMode();

			// Execute commit
			await this.writeChannel(commandString + this.newline);

			let output: string;
			if (andQuit) {
				// and-quit exits config mode, so wait for base prompt
				output = await this.readUntilPrompt(this.basePrompt, timeout);
			} else {
				output = await this.readUntilPrompt(undefined, timeout);
			}

			// Check for commit success
			if (!output.includes(commitMarker)) {
				throw new Error(`Commit failed with the following errors:\n\n${output}`);
			}

			return this.stripFlexVNFContext(output);
		} catch (error) {
			throw new Error(`Failed to commit configuration: ${error}`);
		}
	}

	/**
	 * Send configuration commands.
	 * Overrides base implementation to handle FlexVNF specifics.
	 */
	public async sendConfig(configCommands: string[]): Promise<CommandResult> {
		try {
			// Ensure we're in config mode
			await this.enterConfigMode();

			let allOutput = '';
			let hasError = false;
			let errorMessage = '';
			
			// Send each configuration command
			for (const command of configCommands) {
				try {
					await this.writeChannel(command + this.newline);
					const output = await this.readUntilPrompt(undefined, this.timeout);
					allOutput += output;
					
					// Check for error patterns
					const errorPatterns = [
						/invalid command/i,
						/syntax error/i,
						/unknown command/i,
						/error:/i,
						/failed/i,
					];
					
					if (errorPatterns.some(pattern => pattern.test(output))) {
						hasError = true;
						errorMessage = `Error in command: ${command}`;
						break;
					}
				} catch (cmdError) {
					hasError = true;
					errorMessage = cmdError instanceof Error ? cmdError.message : 'Unknown error';
					break;
				}
			}

			// Clean output
			const cleanedOutput = this.stripFlexVNFContext(allOutput);

			return {
				command: configCommands.join('\n'),
				output: cleanedOutput,
				success: !hasError,
				error: hasError ? errorMessage : undefined,
			};
		} catch (error) {
			return {
				command: configCommands.join('\n'),
				output: '',
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Strip FlexVNF-specific context items from output.
	 * FlexVNF adds context markers like [edit], {master:0}, etc.
	 */
	private stripFlexVNFContext(output: string): string {
		const stringsToStrip = [
			/admin@[\w-]+\S*/g,        // admin@hostname
			/\[edit.*\]/g,             // [edit ...]
			/\[edit\]/g,               // [edit]
			/\[ok\]/g,                 // [ok]
			/\{master:.*\}/g,          // {master:0}
			/\{backup:.*\}/g,          // {backup:1}
			/\{line.*\}/g,             // {line ...}
			/\{primary.*\}/g,          // {primary:...}
			/\{secondary.*\}/g,        // {secondary:...}
		];

		let result = output;

		// Remove all matching patterns
		for (const pattern of stringsToStrip) {
			result = result.replace(pattern, '');
		}

		// Clean up extra whitespace and empty lines
		result = result
			.split('\n')
			.map(line => line.trim())
			.filter(line => line.length > 0)
			.join('\n');

		return result;
	}

	/**
	 * Save configuration (commit and save).
	 * FlexVNF uses commit for saving configuration.
	 */
	public async saveConfig(): Promise<any> {
		try {
			const output = await this.commit({ comment: 'Configuration saved via n8n' });
			
			return {
				command: 'commit',
				output: output,
				success: true,
			};
		} catch (error) {
			throw new Error(`Failed to save configuration: ${error}`);
		}
	}
}

export const VersaFlexVNFConnection = NoEnable(VersaFlexVNFConnectionBase);
