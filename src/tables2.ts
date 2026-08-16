import { parse } from 'kdljs';
import { TFile, Vault } from "obsidian";
import { Type, plainToInstance, instanceToPlain } from 'class-transformer';
import { QuestionOdds } from './question.js';
import { MeaningKind } from './randomevent.js';
import { Metadata } from './metadata.js';
import { assertDefined } from './main.js';
export const enum Interpretation {
	None = 'none',
	Thread = 'thread',
	NPC = 'npc',
	NewNPC = 'newnpc',
}
export class CheckTableEntry {
	min: number = 0;
	weight: number = 0;
	text: string = "??";
	interpretation: Interpretation = Interpretation.None;
	constructor(weight: number = 1, text: string = "", interpretation: Interpretation = Interpretation.None) {
		// this.min = min;
		this.weight = weight ?? 1;
		this.text = text;
		this.interpretation = interpretation;
	}
}
class CheckTable {
	entries: Array<CheckTableEntry> = new Array<CheckTableEntry>;
	totWeights: number = 0;
	// min: number = 0;
	// max: number = 0;
	numDice: number = 1;
	diceMax: number = 0;
	fix(entries: Array<CheckTableEntry> = [], numDice: number = 1) {
		// console.log("fixing", numDice, entries);
		this.numDice = numDice;
		entries.forEach((entry) => {
			entry.min = this.totWeights;
			this.totWeights += entry.weight;
			// console.log("entry", entry, this.totWeights);
		});
		if (this.numDice > 0)
			this.diceMax = this.totWeights / this.numDice;
		this.entries = entries;
	}
}
export const enum ThingFamily { Object, Random, Simple };
export class MythicObjectMeta {
	family: ThingFamily = ThingFamily.Object;
	kind: string = 'object';
	description: string = "object";
	displayName: string = "MythicObject";
	constructor(
		family: ThingFamily = ThingFamily.Object,
		kind: string = 'object',
		description: string = "object",
		displayName: string = "MythicObject") {
		this.family = family;
		this.kind = kind;
		this.description = description;
		this.displayName = displayName;
	}
}
export class Random {
	meta: MythicObjectMeta;
	entries: CheckTable;
	max: number;
	constructor(meta: MythicObjectMeta,
		entries: CheckTable,
		max: number) {
		this.meta = meta;
		this.entries = entries;
		this.max = max;
	}
}
export class Tables {
	questionOdds: Array<QuestionOdds>;
	fateCheckAnswers: CheckTable;
	@Type(() => Array<string>)
	chances: CheckTable;
	randoms: Map<string, Random>;
	simples: Map<string, MythicObjectMeta>;
	objectKinds: Map<string, MythicObjectMeta>;
	meaning: Map<MeaningKind, Array<string>>;
	constructor() {
		this.questionOdds = [];
		this.fateCheckAnswers = new CheckTable;
		this.meaning = new Map<MeaningKind, Array<string>>;
		this.chances = new CheckTable;
		this.randoms = new Map<string, Random>;
		this.simples = new Map<string, MythicObjectMeta>;
		this.objectKinds = new Map<string, MythicObjectMeta>;
	}
	static async fromJson(source: string): Promise<Tables> {
		return plainToInstance(Tables, JSON.parse(source));
	}
	meta(objectKind: string): MythicObjectMeta {
		const objectMeta = this.objectKinds.get(objectKind);
		if (objectMeta !== undefined) return objectMeta;
		const random = this.randoms.get(objectKind);
		if (random !== undefined) return random.meta;
		const simpleMeta = this.simples.get(objectKind);
		assertDefined(simpleMeta);
		return simpleMeta;
	}

	// table must be in decreasing order
	static resolveCheckTable(table: CheckTable, value: number): CheckTableEntry {
		for (let entry of table.entries)
			if (value >= entry.min)
				return entry;
		const last = table.entries[table.entries.length - 1];
		if (last !== undefined) return last;
		return new CheckTableEntry(0, "??", Interpretation.None);
	}
	getQuestionOdds(ident: string): QuestionOdds {
		// console.log("finding odds", ident);
		for (let o of this.questionOdds) {
			if (o.ident == ident) return o;
		}
		return this.questionOdds[0] ?? new QuestionOdds("?", 0);
	}
}

