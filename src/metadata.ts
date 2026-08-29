import { CachedMetadata, MetadataCache, Pos, TAbstractFile, TFile, Vault, } from "obsidian";
import MythicSupportPlugin, { assertDefined, mTrace } from "./main.js";
import { MythicObject } from "./object.js";
/** a MarkDown code block */
export class Block {
	header: string = "";
	body: string = "";
	constructor(header: string = "", body: string = "") {
		this.header = header;
		this.body = body;
	}
	/** converts the code block to data for this plugin. */
	asMythicObject(): MythicObject | undefined {
		// mTrace('', `thread header check '${this.header}' '${MythicObject.TAG}'`);
		if (this.header != MythicObject.TAG) return undefined;
		mTrace('', "have object");
		return MythicObject.fromJson((this.body));
	}
}
/** a collection of Blocks, such as all blocks in an adventure */
export class BlockTable {
	table: Map<string, Array<Block>>;
	// queue: AsyncQueue<BlockOperation> = new AsyncQueue<BlockOperation>();
	constructor() {
		this.table = new Map<string, Array<Block>>;
	}
	clearAll() {
		mTrace('', "clearing block tables");
		this.table = new Map<string, Array<Block>>;
	}
	/** analyse a code block and add it to BlockTable */
	analyseCodeBlock(data: string, pos: Pos, file: TFile, narr: string): void {
		// mTrace('', "analysing", file.path);
		let out_lines = new Array<string>;
		const in_lines = data.split('\n');
		// mTrace('', "code block", pos, data.substring(pos.start.offset, pos.end.offset - pos.start.offset));
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
			// mTrace('', "block header rest", rest, "block", out_block, narr);
			if (!this.table.has(file.path)) this.table.set(file.path, new Array<Block>);
			let fb = this.table.get(file.path);
			if (fb !== undefined)
				fb.push(new Block(rest, out_block));
		}
	}
	/** if the file ha been renamed, transfer the block. */
	renameFile(file: TFile, oldName: string): void {
		let oldBlock = this.table.get(oldName);
		if (oldBlock !== undefined) {
			this.table.set(file.path, oldBlock);
			const _ok = this.table.delete(oldName);
		}
	}
	deleteFile(file: TFile) {
		this.table.delete(file.path);
	}
	/** gets all the objects in the BlockFile */
	objects(kind: string): Array<MythicObject> {
		mTrace('', "collecting objects");
		let objects = new Array<MythicObject>;
		for (let blocks of this.table) {
			// mTrace('', "objects blocks is", blocks);
			for (let block of blocks[1]) {
				// mTrace('', "block is", block);
				let object = block.asMythicObject();
				if (object !== undefined && !(object.removed ?? false) && object.kind == kind) {
					objects.push(object);
				}
			}
		}
		mTrace('', kind, "objects are", objects);
		return objects;
	}
}

/** all the metadata for the adventure. It saves some settings in case the settings disappear. */
export class Metadata {
	blockTable: BlockTable = new BlockTable;
	autoScanLists: boolean = true;
	adventure_from_settings: string = "";
	constructor(plugin: MythicSupportPlugin) {
		if (plugin === undefined) {
			mTrace('', "constructor no plugin");
		}
	}
	/** This is called whenever a note file has changed. It scans all th code blocks. */
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
		const adventure_from_file = file.path;
		if (!adventure_from_file.startsWith(this.adventure_from_settings)) {
			mTrace('', `wrong adventure '${adventure_from_file}', required to be in '${this.adventure_from_settings}'`);
			return;
		}
		// mTrace('', "metadata file scanning, file:", file, "adventure", adventure_from_file, narr);
		// if (file.deleted) mTrace('', "file deleted");
		if (cache !== undefined)
			if (cache.sections !== undefined) {
				this.blockTable.deleteFile(file);
				// mTrace('', "sections", cache.sections.length, "text:", data, narr); 
				for (let section of cache.sections) {
					if (section.type == 'code') {
						this.blockTable.analyseCodeBlock(data, section.position, file, narr);
					}
				}
			}
	}
	/** this loads the metadata when the plugin starts. */
	async load(cache: MetadataCache, vault: Vault, plugin: MythicSupportPlugin): Promise<void> {
		mTrace('', "defining metadata");
		if (this === undefined) console.error("no this for load!");
		else if (plugin === undefined) { console.warn("metadata load no plugin"); }
		else if (plugin.settings === undefined) { console.warn("metadata load no settings"); }
		else this.autoScanLists = plugin.settings.autoScanLists;
		plugin.registerEvent(cache.on('changed', (file, data, cache) => this.onChanged(file, data, cache, plugin, 'load'), this));
		plugin.registerEvent(cache.on('deleted', (file: TAbstractFile) => {
			if (file instanceof TFile) {
				mTrace('', "metadata file deleted", file);
				this.blockTable.deleteFile(file);
			}
		}, this));
		plugin.registerEvent(vault.on('rename', (file: TAbstractFile, oldPath: string) => {
			if (file instanceof TFile) {
				mTrace('', "metadata file renamed", file, "from", oldPath);
				this.blockTable.renameFile(file, oldPath);
			}
		}, this));
		mTrace('', "metadata defined");
	}
	unload(cache: MetadataCache) {
	}
	/** this scans all Markdown files for metadata. */
	async scanAllFiles(cache: MetadataCache, vault: Vault, plugin: MythicSupportPlugin) {
		mTrace('', "block scanning all files");
		assertDefined(plugin);
		// else if (plugin.settings === undefined) { console.warn("scanAllFiles no settings");  }
		assertDefined(cache);
		assertDefined(vault);
		this.blockTable.clearAll();
		for (let file of vault.getMarkdownFiles()) {
			if (file instanceof TFile) {
				// mTrace('', "scanning file (scan all)", file);
				const metadata = cache.getFileCache(file);
				// mTrace('', "file read at start", file, metadata === undefined ? "undefined" : "defined");
				const data = await vault.cachedRead(file);
				// mTrace('', "data length", data.length, "metadata", metadata);
				if (metadata !== undefined && metadata !== null) {
					const data = await vault.cachedRead(file);
					this.onChanged(file, data, metadata, plugin, 'scanAllFiles');
				} else {
					console.warn("metadata not found when scanning all files", file.path);
				}
			}
		}
		mTrace('', "block files scanned", this.blockTable);
	}
}
;
