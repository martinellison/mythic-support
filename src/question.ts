import { Type, plainToInstance, instanceToPlain } from 'class-transformer';
import { Modal, App, Setting, MarkdownPostProcessorContext, } from 'obsidian';
import { CodeBlock } from './codeblock.js';
import { Tables } from './tables2.js';
import { EventFocus, } from './randomevent.js';
import MythicSupportPlugin, { mTrace } from './main.js';
import { Metadata } from './metadata.js';
import { Meaning } from './meaning.js';
import { ChaosProvider, FateData, FateDataModal } from './fatedata.js';
const NONIDENT = /[^a-zA-Z0-9]+/g;
export class QuestionOdds {
	display: string;
	ident: string;
	fate_check_modifier: number;
	constructor(
		ident: string,
		display: string,
		mod: number) {
		this.display = display;
		this.ident = ident.trim() == "" ? this.display.trim().replaceAll(NONIDENT, '_') : ident;
		this.fate_check_modifier = mod;
	}
}
/** implements an fate question block. Question text should come after a question block. */
export class Question implements ChaosProvider {
	chaosValue(): number { return this.chaosFactor; }
	static readonly TAG = "mythic-question";
	@Type(() => FateData)
	fateData: FateData = new FateData(this);
	// description: string;
	// odds: string;
	chaosFactor: number = 5;
	// dice: Array<number>;
	meaningKind: string = "action1";
	@Type(() => EventFocus)
	focus?: EventFocus = new EventFocus;
	@Type(() => Meaning)
	meaning?: Meaning = new Meaning;
	constructor(description: string) {
		this.fateData = new FateData(this);
		// this.description = description;
		// this.odds = 'certain';
		// this.chaosFactor = 5;
		// this.dice = [0, 0];
		this.focus = undefined;
		this.meaning = undefined;
	}
	/** convert from a JSON string */
	static fromJson(source: string): Question {
		// @ts-ignore
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
		let question: Question = plainToInstance(Question, JSON.parse(source));
		if (question.fateData !== undefined)
			question.fateData.chaosProvider = question;
		return question;
	}
	/** convert to a JSON string */
	toJson(): string {
		return JSON.stringify(instanceToPlain(this));
	}
	/** create HTML for display */
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext, tables: Tables) {
		const question: Question = Question.fromJson(source);
		let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-question' });
		question.fateData.toHtml(divElt, tables);

		if (question.focus !== undefined) {
			el.createDiv({ text: question.focus.toText(tables), cls: 'mythic-random' });
		}
		if (question.meaning !== undefined) {
			el.createDiv({ text: question.meaning.result, cls: 'mythic-random' });
		}
	}
	throwDice(tables: Tables, metadata: Metadata): void {
		// for (let d = 0; d < 2; d++) this.dice[d] = mythicDice(10);// dice max is for a Fate Check
		this.fateData.throwDice();
		// if (this.data.dice[0] == this.data.dice[1] && (this.data.dice[0] ?? 5) <= this.
		// chaosFactor) {
		if (this.fateData.isRandom()) {
			this.focus = new EventFocus;
			this.meaning = new Meaning;
			this.meaning.meaningKind = this.meaningKind;
		} else {
			this.focus = undefined;
			this.meaning = undefined;
		}
		if (this.focus !== undefined) {
			this.focus.throwDice(tables);
			let ent = this.focus.focusDescr(tables);
			this.focus.defineSelectedObject(metadata, ent.interpretation);
		}
		if (this.meaning !== undefined) {
			const tabSiz = this.meaning.tableSizes(tables);
			this.meaning.throwDice(tabSiz);
			this.meaning.explain(tables);
		}
	}
}
export class QuestionModal extends Modal {
	question: Question;
	// questionDataModal: QuestionDataModal;
	constructor(app: App, question: Question, block: CodeBlock, tables: Tables, plugin: MythicSupportPlugin) {
		super(app);
		this.question = question;
		this.setTitle('Question');
		let questionDataModal = new FateDataModal(this.contentEl, tables, () => { });
		questionDataModal.setVisibility(true, "Q");
		questionDataModal.setData(question.fateData, tables);
		new Setting(this.contentEl).setName('Meaning').addDropdown((dropDown) => {
			for (let meanTab of tables.oracles) {
				const ident = meanTab[0];
				if (!meanTab[1].meta.noAlt)
					dropDown.addOption(ident, meanTab[1].meta.displayName);
			}
			dropDown.setValue(this.question.meaning?.meaningKind ?? "action1");
			dropDown.onChange((value) => {
				if (this.question.meaning !== undefined)
					this.question.meaning.meaningKind = value;
				this.question.meaningKind = value;
			});
		});
		this.makeSaveButton(app, question, block, QuestionButtonKind.Save, tables, plugin);
		this.makeSaveButton(app, question, block, QuestionButtonKind.ThrowDice, tables, plugin);
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setButtonText('Cancel')
				.setCta()
				.onClick(() => {
					this.close();
				}));
	}

	makeSaveButton(app: App, question: Question, block: CodeBlock, kind: QuestionButtonKind, tables: Tables, plugin: MythicSupportPlugin) {
		if (plugin === undefined) console.error("no plugin");
		else if (plugin.metadata === undefined) console.error("no metadata");
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setButtonText(QuestionModal.buttonText(kind))
				.setCta()
				.onClick(async (): Promise<void> => {
					this.close();
					mTrace('', "saving question", kind);
					switch (kind) {
						case QuestionButtonKind.Save:
							break;
						case QuestionButtonKind.ThrowDice:
							question.throwDice(tables, plugin.metadata);
							if (question.meaning !== undefined)
								question.meaning.explain(tables);
							break;
						default:
							console.error("unknown button kind", kind);
					}
					const json = question.toJson();
					let editor = app.workspace.activeEditor?.editor;
					if (editor !== undefined)
						block.replaceContents(Question.TAG, json, editor);
				}));
	}
	static buttonText(kind: QuestionButtonKind): string {
		switch (kind) {
			case QuestionButtonKind.Save:
				return "Save";
			case QuestionButtonKind.ThrowDice:
				return "Throw dice and save";
			default:
				return "?";
		}
	}
}
const enum QuestionButtonKind {
	ThrowDice, Save,
}
