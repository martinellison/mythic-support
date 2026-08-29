import { plainToInstance, instanceToPlain } from 'class-transformer';
import { Modal, App, Setting, MarkdownPostProcessorContext } from 'obsidian';
import { CodeBlock } from './codeblock.js';
import { MythicObjectMeta, Tables, ThingFamily } from './tables2.js';
import { assertDefined, mTrace } from './main.js';

/** object text should come after a object block */
export class MythicObject {
	static readonly TAG = "mythic-object";
	kind: string = "";
	name: string = "";
	marker: string = ""; // for marking special objects
	description: string;
	result: number;
	removed?: boolean;
	maxProgress: number = 0; // 0 means not a progress thread
	progress: number = 0;
	needsFlashpoint: boolean = false;
	constructor(kind: string, name: string, marker: string, description: string) {
		this.kind = kind;
		this.name = name;
		this.marker = marker;
		this.description = description;
		this.result = 0;
		this.removed = false;
	}
	/** convert from a JSON string */
	static fromJson(source: string): MythicObject {
		// @ts-ignore
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
		let object: MythicObject = plainToInstance(MythicObject, JSON.parse(source));
		if (object.removed === undefined) object.removed = false;
		return object;
	}
	/** convert to a JSON string */
	toJson(): string {
		if (!this.removed) this.removed = undefined;
		return JSON.stringify(instanceToPlain(this));
	}
	/** create HTML for display */
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext, tables: Tables): void {
		const object: MythicObject = MythicObject.fromJson(source);
		const meta = tables.meta(object.kind);
		const tfs: string = (meta === undefined ? "unknown" : (ThingFamily[meta.family] ?? 'unknown')).toLowerCase();
		let cl = `mythic-object mythic-${object.kind} mythic-${tfs}` + ((object.removed ?? false) ? ' mythic-removed' : '');
		let divElt: HTMLDivElement = el.createDiv({ cls: cl });
		divElt.createSpan({ text: `(${object.kind})` });
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
				const diceThrow = Math.trunc(object.result * oracle.entries.totWeights); // TODO standardise
				const entry = oracle.entries.resolve(diceThrow);
				divElt.createEl('b', { text: " " + entry.text }); // ?? interpretation
			}
		}
	}
	newFlashpoint(): boolean {
		const progress = this.progress;
		return progress % 5 > 0 && (progress % 5 == 0 || progress % 5 == 1);
	}
}
export class MythicObjectModal extends Modal {
	object: MythicObject;
	constructor(app: App, object: MythicObject, block: CodeBlock, tables: Tables, kind: MythicObjectMeta) {
		super(app);
		mTrace('', "create object modal", kind);
		assertDefined(kind);
		this.object = object;
		this.setTitle(kind.displayName);
		if (kind.family == ThingFamily.ThingObject)
			new Setting(this.contentEl)
				.setName('Name')
				.addTextArea((text) => {
					text.setValue(this.object.name);
					text.onChange((value) => {
						this.object.name = value;
					});
				});
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
			new Setting(this.contentEl).setName('Max progress').setDesc("Leave as zero if this is not a progress thread").addText((text) => {
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
					this.saveButton(buttonSetting, app, object, block, tables, kind, false, true);
				}
				break;
			case ThingFamily.OracleResponse:
				this.saveButton(buttonSetting, app, object, block, tables, kind, true, false);
				break;
			default:
		}
		this.saveButton(buttonSetting, app, object, block, tables, kind, false, false);
		buttonSetting
			.addButton((btn) => btn
				.setButtonText('Cancel')
				.setCta()
				.onClick(() => {
					this.close();
				}));
	}
	saveButton(setting: Setting, app: App, object: MythicObject, block: CodeBlock, tables: Tables, kind: MythicObjectMeta, throwDice: boolean, bump: boolean) {
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
								// random does not make sense here TODO check
								break;
							case ThingFamily.OracleResponse:
								object.result = Math.random();
								break;
						}
					}
					if (bump) {
						object.progress += 2;
						object.needsFlashpoint = object.newFlashpoint();
					}
					const json = object.toJson();
					let editor = app.workspace.activeEditor?.editor;
					if (editor !== undefined)
						block.replaceContents(MythicObject.TAG, json, editor);
				}));
	}
}

