import { BaseConnection, DeviceCredentials, CommandResult } from '../base-connection';

export class HuaweiConnection extends BaseConnection {
  constructor(credentials: DeviceCredentials) {
    super(credentials);
  }

  public async sessionPreparation(): Promise<void> {
    // 1) Abrir canal de shell
    await this.createHuaweiShellChannel();

    // 2) Desativar paginação (user view)
    await this.disablePaging();

    // 3) Ajustar largura de tela (best-effort)
    await this.setTerminalWidth();

    // 4) Descobrir e fixar basePrompt (ex.: <NE8000> ou [NE8000])
    await this.setBasePrompt();
  }

  private async createHuaweiShellChannel(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.shell((err, channel) => {
        if (err) {
          reject(err);
          return;
        }
        this.currentChannel = channel;
        this.currentChannel.setEncoding(this.encoding);
        // Aguardar shell pronto
        global.setTimeout(() => resolve(), 1000);
      });
    });
  }

  protected async disablePaging(): Promise<void> {
    // VRP: desativar paginação temporária em user view
    try {
      await this.writeChannel('screen-length 0 temporary' + this.newline);
      await this.readChannel(800);
    } catch {
      // não crítico
    }
  }

  protected async setTerminalWidth(): Promise<void> {
    // VRP: algumas versões aceitam screen-width <valor>
    // Tentativa best-effort; se falhar, ignorar.
    try {
      await this.writeChannel('screen-width 300' + this.newline);
      await this.readChannel(600);
    } catch {
      // não crítico
    }
  }

  async getCurrentConfig(): Promise<CommandResult> {
    // VRP: "display current-configuration"
    const cmd = 'display current-configuration';
    try {
      const res = await this.sendCommand(cmd);
      return res;
    } catch (error) {
      return {
        command: cmd,
        output: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async saveConfig(): Promise<CommandResult> {
    // VRP: "save" com confirmação (Y ou y)
    const cmd = 'save';
    try {
      await this.writeChannel(cmd + this.newline);
      let output = await this.readChannel(2000);

      if (this.containsYesNoPrompt(output)) {
        await this.writeChannel('y' + this.newline);
        output += await this.readChannel(4000);
      }

      return {
        command: cmd,
        output: this.sanitizeOutput(output, cmd),
        success: true,
      };
    } catch (error) {
      return {
        command: cmd,
        output: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async rebootDevice(): Promise<CommandResult> {
    // VRP: "reboot" com confirmação (Y)
    const cmd = 'reboot';
    try {
      await this.writeChannel(cmd + this.newline);
      let output = await this.readChannel(3000);

      if (this.containsYesNoPrompt(output)) {
        await this.writeChannel('y' + this.newline);
        output += await this.readChannel(5000);
      }

      return {
        command: cmd,
        output: this.sanitizeOutput(output, cmd),
        success: true,
      };
    } catch (error) {
      return {
        command: cmd,
        output: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Config-mode helpers (VRP usa "system-view" / "return")
  protected async enterConfigMode(): Promise<void> {
    await this.writeChannel('system-view' + this.newline);
    const out = await this.readChannel(800);

    // Best-effort: em algumas versões, podemos reforçar no config:
    // screen-length 0 (sem 'temporary'), para toda a sessão
    try {
      await this.writeChannel('screen-length 0' + this.newline);
      await this.readChannel(400);
    } catch {
      // ignore
    }

    // Se necessário, também tentar largura
    try {
      await this.writeChannel('screen-width 300' + this.newline);
      await this.readChannel(400);
    } catch {
      // ignore
    }

    // Opcional: validar prompt com '[...]'
    if (!/\[.+\][#>\$]?/.test(out)) {
      // não falha; prompts variam
    }
  }

  protected async exitConfigMode(): Promise<void> {
    await this.writeChannel('return' + this.newline);
    await this.readChannel(600);
  }

  // Override para garantir modo de config e coletar saída integral
  async sendConfig(commands: string[]): Promise<CommandResult> {
    const joined = commands.join(' ; ');
    let output = '';
    try {
      await this.enterConfigMode();

      for (const cmd of commands) {
        await this.writeChannel(cmd + this.newline);
        // Leitura curta por comando; ajuste se necessário
        const chunk = await this.readChannel(600);
        output += chunk;
      }

      await this.exitConfigMode();

      return {
        command: `system-view ; ${joined} ; return`,
        output: this.sanitizeOutput(output, joined),
        success: true,
      };
    } catch (error) {
      return {
        command: `system-view ; ${joined} ; return`,
        output: this.sanitizeOutput(output, joined),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  protected sanitizeOutput(output: string, command: string): string {
    let clean = output ?? '';

    // Remover eco do(s) comando(s)
    if (command) {
      const escaped = this.escapeRegex(command);
      clean = clean.replace(new RegExp(escaped, 'g'), '');
      // Também comandos individuais dentro de 'joined'
      for (const part of command.split(/\s*;\s*/)) {
        if (!part) continue;
        clean = clean.replace(new RegExp(this.escapeRegex(part), 'g'), '');
      }
    }

    // Remover prompts Huawei/VRP típicos: <NE8000> e [NE8000]
    if (this.basePrompt) {
      const bp = this.escapeRegex(this.basePrompt);
      clean = clean.replace(new RegExp(`<${bp}>[>#\\$%]?`, 'g'), '');
      clean = clean.replace(new RegExp(`\\[${bp}\\][>#\\$%]?`, 'g'), '');
    } else {
      // fallback genérico
      clean = clean.replace(/<[^>]+>[>#\$\%]?/g, '');
      clean = clean.replace(/\[[^\]]+\][>#\$\%]?/g, '');
    }

    // Remover "---- More ----" e mensagens de "Press ENTER to continue"
    clean = clean.replace(/-+\s*More\s*-+/gi, '');
    clean = clean.replace(/Press\s+ENTER\s+to\s+continue.*$/gim, '');

    // Normalizar quebras de linha e espaços
    clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    clean = clean.replace(/\n\s*\n\s*\n/g, '\n\n');
    clean = clean.trim();

    return clean;
  }

  // Heurística de confirmação [Y/N], variações comuns no VRP
  private containsYesNoPrompt(s: string): boolean {
    if (!s) return false;
    return (
      /\[\s*Y\s*\/\s*N\s*\]\s*:?\s*$/i.test(s) ||
      /Are\s+you\s+sure.*\[\s*Y\s*\/\s*N\s*\]\s*:?\s*$/i.test(s) ||
      /Continue\?\s*\[\s*Y\s*\/\s*N\s*\]\s*:?\s*$/i.test(s)
    );
  }

  protected escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}