import { plainToInstance, instanceToPlain } from 'class-transformer';
import { Modal, App, Setting, MarkdownPostProcessorContext } from 'obsidian';
import { CodeBlock } from './codeblock.js';
import { MythicObjectMeta, ThingFamily } from './tables2.js';
import { assertDefined } from './main.js';

// object text should come after a object block
export class MythicObject {
	static readonly TAG = "mythic-object";
	kind: string = "";
	name: string = "";
	description: string;
	removed: boolean;
	constructor(kind: string, name: string, description: string) {
		this.kind = kind;
		this.name = name;
		this.description = description;
		this.removed = false;
	}
	static fromJson(source: string): MythicObject {
		// @ts-ignore
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
		let object: MythicObject = plainToInstance(MythicObject, JSON.parse(source));
		if (object.removed === undefined) object.removed = false;
		return object;
	}
	toJson(): string {
		return JSON.stringify(instanceToPlain(this));
	}
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext): void {
		const object: MythicObject = MythicObject.fromJson(source);
		let cl = `mythic-object mythic-${object.kind}` + (object.removed ? ' mythic-removed' : '');
		let divElt: HTMLDivElement = el.createDiv({ cls: cl });
		divElt.createSpan({ text: `(${object.kind})` });
		if (object.name !== "")
			divElt.createSpan({ text: ` ${object.name}` });
		divElt.createSpan({ text: `: ${object.description.trim()}` });
		// // console.log("character to", el);
	}
}
export class MythicObjectModal extends Modal {
	object: MythicObject;
	constructor(app: App, object: MythicObject, block: CodeBlock, kind: MythicObjectMeta) {
		super(app);
		// console.log("create object modal", kind);
		assertDefined(kind);
		this.object = object;
		this.setTitle(kind.displayName);
		if (kind.family == ThingFamily.Object)
			new Setting(this.contentEl)
				.setName('Name')
				.addTextArea((text) => {
					text.setValue(this.object.name);
					text.onChange((value) => {
						this.object.name = value;
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
		if (kind.family == ThingFamily.Object)
			new Setting(this.contentEl)
				.setName('Removed')
				.addToggle((flag) => {
					flag.setValue(this.object.removed);
					flag.onChange((value) => {
						this.object.removed = value;
					});
				});

		// new Setting(this.contentEl)
		// 	.addButton((btn) => btn
		// 		.setButtonText('Update')
		// 		.setCta()
		// 		.onClick(() => {
		// 			this.close();
		// 			const json = object.toJson();
		// 			let editor = app.workspace.activeEditor?.editor;
		// 			if (editor !== undefined)
		// 				block.replaceContents(MythicObject.TAG, json, editor);
		// 		}));
		if (kind.family == ThingFamily.Random)
			this.saveButton(app, object, block, true);
		this.saveButton(app, object, block, false);
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setButtonText('Cancel')
				.setCta()
				.onClick(() => {
					this.close();
				}));
	}
	saveButton(app: App, object: MythicObject, block: CodeBlock, throwDice: boolean) {
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setButtonText(throwDice ? 'Throw Dice and Update' : 'Update')
				.setCta()
				.onClick(() => {
					this.close();
					if (throwDice) { // TODO code do random
					}
					const json = object.toJson();
					let editor = app.workspace.activeEditor?.editor;
					if (editor !== undefined)
						block.replaceContents(MythicObject.TAG, json, editor);
				}));
	}
}

