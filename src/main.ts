import {
	Editor,
	MarkdownView,
	MarkdownFileInfo,
	Plugin,
	App,
	Modal,
	Setting,
	EditorPosition,
} from 'obsidian';
import { DEFAULT_SETTINGS, MythicSettingTab, MythicSupportPluginSettings } from './settings.js';
import { CodeBlock } from './codeblock.js';
import 'reflect-metadata';
import { Scene, SceneModal } from './scene.js';
import { Adventure, AdventureModal } from './adventure.js';
import { MythicObject, MythicObjectModal } from './object.js';
import { Question, QuestionModal } from './question.js';
import { MythicObjectMeta, Tables } from './tables2.js';
import { Metadata } from './metadata.js';
import { KdlTables } from './tables2.js';
import { Dice, DiceModal } from './dice.js';
export function assertDefined<T>(value: T | undefined | null): asserts value is T {
	if (value === undefined || value == null) throw new Error('Value is undefined or null');
}

export default class MythicSupportPlugin extends Plugin {
	settings!: MythicSupportPluginSettings;
	tables: Tables = new Tables();
	metadata: Metadata = new Metadata(this);
	async onCreate() {
		console.log("starting plugin create");
		await this.metadata.load(this.app.metadataCache, this.app.vault, this);
		await this.metadata.scanAllFiles(this.app.metadataCache, this.app.vault, this);
		console.log("plugin create ended");
	}

	async onload() {
		console.log('loading MythicSupportPlugin');
		this.app.workspace.onLayoutReady(async () => {
			console.log("layout ready");
			//this.registerEvent(this.app.vault.on('create', this.onCreate.bind(this), this));
			await this.onCreate();
			this.tables = await KdlTables.load(this.app.vault);
			// if (this.metadata !== undefined)
			// 	await this.metadata.runBlockTableQueue(this.app.vault, this.app.metadataCache);
		});
		await this.loadSettings();

		// Command to create a new Mythic object
		this.addCommand({
			id: 'mythic-create',
			name: 'Create a Mythic object',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView | MarkdownFileInfo,
			): boolean => {
				if (checking) {
					return (
						this.app.workspace.getActiveViewOfType(MarkdownView) !=
						null
					);
				}
				// LATER check whether this block is inside the adventure folder
				new CreateModal(this.app, this.tables, (kind: MythicObjectKind, objectKind: string) => {
					let cursor: EditorPosition = editor.getCursor();
					switch (kind) {
						case MythicObjectKind.Scene: {
							let scene = new Scene();
							let block = new CodeBlock(
								cursor.line,
								cursor.line,
								'scene',
							);
							new SceneModal(this.app, scene, block, this.tables, this).open();
							break;
						}
						case MythicObjectKind.Question: {
							let question = new Question('');
							let block = new CodeBlock(
								cursor.line,
								cursor.line,
								'question',
							);
							new QuestionModal(this.app, question, block, this.tables, this).open();
							break;
						}
						case MythicObjectKind.MythicObject: {
							const meta = this.tables.meta(objectKind);
							console.log("meta for", objectKind);
							assertDefined(meta);
							let object = new MythicObject(objectKind, "", "");
							let block = new CodeBlock(
								cursor.line,
								cursor.line,
								'object',
							);
							new MythicObjectModal(this.app, object, block, meta).open();
							break;
						}
						case MythicObjectKind.Thread: {
							let thread = new Thread('');
							let block = new CodeBlock(
								cursor.line,
								cursor.line,
								'thread',
							);
							new ThreadModal(this.app, thread, block).open();
							break;
						}
						case MythicObjectKind.Dice: {
							let dice = new Dice('');
							let block = new CodeBlock(
								cursor.line,
								cursor.line,
								'dice',
							);
							new DiceModal(this.app, dice, block).open();
							break;
						}
						case MythicObjectKind.Adventure: {
							let adventure = new Adventure('');
							let block = new CodeBlock(
								cursor.line,
								cursor.line,
								'adventure',
							);
							new AdventureModal(this.app, this, adventure, block).open();
							break;
						}
						default:
							console.error('unknown object kind', kind);
					}
				}).open();
				return true;
			},
		});

