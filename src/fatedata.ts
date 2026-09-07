import { Setting, TextAreaComponent, ButtonComponent, DisplayValueComponent, DropdownComponent } from 'obsidian';
import { Tables } from './tables2.js';
import { assertDefined, mTrace, mythicDice } from './main.js';
import { Exclude, Expose } from 'class-transformer';
export interface ChaosProvider {
	chaosValue(): number;
}
export class DummmyChaosProvider implements ChaosProvider {
	chaosValue(): number { return 5; }
}
/** contains the data for fate questions, including those derived from meaning or random event. */
export class FateData {
	@Expose() description: string;
	@Expose() odds: string;
	// chaosFactor: number;
	@Exclude() chaosProvider: ChaosProvider = new DummmyChaosProvider;
	@Expose() dice: Array<number>;
	constructor(chaosProvider: ChaosProvider) {
		// mTrace('fate', "making fate",);
		this.description = "";
		this.odds = 'certain';
		// this.chaosFactor = 5;
		this.chaosProvider = chaosProvider;
		this.dice = [0, 0];
	}
	chaosMod(): number {
		assertDefined(this.chaosProvider);
		const chaosFactor = this.chaosProvider.chaosValue();
		return chaosFactor > 7 ? chaosFactor - 4 : chaosFactor < 3 ? chaosFactor - 6 : chaosFactor - 5;
	}
	/** describe the question in plain text */
	toText(tables: Tables): string {
		let mod: number = tables.getQuestionOdds(this.odds).fate_check_modifier;
		let roll_total = (this.dice[0] ?? 0) + (this.dice[1] ?? 0) + mod + this.chaosMod(); // always d10
		let answer = tables.fateCheckAnswers.resolve(roll_total);
		return `${this.description}: ${answer.text} (${this.dice[0]}/${this.dice[1]} = ${roll_total})`;
	}
	/** create HTML for display */
	toHtml(divElt: HTMLElement, tables: Tables) {
		let spanFate: HTMLSpanElement = divElt.createSpan({ cls: 'mythic-fate' });
		try {
			spanFate.createSpan({ text: "(fate) " });
			spanFate.createEl('b', { text: ` ${this.description}` });
			spanFate.createSpan({ text: ` ${this.dice[0]}/${this.dice[1]}` });
			spanFate.createSpan({ text: ` odds: ${this.odds}` });
			const mod: number = tables.getQuestionOdds(this.odds).fate_check_modifier;
			const chaos = this.chaosMod();
			spanFate.createEl('i', { text: ` (${this.dice[0] ?? 0} + ${this.dice[1] ?? 0} + ${mod} + ${chaos})` });
			const roll_total = (this.dice[0] ?? 0) + (this.dice[1] ?? 0) + mod + chaos; // always d10
			const answer = tables.fateCheckAnswers.resolve(roll_total);
			spanFate.createSpan({ text: ` = ${roll_total}` });
			spanFate.createEl('b', { text: ` (${answer.text})` });
			// mTrace('fate', this.dice, mod, chaos, "=", roll_total);
		} catch (error) {
			const msg = `error when rendering fate: ${error as Error}`;
			console.error(msg);
			divElt.createSpan({ text: msg, cls: 'mythic-error' });
		}
	}
	/** whether the fate merits creating a random event */
	isRandom(): boolean {
		const chaosFactor = this.chaosProvider.chaosValue();
		return ((this.dice[0] ?? 0) == (this.dice[1] ?? 0) && (this.dice[0] ?? 0) <= chaosFactor);
	}

	throwDice(): void {
		for (let d = 0; d < 2; d++) this.dice[d] = mythicDice(10);
	}
}
export class FateDataModal {
	questionSetting: Setting;
	oddsSetting: Setting;
	// chaosSetting: Setting;
	fateData?: FateData;
	textArea?: TextAreaComponent;
	oddsComponent?: DropdownComponent;
	throwButton?: ButtonComponent;
	infoDisplay?: DisplayValueComponent;
	throwButtonSetting: Setting;
	infoDisplaySetting: Setting;
	onDone?: (isRandom: boolean) => void;
	constructor(elt: HTMLElement, tables: Tables, onDone?: (isRandom: boolean) => void) {
		// mTrace('fate data', "constructing fate data for modal");
		this.onDone = onDone;
		this.questionSetting = new Setting(elt)
			.setName('Fate Question')
			.addTextArea((text) => {
				this.textArea = text;
				if (this.fateData !== undefined)
					text.setValue(this.fateData.description);
				else mTrace('fate', "fate data modal descr: no data on add question");
				text.onChange((value) => {
					if (this.fateData !== undefined)
						this.fateData.description = value;
					else console.warn("fate data modal descr: no data on change");
				});
			});

		this.oddsSetting = new Setting(elt).setName('Fate Odds').addDropdown((dropDown) => {
			this.oddsComponent = dropDown;
			// 	mTrace('fate data', "loading odds to dropdown", tables);
			for (let quOdds of tables.questionOdds) dropDown.addOption(quOdds.ident, quOdds.display);
			if (this.fateData !== undefined)
				dropDown.setValue(this.fateData.odds);
			else mTrace('fate', "fate data modal odds: no data on add odds");
			dropDown.onChange((value) => {
				if (this.fateData !== undefined)
					this.fateData.odds = value;
				else console.warn("fate data modal odds: no data on change");
			});
		});
		this.throwButtonSetting = new Setting(elt)
			.setDesc("This resolves the random event.").addButton((btn) => {
				this.throwButton = btn;
				btn
					.setButtonText("Resolve fate event")
					.setCta()
					.onClick(() => {
						// mTrace('fate data', "randomising fate event");
						if (this.fateData === undefined) {
							console.warn("no fate data");
							return;
						}
						this.fateData?.throwDice();
						if (this.infoDisplay !== undefined)
							this.infoDisplay.setValue(this.fateData?.toText(tables));
						if (this.onDone !== undefined) {
							// mTrace('fate', "random, callback");
							this.onDone(this.fateData == undefined ? false : this.fateData.isRandom());
						}
					});
			});
		this.infoDisplaySetting = new Setting(elt).addDisplayValue(disp => {
			this.infoDisplay = disp;
		});
	}
	setData(fateData: FateData | undefined, tables: Tables) {
		// mTrace('fate data', "setting fate data");
		assertDefined(fateData);
		this.fateData = fateData;
		if (fateData == undefined) return;
		if (this.textArea !== undefined)
			this.textArea.setValue(fateData.description);
		if (this.oddsComponent !== undefined)
			this.oddsComponent.setValue(this.fateData.odds);
		if (this.infoDisplay !== undefined)
			this.infoDisplay.setValue(this.fateData?.toText(tables));
	}
	setVisibility(visible: boolean, narr: string = "sv?") {
		// mTrace('fate data', "setting fate", visible ? "visible" : "invisible", narr);
		this.questionSetting.setVisibility(visible);
		this.oddsSetting.setVisibility(visible);
		this.throwButtonSetting.setVisibility(visible);
		this.infoDisplaySetting.setVisibility(visible);
		// this.chaosSetting.setVisibility(visible);
	}
}
