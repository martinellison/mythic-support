import { plainToInstance, instanceToPlain, Expose } from 'class-transformer';
import { Modal, App, Setting, MarkdownPostProcessorContext, DropdownComponent } from 'obsidian';
import { CodeBlock } from './codeblock.js';
import { assertDefined, mTrace, mythicDice, shorten } from './main.js';
// import { Question } from './question.js';
import { Oracle, Tables } from './tables2.js';

/**  implements an zzz block. meaning text should come after a meaning block */
export class Meaning {
	@Expose() description: string = "";
	@Expose() meaningKind: string = 'action1';
	@Expose() randoms: Array<number> = [0, 0];
	@Expose() result1: string = "";
	@Expose() result2: string = "";
	static readonly TAG = 'mythic-meaning';
	constructor(meaningKind: string = 'action1') {
		this.meaningKind = meaningKind;
	}
	// typ(): string { return 'meaning'; }
	/** convert from a JSON string to a Meaning. */
	static fromJson(source: string): Meaning {
		try {
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
			let meaning: Meaning = plainToInstance(Meaning, JSON.parse(source), { excludeExtraneousValues: true });
			if (meaning.meaningKind == '') meaning.meaningKind = 'action1';
			return meaning;
		} catch (error) {
			console.error("error parsing meaning: ", error, "reading:", shorten(source));
			throw error;
		}
	}
	/** convert  a Meaning to a JSON string */
	toJson(): string {
		return JSON.stringify(instanceToPlain(this));
	}
	/** create HTML for display */
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext) {
		// assertDefined(tables);
		let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-meaning' });
		try {
			mTrace('meaning', "rendering meaning", source);
			const meaning: Meaning = Meaning.fromJson(source);
			divElt.createSpan({ text: `(meaning) ` });
			let descElt = divElt.createEl('i');
			descElt.createEl('b', { text: `${meaning.description}:` });
			divElt.createSpan({ text: ` ${meaning.result1}` });
			divElt.createEl('b', { text: ` ${meaning.result2}` });
		} catch (error) {
			const msg = `error when parsing meaning: ${error as Error}`;
			console.error(msg);
			divElt.createSpan({ text: msg, cls: 'mythic-error' });
		}
	}
	/** This throws the dice. */
	throwDice(max: number[]) {
		for (let d = 0; d < 2; d++) this.randoms[d] = mythicDice(max[d] ?? 100);
		mTrace('meaning', "meaning result is", this.randoms);
	};
	/** sets `this.result to a textual description of the randomly chosen meaning. */
	explain(tables: Tables) {
		const tab = tables.oracles.get(this.meaningKind);
		if (tab === undefined) {
			this.result1 = `unknown ${this.meaningKind}`;
			this.result2 = "";
			console.warn("cannot explain", this.meaningKind);
			return;
		}
		const meanings = Meaning.meanings(tables, this.randoms, this.meaningKind);
		this.result1 = `(${tab.meta.displayName ?? tab.meta.description})`;
		this.result2 = `${meanings}`;
		mTrace('meaning', `${this.meaningKind} meaning explained as ${this.result1}: ${this.result2}`);
	}
	/** this selects a meaning. */
	static meaning1(tables: Tables, meaningKind: string): string {
		return meaningKind;
	}
	/** this selects another meaning. This is different from `meaning1` if the `alt` flag is et. */
	static meaning2(tables: Tables, meaningKind: string): string {
		if (meaningKind == '') return '';
		// for (const [k, _v] of tables.meaning) mTrace('meaning', "meaning table", k);
		const tab = tables.oracles.get(meaningKind);
		if (tab !== undefined && tab instanceof Oracle) {
			if (tab.meta.noAlt) return "";
			if (tab.meta.alt) return tab.meta.alt;
			return meaningKind;
		} else {
			const err = `unknown '${meaningKind}'`;
			console.error("in meaning2, ", err, "for", meaningKind);
			if (tab !== undefined)
				console.warn("found ", tab);
			// for (const k of tables.oracles.keys()) mTrace('meaning oracles', k);
			return err;
		}
	}
	/** this gets the selected tables */
	static selectedTables(tables: Tables, meaningKind: string): [string[], string[]] {
		const m1 = Meaning.meaning1(tables, meaningKind);
		const m2 = Meaning.meaning2(tables, meaningKind);
		const ms1 = tables.oracles.get(m1)?.texts() ?? [];
		const ms2 = tables.oracles.get(m2)?.texts() ?? [];
		return [ms1, ms2];
	}
	/** This returns a string containing a pair of meanings. */
	static meanings(tables: Tables, event_meaning: Array<number> = [0, 0], meaningKind: string): string {
		const q1: number = event_meaning[0] ?? 0;
		const q2: number = event_meaning[1] ?? 0;
		const [m1t, m2t] = Meaning.selectedTables(tables, meaningKind);
		const m1 = m1t[q1 - 1] ?? "";
		const m2 = m2t[q2 - 1] ?? "";
		return `${m1}/${m2} (${q1}/${q2})`;
	}
	/** this returns the sizes of the selected tables. */
	tableSizes(tables: Tables): Array<number> {
		assertDefined(tables);
		// if (this.meaningKind == 'none') console.warn("no meaning kind in tableSizes");
		let ts = new Array<number>;
		const tabs = Meaning.selectedTables(tables, this.meaningKind);
		for (const t of tabs)
			ts.push(t.length ?? 0);
		mTrace('meaning', "table sizes are", ts);
		return ts;
	}
}
/** dialog to edit a Meaning. */
export class MeaningModal extends Modal {
	meaning: Meaning;
	constructor(app: App, meaning: Meaning, block: CodeBlock, tables: Tables) {
		super(app);
		assertDefined(tables);
		assertDefined(meaning);
		this.meaning = meaning;
		this.setTitle('Meaning'); new Setting(this.contentEl)
			.setName('Description')
			.addTextArea((text) => {
				text.setValue(this.meaning.description);
				text.onChange((value) => {
					this.meaning.description = value;
				});
			});
		let dc: DropdownComponent | undefined;
		MeaningModal.makeMeaning(this.contentEl, dc, tables, (meaningKind: string) => {
			if (meaning !== undefined) {
				this.meaning.meaningKind = meaningKind;
				this.meaning.explain(tables);
			}
		}, this.meaning);
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setButtonText("Throw dice and save")
				.setCta()
				.onClick(() => {
					this.close();
					meaning.throwDice(meaning.tableSizes(tables));
					meaning.explain(tables);
					const json = meaning.toJson();
					mTrace('meaning', "save as", json);
					let editor = app.workspace.activeEditor?.editor;
					if (editor !== undefined)
						block.replaceContents(Meaning.TAG, json, editor);
				}))
			.addButton((btn) => btn
				.setButtonText('Cancel')
				.setCta()
				.onClick(() => {
					this.close();
				}));
	}
	/** create a drop down to select a meaning oracle. */
	static makeMeaning(elt: HTMLElement, dropDownResult: DropdownComponent | undefined, tables: Tables, onChange: (meaningKind: string) => void, meaning: Meaning | undefined) {
		if (meaning === undefined) { console.warn("no meaning for dropdown"); } // LATER if this actually happens, fix it; otherwise change it to an assert
		new Setting(elt)
			.setDesc("Select which meaning tables to consult.").setName('Meaning').addDropdown((dropDown) => {
				dropDownResult = dropDown;
				let tabKind, tab;
				for ([tabKind, tab] of tables.oracles) {
					mTrace('meaning', "drop", tab.meta.noAlt, tab.meta.displayName);
					if (!tab.meta.noAlt)
						dropDown.addOption(tabKind, tab.meta.displayName);
				}
				dropDown.setValue(meaning === undefined ? 'action1' : meaning.meaningKind);
				dropDown.onChange((value) => {
					mTrace('meaning', "meaning changed to", value);
					// if (meaning !== undefined) {
					// meaning.meaningKind = value; // does not work?
					onChange(value);
					// }
				});
			});
	}
};
