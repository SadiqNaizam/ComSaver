import * as vscode from 'vscode';

const TERMINAL_NAME = 'Command Saver';

export class TerminalRunner {
	private terminal: vscode.Terminal | undefined;

	registerListeners(context: vscode.ExtensionContext): void {
		context.subscriptions.push(
			vscode.window.onDidCloseTerminal(closed => {
				if (closed === this.terminal) {
					this.terminal = undefined;
				}
			})
		);
	}

	run(command: string): void {
		const terminal = this.getOrCreateTerminal();
		terminal.show();
		terminal.sendText(command);
	}

	private getOrCreateTerminal(): vscode.Terminal {
		if (!this.terminal || this.terminal.exitStatus !== undefined) {
			this.terminal = vscode.window.createTerminal(TERMINAL_NAME);
		}
		return this.terminal;
	}
}
