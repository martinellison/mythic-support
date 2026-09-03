import { parse, ParseResult } from 'kdljs';
import { Vault } from "obsidian";
import { Type, plainToInstance, instanceToPlain } from 'class-transformer';
import { QuestionOdds } from './question.js';
import { assertDefined, mTrace } from './main.js';
import { DiceRandom } from './dice.js';
export const enum Interpretation {
	None = 'none',
	NewNPC = 'newnpc',
}
/** an entry on a check table. The result of a random selection. The interpretation is what action to take as a result. */
export class CheckTableEntry {
	max: number = 0;
	weight: number = 0;
	text: string = "??";
	interpretation: Interpretation = Interpretation.None;
	constructor(weight: number = 1, text: string = "", interpretation: Interpretation = Interpretation.None) {
		// this.min = min;
		this.max = 0;
		this.weight = weight ?? 1;
		this.text = text;
		this.interpretation = interpretation;
	}
}
/** a check table is a table that can be selected from randomly. */
class CheckTable {
	entries: Array<CheckTableEntry> = new Array<CheckTableEntry>;
	totWeights: number = 0;
	diceType?: string;
	diceMin: number = 0;
	diceMax: number = 0;
	texts(): Array<string> { return this.entries.map((entry) => entry.text); }
	fix(entries: Array<CheckTableEntry> = [], diceType?: string) {
		// mTrace('', "fixing", diceType, entries);
		this.diceType = diceType;
		this.totWeights = 0;
		entries.forEach((entry) => {
			this.totWeights += entry.weight;
			// mTrace('', "entry", entry, this.totWeights);
		});
		let w = 0;
		entries.forEach((entry) => {
			w += entry.weight;
			entry.max = w;
			// mTrace('', "entry", entry, this.totWeights);
		});
		if (this.diceType === undefined) {
			this.diceMax = this.totWeights;
			this.diceMin = 1;
		}
		else {
			const d = new DiceRandom(this.diceType);
			this.diceMax = d.max();
			this.diceMin = d.min();
		}
		this.entries = entries;
	}
	/** throw the dice, with values that can be fed to `resolve()` */
	throwDiceStandardised(): number {
		if (this.diceType === undefined) {
			return Math.floor(this.totWeights * Math.random());
		} else {
			const d = new DiceRandom(this.diceType);
			const [diceThrow, _descr] = d.throw();
			return diceThrow - d.min() + 1;
		}
	}
	/** This selects an entry from a table, given a random number. The table must be in increasing order. The tables can be weighted (not all entries have the same probability). `value` is the dice throw and should be 'standardised', meaning that the lowest value should be 1. If the value is too low, the first entry is returned; if too high, the last. */
	resolve(value: number): CheckTableEntry {
		mTrace("resolving", value);
		for (let entry of this.entries) {
			// mTrace("try", entry.max);
			if (value <= entry.max) {
				mTrace('tables', `resolving ${value}, found `, entry);
				return entry;
			}
		}
		const last = this.entries[this.entries.length - 1];
		if (last !== undefined) return last;
		// if there are no entries, return a dummy value
		return new CheckTableEntry(0, "(unknown)", Interpretation.None);
	}
}
/** which kind of object */
export enum ThingFamily { ThingObject, ThingChoice, OracleResponse, SimpleText };
/** describes some objects, including how to randomise them. */
export class MythicObjectMeta {
	family: ThingFamily = ThingFamily.ThingObject;
	kind: string = 'object';
	description: string = "object";
	displayName: string = "MythicObject";
	alt: string = "";
	noAlt: boolean = false;
	progress: boolean = false;
	constructor(
		family: ThingFamily = ThingFamily.ThingObject,
		kind: string = 'object',
		description: string = "object",
		displayName: string = "MythicObject",
		alt: string = "",
		noAlt: boolean = false,
		progress: boolean = false,) {
		this.family = family;
		this.kind = kind;
		this.description = description;
		this.displayName = displayName;
		this.alt = alt;
		this.noAlt = noAlt;
		this.progress = progress;
	}
}
export class Oracle {
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
	texts(): Array<string> {
		return this.entries.entries.map((entry) => entry.text);
	}
}
/** Tables read from a configuration file. */
export class Tables {
	questionOdds: Array<QuestionOdds>;
	fateCheckAnswers: CheckTable;
	@Type(() => Array<string>)
	eventFocus: CheckTable;
	oracles: Map<string, Oracle>;
	simples: Map<string, MythicObjectMeta>;
	objectKinds: Map<string, MythicObjectMeta>;
	// meaning: Map<string, MeaningTable>;
	result: string = ""; // non-empty means error
	constructor() {
		this.questionOdds = [];
		this.fateCheckAnswers = new CheckTable;
		// this.meaning = new Map<string, MeaningTable>;
		this.eventFocus = new CheckTable;
		this.oracles = new Map<string, Oracle>;
		this.simples = new Map<string, MythicObjectMeta>;
		this.objectKinds = new Map<string, MythicObjectMeta>;
		this.result = "";
	}
	/** convert from a JSON string */
	static async fromJson(source: string): Promise<Tables> {
		return plainToInstance(Tables, JSON.parse(source));
	}
	/** this finds the 'meta' for this object kind; it can return undefined if the tables are not loaded yet */
	meta(objectKind: string): MythicObjectMeta | undefined {
		const objectMeta = this.objectKinds.get(objectKind);
		if (objectMeta !== undefined) return objectMeta;
		const oracle = this.oracles.get(objectKind);
		if (oracle !== undefined) return oracle.meta;
		const simpleMeta = this.simples.get(objectKind);
		if (simpleMeta === undefined) {
			console.error(`cannot find meta for '${objectKind}'`);
			console.warn("have", this.objectKinds.size, this.oracles.size, this.simples.size);
			for (let k of this.objectKinds) { console.warn("obj", k[0]); }
			for (let k of this.oracles) { console.warn("oracles", k[0]); }
			for (let k of this.simples) { console.warn("simples", k[0]); }
		}
		// assertDefined(simpleMeta);
		return simpleMeta;
	}

