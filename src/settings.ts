import { App, debounce, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import MythicSupportPlugin from './main.js';

export interface MythicSupportPluginSettings {
	adventureFolder: string;
	autoScanLists: boolean;
}

export const DEFAULT_SETTINGS: MythicSupportPluginSettings = {
	adventureFolder: "",
	autoScanLists: true,
};

export class MythicSettingTab extends PluginSettingTab {
	plugin: MythicSupportPlugin;
	app: App;

	constructor(app: App, plugin: MythicSupportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.app = app;
		let refresh = debounce(() => this.update(), 200, true);
		plugin.registerEvent(this.app.vault.on('create', refresh));
		plugin.registerEvent(this.app.vault.on('delete', refresh));
		plugin.registerEvent(this.app.vault.on('rename', refresh));
	}
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{ name: "Auto scan lists", desc: "automatically recreate lists", control: { type: 'toggle', defaultValue: true, key: '?' } },
			{ name: "Adventure folder", desc: "folder containing the current adventure", control: { type: 'folder', defaultValue: this.app.vault.getRoot().path, key: '?' } },
		];
	}
}

