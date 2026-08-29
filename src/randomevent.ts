import { DiceRandom } from "./dice.js";
import { assertDefined, mTrace } from "./main.js";
import { Metadata } from "./metadata.js";
import { Question } from "./question.js";
import { CheckTableEntry, Interpretation, Tables } from "./tables2.js";

/** the focus of a random event */
export class EventFocus {
	event_focus: number = 0;
	object: string = "";
	objectNumber: number = 0; // not stable as the lists are not stable
	constructor() { }
	/** this does random things for an event focus. */
	throwDice(tables: Tables) {
		assertDefined(tables);
		const dice = new DiceRandom(tables.eventFocus.diceType ?? "2d10");
		this.event_focus = dice.throw()[0]; // ?? TODO standardise
		this.objectNumber = Math.floor(Math.random() * 100.0) / 100.0; // ?? TODO standardise
	}
	/** this returns the description of the random event focus. */
	focusDescr(tables: Tables): CheckTableEntry {
		const entry = tables.eventFocus.resolve(this.event_focus); // TODO standardise input?
		mTrace('randomevent', "focus resolved to", entry);
		return entry;
	}
	/** set the object */
	defineSelectedObject(metadata: Metadata, interpretation: string) {
		const objects = metadata.blockTable.objects(interpretation);
		if (objects.length == 0) console.warn("no objects to select from, for", interpretation);
		this.objectNumber = Math.floor(objects.length * this.objectNumber);
		const obj = objects[this.objectNumber];
		this.object = obj === undefined ? "(unknown)" : obj.description ?? obj?.name;
		mTrace('randomevent', `random object ${this.objectNumber} is ${this.object}`);
	}
	/** This returns a string describing the event focus. ~~This consults two separate tables for some MeaningKinds, but only one for the rest.~~ */
	toText(tables: Tables): string {
		mTrace('', "random event: explaining ");
		let parts = new Array<string>;
		const focus_descr = this.focusDescr(tables);
		let focus_explain = "";
		const meta = tables.objectKinds.get(focus_descr.interpretation);
		if (meta !== undefined) {
			const kind = meta.kind; //??
			parts.push(meta.displayName);
		}
		parts.push(this.object);
		switch (focus_descr.interpretation) {
			case Interpretation.None: break;
			case Interpretation.NewNPC: focus_explain = "Create a new NPC"; break;
			// default: focus_explain = `unknown interpretation: ${focus_descr.interpretation}`;
		}
		parts.push(focus_explain);
		return parts.join(' ');
	}
} 