	getQuestionOdds(ident: string): QuestionOdds {
		// mTrace('', "finding odds", ident);
		for (let questOdds of this.questionOdds) {
			if (questOdds.ident == ident) return questOdds;
		}
		return this.questionOdds[0] ?? new QuestionOdds(ident, ident, 0);
	}
}

export class KdlTables {
	static async load(vault: Vault): Promise<Tables> {
		// mTrace('kdl', "start parsing KDL");
		let table = new Tables;
		const files = ["tables.md", "tables-extra.md"];
		for (let file of files)
			await KdlTables.loadFromFile(file, table, vault);
		// mTrace('kdl', "tables", table);
		return table;
	}
	/** gets all the KDL */
	static async getKdl(file: string, table: Tables, vault: Vault): Promise<ParseResult | undefined> {
		const path = vault.getFileByPath(file);
		if (path == null) {
			console.warn("bad path for KDL", file, "resolved as", path);
			return;
		}
		const source = await vault.cachedRead(path);
		const kdl = parse(source);
		// mTrace('kdl', "KDL parse result", kdl);
		if (kdl.errors.length) {
			for (const e of kdl.errors) console.warn("kdl error", e);
			if (table.result == "") {
				const errTxt = kdl.errors.map(ex => `${ex} `).join("\n");
				table.result = `in parsing KDL: ${errTxt}`;
			}
			console.error("bad KDL", table.result);
		}
		return kdl;
	}
	/** gets all the questions from the KDL */
	static getQuestions(children: KdlNode[], table: Tables) {
		children.forEach((odds: KdlNode) => {
			// mTrace('', "odds", odds);
			const ident: string = odds.values[0] as string ?? "";
			const props = new Map(Object.entries(odds.properties));
			// mTrace('tables', "props is", props);
			assertDefined(props);
			const display = props.get('display') as string;
			const mod = parseInt(props.get('mod') as string ?? "0") ?? 0;
			table.questionOdds.push(new QuestionOdds(ident, display, mod));
		});
	}
	/** gets all the fate types from the KDL */
	static getFate(node: KdlNode, table: Tables) {
		const props = new Map(Object.entries(node.properties));
		const diceType = props.get('dice') as string;
		// mTrace('', "num dice", diceType);
		let entries = new Array<CheckTableEntry>;
		node.children.forEach(odds => {
			// mTrace('', "odds", odds);
			const text = odds.values[0] ?? "";
			const props = new Map(Object.entries(odds.properties));
			assertDefined(props);
			// const interpretation = props.interpretation as string;
			// const min = parseInt(props.min as string) ?? 0;
			const weight = parseInt(props.get('weight') as string ?? "1") ?? 1;
			// mTrace('', "fate", text, weight);
			entries.push(new CheckTableEntry(weight, text, Interpretation.None));
		});
		table.fateCheckAnswers.fix(entries, diceType);
	}
	/** gets all the events from the KDL */
	static getEventFocus(node: KdlNode, table: Tables) {
		const props = new Map(Object.entries(node.properties));
		const diceType = props.get('dice') as string;
		let entries = new Array<CheckTableEntry>;
		node.children.forEach(chance => {
			// mTrace('', "chance", chance);
			const text = chance.values[0] ?? "";
			const props = new Map(Object.entries(chance.properties));
			assertDefined(props);
			// const text = props.text as string;
			const interpretation = props.get('interpretation') as Interpretation;
			// const min = parseInt(props.min as string) ?? 0;
			entries.push(new CheckTableEntry(parseInt(props.get('weight') as string ?? "1") ?? 1, text, interpretation));
		});
		table.eventFocus.fix(entries, diceType);
	}
	/** gets all the   objects from the KDL */
	static getObjects(node: KdlNode, table: Tables) {
		node.children.forEach(kind => {
			// mTrace('', "object kind", kind);
			const ident = kind.values[0] ?? "";
			const props = new Map(Object.entries(kind.properties));
			assertDefined(props);
			// const text = odds.text as string;
			const display = props.get('display') as string;
			const description = props.get('description') as string;
			const progress = props.get('progress') as boolean;
			// mTrace('', "object kind has", kind, description, display);
			table.objectKinds.set(ident, new MythicObjectMeta(ThingFamily.ThingObject, kind.name, description, display, "", false, progress));
		});
	}
	/** gets all the simple object types from the KDL */
	static getSimples(node: KdlNode, table: Tables) {
		node.children.forEach(itemNode => {
			const ident: string = itemNode.values[0] ?? "";
			const props = new Map(Object.entries(itemNode.properties));
			assertDefined(props);
			const display = props.get('display') as string;
			const description = props.get('description') as string;
			const progress = false;
			table.simples.set(ident, new MythicObjectMeta(ThingFamily.SimpleText, ident, description, display, "", false, progress));
		});
	}
	/** gets all the oracles from the KDL */
	static getOracles(node: KdlNode, table: Tables) {
		node.children.forEach(tableNode => {
			const ident = tableNode.values[0] ?? "";
			const props = new Map(Object.entries(tableNode.properties));
			assertDefined(props);
			const diceType = props.get('dice') as string;
			const description = props.get('description') as string;
			let alt = props.get('alt') as string;
			let noAlt = props.get('noAlt') as boolean;
			let display = props.get('display') as string ?? ident;
			let entries = new Array<CheckTableEntry>;
			// let items = new Array<string>;
			tableNode.children.forEach(itemNode => {
				const itemIdent = itemNode.values[0] ?? "";
				const itemProps = new Map(Object.entries(tableNode.properties));
				const itemWeight = parseInt(itemProps.get('weight') as string ?? "1") ?? 1;
				const interpretation = itemProps.get('interpretation') as Interpretation ?? Interpretation.None;
				let entry = new CheckTableEntry(itemWeight, itemIdent, interpretation);
				// mTrace('table oracle', "entry", entry);
				entries.push(entry);
			});
			const progress = false;
			const meta = new MythicObjectMeta(ThingFamily.OracleResponse, ident, description, display, alt, noAlt, progress);
			let checkTable = new CheckTable;
			checkTable.fix(entries, diceType);
			table.oracles.set(ident, new Oracle(meta, checkTable, checkTable.diceMax));
		});
	}
	static async loadFromFile(file: string, table: Tables, vault: Vault) {
		const kdl = await KdlTables.getKdl(file, table, vault);
		assertDefined(kdl);
		let nodes: Array<KdlNode> = plainToInstance(Array<KdlNode>, kdl.output);
		// mTrace('', "tables as read from KDL", nodes);
		nodes.forEach((node: KdlNode) => {
			// mTrace('kdl', "node is", node);
			switch (node.name) {
				case 'questions':
					KdlTables.getQuestions(node.children, table);
					break;
				case 'fate':
					KdlTables.getFate(node, table);
					break;
				case 'eventFocus':
					KdlTables.getEventFocus(node, table);
					break;
				case 'objects':
					KdlTables.getObjects(node, table);
					break;
				case 'simples':
					KdlTables.getSimples(node, table);
					break;
				case 'oracles':
					KdlTables.getOracles(node, table);
					break;
				default:
					// mTrace('', "need to implement", node.name);
					console.error("unknown node type", node.name);
					if (table.result == "") table.result = `invalid table entry '${node.name}'.`;
			}
		});
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
