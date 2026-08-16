import { CachedMetadata, MetadataCache, Pos, TAbstractFile, TFile, Vault, } from "obsidian";
import MythicSupportPlugin, { assertDefined } from "./main.js";
import { MythicObject } from "./object.js";
// class FrontMatter {
// 	mythic_adventure: string = "";
// }
class Context {
	hello: number = -1;
}
export class Block {
	header: string = "";
	body: string = "";
	constructor(header: string = "", body: string = "") {
		this.header = header;
		this.body = body;
	}
	asMythicObject(): MythicObject | undefined {
		// // console.log(`thread header check '${this.header}' '${MythicObject.TAG}'`);
		if (this.header != MythicObject.TAG) return undefined;
		// console.log("have object");
		return MythicObject.fromJson((this.body));
	}
}
export class BlockTable {
	table: Map<string, Array<Block>>;
	// queue: AsyncQueue<BlockOperation> = new AsyncQueue<BlockOperation>();
	constructor() {
		this.table = new Map<string, Array<Block>>;
	}
	clearAll() {
		// console.log("clearing block tables");
		this.table = new Map<string, Array<Block>>;
	}
	analyseCodeBlock(data: string, pos: Pos, file: TFile, narr: string): void {
		// console.log("analysing", file.path);
		let out_lines = new Array<string>;
		const in_lines = data.split('\n');
		// // console.log("code block", pos, data.substring(pos.start.offset, pos.end.offset - pos.start.offset));
		const start_line = in_lines[pos.start.line] || "";
		for (let i = pos.start.line + 1; i < pos.end.line; ++i) {
			let inline = in_lines[i];
			if (inline !== undefined) {
				out_lines.push(inline);
			}
		}
		let out_block = out_lines.join("\n");
		if (start_line.length > 10 && start_line.substring(0, 10) == "```mythic-") {
			const rest = start_line.substring(3);
			// console.log("block header rest", rest, "block", out_block, narr);
			if (!this.table.has(file.path)) this.table.set(file.path, new Array<Block>);
			let fb = this.table.get(file.path);
			if (fb !== undefined)
				fb.push(new Block(rest, out_block));
		}
	}
	renameFile(file: TFile, oldName: string): void {
		// TODO rename File
	}
	deleteFile(file: TFile) {
		this.table.delete(file.path);
	}
	objects(kind: string): Array<MythicObject> {
		// console.log("collecting objects");
		let objects = new Array<MythicObject>;
		for (let blocks of this.table) {
			// // console.log("objects blocks is", blocks);
			for (let block of blocks[1]) {
				// // console.log("block is", block);
				let object = block.asMythicObject();
				if (object !== undefined && !object.removed && object.kind == kind) {
					objects.push(object);
				}
			}
		}
		// console.log(kind, "objects are", objects);
		return objects;
	}
}

export class Metadata {
	blockTable: BlockTable = new BlockTable;
	autoScanLists: boolean = true;
	adventure_from_settings: string = "";
	constructor(plugin: MythicSupportPlugin) {
		if (plugin === undefined) {
			// console.log("constructor no plugin");
		}
	}
	onChanged(file: TFile, data: string, cache: CachedMetadata, plugin: MythicSupportPlugin, narr: string) {
		if (plugin === undefined) { console.warn(`onChanged no plugin, ${file.path}, ${narr}`); }
		else if (plugin.settings === undefined) { console.warn("onChanged no settings", narr); }
		else {
			this.autoScanLists = plugin.settings.autoScanLists;
			this.adventure_from_settings = plugin.settings.adventureFolder;
		}
		if (this === undefined) console.error("no this for change!", narr);
		if (cache === undefined) console.error("no metadata", narr);
		if (cache === null) console.warn("null metadata", narr);
		if (file.extension !== "md") return;
		// if (cache.frontmatter === undefined) return;
		// console.warn("no front matter", file.path);
		// const fm = cache.frontmatter || new FrontMatter();
		// const adventure_from_file = (fm as FrontMatter).mythic_adventure;
		const adventure_from_file = file.path;
		if (!adventure_from_file.startsWith(this.adventure_from_settings)) {
			// console.log(`wrong adventure '${adventure_from_file}', required to be in '${this.adventure_from_settings}'`);
			return;
		}
		// // console.log("metadata file scanning, file:", file, "adventure", adventure_from_file, narr);
		// if (file.deleted) // console.log("file deleted");
		if (cache !== undefined)
			if (cache.sections !== undefined) {
				this.blockTable.deleteFile(file);
				// // console.log("sections", cache.sections.length, "text:", data, narr); 
				for (let section of cache.sections) {
					if (section.type == 'code') {
						this.blockTable.analyseCodeBlock(data, section.position, file, narr);
					}
				}
			}
	}
	async load(cache: MetadataCache, vault: Vault, plugin: MythicSupportPlugin): Promise<void> {
		// console.log("defining metadata");
		if (this === undefined) console.error("no this for load!");
		else if (plugin === undefined) { console.warn("metadata load no plugin"); }
		else if (plugin.settings === undefined) { console.warn("metadata load no settings"); }
		else this.autoScanLists = plugin.settings.autoScanLists;
		plugin.registerEvent(cache.on('changed', (file, data, cache) => this.onChanged(file, data, cache, plugin, 'load'), this));
		plugin.registerEvent(cache.on('deleted', (file: TAbstractFile) => {
			if (file instanceof TFile) {
				// console.log("metadata file deleted", file);
				this.blockTable.deleteFile(file);
			}
		}, this));
		plugin.registerEvent(vault.on('rename', (file: TAbstractFile, oldPath: string) => {
			if (file instanceof TFile) {
				// console.log("metadata file renamed", file, "from", oldPath);
				// const metadata = cache.getFileCache(file);
				// if (metadata?.referenceLinks !== undefined)
				this.blockTable.renameFile(file, oldPath);
			}
		}, this));
		// console.log("metadata defined");
	}
	unload(cache: MetadataCache) {
	}
	async scanAllFiles(cache: MetadataCache, vault: Vault, plugin: MythicSupportPlugin) {
		// console.log("block scanning all files");
		assertDefined(plugin);
		// else if (plugin.settings === undefined) { console.warn("scanAllFiles no settings");  }
		assertDefined(cache);
		assertDefined(vault);
		this.blockTable.clearAll();
		for (let file of vault.getMarkdownFiles()) {
			if (file instanceof TFile) {
				// // console.log("scanning file (scan all)", file);
				const metadata = cache.getFileCache(file);
				// // console.log("file read at start", file, metadata === undefined ? "undefined" : "defined");
				const data = await vault.cachedRead(file);
				// // console.log("data length", data.length, "metadata", metadata);
				if (metadata !== undefined && metadata !== null) {
					const data = await vault.cachedRead(file);
					this.onChanged(file, data, metadata, plugin, 'scanAllFiles');
				} else {
					console.warn("metadata not found", file.path);
				}
			}
		}
		// await this.blockTable.runQueue(vault, cache);
		// console.log("block files scanned", this.blockTable);
	}
}
;
