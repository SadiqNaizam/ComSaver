import * as vscode from 'vscode';
import { CommandStore } from './commandStore';
import { CommandPanelProvider } from './webviewProvider';
import { TerminalRunner } from './terminalRunner';

export function activate(context: vscode.ExtensionContext): void {
	const store = new CommandStore(context);
	const runner = new TerminalRunner();
	runner.registerListeners(context);

	const provider = new CommandPanelProvider(context.extensionUri, store, runner);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(CommandPanelProvider.viewType, provider)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('comsaver.addCommand', () => provider.openAddForm()),
		vscode.commands.registerCommand('comsaver.refresh', () => provider.refresh()),
		vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh())
	);
}

export function deactivate(): void {}