		this.addCommand({
			id: 'mythic-edit',
			name: 'Edit selected',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView | MarkdownFileInfo,
			): boolean => {
				if (checking) {
					return (
						this.app.workspace.getActiveViewOfType(MarkdownView) !=
						null
					);
				}
				// LATER check whether this block is inside the adventure folder
				let block = CodeBlock.get(editor);
				if (block.is_block) {
					const source = block.contents(editor);
					switch (block.kind) {
						case Scene.TAG:
							{
								let scene = Scene.fromJson(source);
								new SceneModal(this.app, scene, block, this.tables, this).open();
							}
							break;
						case Question.TAG:
							{
								let question = Question.fromJson(source);
								new QuestionModal(this.app, question, block, this.tables, this).open();
							}
							break;
						case Thread.TAG:
							{
								let thread = Thread.fromJson(source);
								new ThreadModal(this.app, thread, block).open();
							}
							break;
						case Dice.TAG:
							{
								let dice = Dice.fromJson(source);
								new DiceModal(this.app, dice, block).open();
							}
							break;
						case MythicObject.TAG:
							{
								let object = MythicObject.fromJson(source);
								const meta = this.tables.meta(object.kind);
								assertDefined(meta);
								new MythicObjectModal(this.app, object, block, meta).open();
							}
							break;
						case Adventure.TAG:
							{
								let adventure = Adventure.fromJson(source);
								new AdventureModal(this.app, this, adventure, block).open();
							}
							break;
						default:
							console.warn("unknown block type '%s'", block.kind);
					}
				} else {
					console.warn('not a block');
				}
				return true;
			},
		});
		this.addCommand({
			id: 'mythic-bump',
			name: 'Rescan lists TODO not coded yet',
			callback: (
				// checking: boolean,
				// editor: Editor,
				// view: MarkdownView | MarkdownFileInfo,
			): boolean => {
				// if (checking) { return true; }
				// TODO code to fix all lists should go here but async?)
				return true;
			}
		});

		this.registerMarkdownCodeBlockProcessor(
			Scene.TAG,
			(source, el, ctx) => {
				console.log("generation scene html");
				Scene.toHtml(source, el, ctx, this.tables);
			},
		);
		this.registerMarkdownCodeBlockProcessor(
			Question.TAG,
			(source, el, ctx) => {
				Question.toHtml(source, el, ctx, this.tables);
			},
		);
		this.registerMarkdownCodeBlockProcessor(
			Thread.TAG,
			(source, el, ctx) => {
				Thread.toHtml(source, el, ctx);
			},
		);
		this.registerMarkdownCodeBlockProcessor(
			Dice.TAG,
			(source, el, ctx) => {
				Dice.toHtml(source, el, ctx);
			},
		);
		this.registerMarkdownCodeBlockProcessor(
			MythicObject.TAG,
			(source, el, ctx) => {
				MythicObject.toHtml(source, el, ctx);
			},
		);
		this.registerMarkdownCodeBlockProcessor(
			Adventure.TAG,
			(source, el, ctx) => {
				console.log("generation adventure html");
				Adventure.toHtml(source, el, ctx, this.metadata, this.tables);
			},
		);
		this.addSettingTab(new MythicSettingTab(this.app, this));
		console.log("MythicSupportPlugin plugin loaded");
	}

	onunload() {
		console.log('unloading MythicSupportPlugin');
		this.metadata.unload(this.app.metadataCache);
	}

	async loadSettings() {
		console.log("loading settings");
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MythicSupportPluginSettings>,
		);
		console.log("settings loaded");
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	// settings() : MythicSupportPluginSettings {
	// 	this.settings
	// }
}

export const enum MythicObjectKind {
	Scene = 'scene',
	Question = 'question',
	Thread = 'thread',
	MythicObject = 'object',
	Dice = 'dice',
	Adventure = 'adventure',
}
export class CreateModal extends Modal {
	// onCreate: () => undefined = () => {},
	constructor(app: App, tables: Tables, onCreate: (kind: MythicObjectKind, meta: string) => void) {
		let kind: MythicObjectKind = MythicObjectKind.Scene;
		let meta: string = "";
		super(app);
		// this.onCreate =  onCreate;
		this.setTitle('Create object');
		new Setting(this.contentEl).setName('Kind').addDropdown((dropDown) => {
			dropDown.addOptions({ scene: 'Scene', question: 'Question', dice: 'Dice', adventure: 'Adventure' });
			tables.objectKinds.forEach((kind: MythicObjectMeta, ident: string) => {
				dropDown.addOption(ident, kind.displayName);
			});
			tables.simples.forEach((kind: MythicObjectMeta, ident: string) => {
				dropDown.addOption(ident, kind.displayName);
			});
			tables.randoms.forEach((random, ident: string) => {
				dropDown.addOption(ident, random.meta.displayName);
			});
			dropDown.onChange((value) => {
				switch (value) {
					case 'scene': kind = MythicObjectKind.Scene; break;
					case 'question': kind = MythicObjectKind.Question; break;
					case 'dice': kind = MythicObjectKind.Dice; break;
					case 'adventure': kind = MythicObjectKind.Adventure; break;
					default:
						kind = MythicObjectKind.MythicObject;
						meta = value;
				}
			});
		});
		new Setting(this.contentEl).addButton((btn) =>
			btn
				.setButtonText('Create')
				.setCta()
				.onClick(() => {
					this.close();
					onCreate(kind, meta);
				}),
		);
		new Setting(this.contentEl).addButton((btn) =>
			btn
				.setButtonText('Cancel')
				.setCta()
				.onClick(() => {
					this.close();
				}),
		);
	}
}
