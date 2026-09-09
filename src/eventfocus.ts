// import { DiceRandom } from "./dice.js";
import { assertDefined, mTrace, shorten } from "./main.js";
import { Metadata } from "./metadata.js";
// import { Question } from "./question.js";
import { Expose } from 'class-transformer';
import { CheckTableEntry, Interpretation, Tables } from "./tables2.js";
import { MarkdownPostProcessorContext } from "obsidian";

/** the focus of a random event */
export class EventFocus {
	@Expose() event_focus_index: number = 0;
	@Expose() object: string = "";
	@Expose() objectNumber: number = 0; // not stable as the lists are not stable
	constructor() { }
	/** this does random things for an event focus. */
	throwDice(tables: Tables) {
		assertDefined(tables);
		mTrace('eventfocus', "throwing dice for focus");
		// const dice = new DiceRandom(tables.eventFocus.diceType ?? "2d10");
		// this.event_focus_index = dice.throw()[0]; 
		this.event_focus_index = tables.eventFocus.throwDiceStandardised();
		this.objectNumber = Math.floor(Math.random() * 100.0) / 100.0;
	}
	/** this returns the description of the random event focus. */
	focusDescr(tables: Tables): CheckTableEntry {
		const entry = tables.eventFocus.resolve(this.event_focus_index);
		mTrace('eventfocus', "focus resolved to", entry);
		return entry;
	}
	/** set the object (or no object, for some interpretations) */
	defineSelectedObject(metadata: Metadata, interpretation: string) {
		const objects = metadata.blockTable.objects(interpretation);
		if (objects.length == 0) {
			mTrace('event', "no objects to select from, for", interpretation);
			this.objectNumber = 0;
			this.object = '';
		} else {
			this.objectNumber = Math.floor(objects.length * this.objectNumber);
			const obj = objects[this.objectNumber];
			this.object = obj === undefined ? "" : obj.description ?? obj?.name;
			mTrace('eventfocus', `random object ${this.objectNumber} is ${this.object}`);
		}
	}
	/** This returns a string describing the event focus. ~~This consults two separate tables for some MeaningKinds, but only one for the rest.~~ */
	toText(tables: Tables): string {
		mTrace('', "random event: explaining ");
		let parts = new Array<string>;
		const focus_descr = this.focusDescr(tables);
		const meta = tables.objectKinds.get(focus_descr.interpretation);
		if (meta !== undefined) {
			// const kind = meta.kind;
			parts.push(meta.displayName);
		}
		if (this.object != "")
			parts.push(this.object);
		switch (focus_descr.interpretation) {
			case Interpretation.None: break;
			case Interpretation.NewNPC: parts.push("Create a new NPC"); break;
		}
		parts.push(focus_descr.text);
		return parts.join(' ');
	}
	/** create HTML for display */
	toHtml(divElt: HTMLElement, tables: Tables): void {
		let spanFocus: HTMLSpanElement = divElt.createSpan({ text: " (focus) ", cls: 'mythic-focus' });
		try {
			const focus_descr = this.focusDescr(tables);
			const meta = tables.objectKinds.get(focus_descr.interpretation);
			if (meta !== undefined) {
				// const kind = meta.kind;
				spanFocus.createSpan({ text: meta.displayName });
			}
			if (this.object != "")
				spanFocus.createSpan({ text: this.object });
			switch (focus_descr.interpretation) {
				case Interpretation.None: break;
				case Interpretation.NewNPC: spanFocus.createSpan({ text: "Create a new NPC" }); break;
			}
			spanFocus.createSpan({ text: focus_descr.text });
		} catch (error) {
			console.error("error displaying event focus: ", error);
			spanFocus.createSpan({ text: `error in displaying event focus: ${error as Error}`, cls: 'mythic-error' });
		}
	}
}