export class KdlTables {
	static async load(vault: Vault): Promise<Tables> {
		const file = "tables.md";
		const path = vault.getFileByPath(file);
		if (path == null) { console.error("bad path for KDL", file, "resolved as", path); return new Tables; }
		const source = await vault.cachedRead(path);
		const kdl = parse(source);
		let nodes: Array<KdlNode> = plainToInstance(Array<KdlNode>, kdl.output);
		console.log("tables as read from KDL", nodes);
		let table = new Tables;
		nodes.forEach((node: KdlNode) => {
			// console.log("node is", node);
			switch (node.name) {
				case 'questions':
					node.children.forEach(odds => {
						// console.log("odds", odds);
						const ident = odds.values[0] ?? "";
						const props = odds.properties;
						const display = props.display as string;
						const mod = parseInt(props.mod as string ?? "0") ?? 0;
						table.questionOdds.push(new QuestionOdds(display, mod)); // TODO ident
					});
					break;
				case 'fate': {
					const props = node.properties;
					const numDice = parseInt(props.dice as string ?? "1") ?? 1;
					// console.log("num dice", numDice);
					let entries = new Array<CheckTableEntry>;
					node.children.forEach(odds => {
						// console.log("odds", odds);
						const text = odds.values[0] ?? "";
						const props = odds.properties;
						// const interpretation = props.interpretation as string;
						// const min = parseInt(props.min as string) ?? 0;
						const weight = parseInt(props.weight as string ?? "1") ?? 1;
						// console.log("fate", text, weight);
						entries.push(new CheckTableEntry(weight, text));
					});
					table.fateCheckAnswers.fix(entries, numDice);
				}
					break;
				case 'chances': {
					const props = node.properties;
					const numDice = parseInt(props.dice as string ?? "1") ?? 1;
					let entries = new Array<CheckTableEntry>;
					node.children.forEach(chance => {
						// console.log("chance", chance);
						const text = chance.values[0] ?? "";
						const props = chance.properties;
						// const text = props.text as string;
						const interpretation = props.interpretation as Interpretation;
						// const min = parseInt(props.min as string) ?? 0;
						entries.push(new CheckTableEntry(parseInt(props.weight as string ?? "1") ?? 1, text));
					});
					table.chances.fix(entries, numDice);
				}
					break;
				case 'objects':
					node.children.forEach(kind => { // TODO FIXME this is wrong
						// console.log("object kind", kind);
						const ident = kind.values[0] ?? "";
						const props = kind.properties;
						// const text = odds.text as string;
						const display = props.display as string;
						const description = props.description as string;
						console.log("object kind has", kind, description, display);
						table.objectKinds.set(ident, new MythicObjectMeta(ThingFamily.Object, kind.name, description, display));
					});
					break;
				case 'randoms': {
					node.children.forEach(tableNode => {
						const ident = tableNode.values[0] ?? "";
						const props = tableNode.properties;
						const numDice = parseInt(props.dice as string ?? "1") ?? 1;
						const display = props.display as string;
						const description = props.description as string;
						let entries = new Array<CheckTableEntry>;
						tableNode.children.forEach(itemNode => {
							const itemIdent = itemNode.values[0] ?? "";
							const itemProps = tableNode.properties;
							const itemWeight = parseInt(itemProps.weight as string ?? "1") ?? 1;
							let entry = new CheckTableEntry(itemWeight, itemIdent);
							entries.push(entry);
						});
						const meta = new MythicObjectMeta(ThingFamily.Random, ident, description, display);
						let checkTable = new CheckTable;
						checkTable.fix(entries, numDice);
						table.randoms.set(ident, new Random(meta, checkTable, checkTable.diceMax));
					});
				}
					break;
				case 'simples':
					node.children.forEach(itemNode => {
						const ident: string = itemNode.values[0] ?? "";
						const props = itemNode.properties;
						const display = props.display as string;
						const description = props.description as string;
						table.simples.set(ident, new MythicObjectMeta(ThingFamily.Simple, ident, description, display));
					});
					break;
				case 'tables':
					node.children.forEach(list => {
						const ident = list.values[0] ?? "";
						// console.log("list", ident, list);
						let items = new Array<string>;
						list.children.forEach(item => {
							const text = item.values[0] ?? "";
							// console.log("item", item, ident);
							items.push(text);

						});
						table.meaning.set(ident as MeaningKind, items);
					});
					break;
				default:
					console.log("need to implement", node.name);
			}
		});
		console.log("tables", table);
		return table;
	}
}
class KdlNode {
	name: string = "";
	properties: Map<string, any> = new Map<string, any>();
	values: Array<string> = [];
	@Type(() => KdlNode)
	children: Array<KdlNode> = [];
	@Type(() => KdlTags)
	tags: KdlTags = new KdlTags;
}
class KdlTags {
	properties: Map<string, string> = new Map<string, string>();
	values: Array<string> = [];
}
