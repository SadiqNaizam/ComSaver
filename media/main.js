(function () {
	const vscode = acquireVsCodeApi();

	const icons = {
		plus: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 2.5V13.5M2.5 8H13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
		terminal: '<svg viewBox="0 0 16 16" fill="none"><path d="M2 3.5C2 2.94772 2.44772 2.5 3 2.5H13C13.5523 2.5 14 2.94772 14 3.5V12.5C14 13.0523 13.5523 13.5 13 13.5H3C2.44772 13.5 2 13.0523 2 12.5V3.5Z" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 6L7 8.2L4.5 10.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 10.4H11.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
		play: '<svg viewBox="0 0 16 16" fill="none"><path d="M4.5 3.2C4.5 2.6 5.15 2.24 5.66 2.55L12.5 6.85C12.98 7.15 12.98 7.85 12.5 8.15L5.66 12.45C5.15 12.76 4.5 12.4 4.5 11.8V3.2Z" fill="currentColor"/></svg>',
		edit: '<svg viewBox="0 0 16 16" fill="none"><path d="M10.6 2.6L13.4 5.4L5.8 13H3V10.2L10.6 2.6Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
		copy: '<svg viewBox="0 0 16 16" fill="none"><rect x="5.5" y="5.5" width="8" height="8" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 10.5V3.3C3.5 2.86 3.86 2.5 4.3 2.5H10.5" stroke="currentColor" stroke-width="1.3"/></svg>',
		trash: '<svg viewBox="0 0 16 16" fill="none"><path d="M3 4.5H13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M6 4.5V3.3C6 2.86 6.36 2.5 6.8 2.5H9.2C9.64 2.5 10 2.86 10 3.3V4.5" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 4.5L5.1 12.4C5.14 12.9 5.56 13.3 6.06 13.3H9.94C10.44 13.3 10.86 12.9 10.9 12.4L11.5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
		globe: '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.6" stroke="currentColor" stroke-width="1.2"/><path d="M2.4 8H13.6M8 2.4C9.4 4 10.1 6 10.1 8C10.1 10 9.4 12 8 13.6C6.6 12 5.9 10 5.9 8C5.9 6 6.6 4 8 2.4Z" stroke="currentColor" stroke-width="1.2"/></svg>',
		folder: '<svg viewBox="0 0 16 16" fill="none"><path d="M2.5 4.3C2.5 3.86 2.86 3.5 3.3 3.5H6.4L7.6 4.9H12.7C13.14 4.9 13.5 5.26 13.5 5.7V11.7C13.5 12.14 13.14 12.5 12.7 12.5H3.3C2.86 12.5 2.5 12.14 2.5 11.7V4.3Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
		tag: '<svg viewBox="0 0 16 16" fill="none"><path d="M2.5 2.5H7.6L13.5 8.4C13.9 8.8 13.9 9.4 13.5 9.8L9.8 13.5C9.4 13.9 8.8 13.9 8.4 13.5L2.5 7.6V2.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="5.3" cy="5.3" r="1" fill="currentColor"/></svg>',
		empty: '<svg viewBox="0 0 16 16" fill="none"><path d="M2 3.5C2 2.94772 2.44772 2.5 3 2.5H13C13.5523 2.5 14 2.94772 14 3.5V12.5C14 13.0523 13.5523 13.5 13 13.5H3C2.44772 13.5 2 13.0523 2 12.5V3.5Z" stroke="currentColor" stroke-width="1.1"/><path d="M4.5 8H11.5M8 5.5V10.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>'
	};

	const PARAM_PATTERN = /\{\{([^:{}]+)(?::([^{}]*))?\}\}/g;

	const sectionsEl = document.getElementById('sections');
	const formEl = document.getElementById('commandForm');
	const labelInput = document.getElementById('labelInput');
	const commandInput = document.getElementById('commandInput');
	const scopeField = document.getElementById('scopeField');
	const scopeSegmented = document.getElementById('scopeSegmented');
	const projectChecklistEl = document.getElementById('projectChecklist');
	const markParamBtn = document.getElementById('markParamBtn');
	const tabStrip = document.getElementById('tabStrip');
	const commandsView = document.getElementById('commandsView');
	const historyView = document.getElementById('historyView');
	const historyListEl = document.getElementById('historyList');
	const clearHistoryBtn = document.getElementById('clearHistoryBtn');

	const emptyScopeData = { commands: [], projects: [] };
	let state = { hasWorkspace: false, global: emptyScopeData, workspace: emptyScopeData, history: [], paramValues: {} };
	let formOpen = false;
	let editingId = null;
	let activeScope = 'global';
	let selectedProjectIds = new Set();
	let activeTab = 'commands';

	const labelUndo = createUndoController(labelInput);
	const commandUndo = createUndoController(commandInput);

	document.getElementById('addBtn').addEventListener('click', () => openForm());
	document.getElementById('cancelBtn').addEventListener('click', () => closeForm());
	formEl.addEventListener('submit', onSubmit);
	markParamBtn.addEventListener('click', () => markSelectionAsParameter());
	clearHistoryBtn.addEventListener('click', () => vscode.postMessage({ type: 'clearHistory' }));
	scopeSegmented.addEventListener('click', event => {
		const btn = event.target.closest('.segment');
		if (!btn || btn.dataset.scope === activeScope) {
			return;
		}
		activeScope = btn.dataset.scope;
		applyScopeUI(activeScope);
		selectedProjectIds = new Set();
		renderProjectChecklist();
	});
	tabStrip.addEventListener('click', event => {
		const btn = event.target.closest('.tab');
		if (!btn || btn.dataset.tab === activeTab) {
			return;
		}
		setActiveTab(btn.dataset.tab);
	});

	window.addEventListener('message', event => {
		const message = event.data;
		if (message.type === 'state') {
			state = message;
			render();
			renderHistory();
			if (formOpen) {
				renderProjectChecklist();
			}
		} else if (message.type === 'openAddForm') {
			setActiveTab('commands');
			openForm();
		}
	});

	vscode.postMessage({ type: 'ready' });

	function setActiveTab(tab) {
		activeTab = tab;
		for (const el of tabStrip.querySelectorAll('.tab')) {
			el.classList.toggle('active', el.dataset.tab === tab);
		}
		commandsView.classList.toggle('hidden', tab !== 'commands');
		historyView.classList.toggle('hidden', tab !== 'history');
	}

	function applyScopeUI(scope) {
		for (const el of scopeSegmented.querySelectorAll('.segment')) {
			el.classList.toggle('active', el.dataset.scope === scope);
		}
	}

	function scopeData(scope) {
		return state[scope] || emptyScopeData;
	}

	function openForm(existing) {
		formOpen = true;
		editingId = existing ? existing.data.id : null;
		labelInput.value = existing ? existing.data.label : '';
		commandInput.value = existing ? existing.data.command : '';
		labelUndo.reset(labelInput.value);
		commandUndo.reset(commandInput.value);
		activeScope = existing ? existing.scope : 'global';
		applyScopeUI(activeScope);
		scopeField.style.display = state.hasWorkspace && !existing ? '' : 'none';
		selectedProjectIds = new Set(existing ? existing.data.projectIds || [] : []);
		renderProjectChecklist();
		formEl.classList.remove('hidden');
		labelInput.focus();
	}

	function closeForm() {
		formEl.classList.add('hidden');
		formEl.reset();
		editingId = null;
		formOpen = false;
		selectedProjectIds = new Set();
		projectChecklistEl.innerHTML = '';
	}

	function onSubmit(event) {
		event.preventDefault();
		const label = labelInput.value.trim();
		const command = commandInput.value.trim();
		if (!label || !command) {
			return;
		}
		vscode.postMessage({
			type: 'save',
			payload: { id: editingId || undefined, scope: activeScope, label, command, projectIds: Array.from(selectedProjectIds) }
		});
		closeForm();
	}

	function renderProjectChecklist() {
		const projects = scopeData(activeScope).projects.slice().sort((a, b) => a.name.localeCompare(b.name));
		for (const id of Array.from(selectedProjectIds)) {
			if (!projects.some(p => p.id === id)) {
				selectedProjectIds.delete(id);
			}
		}

		projectChecklistEl.innerHTML = '';
		if (projects.length === 0) {
			const hint = document.createElement('div');
			hint.className = 'checklist-hint';
			hint.textContent = 'No projects yet.';
			projectChecklistEl.appendChild(hint);
		}
		for (const project of projects) {
			const row = document.createElement('label');
			row.className = 'checklist-row';
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = selectedProjectIds.has(project.id);
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					selectedProjectIds.add(project.id);
				} else {
					selectedProjectIds.delete(project.id);
				}
			});
			const text = document.createElement('span');
			text.textContent = project.name;
			row.appendChild(checkbox);
			row.appendChild(text);
			projectChecklistEl.appendChild(row);
		}

		const addRow = document.createElement('div');
		addRow.className = 'checklist-add-row';
		addRow.innerHTML = `
			<input type="text" class="new-project-input" placeholder="New project name" autocomplete="off" />
			<button type="button" class="icon-btn" title="Create project">${icons.plus}</button>
		`;
		const input = addRow.querySelector('.new-project-input');
		const submit = () => {
			const name = input.value.trim();
			if (!name) {
				return;
			}
			vscode.postMessage({ type: 'saveProject', payload: { scope: activeScope, name } });
			input.value = '';
		};
		addRow.querySelector('.icon-btn').addEventListener('click', submit);
		input.addEventListener('keydown', event => {
			if (event.key === 'Enter') {
				event.preventDefault();
				submit();
			}
		});
		projectChecklistEl.appendChild(addRow);
	}

	function createUndoController(input) {
		let history = [input.value];
		let index = 0;
		let timer = null;

		function snapshot() {
			clearTimeout(timer);
			timer = null;
			const value = input.value;
			if (value === history[index]) {
				return;
			}
			history = history.slice(0, index + 1);
			history.push(value);
			index = history.length - 1;
		}

		function scheduleSnapshot() {
			clearTimeout(timer);
			timer = setTimeout(snapshot, 400);
		}

		function undo() {
			snapshot();
			if (index === 0) {
				return;
			}
			index--;
			input.value = history[index];
		}

		function redo() {
			if (index >= history.length - 1) {
				return;
			}
			index++;
			input.value = history[index];
		}

		input.addEventListener('input', scheduleSnapshot);
		input.addEventListener('blur', snapshot);
		input.addEventListener('keydown', event => {
			const mod = event.metaKey || event.ctrlKey;
			if (!mod) {
				return;
			}
			const key = event.key.toLowerCase();
			if (key === 'z' && !event.shiftKey) {
				event.preventDefault();
				undo();
			} else if ((key === 'z' && event.shiftKey) || key === 'y') {
				event.preventDefault();
				redo();
			}
		});

		return {
			reset(value) {
				clearTimeout(timer);
				timer = null;
				history = [value];
				index = 0;
			},
			record: snapshot
		};
	}

	function markSelectionAsParameter() {
		const start = commandInput.selectionStart;
		const end = commandInput.selectionEnd;
		if (start === end) {
			return;
		}
		const selectedText = commandInput.value.slice(start, end);
		const existingNames = parseParameters(commandInput.value).map(p => p.name);
		const suggested = suggestParamName(existingNames);

		promptInline(markParamBtn, {
			value: suggested,
			placeholder: 'Parameter name',
			onSubmit: rawName => {
				const name = sanitizeParamName(rawName) || suggested;
				const token = '{{' + name + ':' + selectedText + '}}';
				commandInput.value = commandInput.value.slice(0, start) + token + commandInput.value.slice(end);
				commandUndo.record();
				commandInput.focus();
				const cursor = start + token.length;
				commandInput.setSelectionRange(cursor, cursor);
			}
		});
	}

	function suggestParamName(existingNames) {
		let i = 1;
		while (existingNames.includes('param' + i)) {
			i++;
		}
		return 'param' + i;
	}

	function sanitizeParamName(raw) {
		return raw.replace(/[{}:]/g, '').trim();
	}

	function parseParameters(command) {
		const seen = new Map();
		PARAM_PATTERN.lastIndex = 0;
		let match;
		while ((match = PARAM_PATTERN.exec(command))) {
			const name = match[1].trim();
			const defaultValue = match[2] !== undefined ? match[2] : '';
			if (!seen.has(name)) {
				seen.set(name, defaultValue);
			}
		}
		return Array.from(seen, ([name, defaultValue]) => ({ name, defaultValue }));
	}

	function resolveCommand(command, values) {
		PARAM_PATTERN.lastIndex = 0;
		return command.replace(PARAM_PATTERN, (match, rawName, defaultValue) => {
			const name = rawName.trim();
			if (Object.prototype.hasOwnProperty.call(values, name)) {
				return values[name];
			}
			return defaultValue !== undefined ? defaultValue : '';
		});
	}

	function openRunParamsForm(row, scope, data, params) {
		const existing = row.parentElement.querySelector(':scope > .run-params-form');
		if (existing) {
			const wasForThisRow = existing.dataset.forId === data.id;
			existing.remove();
			if (wasForThisRow) {
				return;
			}
		}

		const form = document.createElement('div');
		form.className = 'run-params-form';
		form.dataset.forId = data.id;

		const inputs = {};
		params.forEach((param, i) => {
			const fieldRow = document.createElement('div');
			fieldRow.className = 'run-param-row';
			const label = document.createElement('label');
			label.textContent = param.name;
			const input = document.createElement('input');
			input.type = 'text';
			input.value = param.defaultValue;
			const suggestions = state.paramValues[param.name] || [];
			if (suggestions.length > 0) {
				const listId = 'paramlist-' + i;
				input.setAttribute('list', listId);
				const datalist = document.createElement('datalist');
				datalist.id = listId;
				datalist.innerHTML = suggestions.map(v => `<option value="${escapeHtml(v)}"></option>`).join('');
				fieldRow.appendChild(datalist);
			}
			fieldRow.appendChild(label);
			fieldRow.appendChild(input);
			form.appendChild(fieldRow);
			inputs[param.name] = input;
		});

		const actions = document.createElement('div');
		actions.className = 'run-params-actions';
		actions.innerHTML = `
			<button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
			<button type="button" class="btn btn-primary" data-action="run">Run</button>
		`;
		form.appendChild(actions);

		const doRun = () => {
			const values = {};
			for (const name in inputs) {
				values[name] = inputs[name].value;
			}
			vscode.postMessage({
				type: 'run',
				payload: { command: resolveCommand(data.command, values), label: data.label, scope, values }
			});
			form.remove();
		};
		const doCancel = () => form.remove();

		actions.querySelector('[data-action="run"]').addEventListener('click', doRun);
		actions.querySelector('[data-action="cancel"]').addEventListener('click', doCancel);
		for (const name in inputs) {
			inputs[name].addEventListener('keydown', event => {
				if (event.key === 'Enter') {
					event.preventDefault();
					doRun();
				} else if (event.key === 'Escape') {
					event.preventDefault();
					doCancel();
				}
			});
		}

		const preview = row.nextElementSibling;
		const anchor = preview && preview.classList.contains('command-preview') ? preview : row;
		anchor.insertAdjacentElement('afterend', form);
		const firstInput = form.querySelector('input');
		if (firstInput) {
			firstInput.focus();
			firstInput.select();
		}
	}

	function render() {
		sectionsEl.innerHTML = '';
		sectionsEl.appendChild(buildSection('global', 'Global Commands', icons.globe, scopeData('global')));
		if (state.hasWorkspace) {
			sectionsEl.appendChild(buildSection('workspace', 'Workspace Commands', icons.folder, scopeData('workspace')));
		}
	}

	function renderHistory() {
		const history = state.history || [];
		clearHistoryBtn.style.display = history.length === 0 ? 'none' : '';
		historyListEl.innerHTML = '';
		if (history.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'empty-state';
			empty.innerHTML = `${icons.empty}<span>No commands run yet.</span>`;
			historyListEl.appendChild(empty);
			return;
		}
		for (const entry of history) {
			historyListEl.appendChild(buildHistoryRow(entry));
		}
	}

	function buildHistoryRow(entry) {
		const row = document.createElement('div');
		row.className = 'command-row';
		row.tabIndex = 0;

		const firstLine = entry.command.split('\n')[0];
		const isMultiline = entry.command.includes('\n');

		row.innerHTML = `
			<span class="row-icon">${icons.terminal}</span>
			<span class="row-text">
				<span class="row-label"></span>
				<span class="row-summary"></span>
			</span>
			<span class="row-time"></span>
			<span class="row-actions">
				<button class="icon-btn run" title="Run again" data-action="run">${icons.play}</button>
				<button class="icon-btn" title="Copy" data-action="copy">${icons.copy}</button>
				<button class="icon-btn danger" title="Delete" data-action="delete">${icons.trash}</button>
			</span>
		`;
		row.querySelector('.row-label').textContent = entry.label;
		row.querySelector('.row-summary').textContent = isMultiline ? `${firstLine} …` : firstLine;
		row.querySelector('.row-time').textContent = formatRelativeTime(entry.ranAt);

		row.addEventListener('click', event => {
			const btn = event.target.closest('.icon-btn');
			if (btn) {
				if (btn.dataset.action === 'run') {
					vscode.postMessage({ type: 'run', payload: { command: entry.command, label: entry.label, scope: entry.scope } });
				} else if (btn.dataset.action === 'copy') {
					navigator.clipboard.writeText(entry.command);
				} else if (btn.dataset.action === 'delete') {
					vscode.postMessage({ type: 'deleteHistoryEntry', payload: { id: entry.id } });
				}
				return;
			}
			row.classList.toggle('expanded');
		});

		const wrapper = document.createDocumentFragment();
		const preview = document.createElement('pre');
		preview.className = 'command-preview';
		preview.textContent = entry.command;
		wrapper.appendChild(row);
		wrapper.appendChild(preview);
		return wrapper;
	}

	function formatRelativeTime(timestamp) {
		const diffMs = Date.now() - timestamp;
		const minute = 60 * 1000;
		const hour = 60 * minute;
		const day = 24 * hour;
		if (diffMs < minute) {
			return 'just now';
		}
		if (diffMs < hour) {
			return Math.floor(diffMs / minute) + 'm ago';
		}
		if (diffMs < day) {
			return Math.floor(diffMs / hour) + 'h ago';
		}
		if (diffMs < 7 * day) {
			return Math.floor(diffMs / day) + 'd ago';
		}
		return new Date(timestamp).toLocaleDateString();
	}

	function buildSection(scope, title, icon, data) {
		const section = document.createElement('div');
		section.className = 'section';

		const header = document.createElement('div');
		header.className = 'section-header';
		header.innerHTML = `${icon}<span>${title}</span>`;
		const addProjectBtn = document.createElement('button');
		addProjectBtn.className = 'icon-btn add-project-btn';
		addProjectBtn.title = 'New project';
		addProjectBtn.innerHTML = icons.plus;
		addProjectBtn.addEventListener('click', () => {
			promptInline(header, {
				placeholder: 'Project name',
				onSubmit: name => vscode.postMessage({ type: 'saveProject', payload: { scope, name } })
			});
		});
		header.appendChild(addProjectBtn);
		section.appendChild(header);

		if (data.commands.length === 0 && data.projects.length === 0) {
			section.appendChild(buildEmptyState(scope));
			return section;
		}

		if (data.projects.length === 0) {
			for (const command of sortedByLabel(data.commands)) {
				section.appendChild(buildRow(scope, command, false));
			}
			return section;
		}

		for (const project of data.projects.slice().sort((a, b) => a.name.localeCompare(b.name))) {
			const members = data.commands.filter(c => c.projectIds && c.projectIds.includes(project.id));
			section.appendChild(buildProjectGroup(scope, project, members));
		}
		const ungrouped = data.commands.filter(c => !c.projectIds || c.projectIds.length === 0);
		if (ungrouped.length > 0) {
			section.appendChild(buildProjectGroup(scope, null, ungrouped));
		}
		return section;
	}

	function buildProjectGroup(scope, project, members) {
		const group = document.createElement('div');
		group.className = 'project-group';

		const header = document.createElement('div');
		header.className = 'project-group-header';
		header.innerHTML = `${icons.tag}<span class="project-name"></span><span class="project-count">${members.length}</span>`;
		header.querySelector('.project-name').textContent = project ? project.name : 'Ungrouped';

		if (project) {
			const actions = document.createElement('span');
			actions.className = 'project-group-actions';
			actions.innerHTML = `
				<button class="icon-btn" title="Rename" data-action="rename">${icons.edit}</button>
				<button class="icon-btn danger" title="Delete" data-action="delete">${icons.trash}</button>
			`;
			actions.querySelector('[data-action="rename"]').addEventListener('click', () => {
				promptInline(header, {
					value: project.name,
					placeholder: 'Project name',
					onSubmit: name => vscode.postMessage({ type: 'saveProject', payload: { id: project.id, scope, name } })
				});
			});
			actions.querySelector('[data-action="delete"]').addEventListener('click', () => {
				vscode.postMessage({ type: 'deleteProject', payload: { id: project.id, scope } });
			});
			header.appendChild(actions);
		}

		group.appendChild(header);

		if (members.length === 0) {
			const hint = document.createElement('div');
			hint.className = 'checklist-hint project-empty-hint';
			hint.textContent = 'No commands yet.';
			group.appendChild(hint);
		} else {
			for (const command of sortedByLabel(members)) {
				group.appendChild(buildRow(scope, command, true));
			}
		}

		return group;
	}

	function promptInline(anchorEl, { value = '', placeholder = '', onSubmit }) {
		const existing = anchorEl.parentElement.querySelector(':scope > .inline-edit');
		if (existing) {
			existing.remove();
		}
		const row = document.createElement('div');
		row.className = 'inline-edit';
		row.innerHTML = `<input type="text" placeholder="${placeholder}" />`;
		const input = row.querySelector('input');
		input.value = value;
		anchorEl.insertAdjacentElement('afterend', row);
		input.focus();
		input.select();

		let done = false;
		const finish = submit => {
			if (done) {
				return;
			}
			done = true;
			const name = input.value.trim();
			if (submit && name) {
				onSubmit(name);
			}
			row.remove();
		};
		input.addEventListener('keydown', event => {
			if (event.key === 'Enter') {
				event.preventDefault();
				finish(true);
			} else if (event.key === 'Escape') {
				event.preventDefault();
				finish(false);
			}
		});
		input.addEventListener('blur', () => finish(true));
	}

	function sortedByLabel(commands) {
		return commands.slice().sort((a, b) => a.label.localeCompare(b.label));
	}

	function escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	function buildEmptyState(scope) {
		const empty = document.createElement('div');
		empty.className = 'empty-state';
		empty.innerHTML = `${icons.empty}<span>No ${scope === 'global' ? 'global' : 'workspace'} commands yet.</span>`;
		return empty;
	}

	function buildRow(scope, data, indented) {
		const wrapper = document.createDocumentFragment();

		const row = document.createElement('div');
		row.className = indented ? 'command-row indented' : 'command-row';
		row.tabIndex = 0;

		const firstLine = data.command.split('\n')[0];
		const isMultiline = data.command.includes('\n');

		row.innerHTML = `
			<span class="row-icon">${icons.terminal}</span>
			<span class="row-text">
				<span class="row-label"></span>
				<span class="row-summary"></span>
			</span>
			<span class="row-actions">
				<button class="icon-btn run" title="Run" data-action="run">${icons.play}</button>
				<button class="icon-btn" title="Edit" data-action="edit">${icons.edit}</button>
				<button class="icon-btn" title="Copy" data-action="copy">${icons.copy}</button>
				<button class="icon-btn danger" title="Delete" data-action="delete">${icons.trash}</button>
			</span>
		`;
		row.querySelector('.row-label').textContent = data.label;
		row.querySelector('.row-summary').textContent = data.description || (isMultiline ? `${firstLine} …` : firstLine);

		const preview = document.createElement('pre');
		preview.className = 'command-preview';
		preview.textContent = data.command;

		row.addEventListener('click', event => {
			const btn = event.target.closest('.icon-btn');
			if (btn) {
				handleAction(btn.dataset.action, scope, data, row);
				return;
			}
			row.classList.toggle('expanded');
		});

		wrapper.appendChild(row);
		wrapper.appendChild(preview);
		return wrapper;
	}

	function handleAction(action, scope, data, row) {
		if (action === 'run') {
			const params = parseParameters(data.command);
			if (params.length === 0) {
				vscode.postMessage({ type: 'run', payload: { command: data.command, label: data.label, scope } });
			} else {
				openRunParamsForm(row, scope, data, params);
			}
		} else if (action === 'edit') {
			openForm({ scope, data });
		} else if (action === 'copy') {
			navigator.clipboard.writeText(data.command);
		} else if (action === 'delete') {
			vscode.postMessage({ type: 'delete', payload: { id: data.id, scope } });
		}
	}
})();
