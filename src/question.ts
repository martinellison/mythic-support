import { Type, plainToInstance, instanceToPlain } from 'class-transformer';
import { Modal, App, Setting, MarkdownPostProcessorContext } from 'obsidian';
import { CodeBlock } from './codeblock.js';
import { Tables } from './tables2.js';
import { EventFocus, } from './randomevent.js';
import MythicSupportPlugin, { mTrace } from './main.js';
import { Metadata } from './metadata.js';
import { Meaning } from './meaning.js';
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
// question text should come after a question block
export class Question {
	static readonly TAG = "mythic-question";
	description: string;
	odds: string;
	chaosFactor: number;
	dice: Array<number>;
	meaningKind: string = "action1";
	@Type(() => EventFocus)
	focus?: EventFocus = new EventFocus;
	@Type(() => Meaning)
	meaning?: Meaning = new Meaning;
	constructor(description: string) {
		this.description = description;
		this.odds = 'certain';
		this.chaosFactor = 5;
		this.dice = [0, 0];
		this.focus = undefined;
		this.meaning = undefined;
	}
	/** convert from a JSON string */
	static fromJson(source: string): Question {
		// @ts-ignore
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
		let question: Question = plainToInstance(Question, JSON.parse(source));
		return question;
	}
	/** convert to a JSON string */
	toJson(): string {
		return JSON.stringify(instanceToPlain(this));
	}
	chaosMod(): number {
		return this.chaosFactor > 7 ? this.chaosFactor - 4 : this.chaosFactor < 3 ? this.chaosFactor - 6 : this.chaosFactor - 5;
	}
	isRandom(): boolean { return ((this.dice[0] ?? 0) == (this.dice[1] ?? 0) && (this.dice[0] ?? 0) <= this.chaosFactor); }
	/** create HTML for display */
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext, tables: Tables) {
		const question: Question = Question.fromJson(source);
		let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-question' });
		divElt.createSpan({ text: `(question) ${question.description} ${question.dice[0]}/${question.dice[1]}` });
		divElt.createSpan({ text: ` odds: ${question.odds}` });
		let mod: number = tables.getQuestionOdds(question.odds).fate_check_modifier;
		divElt.createEl('i', { text: ` (${question.dice[0] ?? 0} + ${question.dice[1] ?? 0} + ${mod} + ${question.chaosMod()})` });
		let roll_total = (question.dice[0] ?? 0) + (question.dice[1] ?? 0) + mod + question.chaosMod(); // TODO standardise
		let answer = tables.fateCheckAnswers.resolve(roll_total);
		divElt.createSpan({ text: ` = ${roll_total}` });
		divElt.createEl('b', { text: ` (${answer.text})` });
		if (question.focus !== undefined) {
			el.createDiv({ text: question.focus.toText(tables), cls: 'mythic-random' });
		}
		if (question.meaning !== undefined) {
			el.createDiv({ text: question.meaning.result, cls: 'mythic-random' });
		}
	}
	throwDice(tables: Tables, metadata: Metadata): void {
		for (let d = 0; d < 2; d++) this.dice[d] = Question.dice(10);// dice max is for a Fate Check
		if (this.dice[0] == this.dice[1] && (this.dice[0] ?? 5) <= this.chaosFactor) {
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
	/** This returns a random number 1 to `n` */
	static dice(n: number): number { return Math.floor(Math.random() * n) + 1; }
}
export class QuestionModal extends Modal {
	question: Question;
	constructor(app: App, question: Question, block: CodeBlock, tables: Tables, plugin: MythicSupportPlugin) {
		super(app);
		this.question = question;
		this.setTitle('Question');
		new Setting(this.contentEl)
			.setName('Description')
			.addTextArea((text) => {
				text.setValue(this.question.description);
				text.onChange((value) => {
					this.question.description = value;
				});
			});

		new Setting(this.contentEl).setName('Odds').addDropdown((dropDown) => {
			// mTrace('', "loading odds to dropdown", tables);
			for (let quOdds of tables.questionOdds) dropDown.addOption(quOdds.ident, quOdds.display);
			dropDown.setValue(this.question.odds);
			dropDown.onChange((value) => {
				this.question.odds = value;
			});
		});
		new Setting(this.contentEl).setName('Chaos').addSlider((slider) => {
			slider.setLimits(1, 9, 1).setInstant(true).setValue(this.question.chaosFactor).onChange((value) => {
				this.question.chaosFactor = value;
			});
		});
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
