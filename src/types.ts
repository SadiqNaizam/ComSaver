export interface SavedCommand {
	id: string;
	label: string;
	command: string;
	description?: string;
	createdAt: number;
	projectIds: string[];
}

export interface Project {
	id: string;
	name: string;
	createdAt: number;
}

export interface ScopeData {
	commands: SavedCommand[];
	projects: Project[];
}

export type CommandScope = 'global' | 'workspace';

export interface HistoryEntry {
	id: string;
	label: string;
	command: string;
	scope: CommandScope;
	ranAt: number;
}
