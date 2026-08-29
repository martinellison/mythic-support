import { Type, plainToInstance, instanceToPlain } from 'class-transformer';
import { Modal, App, Setting, MarkdownPostProcessorContext, DisplayValueComponent, ButtonComponent, TextAreaComponent, DropdownComponent } from 'obsidian';
import { CodeBlock } from './codeblock.js';
import { Tables } from './tables2.js';
import { EventFocus, } from './randomevent.js';
import MythicSupportPlugin, { assertDefined, mTrace, shorten } from './main.js';
import { Question } from './question.js';
import { Meaning, MeaningModal } from './meaning.js';

export const enum AlterationKind {
	Expected = 'expected',
	Next = 'next',
	Tweak = 'tweak',
	Fate = 'fate',
	Meaning = 'meaning',
	Adjustment = 'adjustment',
}
export const enum SceneType {
	NeedDice = 'need dice',
	Expected = 'expected',
	Altered = 'altered',
	Interrupt = 'interrupt',
}
export const enum SceneAdjustment {
	ReduceRemoveActivity = 'reduce/remove activity',
	IncreaseActivity = 'increase activity',
	RemoveMythicObject = 'remove object',
	AddMythicObject = 'add object',
}
/** checking status of a scene. Keep the order. */
enum SceneStatus {
	NeedsExpected, NeedsRandom, NeedsAlterationKind, NeedsMeaning, NeedsAlteration, OK,
};
/** scene text should come after a scene block */
export class Scene {
	static readonly TAG = 'mythic-scene';
	ident: string = "";
	chaos: number = 5;
	sceneType: SceneType = SceneType.NeedDice;
	kind: AlterationKind = AlterationKind.Expected;
	expected: string = '';
	alteration?: string;
	adjustment?: Array<SceneAdjustment>;
	@Type(() => EventFocus)
	focus?: EventFocus;
	@Type(() => Meaning)
	meaning?: Meaning;
	constructor(num?: string) {
		this.ident = num ?? "0";
	}
	/** set scene type. Call `useSceneType` after this. */
	setSceneType(sceneType: SceneType) {
		this.sceneType = sceneType;
		if (this.sceneType != SceneType.Expected && this.alteration === undefined)
			this.alteration = "";
		switch (this.sceneType) {
			default:
		}
	}
	/** use the scene type */
	useSceneType() {
		switch (this.sceneType) {
			case SceneType.NeedDice:
			case SceneType.Expected:
				this.alteration = undefined;
				this.adjustment = undefined;
				// this.randomEvent = undefined;
				this.focus = undefined;
				this.meaning = undefined;
				break;
			case SceneType.Altered:
				this.useAlterationKind();
				break;
			case SceneType.Interrupt:
				this.adjustment = undefined;
				break;
		}
	}
	/** set this scene to alteration */
	setAlterationKind(kind: AlterationKind) {
		if (kind == this.kind) {
			mTrace("no change, because alteration kind already set to", kind);
			return;
		}
		this.kind = kind;
		if (this.kind != AlterationKind.Expected) this.alteration = "";
		switch (this.kind) {
			case AlterationKind.Expected:
				break;
			case AlterationKind.Next:
			case AlterationKind.Tweak:
				break;
			case AlterationKind.Fate: break;
			case AlterationKind.Adjustment:
				this.adjustment = new Array<SceneAdjustment>;
				break;
			case AlterationKind.Meaning:
				this.meaning = new Meaning;
				break;
		}
	}
	/** this scene is an alteration scene, so remove any unnecessary data. */
	useAlterationKind() {
		// this.focus = undefined;
		// this.meaning = undefined;
		switch (this.kind) {
			case AlterationKind.Expected:
				this.alteration = undefined;
				this.adjustment = undefined;
				this.meaning = undefined;
				this.focus = undefined;
				break;
			case AlterationKind.Next:
			case AlterationKind.Tweak:
				this.adjustment = undefined;
				this.meaning = undefined;
				this.focus = undefined;
				break;
			case AlterationKind.Fate:
				this.adjustment = undefined;
				this.meaning = undefined;
				this.focus = undefined;
				break;
			case AlterationKind.Adjustment:
				this.meaning = undefined;
				this.focus = undefined;
				if (this.adjustment === undefined)
					this.adjustment = new Array<SceneAdjustment>;
				break;
			case AlterationKind.Meaning:
				// case AlterationKind.Table:
				this.alteration = undefined;
				this.adjustment = undefined;
				this.focus = undefined;
				if (this.meaning === undefined)
					this.meaning = new Meaning;
				// this.meaning.explain(tables);
				break;
		}
	}
	/** checks whether the scene has a valid value and can be saved. */
	check(): SceneStatus {
		if (this.expected.trim() == "") return SceneStatus.NeedsExpected;
		switch (this.sceneType) {
			case SceneType.NeedDice:
				return SceneStatus.NeedsRandom;
			case SceneType.Altered:
				switch (this.kind) {
					case AlterationKind.Expected:
						return SceneStatus.NeedsAlterationKind;
					case AlterationKind.Meaning:
						if (this.meaning === undefined)
							return SceneStatus.NeedsMeaning;
						break;
					default:
				}
				if (this.alteration === undefined || this.alteration.trim() == "")
					return SceneStatus.NeedsAlteration;
				break;
			case SceneType.Interrupt:
				if (this.kind == AlterationKind.Meaning && this.meaning == undefined)
					return SceneStatus.NeedsMeaning;
				if (this.alteration === undefined || this.alteration.trim() == "")
					return SceneStatus.NeedsAlteration;
				break;
			case SceneType.Expected:
				break;
		}
		return SceneStatus.OK;
	}
	/** generate randomness. The table for the scene type test is hard coded. */
	setRandom(tables: Tables, plugin: MythicSupportPlugin): void {
		mTrace('scene', "Setting random");
		const sceneTestOracle = Question.dice(10);
		if (sceneTestOracle > this.chaos) {
			this.setSceneType(SceneType.Expected);
		}
		else if (sceneTestOracle % 2 == 1) {
			this.setSceneType(SceneType.Altered);
		}
		else {
			this.setSceneType(SceneType.Interrupt);
		}
		this.useSceneType();
		switch (this.sceneType) {
			case SceneType.NeedDice:
			case SceneType.Expected:
				break;
			case SceneType.Altered:
				switch (this.kind) {
					case AlterationKind.Adjustment:
						this.adjustment = new Array<SceneAdjustment>;
						this.addSceneAdjustment();
						break;
					case AlterationKind.Expected:
						break;
					case AlterationKind.Next:
					case AlterationKind.Tweak:
						break;
					case AlterationKind.Fate:
						break;
					case AlterationKind.Meaning:
						if (this.meaning === undefined)
							this.meaning = new Meaning;
						break;
				}
				break;
			case SceneType.Interrupt:
				if (this.focus === undefined)
					this.focus = new EventFocus;
				if (this.meaning === undefined)
					this.meaning = new Meaning;
				break;
		}
		if (this.focus !== undefined) {
			this.focus.throwDice(tables);
			let ent = this.focus.focusDescr(tables);
			mTrace('scene', "focus on", ent.text);
			this.focus.defineSelectedObject(plugin.metadata, ent.interpretation);
		}
		if (this.meaning !== undefined) {
			const tabSiz = this.meaning.tableSizes(tables);
			this.meaning.throwDice(tabSiz);
			this.meaning.explain(tables);
		}
	}
	/** do a scene adjustment. */
	addSceneAdjustment() {
		const sceneAdjustOracle = Question.dice(10); // TODO check dice count
		assertDefined(this.adjustment);
		switch (sceneAdjustOracle) { // TODO fix
			case 1: this.adjustment.push(SceneAdjustment.RemoveMythicObject); break;
			case 2: this.adjustment.push(SceneAdjustment.AddMythicObject); break;
			case 3: this.adjustment.push(SceneAdjustment.ReduceRemoveActivity); break;
			case 4: this.adjustment.push(SceneAdjustment.IncreaseActivity); break;
			case 5: this.adjustment.push(SceneAdjustment.RemoveMythicObject); break;
			case 6: this.adjustment.push(SceneAdjustment.AddMythicObject); break;
			default:
				if (this.adjustment.length < 2)
					this.addSceneAdjustment();
				if (this.adjustment.length < 2)
					this.addSceneAdjustment();
		}
	}

