import { Type, plainToInstance, instanceToPlain, Expose } from 'class-transformer';
// import 'reflect-metadata';
import { Modal, App, Setting, MarkdownPostProcessorContext } from 'obsidian';
import { CodeBlock } from './codeblock.js';
// import { MythicSupportPluginSettings } from './settings.js';
import MythicSupportPlugin, { assertDefined, mTrace, mythicDice, shorten } from './main.js';
import { Question } from './question.js';

const diceRegex: RegExp = /(?<sign>[-+]?)(?<numDice>[1-9]+)?([dD](?<die>[0-9]+))?/g;
/**  implements an zzz block. a question block that just throws some dice. */
export class Dice {
	@Expose() text: string;
	@Expose() result: number = 0;
	@Expose() explain: string = "";
	@Expose() description: string = "";
	static readonly TAG = 'mythic-dice';

	constructor(text: string) {
		this.text = text;
	}
	/** convert Dice from a JSON string */
	static fromJson(source: string): Dice {
		try {
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
			let dice: Dice = plainToInstance(Dice, JSON.parse(source), { excludeExtraneousValues: true });
			return dice;
		} catch (error) {
			console.error("error parsing dice: ", error, "reading:", shorten(source));
			// return new MythicObject("", "", "", "", false);
			throw error;
		}
	}
	/** convert Dice to a JSON string */
	toJson(): string {
		return JSON.stringify(instanceToPlain(this));
	}
	/** create HTML for display */
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext) {
		// mTrace('dice', "rendering dice", source);
		let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-dice' });
		try {
			const dice: Dice = Dice.fromJson(source);
			divElt.createSpan({ text: `(dice) ${dice.description}:` });
			divElt.createEl('i', { text: ` ${dice.text} =` });
			divElt.createEl('b', { text: ` ${dice.result}` });
			divElt.createSpan({ text: ` (${dice.explain})` });
		} catch (error) {
			divElt.createSpan({ text: `error in parsing dice: ${error as Error}`, cls: 'mythic-error' });
		}
	}
	static matches(s: string): boolean {
		return diceRegex.test(s);
	}
	static match(s: string): RegExpStringIterator<RegExpMatchArray> | undefined {
		assertDefined(diceRegex);
		if (diceRegex == null) { console.error("bad regexp"); }
		else {
			// for (let element of s.matchAll(diceRegex)) {
			// 	mTrace('', "match", element);
			// };
			let m = s.matchAll(diceRegex);
			// mTrace('', "dice match is ", m);
			return m;
		}
		return undefined;
	}
	throw(): [number, string] {
		const d = new DiceRandom(this.text);
		return d.throw();
	}
}
/** represents a dice expression like `2d6`. Ggenerates a random number */
export class DiceRandom {
	items: Array<DiceItem> = [];
	constructor(s: string) {
		let m = Dice.match(s);
		if (m === undefined) return;
		for (let element of m) {
			if (element == null || element.groups === undefined) continue;
			const group = element.groups;
			if (group === undefined || (group.numDice === undefined && group.die === undefined)) continue;
			const numDice = parseInt(group.numDice ?? "1") ?? 1;
			const die = parseInt(group.die ?? "1") ?? 1;
			const sign = group.sign ? group.sign : "+";
			this.items.push(new DiceItem(sign, numDice, die));
		}
	}
	/** returns the smallest number that the dice can throw */
	min(): number {
		let m = 0;
		this.items.forEach((item) => {
			m += item.min();
		});
		return m;
	}
	/** returns the largest number that the dice can throw */
	max(): number {
		let m = 0;
		this.items.forEach((item) => {
			m += item.max();
		});
		return m;
	}
	/** This actually throws the dice, and returns the total and a text breakdown. */
	throw(): [number, string] {
		let total = 0;
		let explains = new Array<string>;
		this.items.forEach((item) => {
			const [part, exp] = item.throw();
			total += part; explains.push(exp);
		});
		return [total, explains.join("")];
	}
}
/** part of a random */
class DiceItem {
	sign: string = "+";
	numDice: number = 1;
	die: number = 1;
	constructor(sign: string = "+", numDice: number = 1, die: number = 1) {
		this.sign = sign; this.numDice = numDice; this.die = die;
	}
	/** returns the smallest number that the dice can throw */
	min(): number {
		return this.numDice * (this.sign == "-" ? - this.die : 1);
	}
	/** returns the largest number that the dice can throw */
	max(): number {
		return this.numDice * (this.sign == "-" ? -1 : this.die);
	}
	throw(): [number, string] {
		let part = 0;
		let explains = new Array<string>;
		for (let i = 0; i < this.numDice; i++) {
			const thrown = mythicDice(this.die);
			part += thrown;
			explains.push(`${this.sign}${thrown}`);
		}
		if (this.sign == "-")
			part = -part;
		return [part, explains.join("")];
	}
}
/** display a Dice for editing */
export class DiceModal extends Modal {
	dice: Dice;
	constructor(app: App, dice: Dice, block: CodeBlock) {
		super(app);
		this.dice = dice;
		this.setTitle('Dice'); new Setting(this.contentEl)
			.setName('Description')
			.addText((text) => {
				text.setValue(this.dice.description);
				text.onChange((value) => {
					this.dice.description = value;
				});
			});
		new Setting(this.contentEl)
			.setName('Dice')
			.addText((text) => {
				text.setValue(this.dice.text);
				text.onChange((value) => {
					if (Dice.matches(value))
						this.dice.text = value;
				});
			});
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setButtonText("Throw dice and save")
				.setCta()
				.onClick(async (): Promise<void> => {
					this.close();
					let match = Dice.match(this.dice.text);
					mTrace('dice', "saving dice", dice.text);
					const [result, explain] = dice.throw();
					dice.result = result;
					dice.explain = explain;
					const json = dice.toJson();
					let editor = app.workspace.activeEditor?.editor;
					if (editor !== undefined)
						block.replaceContents(Dice.TAG, json, editor);
				}))
			.addButton((btn) => btn
				.setButtonText('Cancel')
				.setCta()
				.onClick(() => {
					this.close();
				}));
	}
}
