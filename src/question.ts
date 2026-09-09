import { Type, plainToInstance, instanceToPlain, Expose } from 'class-transformer';
import { Modal, App, Setting, MarkdownPostProcessorContext, DropdownComponent, DisplayValueComponent, } from 'obsidian';
import { CodeBlock } from './codeblock.js';
import { Tables } from './tables2.js';
import { EventFocus, } from './eventfocus.js';
import MythicSupportPlugin, { mTrace, shorten } from './main.js';
import { Metadata } from './metadata.js';
import { Meaning, MeaningModal } from './meaning.js';
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
	chaosValue(): number {
		mTrace('question', "chaos factor is:", this.chaosFactor);
		return this.chaosFactor;
	}
	static readonly TAG = "mythic-question";
	@Type(() => FateData)
	@Expose() fateData: FateData = new FateData(this);
	@Expose() chaosFactor: number = 5;
	@Expose() hasRandom: boolean = false;
	@Expose() meaningKind: string = "action1";
	@Type(() => EventFocus)
	@Expose() focus?: EventFocus;
	@Type(() => Meaning)
	@Expose() meaning?: Meaning;
	constructor(description: string) {
		this.fateData = new FateData(this);
		this.focus = undefined;
		this.meaning = undefined;
		this.chaosFactor = 5;
	}
	/** create or remove a random event */
	makeRandomEvent(isRandom: boolean, tables: Tables, metadata: Metadata) {
		mTrace('question', `random set to${isRandom ? "" : " not"} random`);
		if (isRandom) {
			if (this.meaning == undefined) {
				this.meaning = new Meaning(this.meaningKind);
				const tabSiz = this.meaning.tableSizes(tables);
				this.meaning.throwDice(tabSiz);
				this.meaning.explain(tables);
			}
			if (this.focus == undefined) {
				this.focus = new EventFocus();
				this.focus.throwDice(tables);
				let ent = this.focus.focusDescr(tables);
				this.focus.defineSelectedObject(metadata, ent.interpretation);
			}
		} else {
			this.focus = undefined;
			this.meaning = undefined;
		}
	}
	/** convert from a JSON string */
	static fromJson(source: string): Question {
		try {
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
			let question: Question = plainToInstance(Question, JSON.parse(source), { excludeExtraneousValues: true });
			if (question.fateData === undefined)
				question.fateData = new FateData(question);
			question.fateData.chaosProvider = question;

			return question;
		} catch (error) {
			console.error("error parsing object: ", error, "reading:", shorten(source));
			throw error;
		}
	}
	/** convert to a JSON string */
	toJson(): string {
		return JSON.stringify(instanceToPlain(this));
	}
	/** describe the scene in plain text */
	toText(tables: Tables): string {
		let texts = new Array<string>; try {
			// if (this.fateData !== undefined)
			// 	texts.push(this.fateData.toText(tables));
			if (this.hasRandom) {
				texts.push("Random event ");
				if (this.focus !== undefined) {
					texts.push(this.focus.toText(tables));
				}
				if (this.meaning !== undefined) {
					texts.push(this.meaning.result2);
				}
			}
		} catch (error) {
			const msg = `error in question: ${error as Error}`;
			console.error(msg);
			texts.push(msg);
		}
		return texts.join(" ");
	}
	/** create HTML for display */
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext, tables: Tables) {
		let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-question' });
		try {
			const question: Question = Question.fromJson(source);
			divElt.createSpan({ text: "(question) " });
			if (question.fateData !== undefined)
				question.fateData.toHtml(divElt, tables);

			if (question.hasRandom) {
				divElt.createSpan({ text: "Random event ", cls: 'mythic-random' });
				if (question.focus !== undefined) {
					question.focus.toHtml(divElt, tables);
				}
				if (question.meaning !== undefined) {
					divElt.createDiv({ text: question.meaning.result1, cls: 'mythic-random' });
					divElt.createEl('b', { text: question.meaning.result2, cls: 'mythic-random' });
				}
			}
		} catch (error) {
			const msg = `error when parsing question: ${error as Error}`;
			console.error(msg);
			divElt.createSpan({ text: msg, cls: 'mythic-error' });
		}
	}
	throwDice(tables: Tables, metadata: Metadata): void {
		// for (let d = 0; d < 2; d++) this.dice[d] = mythicDice(10);// dice max is for a Fate Check
		this.fateData.throwDice();
		// if (this.data.dice[0] == this.data.dice[1] && (this.data.dice[0] ?? 5) <= this.
		// chaosFactor) {
		const isRandom = this.fateData.isRandom();
		// if (isRandom) {
		// 	this.focus = new EventFocus;
		// 	this.meaning = new Meaning;
		// 	this.meaning.meaningKind = this.meaningKind;
		// } else {
		// 	this.focus = undefined;
		// 	this.meaning = undefined;
		// }
		// if (this.focus !== undefined) {
		// 	this.focus.throwDice(tables);
		// 	let ent = this.focus.focusDescr(tables);
		// 	this.focus.defineSelectedObject(metadata, ent.interpretation);
		// }
		// if (this.meaning !== undefined) {
		// 	const tabSiz = this.meaning.tableSizes(tables);
		// 	this.meaning.throwDice(tabSiz);
		// 	this.meaning.explain(tables);
		// }
		this.makeRandomEvent(isRandom, tables, metadata);
	}
}
export class QuestionModal extends Modal {
	question: Question;
	hasRandom: boolean = false;
	meaningSetting?: Setting;
	infoDisplay1?: DisplayValueComponent;
	// questionDataModal: QuestionDataModal;
	constructor(app: App, question: Question, block: CodeBlock, tables: Tables, plugin: MythicSupportPlugin, metadata: Metadata) {
		super(app);
		this.question = question;
		this.setTitle('Question');
		new Setting(this.contentEl).setName('Chaos')
			.setDesc("The current Chaos Factor").addSlider((slider) => {
				slider.setLimits(1, 9, 1).setInstant(true).setValue(this.question.chaosFactor).onChange((value) => {
					this.question.chaosFactor = value;
				});
			});
		let fateDataModal = new FateDataModal(this.contentEl, tables, (isRandom) => {
			this.question.makeRandomEvent(isRandom, tables, metadata);
			this.setRandom(isRandom, tables);
			/* TODO iff is random, create a random event i.e. focus and question*/
		});
		fateDataModal.setVisibility(true, "Q");
		fateDataModal.setData(question.fateData, tables);
		// this.meaningSetting = new Setting(this.contentEl).setName('Meaning').addDropdown((dropDown) => {
		// 	for (let meanTab of tables.oracles) {
		// 		const ident = meanTab[0];
		// 		if (!meanTab[1].meta.noAlt)
		// 			dropDown.addOption(ident, meanTab[1].meta.displayName);
		// 	}
		// 	dropDown.setValue(this.question.meaning?.meaningKind ?? "action1");
		// 	dropDown.onChange((value) => {
		// 		if (this.question.meaning !== undefined)
		// 			this.question.meaning.meaningKind = value;
		// 		this.question.meaningKind = value;
		// 		this.question.makeRandomEvent(this.hasRandom, tables, metadata);
		// 	});
		// });
		let dc: DropdownComponent | undefined;
		MeaningModal.makeMeaning(this.contentEl, dc, tables,
			(value) => {
				if (this.question.meaning !== undefined)
					this.question.meaning.meaningKind = value;
				this.question.meaningKind = value;
				this.question.makeRandomEvent(this.hasRandom, tables, metadata);
			}, this.question.meaning);
		new Setting(this.contentEl).addDisplayValue(disp => {
			this.infoDisplay1 = disp;
		});
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setButtonText('Cancel')
				.setCta()
				.onClick(() => {
					this.close();
				}))
			.addButton((btn) => btn
				.setButtonText("Save")
				.setCta()
				.onClick(async (): Promise<void> => {
					this.close();
					mTrace('', "saving question");
					const json = question.toJson();
					let editor = app.workspace.activeEditor?.editor;
					if (editor !== undefined)
						block.replaceContents(Question.TAG, json, editor);
				}));
		this.setRandom(this.hasRandom, tables);
	}
	setRandom(hasRandom: boolean, tables: Tables) {
		this.question.hasRandom = hasRandom;
		this.hasRandom = hasRandom;
		this.meaningSetting?.setVisibility(hasRandom);
		if (this.infoDisplay1 !== undefined)
			this.infoDisplay1.setValue(this.question.toText(tables));
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
