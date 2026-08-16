import { App, debounce, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import MythicSupportPlugin from './main.js';
import { CheckTableEntry } from './tables2.js';

export interface MythicSupportPluginSettings {
	// adventureName: string;
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
	// display(): void {
	//     const { containerEl } = this;

	//     containerEl.empty();

	//     new Setting(containerEl).setName('Adventure')
	//         .setDesc('The identifier of your current adventure')
	//         .addTextArea((text) => {
	//             text.setValue(this.plugin.settings.adventureName);
	//             text.onChange(async (value) => {
	//                 this.plugin.settings.adventureName = value;
	//                 await this.plugin.saveSettings();
	//             });
	//         });
	//     new Setting(containerEl)
	//         .setName('AutoScan')
	//         .setDesc('If checked, this plugin will scan for lists automatically (uncheck if Obsidian is slow)')
	//         .addToggle((flag) => {
	//             flag.setValue(this.plugin.settings.autoScanLists);
	//             flag.onChange(async (value) => {
	//                 this.plugin.settings.autoScanLists = value;
	//                 await this.plugin.saveSettings();
	//             });
	//         });
	//     new Setting(containerEl)
	//         .addButton((btn) => btn
	//             .setButtonText('Scan files for lists')
	//             .setCta()
	//             .onClick(async () => {
	//                 await this.plugin.metadata.scanAllFiles(this.app.metadataCache, this.app.vault, this.plugin);
	//             }));
	//     // new Setting(containerEl)
	//     // 	.addButton((btn) => btn
	//     // 		.setButtonText('Close')
	//     // 		.setCta()
	//     // 		.onClick(() => {
	//     // 			this.close();
	//     // 		}));
	// }
}

