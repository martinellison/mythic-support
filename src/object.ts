import { plainToInstance, instanceToPlain, Expose } from 'class-transformer';
import { Modal, App, Setting, MarkdownPostProcessorContext } from 'obsidian';
import { CodeBlock } from './codeblock.js';
import { MythicObjectMeta, Tables, ThingFamily } from './tables2.js';
import MythicSupportPlugin, { assertDefined, mTrace, shorten } from './main.js';
import { Metadata } from './metadata.js';

/**  MythicObject implements an Object block.  Object text should come after a object block */
export class MythicObject {
	static readonly TAG = "mythic-object";
	@Expose() kind: string = "";
	@Expose() name: string = "";
	@Expose() marker: string = ""; // for marking special objects
	@Expose() description: string;
	@Expose() diceThrow: number = 0;
	@Expose() removed?: boolean;
	@Expose() maxProgress: number = 0; // 0 means not a progress thread
	@Expose() progress: number = 0;
	@Expose() needsFlashpoint: boolean = false;
	@Expose() selection: boolean = false;
	@Expose() selected: string = "";
	constructor(kind: string, name: string, marker: string, description: string, selection: boolean) {
		this.kind = kind;
		this.name = name;
		this.marker = marker;
		this.description = description;
		this.diceThrow = 0;
		this.removed = false;
		this.selection = selection;
		this.selected = "";
	}
	/** convert from a JSON string */
	static fromJson(source: string): MythicObject {
		try {
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
			let object: MythicObject = plainToInstance(MythicObject, JSON.parse(source));
			if (object.removed === undefined) object.removed = false;
			return object;
		} catch (error) {
			console.error("error parsing object: ", error, "reading:", shorten(source));
			throw error;
		}
	}
	/** convert to a JSON string */
	toJson(): string {
		if (!this.removed) this.removed = undefined;
		return JSON.stringify(instanceToPlain(this));
	}
	/** create HTML for display */
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext, tables: Tables): void {
		let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-adventure' });
		try {
			const object: MythicObject = MythicObject.fromJson(source);
			const meta = tables.meta(object.kind);
			const tfs: string = (meta === undefined ? "unknown" : (ThingFamily[meta.family] ?? 'unknown')).toLowerCase();
			let cl = `mythic-object mythic-${object.kind} mythic-${tfs}` + ((object.removed ?? false) ? ' mythic-removed' : '');
			const tag = object.selection ? " selection" : "";
			divElt.createSpan({ text: `(${object.kind}${tag})` });
			if (object.marker !== undefined && object.marker != "")
				divElt.createEl('i', ` ${object.marker}`);
			if (object.name !== "")
				divElt.createSpan({ text: ` ${object.name}` });
			divElt.createSpan({ text: `: ${object.description.trim()}` });
			if (object.maxProgress > 0)
				divElt.createSpan({ text: ` progress ${object.progress}/${object.maxProgress}` });
			if (object.needsFlashpoint)
				divElt.createEl('b', { text: " needs flashpoint" });
			if (meta !== undefined && meta.family == ThingFamily.OracleResponse) {
				const oracle = tables.oracles.get(object.kind);
				if (oracle === undefined) {
					divElt.createDiv({ text: `oracle ${object.kind} not found`, cls: 'mythic-error' });
				} else {
					const entry = oracle.entries.resolve(object.diceThrow);
					divElt.createSpan({ text: ` (${meta.displayName} oracle) ` });
					divElt.createEl('b', { text: ` ${entry.text}` });
				}
			}
			if (object.selection) {
				divElt.createSpan({ text: " Selected: " });
				divElt.createEl('b', { text: ` ${object.selected}` });
			}
		} catch (error) {
			console.error("error displaying object: ", error, "reading:", shorten(source));
			divElt.createSpan({ text: `error in displaying object: ${error as Error}`, cls: 'mythic-error' });
		}
	}
	newFlashpoint(): boolean {
		const progress = this.progress;
		return progress % 5 > 0 && (progress % 5 == 0 || progress % 5 == 1);
	}
	selectObject(metadata: Metadata, ident: string) {
		const objects = metadata.blockTable.objectNames(ident);
		const object = objects[Math.floor(objects.length * Math.random())];
		this.selected = object ?? "??";
	}
}
export class MythicObjectModal extends Modal {
	object: MythicObject;
	constructor(app: App, plugin: MythicSupportPlugin, object: MythicObject, block: CodeBlock, tables: Tables, kind: MythicObjectMeta) {
		super(app);
		mTrace('object', "create object modal", kind, "block:", block, "object:", object);
		assertDefined(kind);
		this.object = object;
		this.setTitle(kind.displayName);
		if (kind.family == ThingFamily.ThingObject && !object.selection)
			new Setting(this.contentEl)
				.setName('Name')
				.addTextArea((text) => {
					text.setValue(this.object.name);
					text.onChange((value) => {
						this.object.name = value;
					});
				});
		if (!object.selection)
			new Setting(this.contentEl)
				.setName('Marker')
				.addText((text) => {
					text.setValue(this.object.marker);
					text.onChange((value) => {
						this.object.marker = value;
					});
				});
		new Setting(this.contentEl)
			.setName('Description')
			.addTextArea((text) => {
				text.setValue(this.object.description);
				text.onChange((value) => {
					this.object.description = value;
				});
			});

		if (kind.family == ThingFamily.ThingObject && kind.progress) {
			new Setting(this.contentEl).setName('Max progress').setDesc("Number of steps in a progress thread").addText((text) => {
				text.setValue(this.object.maxProgress.toString());;
				text.onChange((value) => {
					let p = parseInt(value);
					if (p !== undefined && p >= 0)
						this.object.maxProgress = p - (p % 5);
				});
			});

			new Setting(this.contentEl).setName('Progress').setDesc("Progress so far on a progress thread").addText((text) => {
				text.setValue(this.object.progress.toString());
				text.onChange((value) => {
					let p = parseInt(value);
					if (p !== undefined && p >= 0 && p <= this.object.maxProgress) {
						this.object.progress = p;
						this.object.needsFlashpoint = this.object.newFlashpoint();
					}
				});
			});
			new Setting(this.contentEl).setDesc("This thread needs a flashpoint")
				.setName('Needs flashpoint')
				.addToggle((flag) => {
					flag.setValue(this.object.needsFlashpoint);
					flag.onChange((value) => {
						this.object.needsFlashpoint = value;
					});
				});
		}
		let buttonSetting = new Setting(this.contentEl);
		switch (kind.family) {
			case ThingFamily.ThingObject:
				new Setting(this.contentEl)
					.setName('Removed')
					.addToggle((flag) => {
						flag.setValue(this.object.removed ?? false);
						flag.onChange((value) => {
							this.object.removed = value;
						});
					});
				if (this.object.maxProgress > 0) {
					this.saveButton(buttonSetting, app, plugin, object, block, tables, kind, false, true, false);
				}
				break;
			case ThingFamily.OracleResponse:
				this.saveButton(buttonSetting, app, plugin, object, block, tables, kind, true, false, false);
				break;
			// case ThingFamily.ThingChoice:
			// 	// TODO ThingChoice?
			// 	break;
			default:
		}
		this.saveButton(buttonSetting, app, plugin, object, block, tables, kind, false, false, object.selection);
		buttonSetting
			.addButton((btn) => btn
				.setButtonText('Cancel')
				.setCta()
				.onClick(() => {
					this.close();
				}));
	}
	saveButton(setting: Setting, app: App, plugin: MythicSupportPlugin, object: MythicObject, block: CodeBlock, tables: Tables, kind: MythicObjectMeta, throwDice: boolean, bump: boolean, select: boolean) {
		setting
			.addButton((btn) => btn
				.setButtonText(throwDice ? 'Throw Dice and Update' : bump ? 'Mark Progress and Update' : 'Update')
				.setCta()
				.onClick(() => {
					this.close();
					if (throwDice) {
						switch (kind.family) {
							case ThingFamily.ThingObject:
							case ThingFamily.SimpleText:
								// random does not make sense here
								break;
							case ThingFamily.OracleResponse: {
								const oracle = tables.oracles.get(object.kind);
								if (oracle !== undefined)
									object.diceThrow = oracle.entries.throwDiceStandardised();
							}
								break;
							// case ThingFamily.ThingChoice:
							// 	// TODO ThingChoice?
							// 	break;
						}
					}
					if (bump) {
						object.progress += 2;
						object.needsFlashpoint = object.newFlashpoint();
					}
					if (select) {
						object.selectObject(plugin.metadata, object.kind);
					}
					mTrace('object', "saving", object);
					const json = object.toJson();
					let editor = app.workspace.activeEditor?.editor;
					if (editor !== undefined)
						block.replaceContents(MythicObject.TAG, json, editor);
				}));
	}
}

