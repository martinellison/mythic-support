import { plainToInstance, instanceToPlain } from 'class-transformer';
import { Modal, App, Setting, MarkdownPostProcessorContext, } from 'obsidian';
import { CodeBlock } from './codeblock.js';
import MythicSupportPlugin, { assertDefined } from './main.js';
import { Metadata } from './metadata.js';
import { Tables } from './tables2.js';

// adventure text should come after a adventure block
export class Adventure {
	static readonly TAG = "mythic-adventure";
	description: string;
	showLists: boolean;
	count: number; // used to fake change and force rerendering
	constructor(description: string) {
		this.description = description;
		this.showLists = false;
		this.count = 0;
	}
	static fromJson(source: string): Adventure {
		// @ts-ignore
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
		let adventure: Adventure = plainToInstance(Adventure, JSON.parse(source));
		return adventure;
	}
	toJson(): string {
		return JSON.stringify(instanceToPlain(this));
	}
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext, metadata: Metadata, tables: Tables): void {
		assertDefined(tables);
		const adventure: Adventure = Adventure.fromJson(source);
		let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-adventure' });
		divElt.createSpan({ text: "Adventure: " });
		divElt.createEl('i', { text: adventure.description.trim(), });
		if (adventure.showLists && tables.objectKinds !== undefined) { // LATER recode to pull all objects using one call
			tables.objectKinds.forEach((kind, ident) => {
				let kindElt = divElt.createDiv();
				kindElt.createEl('b', { text: `${kind.displayName}: ` });
				const objects = metadata.blockTable.objects(ident).map(ch => ch.name);
				// console.log("for adventure", ident, kind, objects);
				kindElt.createSpan({ text: ` ${objects.join(", ")}` });
				// console.log((`${ident}: found ${objects.length}`));
			});
		}
	}
	// static getRandomMythicObject(vault: Vault): MythicObject {
	// 	const files = vault.getMarkdownFiles();
	// 	for (let i = 0; i < files.length; i++) {
	// 		let f = files[i];
	// 		if (f !== undefined) { let txt = vault.cachedRead(f); }
	// 	}
	// }
}
export class AdventureModal extends Modal {
	adventure: Adventure;
	// statusDisplay: DisplayValueComponent | undefined = undefined;
	constructor(app: App, plugin: MythicSupportPlugin, adventure: Adventure, block: CodeBlock) {
		super(app);
		this.adventure = adventure;
		this.setTitle('Adventure');
		// LATER check adventure name against settings and show appropriate settings
		new Setting(this.contentEl)
			.setName('Description')
			.addTextArea((text) => {
				text.setValue(this.adventure.description);
				text.onChange((value) => {
					this.adventure.description = value;
				});
			});

		new Setting(this.contentEl).setName("ShowLists")
			.setDesc("show the generated lists")
			.addToggle((toggle) => {
				toggle.setValue(this.adventure.showLists);
				toggle.onChange((value) => { this.adventure.showLists = value; });
			});
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setButtonText('Update')
				.setCta()
				.onClick(() => {
					this.close();
					adventure.count++;
					// LATER check whether this adventure is inside the adventure folder 
					const json = adventure.toJson();
					let editor = app.workspace.activeEditor?.editor;
					if (editor !== undefined)
						block.replaceContents(Adventure.TAG, json, editor);
				}));
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setButtonText('Cancel')
				.setCta()
				.onClick(() => {
					this.close();
				}));
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setButtonText('Scan files for lists')
				.setCta()
				.onClick(async () => {
					// this.statusDisplay?.setValue("loading...");
					await plugin.metadata.scanAllFiles(this.app.metadataCache, this.app.vault, plugin);
					// this.statusDisplay?.setValue("loaded");
				}));
		// const displaySetting = new Setting(this.contentEl).addDisplayValue(async (display) => { display.setValue("wait..."); });

		// this.statusDisplay = displaySetting.components[0] as DisplayValueComponent;
	}
}
