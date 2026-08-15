import * as vscode from 'vscode';
import { CommandStore } from './commandStore';
import { TerminalRunner } from './terminalRunner';
import { CommandScope, HistoryEntry, ScopeData } from './types';

type OutboundMessage =
	| { type: 'state'; hasWorkspace: boolean; global: ScopeData; workspace: ScopeData; history: HistoryEntry[]; paramValues: Record<string, string[]> }
	| { type: 'openAddForm' };

type InboundMessage =
	| { type: 'ready' }
	| { type: 'save'; payload: { id?: string; scope: CommandScope; label: string; command: string; projectIds: string[] } }
	| { type: 'run'; payload: { command: string; label?: string; scope?: CommandScope; values?: Record<string, string> } }
	| { type: 'delete'; payload: { id: string; scope: CommandScope } }
	| { type: 'saveProject'; payload: { id?: string; scope: CommandScope; name: string } }
	| { type: 'deleteProject'; payload: { id: string; scope: CommandScope } }
	| { type: 'deleteHistoryEntry'; payload: { id: string } }
	| { type: 'clearHistory' };

export class CommandPanelProvider implements vscode.WebviewViewProvider {
	static readonly viewType = 'comsaverCommandsView';

	private view: vscode.WebviewView | undefined;

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly store: CommandStore,
		private readonly runner: TerminalRunner
	) {}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
		};
		webviewView.webview.html = this.renderHtml(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((message: InboundMessage) => this.handleMessage(message));
	}

	async refresh(): Promise<void> {
		await this.postState();
	}

	openAddForm(): void {
		if (!this.view) {
			return;
		}
		this.view.show?.(true);
		this.post({ type: 'openAddForm' });
	}

	private async handleMessage(message: InboundMessage): Promise<void> {
		switch (message.type) {
			case 'ready':
				await this.postState();
				break;
			case 'save':
				await this.handleSave(message.payload);
				break;
			case 'run':
				await this.handleRun(message.payload);
				break;
			case 'delete':
				await this.handleDelete(message.payload);
				break;
			case 'saveProject':
				await this.handleSaveProject(message.payload);
				break;
			case 'deleteProject':
				await this.handleDeleteProject(message.payload);
				break;
			case 'deleteHistoryEntry':
				await this.handleDeleteHistoryEntry(message.payload);
				break;
			case 'clearHistory':
				await this.handleClearHistory();
				break;
		}
	}

	private async handleSave(payload: { id?: string; scope: CommandScope; label: string; command: string; projectIds: string[] }): Promise<void> {
		const label = payload.label.trim();
		const command = payload.command.trim();
		if (!label || !command) {
			return;
		}
		if (payload.id) {
			await this.store.updateCommand(payload.scope, payload.id, { label, command, projectIds: payload.projectIds });
		} else {
			await this.store.addCommand(payload.scope, { label, command, projectIds: payload.projectIds });
		}
		await this.postState();
	}

	private async handleRun(payload: { command: string; label?: string; scope?: CommandScope; values?: Record<string, string> }): Promise<void> {
		this.runner.run(payload.command);
		if (payload.values) {
			await this.store.recordParamValues(payload.values);
		}
		await this.store.addHistoryEntry({
			label: payload.label ?? 'Command',
			command: payload.command,
			scope: payload.scope ?? 'global'
		});
		await this.postState();
	}

	private async handleDelete(payload: { id: string; scope: CommandScope }): Promise<void> {
		const commands = await this.store.getCommands(payload.scope);
		const found = commands.find(c => c.id === payload.id);
		const confirm = await vscode.window.showWarningMessage(
			`Delete "${found?.label ?? 'this command'}"?`,
			{ modal: true },
			'Delete'
		);
		if (confirm !== 'Delete') {
			return;
		}
		await this.store.deleteCommand(payload.scope, payload.id);
		await this.postState();
	}

	private async handleSaveProject(payload: { id?: string; scope: CommandScope; name: string }): Promise<void> {
		const name = payload.name.trim();
		if (!name) {
			return;
		}
		if (payload.id) {
			await this.store.renameProject(payload.scope, payload.id, name);
		} else {
			await this.store.addProject(payload.scope, name);
		}
		await this.postState();
	}

	private async handleDeleteProject(payload: { id: string; scope: CommandScope }): Promise<void> {
		const { projects } = await this.store.getScopeData(payload.scope);
		const found = projects.find(p => p.id === payload.id);
		const confirm = await vscode.window.showWarningMessage(
			`Delete project "${found?.name ?? 'this project'}"? Its commands won't be deleted, just ungrouped.`,
			{ modal: true },
			'Delete'
		);
		if (confirm !== 'Delete') {
			return;
		}
		await this.store.deleteProject(payload.scope, payload.id);
		await this.postState();
	}

	private async handleDeleteHistoryEntry(payload: { id: string }): Promise<void> {
		await this.store.deleteHistoryEntry(payload.id);
		await this.postState();
	}

	private async handleClearHistory(): Promise<void> {
		if (this.store.getHistory().length === 0) {
			return;
		}
		const confirm = await vscode.window.showWarningMessage(
			'Clear all run history?',
			{ modal: true },
			'Clear'
		);
		if (confirm !== 'Clear') {
			return;
		}
		await this.store.clearHistory();
		await this.postState();
	}

	private async postState(): Promise<void> {
		const [global, workspace] = await Promise.all([
			this.store.getScopeData('global'),
			this.store.getScopeData('workspace')
		]);
		this.post({
			type: 'state',
			hasWorkspace: this.store.hasWorkspace(),
			global,
			workspace,
			history: this.store.getHistory(),
			paramValues: this.store.getParamValues()
		});
	}

	private post(message: OutboundMessage): void {
		this.view?.webview.postMessage(message);
	}

	private renderHtml(webview: vscode.Webview): string {
		const nonce = getNonce();
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js'));
		const csp = [
			`default-src 'none'`,
			`img-src ${webview.cspSource}`,
			`style-src ${webview.cspSource}`,
			`script-src 'nonce-${nonce}'`
		].join('; ');

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="${csp}" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<link rel="stylesheet" href="${styleUri}" />
	<title>Command Saver</title>
</head>
<body>
	<div class="app">
		<div class="segmented tabs" id="tabStrip">
			<button type="button" class="segment tab active" data-tab="commands">Commands</button>
			<button type="button" class="segment tab" data-tab="history">History</button>
		</div>
		<div id="commandsView">
			<div class="toolbar">
				<button id="addBtn" class="btn btn-primary" title="Add Command">
					<svg viewBox="0 0 16 16" fill="none"><path d="M8 2.5V13.5M2.5 8H13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
					Add Command
				</button>
			</div>
			<form id="commandForm" class="command-form hidden">
				<div class="field">
					<label for="labelInput">Label</label>
					<input id="labelInput" type="text" placeholder="e.g. Start dev server" autocomplete="off" />
				</div>
				<div class="field">
					<div class="field-label-row">
						<label for="commandInput">Command</label>
						<button type="button" id="markParamBtn" class="icon-btn" title="Select text in the command, then click to turn it into an editable parameter">
							<svg viewBox="0 0 16 16" fill="none"><path d="M2.5 2.5H7.6L13.5 8.4C13.9 8.8 13.9 9.4 13.5 9.8L9.8 13.5C9.4 13.9 8.8 13.9 8.4 13.5L2.5 7.6V2.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="5.3" cy="5.3" r="1" fill="currentColor"/></svg>
						</button>
					</div>
					<textarea id="commandInput" rows="3" placeholder="npm run dev"></textarea>
				</div>
				<div class="field scope-field" id="scopeField">
					<label>Save to</label>
					<div class="segmented" id="scopeSegmented">
						<button type="button" class="segment active" data-scope="global">Global</button>
						<button type="button" class="segment" data-scope="workspace">Workspace</button>
					</div>
				</div>
				<div class="field">
					<label>Projects</label>
					<div id="projectChecklist" class="project-checklist"></div>
				</div>
				<div class="form-actions">
					<button type="button" id="cancelBtn" class="btn btn-secondary">Cancel</button>
					<button type="submit" id="saveBtn" class="btn btn-primary">Save</button>
				</div>
			</form>
			<div id="sections" class="sections"></div>
		</div>
		<div id="historyView" class="hidden">
			<div class="history-toolbar">
				<button type="button" id="clearHistoryBtn" class="btn btn-secondary">Clear All</button>
			</div>
			<div id="historyList" class="history-list"></div>
		</div>
	</div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

function getNonce(): string {
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let text = '';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
