import { Metadata } from "./metadata.js";
import { Question } from "./question.js";
import { CheckTableEntry, Interpretation, Tables } from "./tables2.js";
import { Type, plainToInstance, instanceToPlain } from 'class-transformer';

export const enum MeaningKind {
	Action1 = 'action1', Action2 = 'action2', Description1 = 'description1', Description2 = 'description2', MythicObjects = 'objects', Locations = 'locations',
}
// random event
export class RandomEvent {
	event_focus: number = 0;
	event_meaning: Array<number> = [0, 0];
	meaning_kind: MeaningKind = MeaningKind.Action1; // this is set by QuestionModal and SceneModal
	object: string = "";
	objectRandom: number = 0;
	constructor() { }
	throwDice() {
		this.event_focus = Question.dice(100);
		for (let d = 0; d < 2; d++) this.event_meaning[d] = Question.dice(100);
		this.objectRandom = Math.trunc(Math.random() * 100.0) / 100.0;
	}
	focusDescr(tables: Tables): CheckTableEntry { return Tables.resolveCheckTable(tables.chances, this.event_focus); }
	interpret(tables: Tables, metadata: Metadata) {
		const focus_descr = this.focusDescr(tables);
		console.log("random event: interpreting focus", this.event_focus, focus_descr);
		if (metadata === undefined) console.error("no metadata");
		else if (metadata.blockTable === undefined) console.error("no blockTable");
		let has_kind = tables.objectKinds.has(focus_descr.interpretation);
		if (has_kind) {
			const objects = metadata.blockTable.objects(focus_descr.interpretation);
			if (objects.length == 0) console.warn("no objects to select from");
			const objectNumber = Math.floor(objects.length * this.objectRandom);
			this.object = objects[objectNumber]?.description ?? "??";
			console.log(`random object ${objectNumber} is ${this.object}`);
		} else {
			switch (focus_descr.interpretation) {
				case Interpretation.None:
					console.log("no interpretation");
					break;
				case Interpretation.Thread:
				case Interpretation.NPC: {
					console.error("object kinds configuration error, nothing for", focus_descr);
				}
					break;
				case Interpretation.NewNPC:
					console.log("new NPC");
					break;// TODO explain interpretation (new NPC)
			}
		}
	}
	explain(tables: Tables): string {
		console.log("random event: explaining ");
		// two separate tables for some MeaningKind, only one for the rest
		// const q1: number = this.event_meaning[0] ?? 0;
		// const q2: number = this.event_meaning[1] ?? 0;
		// const meaning1 = (this.meaning_kind == MeaningKind.Action2) ? MeaningKind.Action1 : (this.meaning_kind == MeaningKind.Description2) ? MeaningKind.Description1 : this.meaning_kind;
		// const meaning2 = (this.meaning_kind == MeaningKind.Action1) ? MeaningKind.Action2 : (this.meaning_kind == MeaningKind.Description1) ? MeaningKind.Description2 : this.meaning_kind;
		const focus_descr = this.focusDescr(tables);
		let fd2 = "";
		switch (focus_descr.interpretation) {
			case Interpretation.None: break;
			case Interpretation.Thread: fd2 = `[thread ${this.object}]`; break;
			case Interpretation.NPC: fd2 = `[npc ${this.object}]`; break;
			case Interpretation.NewNPC: fd2 = `[new npc ${this.object}]`; break;// TODO explain interpretation (new NPC)
		}
		// let m1t = tables.meaning.get(this.meaning1());
		// if (m1t === undefined) return "";
		// let m2t = tables.meaning.get(this.meaning2());
		// if (m2t === undefined) return "";
		const meanings = RandomEvent.meanings(tables, this.event_meaning, this.meaning_kind);
		const str: string = `${focus_descr.text} ${fd2} (${this.event_focus}), meaning ${this.meaning_kind} ${meanings}`;
		return str;
	}
	static meaning1(meaningKind: MeaningKind): MeaningKind {
		switch (meaningKind) {
			case MeaningKind.Action2: return MeaningKind.Action1;
			case MeaningKind.Description2: return MeaningKind.Description1;
			default: return meaningKind;
		}
	}
	static meaning2(meaningKind: MeaningKind): MeaningKind {
		switch (meaningKind) {
			case MeaningKind.Action1: return MeaningKind.Action2;
			case MeaningKind.Description2: return MeaningKind.Description1;
			default: return meaningKind;
		}
	}
	static meanings(tables: Tables, event_meaning: Array<number> = [0, 0], meaningKind: MeaningKind): string {
		const q1: number = event_meaning[0] ?? 0;
		const q2: number = event_meaning[1] ?? 0;
		const m1t = tables.meaning.get(RandomEvent.meaning1(meaningKind)) ?? [];
		const m2t = tables.meaning.get(RandomEvent.meaning2(meaningKind)) ?? [];
		const m1 = m1t[q1 - 1] ?? "";
		const m2 = m2t[q2 - 1] ?? "";
		return `${m1}/${m2} (${q1}/${q2})`;
	}
}

export class MeaningTableEntry {
	kind: string = MeaningKind.Action1;
	@Type(() => Array<string>)
	items: Array<string> = new Array<string>;
}
export class MeaningTable {
	@Type(() => MeaningTableEntry)
	entries: Array<MeaningTableEntry>;
	constructor() {
		this.entries = [];
	}
	static async fromJson(source: string): Promise<MeaningTable> {
		return plainToInstance(MeaningTable, JSON.parse(source));
	}
}