	/** convert from a JSON string */
	static fromJson(source: string): Scene {
		// @ts-ignore
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
		let scene: Scene = plainToInstance(Scene, JSON.parse(source));
		scene.useSceneType();
		return scene;
	}
	toJson(): string {
		this.useSceneType();
		return JSON.stringify(instanceToPlain(this));
	}
	/** describe the scene in plain text */
	toText(tables: Tables): [string, string] {
		let desc1 = "";
		let descrs = new Array<string>;
		switch (this.sceneType) {
			case SceneType.NeedDice:
				desc1 = "(not complete)";
				break;
			case SceneType.Expected:
				desc1 = "The scene is as expected.";
				break;
			case SceneType.Altered:
				desc1 = "The scene has been altered.";
				switch (this.kind) {
					case AlterationKind.Expected: descrs.push("(not complete)"); break;
					case AlterationKind.Next: descrs.push("Next"); break;
					case AlterationKind.Tweak: descrs.push("Tweak"); break;
					case AlterationKind.Fate: descrs.push("Fate"); break;
					case AlterationKind.Meaning: descrs.push("Meaning: "); break;
					case AlterationKind.Adjustment: descrs.push(`Adjustment ${this.adjustment?.join("+")}`); break;
				}
				break;
			case SceneType.Interrupt:
				desc1 = "The scene has been interrupted and replaced.";
				if (this.kind == AlterationKind.Meaning)
					descrs.push("Meaning");
				break;
		}
		if (this.focus !== undefined) {
			descrs.push(`${this.focus.toText(tables)}`);
			// if (this.focus.object.trim() != "")
			// 	descrs.push(`for: ${this.focus.object}`);
		}
		if (this.meaning !== undefined) {
			if (this.meaning.result.trim() == "")
				console.warn("unexplained meaning", this.meaning);
			descrs.push(`${this.meaning.result}`);
		}
		mTrace('scene', desc1, descrs.join(' '));
		return [desc1, descrs.map((s) => shorten(s)).join(' ')];
	}
	/** create HTML for display */
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext, tables: Tables) {
		assertDefined(tables);
		mTrace('', "rendering scene", source);
		const scene: Scene = Scene.fromJson(source);
		let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-scene' });
		divElt.createSpan({ text: `(scene) ${scene.ident} chaos ${scene.chaos}` });
		switch (scene.sceneType) {
			case SceneType.Expected:
				divElt.createSpan({ text: ` (expected)` });
				divElt.createEl('b', { text: ` ${scene.expected} ` });
				break;
			case SceneType.Altered:
				divElt.createSpan({ text: ` (altered ${scene.kind})` });
				switch (scene.kind) {
					case AlterationKind.Meaning:
						if (scene.meaning !== undefined && scene.meaning instanceof Meaning) {// TODO temp hack remove
							scene.meaning.explain(tables);
							divElt.createSpan({
								text: scene.meaning.result
							});
						} else {
							console.error("invalid meaning", scene.meaning);
							divElt.createEl('b', { text: " no meaning! " });
						}
						break;
					case AlterationKind.Adjustment:
						if (scene.adjustment !== undefined)
							for (let adj of scene.adjustment) divElt.createSpan({ text: ` ${adj} ` });
						break;
					case AlterationKind.Expected:
						divElt.createSpan({ text: " select an appropriate alteration kind!" });
						break;
					case AlterationKind.Next:
					case AlterationKind.Tweak:
					case AlterationKind.Fate:
						divElt.createEl('i', { text: ` other alteration: ${scene.kind} ` });
				}
				divElt.createEl('s', { text: ` (expected) ${scene.expected} ` });
				// divElt.createEl('i', { text: ` (altered ${scene.kind}) ` });
				divElt.createEl('b', { text: ` ${scene.alteration} ` });
				break;
			case SceneType.Interrupt:
				divElt.createSpan({ text: ` (interrupt)` });
				divElt.createEl('s', { text: ` (expected) ${scene.expected} ` });
				divElt.createEl('b', { text: ` ${scene.alteration} ` });
				break;
		}
		if ((scene.kind != AlterationKind.Expected) && (scene.alteration == "")) {
			divElt.createEl('b', { text: " needs alteration!" });
			divElt.createSpan({ text: ' edit this scene to provide the adjusted scene!' });
		}

		if (scene.focus !== undefined) {
			el.createDiv({ text: scene.focus.toText(tables), cls: 'mythic-random' });
		}
		if (scene.meaning !== undefined) {
			el.createDiv({ text: scene.meaning.result, cls: 'mythic-random' });
		}
	}
}
export class SceneModal extends Modal {
	scene: Scene;
	action: string = "Save";
	mandDisplay?: DisplayValueComponent = undefined;
	saveButton?: ButtonComponent = undefined;
	randomButton?: ButtonComponent = undefined;
	alterationDropdown?: DropdownComponent = undefined;
	alterationText?: TextAreaComponent = undefined;
	meaningDropdown?: DropdownComponent = undefined;
	infoDisplay1?: DisplayValueComponent = undefined;
	infoDisplay2?: DisplayValueComponent = undefined;
	checkAndShow(tables: Tables): void {
		assertDefined(this.mandDisplay);
		assertDefined(this.saveButton);
		assertDefined(this.randomButton);
		assertDefined(this.alterationDropdown);
		assertDefined(this.alterationText);
		// assertDefined(this.meaningDropdown);
		assertDefined(this.infoDisplay1);
		assertDefined(this.infoDisplay2);
		const status = this.scene.check();
		mTrace("scene status checked as", SceneStatus[status]);
		switch (status) {
			case SceneStatus.NeedsExpected:
				this.mandDisplay.setValue("Enter the Expected scene description.");
				break;
			case SceneStatus.NeedsRandom:
				this.mandDisplay.setValue("Throw the Dice.");
				break;
			case SceneStatus.NeedsAlterationKind:
				this.mandDisplay.setValue("Select the Alteration Kind.");
				break;
			case SceneStatus.NeedsAlteration:
				this.mandDisplay.setValue("Enter the Altered scene description.");
				break;
			case SceneStatus.NeedsMeaning:
				this.mandDisplay.setValue("Select a Meaning Oracle.");
				break;
			case SceneStatus.OK:
				this.mandDisplay.setValue(`${this.action} the Scene.`);
				break;
			default: console.warn("unknown scene status", status);

		};
		this.mandDisplay.setStatus(status < SceneStatus.OK ? 'warning' : null);
		this.saveButton.setDisabled(status < SceneStatus.OK);
		this.randomButton.setDisabled(status < SceneStatus.NeedsRandom);
		this.alterationDropdown.setDisabled(status < SceneStatus.NeedsAlterationKind || this.scene.sceneType != SceneType.Altered);
		this.alterationText.setDisabled(status < SceneStatus.NeedsAlteration || this.scene.sceneType == SceneType.Expected);
		if (this.meaningDropdown !== undefined)
			this.meaningDropdown.setDisabled(status < SceneStatus.NeedsMeaning
				|| this.scene.sceneType == SceneType.Expected);
		let [d1, d2] = this.scene.toText(tables);
		this.infoDisplay1.setValue(d1);
		this.infoDisplay2.setValue(d2);
	}
	constructor(creating: boolean, app: App, scene: Scene, block: CodeBlock, tables: Tables, plugin: MythicSupportPlugin) {
		super(app);
		this.scene = scene;
		this.action = creating ? "Create" : "Update";
		this.setTitle(this.action + ' Scene');
		new Setting(this.contentEl).addDisplayValue(disp => {
			this.mandDisplay = disp;
		});
		new Setting(this.contentEl).setName('Ident')
			.setDesc("Identifier for this scene")
			.addText((text) => {
				text.setValue(this.scene.ident);
				text.onChange((value) => {
					if (parseInt(value) !== undefined)
						this.scene.ident = value;
					this.checkAndShow(tables);
				});
			});
		new Setting(this.contentEl).setName('Chaos')
			.setDesc("The current Chaos Factor").addSlider((slider) => {
				slider.setLimits(1, 9, 1).setInstant(true).setValue(this.scene.chaos).onChange((value) => {
					this.scene.chaos = value;
					this.checkAndShow(tables);
				});
			});
		new Setting(this.contentEl)
			.setDesc("Describe what is expected to happen.").setName('Expected').addTextArea((text) => {
				text.setPlaceholder("What is expected to happen");
				text.setValue(this.scene.expected);
				text.onChange((value) => {
					this.scene.expected = value;
					this.checkAndShow(tables);
				});
			});
		new Setting(this.contentEl)
			.setDesc("This makes the random change.").addButton((btn) => {
				this.randomButton = btn;
				btn
					.setButtonText("Throw the Dice")
					.setCta()
					.onClick(() => {
						if (this.scene.meaning !== undefined)
							mTrace('scene', "on scene randomise, meaning kind is", this.scene.meaning?.meaningKind);
						this.scene.setRandom(tables, plugin);
						this.checkAndShow(tables);
					});
			});
		new Setting(this.contentEl)
			.setDesc("Decide how to alter the scene.").setName('Alteration Kind').addDropdown((dropDown) => {
				this.alterationDropdown = dropDown;
				dropDown.addOptions({
					expected: 'expected',
					next: 'next',
					tweak: 'tweak',
					fate: 'fate',
					meaning: 'meaning',
					adjustment: 'adjustment',
					table: 'table',
				});
				dropDown.setValue(this.scene.kind);
				dropDown.onChange((value) => {
					mTrace('', "alteration kind", value,);
					this.scene.setAlterationKind(value as AlterationKind);
					this.scene.useAlterationKind();
					this.checkAndShow(tables);
				});
			});
		// new Setting(this.contentEl)
		// 	.setDesc("Select which meaning tables to consult.").setName('Meaning').addDropdown((dropDown) => {
		// 		this.meaningDropdown = dropDown;
		// 		dropDown.addOption('none', "None");
		// 		let tabKind, tab;
		// 		for ([tabKind, tab] of tables.oracles) {
		// 			if (!tab.meta.noAlt)
		// 				dropDown.addOption(tabKind, tab.meta.displayName);
		// 		}
		// 		dropDown.setValue(this.scene.meaning?.meaningKind ?? "none");
		// 		dropDown.onChange((value) => {
		// 			mTrace('scene', "scene meaning changed to", value);
		// 			if (value != 'none' && this.scene.meaning !== undefined) {
		// 				this.scene.meaning.meaningKind = value;
		// 				// TODO update stuff
		// 			}
		// 			this.checkAndShow(tables);
		// 		});
		// 	});
		if (this.scene.meaning !== undefined)
			MeaningModal.makeMeaning(this.contentEl, this.meaningDropdown, tables, (meaningKind: string) => {
				assertDefined(this.scene.meaning);
				this.scene.meaning.meaningKind = meaningKind;
				this.scene.meaning.explain(tables);
				mTrace('scene', "after meaning, meaning is", this.scene.meaning);
				this.checkAndShow(tables);
			}, this.scene.meaning);
		new Setting(this.contentEl).addDisplayValue(disp1 => {
			this.infoDisplay1 = disp1;
		});
		new Setting(this.contentEl).addDisplayValue(disp1 => {
			this.infoDisplay2 = disp1;
		});
		new Setting(this.contentEl)
			.setDesc("Describe the scene as altered (or the interrupt scene).")
			.setName('Alteration/Interruption')
			.addTextArea((text) => {
				this.alterationText = text;
				text.setPlaceholder("What actually happens");
				text.setValue(this.scene.alteration ?? "");
				text.onChange((value) => {
					this.scene.alteration = value;
					this.checkAndShow(tables);
				});
			});
		new Setting(this.contentEl)
			.setDesc("This saves the scene.").addButton((btn) => {
				this.saveButton = btn;
				btn
					.setButtonText(this.action + " the Scene")
					.setCta()
					.onClick(() => {
						this.close();
						const json = scene.toJson();
						let editor = app.workspace.activeEditor?.editor;
						if (editor !== undefined)
							block.replaceContents(Scene.TAG, json, editor);
					});
			})
			.addButton((btn) =>
				btn
					.setButtonText('Cancel')
					.setCta()
					.onClick(() => {
						this.close();
					}),
			);
		this.checkAndShow(tables);
	}
}
