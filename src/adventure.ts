import { plainToInstance, instanceToPlain, Expose } from 'class-transformer';
import { Modal, App, Setting, MarkdownPostProcessorContext, } from 'obsidian';
import { CodeBlock } from './codeblock.js';
import MythicSupportPlugin, { assertDefined, mTrace, shorten } from './main.js';
import { Metadata } from './metadata.js';
import { Tables } from './tables2.js';

/** implements an Adventure block. Adventure text should come after a adventure block */
export class Adventure {
	static readonly TAG = "mythic-adventure";
	@Expose() description: string = "";
	@Expose() showLists: boolean = true;
	@Expose() count: number = 0; // used to fake change and force rerendering
	constructor(description: string) {
		this.description = description;
		this.showLists = false;
		this.count = 0;
	}
	/** convert from a JSON string */
	static fromJson(source: string): Adventure {
		try {
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
			let adventure: Adventure = plainToInstance(Adventure, JSON.parse(source), { excludeExtraneousValues: true });
			return adventure;
		} catch (error) {
			console.error("error parsing adventure: ", error, "reading:", shorten(source));
			throw error;
		}
	}
	/** convert to a JSON string */
	toJson(): string {
		return JSON.stringify(instanceToPlain(this));
	}
	/** create HTML for display */
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext, metadata: Metadata, tables: Tables): void {
		assertDefined(tables);
		let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-adventure' });
		try {
			const adventure: Adventure = Adventure.fromJson(source);
			mTrace('adventure', "rendering adventure");
			divElt.createSpan({ text: "(adventure) " });
			divElt.createEl('i', { text: adventure.description.trim(), });
			if (adventure.showLists && tables.objectKinds !== undefined) { // LATER recode to pull all objects using one call
				tables.objectKinds.forEach((kind, ident) => {
					let kindElt = divElt.createDiv();
					kindElt.createEl('b', { text: `${kind.displayName}: ` });
					// const objects = metadata.blockTable.objects(ident).map(ch => (ch.marker !== undefined && ch.marker.trim() != "" ? ` [${ch.marker}] ` : "") + ch.name);
					const objects = metadata.blockTable.objectNames(ident);
					mTrace('adventure', "for adventure", ident, kind, objects);
					kindElt.createSpan({ text: ` ${objects.join(", ")}` });
					mTrace('adventure', (`${ident}: found ${objects.length}`));
				});
			}
		} catch (error) {
			const msg = `error when parsing adventure: ${error as Error}`;
			console.error(msg);
			divElt.createSpan({ text: msg, cls: 'mythic-error' });
		}
	}
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
				}))
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
				}));
	}
}
