import { Type, plainToInstance, instanceToPlain } from 'class-transformer';
// import 'reflect-metadata';
import { Modal, App, Setting, MarkdownPostProcessorContext } from 'obsidian';
import { CodeBlock } from './codeblock.js';
// import { MythicSupportPluginSettings } from './settings.js';
import MythicSupportPlugin, { assertDefined } from './main.js';
import { Question } from './question.js';

const diceRegex: RegExp = /(?<sign>[-+]?)(?<numDice>[1-9]+)([dD](?<die>[0-9]+))?/g;
// dice text should come after a dice block
export class Dice {
	text: string;
	result: number = 0;
	description: string = "";
	static readonly TAG = 'mythic-dice';

	constructor(text: string) {
		this.text = text;
	}
	static fromJson(source: string): Dice {
		// @ts-ignore
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
		let dice: Dice = plainToInstance(Dice, JSON.parse(source));
		return dice;
	}
	toJson(): string {
		return JSON.stringify(instanceToPlain(this));
	}
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext) {
		// assertDefined(tables);
		// console.log("rendering scene", source);
		const dice: Dice = Dice.fromJson(source);
		let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-dice' });
		divElt.createSpan({ text: "Dice " });
		divElt.createEl('i', { text: `(${dice.description}: ${dice.text}) = ` });
		divElt.createSpan({ text: `${dice.result}` });
	}
	static matches(s: string): boolean {
		return diceRegex.test(s);
	}
	static match(s: string): RegExpStringIterator<RegExpMatchArray> | undefined {
		assertDefined(diceRegex);
		if (diceRegex == null) { console.error("bad regexp"); }
		else {
			for (let element of s.matchAll(diceRegex)) {
				// console.log("match", element);
			};
			let m = s.matchAll(diceRegex);
			// console.log("dice match is ", m);
			return m;
		}
		return undefined;
	}
	throw(): number {
		let m = Dice.match(this.text);
		// // console.log("dice match is ", m);
		let res = 0;
		if (m !== undefined) {
			for (let element of m) {
				let part = 0;
				if (element != null && element.groups !== undefined) {
					const g0 = element.groups;
					if (g0 !== undefined) {
						const numDice = parseInt(g0.numDice ?? "1") ?? 1;
						const die = parseInt(g0.die ?? "1") ?? 1;
						for (let i = 0; i < numDice; i++)
							part += Question.dice(die);
						if (g0.sign == "-")
							part = -part;
						// console.log(`dice ${g0.sign} ${numDice} d ${die} = ${part}`);
					}
				}
				res += part;
			}
		}
		// console.log("dice result is", res);
		return res;
	};
}

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
					// console.log("saving dice", dice.text, match);
					dice.result = dice.throw();
					const json = dice.toJson();
					let editor = app.workspace.activeEditor?.editor;
					if (editor !== undefined)
						block.replaceContents(Dice.TAG, json, editor);
				}));
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setButtonText('Cancel')
				.setCta()
				.onClick(() => {
					this.close();
				}));
	}
}
