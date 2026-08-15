import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { CommandScope, HistoryEntry, Project, SavedCommand, ScopeData } from './types';

const GLOBAL_COMMANDS_KEY = 'comsaver.globalCommands';
const GLOBAL_PROJECTS_KEY = 'comsaver.globalProjects';
const HISTORY_KEY = 'comsaver.history';
const PARAM_VALUES_KEY = 'comsaver.paramValueHistory';
const WORKSPACE_FILE_SEGMENTS = ['.vscode', 'comsaver.json'];
const MAX_HISTORY_ENTRIES = 50;
const MAX_VALUES_PER_PARAM = 8;

export class CommandStore {
	constructor(private readonly context: vscode.ExtensionContext) {}

	hasWorkspace(): boolean {
		return !!vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
	}

	async getScopeData(scope: CommandScope): Promise<ScopeData> {
		return scope === 'global' ? this.getGlobalData() : this.getWorkspaceData();
	}

	async getCommands(scope: CommandScope): Promise<SavedCommand[]> {
		return (await this.getScopeData(scope)).commands;
	}

	private getGlobalData(): ScopeData {
		return {
			commands: this.context.globalState.get<SavedCommand[]>(GLOBAL_COMMANDS_KEY, []),
			projects: this.context.globalState.get<Project[]>(GLOBAL_PROJECTS_KEY, [])
		};
	}

	private async getWorkspaceData(): Promise<ScopeData> {
		const folder = this.workspaceFolder();
		if (!folder) {
			return { commands: [], projects: [] };
		}
		try {
			const bytes = await vscode.workspace.fs.readFile(this.workspaceFileUri(folder));
			const parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));
			return {
				commands: Array.isArray(parsed?.commands) ? parsed.commands : [],
				projects: Array.isArray(parsed?.projects) ? parsed.projects : []
			};
		} catch (err) {
			if (err instanceof vscode.FileSystemError && err.code === 'FileNotFound') {
				return { commands: [], projects: [] };
			}
			vscode.window.showErrorMessage(`Command Saver: failed to read .vscode/comsaver.json (${(err as Error).message})`);
			return { commands: [], projects: [] };
		}
	}

	async addCommand(scope: CommandScope, data: { label: string; command: string; description?: string; projectIds?: string[] }): Promise<SavedCommand> {
		const entry: SavedCommand = { id: randomUUID(), createdAt: Date.now(), projectIds: [], ...data };
		const scopeData = await this.getScopeData(scope);
		scopeData.commands.push(entry);
		await this.persist(scope, scopeData);
		return entry;
	}

	async updateCommand(scope: CommandScope, id: string, patch: Partial<Pick<SavedCommand, 'label' | 'command' | 'description' | 'projectIds'>>): Promise<void> {
		const scopeData = await this.getScopeData(scope);
		const index = scopeData.commands.findIndex(c => c.id === id);
		if (index === -1) {
			return;
		}
		scopeData.commands[index] = { ...scopeData.commands[index], ...patch };
		await this.persist(scope, scopeData);
	}

	async deleteCommand(scope: CommandScope, id: string): Promise<void> {
		const scopeData = await this.getScopeData(scope);
		scopeData.commands = scopeData.commands.filter(c => c.id !== id);
		await this.persist(scope, scopeData);
	}

	async addProject(scope: CommandScope, name: string): Promise<Project> {
		const project: Project = { id: randomUUID(), name, createdAt: Date.now() };
		const scopeData = await this.getScopeData(scope);
		scopeData.projects.push(project);
		await this.persist(scope, scopeData);
		return project;
	}

	async renameProject(scope: CommandScope, id: string, name: string): Promise<void> {
		const scopeData = await this.getScopeData(scope);
		const index = scopeData.projects.findIndex(p => p.id === id);
		if (index === -1) {
			return;
		}
		scopeData.projects[index] = { ...scopeData.projects[index], name };
		await this.persist(scope, scopeData);
	}

	async deleteProject(scope: CommandScope, id: string): Promise<void> {
		const scopeData = await this.getScopeData(scope);
		scopeData.projects = scopeData.projects.filter(p => p.id !== id);
		scopeData.commands = scopeData.commands.map(c =>
			c.projectIds.includes(id) ? { ...c, projectIds: c.projectIds.filter(pid => pid !== id) } : c
		);
		await this.persist(scope, scopeData);
	}

	private async persist(scope: CommandScope, data: ScopeData): Promise<void> {
		if (scope === 'global') {
			await this.context.globalState.update(GLOBAL_COMMANDS_KEY, data.commands);
			await this.context.globalState.update(GLOBAL_PROJECTS_KEY, data.projects);
			return;
		}
		const folder = this.workspaceFolder();
		if (!folder) {
			return;
		}
		await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, '.vscode'));
		const content = JSON.stringify({ commands: data.commands, projects: data.projects }, null, 2) + '\n';
		await vscode.workspace.fs.writeFile(this.workspaceFileUri(folder), Buffer.from(content, 'utf8'));
	}

	getHistory(): HistoryEntry[] {
		return this.context.globalState.get<HistoryEntry[]>(HISTORY_KEY, []);
	}

	async addHistoryEntry(data: { label: string; command: string; scope: CommandScope }): Promise<void> {
		const entry: HistoryEntry = { id: randomUUID(), ranAt: Date.now(), ...data };
		const history = [entry, ...this.getHistory()].slice(0, MAX_HISTORY_ENTRIES);
		await this.context.globalState.update(HISTORY_KEY, history);
	}

	async deleteHistoryEntry(id: string): Promise<void> {
		const history = this.getHistory().filter(h => h.id !== id);
		await this.context.globalState.update(HISTORY_KEY, history);
	}

	async clearHistory(): Promise<void> {
		await this.context.globalState.update(HISTORY_KEY, []);
	}

	getParamValues(): Record<string, string[]> {
		return this.context.globalState.get<Record<string, string[]>>(PARAM_VALUES_KEY, {});
	}

	async recordParamValues(values: Record<string, string>): Promise<void> {
		const paramValues = this.getParamValues();
		for (const [name, value] of Object.entries(values)) {
			if (!value) {
				continue;
			}
			const existing = (paramValues[name] || []).filter(v => v !== value);
			paramValues[name] = [value, ...existing].slice(0, MAX_VALUES_PER_PARAM);
		}
		await this.context.globalState.update(PARAM_VALUES_KEY, paramValues);
	}

	private workspaceFolder(): vscode.WorkspaceFolder | undefined {
		return vscode.workspace.workspaceFolders?.[0];
	}

	private workspaceFileUri(folder: vscode.WorkspaceFolder): vscode.Uri {
		return vscode.Uri.joinPath(folder.uri, ...WORKSPACE_FILE_SEGMENTS);
	}
}
