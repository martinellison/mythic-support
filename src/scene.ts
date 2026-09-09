import { Type, plainToInstance, instanceToPlain, Expose } from 'class-transformer';
import { Modal, App, Setting, MarkdownPostProcessorContext, DisplayValueComponent, ButtonComponent, TextAreaComponent, DropdownComponent } from 'obsidian';
import { CodeBlock } from './codeblock.js';
import { Tables } from './tables2.js';
import { EventFocus, } from './eventfocus.js';
import MythicSupportPlugin, { assertDefined, mTrace, mythicDice, shorten } from './main.js';
// import { Question, QuestionModal } from './question.js';
import { FateData, FateDataModal as FateDataModal, ChaosProvider } from './fatedata.js';
import { Meaning, MeaningModal } from './meaning.js';

export const enum AlterationKind {
	Expected = 'expected',
	Next = 'next',
	Tweak = 'tweak',
	FateQuestion = 'fatequestion',
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
	RemoveMythicCharacter = 'remove character',
	AddMythicCharacter = 'add character',
}
/** checking status of a scene. Keep the order. */
enum SceneStatus {
	NeedsExpected, NeedsRandom, NeedsAlterationKind, NeedsFate, NeedsMeaning, NeedsAlteration, OK,
};
/**  implements an Scene block. Scene text should come after a scene block */
export class Scene implements ChaosProvider {
	chaosValue(): number { return this.chaos; }
	static readonly TAG = 'mythic-scene';
	@Expose() ident: string = "";
	@Expose() chaos: number = 5;
	@Expose() sceneType: SceneType = SceneType.NeedDice;
	@Expose() kind: AlterationKind = AlterationKind.Expected;
	@Expose() expected: string = '';
	@Expose() alteration?: string;
	@Expose() adjustment?: Array<SceneAdjustment>;
	@Type(() => FateData)
	@Expose() fate?: FateData;
	@Type(() => EventFocus)
	@Expose() focus?: EventFocus;
	@Type(() => Meaning)
	@Expose() meaning?: Meaning;
	@Expose() hasRandom: boolean = false;
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
		// mTrace("scene type is", this.sceneType);
		switch (this.sceneType) {
			case SceneType.NeedDice:
			case SceneType.Expected:
				this.alteration = undefined;
				this.adjustment = undefined;
				// this.randomEvent = undefined;
				this.fate = undefined;
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
		// mTrace('scene use type', this.fate === undefined ? "haven't fate" : "have fate");
	}
	/** set this scene to alteration */
	setAlterationKind(kind: AlterationKind) {
		if (kind == this.kind) {
			// mTrace("no change, because alteration kind already set to", kind);
			return;
		}
		// mTrace('scene', "kind set to", kind);
		if (kind != AlterationKind.Expected && this.kind != kind) this.alteration = "";
		this.kind = kind;
		switch (this.kind) {
			case AlterationKind.Expected:
				break;
			case AlterationKind.Next:
			case AlterationKind.Tweak:
				break;
			case AlterationKind.FateQuestion:
				this.fate = new FateData(this);
				break;
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
		mTrace("scene", "kind is", this.kind);
		switch (this.kind) {
			case AlterationKind.Expected:
				this.alteration = undefined;
				this.adjustment = undefined;
				this.fate = undefined;
				this.meaning = undefined;
				this.focus = undefined;
				break;
			case AlterationKind.Next:
			case AlterationKind.Tweak:
				this.adjustment = undefined;
				this.fate = undefined;
				this.meaning = undefined;
				this.focus = undefined;
				break;
			case AlterationKind.FateQuestion:
				this.adjustment = undefined;
				this.meaning = undefined;
				this.focus = undefined;
				if (this.fate === undefined)
					this.fate = new FateData(this);
				break;
			case AlterationKind.Adjustment:
				this.fate = undefined;
				this.meaning = undefined;
				this.focus = undefined;
				if (this.adjustment === undefined)
					this.adjustment = new Array<SceneAdjustment>;
				break;
			case AlterationKind.Meaning:
				this.adjustment = undefined;
				this.fate = undefined;
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
					case AlterationKind.FateQuestion:
						if (this.fate !== undefined && this.fate.description.trim() == "")
							return SceneStatus.NeedsFate;
						break;
					case AlterationKind.Meaning:
						if (this.meaning === undefined)
							return SceneStatus.NeedsMeaning;
						break;
					default:
				}
				break;
			case SceneType.Interrupt:
				if (this.kind == AlterationKind.Meaning && this.meaning == undefined)
					return SceneStatus.NeedsMeaning;
				break;
			case SceneType.Expected:
				break;
		}
		if (this.sceneType != SceneType.Expected && (this.alteration === undefined || this.alteration.trim() == ""))
			return SceneStatus.NeedsAlteration;
		return SceneStatus.OK;
	}
	/** generate randomness. The table for the scene type test is hard coded. */
	setRandom(tables: Tables, plugin: MythicSupportPlugin): void {
		// mTrace('scene', "Setting random");
		const sceneTestOracle = mythicDice(10);
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
					case AlterationKind.FateQuestion:
						if (this.fate === undefined)
							this.fate = new FateData(this);
						break;
					case AlterationKind.Meaning:
						if (this.meaning === undefined)
							this.meaning = new Meaning;
						break;
					default:
						console.warn("unknown kind", this.kind);
				}
				break;
			case SceneType.Interrupt:
				if (this.focus === undefined)
					this.focus = new EventFocus;
				if (this.meaning === undefined)
					this.meaning = new Meaning;
				break;
		}
		if (this.fate !== undefined) {
			this.fate.throwDice();
			// mTrace('scene', "fate on", this.fate);
		}
		if (this.focus !== undefined) {
			this.focus.throwDice(tables);
			let ent = this.focus.focusDescr(tables);
			// mTrace('scene', "focus on", ent.text);
			this.focus.defineSelectedObject(plugin.metadata, ent.interpretation);
		}
		if (this.meaning !== undefined) { // TODO the permitted kinds of adjustment are different for interrupts
			const tabSiz = this.meaning.tableSizes(tables);
			this.meaning.throwDice(tabSiz);
			this.meaning.explain(tables);
		}
		// mTrace('scene set random', this.fate === undefined ? "haven't fate" : "have fate");
	}
	/** do a scene adjustment. */
	addSceneAdjustment() {
		const sceneAdjustOracle = mythicDice(10); // MGME p70
		assertDefined(this.adjustment);
		switch (sceneAdjustOracle) {
			case 1: this.adjustment.push(SceneAdjustment.RemoveMythicCharacter); break;
			case 2: this.adjustment.push(SceneAdjustment.AddMythicCharacter); break;
			case 3: this.adjustment.push(SceneAdjustment.ReduceRemoveActivity); break;
			case 4: this.adjustment.push(SceneAdjustment.IncreaseActivity); break;
			case 5: this.adjustment.push(SceneAdjustment.RemoveMythicCharacter); break;
			case 6: this.adjustment.push(SceneAdjustment.AddMythicCharacter); break;
			default:
				if (this.adjustment.length < 2)
					this.addSceneAdjustment();
				if (this.adjustment.length < 2)
					this.addSceneAdjustment();
		}
	}

	/** convert from a JSON string */
	static fromJson(source: string): Scene {
		try {
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
			let scene: Scene = plainToInstance(Scene, JSON.parse(source), { excludeExtraneousValues: true });
			// mTrace('scene', "scene from json", scene, scene.fate === undefined ? "haven't fate" : "have fate");
			if (scene.fate !== undefined)
				scene.fate.chaosProvider = scene;
			scene.useSceneType();
			return scene;
		} catch (error) {
			console.error("error parsing scene: ", error, "reading:", shorten(source));
			throw error;
		}
	}
	toJson(): string {
		this.useSceneType();
		return JSON.stringify(instanceToPlain(this));
	}
	/** describe the scene in plain text */
	toText(tables: Tables): [string, string, string] {
		let desc1 = "";
		let descrs = new Array<string>;
		let desc3 = "";
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
					case AlterationKind.FateQuestion: descrs.push("Fate"); break;
					case AlterationKind.Meaning: descrs.push("Meaning: "); break;
					case AlterationKind.Adjustment: descrs.push(`Adjustment: ${this.adjustment?.join(" + ")}`); break;
				}
				break;
			case SceneType.Interrupt:
				desc1 = "The scene has been interrupted and replaced.";
				// if (this.kind == AlterationKind.Meaning)
				// 	descrs.push("Meaning: ");
				break;
		}
		// if (this.fate !== undefined) {
		// 	descrs.push(`${this.fate.toText(tables)}`);
		// }
		if (this.focus !== undefined) {
			descrs.push(`${this.focus.toText(tables)}`);
		}
		if (this.meaning !== undefined) {
			if (this.meaning.result1.trim() == "")
				console.warn("unexplained meaning", this.meaning);
			else desc3 = `${this.meaning.result1}: ${this.meaning.result2}`;
		}
		// mTrace('scene', desc1, descrs.join(' '));
		return [desc1, descrs.map((s) => shorten(s)).join(' '), desc3];
	}
	/** create HTML for display */
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext, tables: Tables) {
		let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-scene' });
		try {
			assertDefined(tables);
			// mTrace('', "rendering scene", source);
			const scene: Scene = Scene.fromJson(source);
			divElt.createSpan({ text: `(scene) ${scene.ident} chaos ${scene.chaos} ` });
			switch (scene.sceneType) {
				case SceneType.Expected:
					divElt.createSpan({ text: ` (expected) ` });
					divElt.createEl('b', { text: ` ${scene.expected} ` });
					break;
				case SceneType.Altered:
					divElt.createSpan({ text: ` (altered by ${scene.kind}) ` });
					switch (scene.kind) {
						case AlterationKind.Meaning:
							if (scene.meaning !== undefined) {
								scene.meaning.explain(tables);
								// divElt.createSpan({
								// 	text: scene.meaning.result
								// });
							} else {
								console.error("invalid meaning", scene.meaning);
								divElt.createEl('b', { text: " no meaning! " });
							}
							break;
						case AlterationKind.Adjustment:
							if (scene.adjustment !== undefined) {
								const adjs = scene.adjustment.join(", ");
								divElt.createSpan({ text: ` [ ${adjs} ] ` });
							}
							break;
						case AlterationKind.Expected:
							divElt.createSpan({ text: " select an appropriate alteration kind!" });
							break;
						case AlterationKind.Next:
						case AlterationKind.Tweak:
							divElt.createEl('i', { text: ` other alteration: ${scene.kind} ` });
							break;
						case AlterationKind.FateQuestion:
							break;
					}
					divElt.createEl('s', { text: ` (expected) ${scene.expected} ` });
					// divElt.createEl('i', { text: ` (altered ${scene.kind}) ` });
					if (scene.alteration !== undefined)
						divElt.createEl('b', { text: ` ${scene.alteration} ` });
					break;
				case SceneType.Interrupt:
					divElt.createSpan({ text: ` (interrupt) ` });
					divElt.createEl('s', { text: ` (expected) ${scene.expected} ` });
					if (scene.alteration !== undefined)
						divElt.createEl('b', { text: ` ${scene.alteration} ` });
					break;
			}
			if ((scene.kind != AlterationKind.Expected) && (scene.alteration == "")) {
				divElt.createEl('b', { text: " needs alteration! " });
				divElt.createSpan({ text: ' edit this scene to provide the adjusted scene!' });
			}

			if (scene.fate !== undefined) {
				scene.fate.toHtml(divElt, tables);
			}
			if (scene.focus !== undefined) {
				scene.focus.toHtml(divElt, tables);
				// el.createDiv({ text: ` ${scene.focus.toText(tables)} `, cls: 'mythic-random' });
			}
			if (scene.meaning !== undefined) {
				el.createDiv({ text: ` ${scene.meaning.result1} `, cls: 'mythic-random' });
				el.createEl('b', { text: ` ${scene.meaning.result2} `, cls: 'mythic-random' });
			}
		} catch (error) {
			const msg = `error when parsing scene: ${error as Error}`;
			console.error(msg);
			divElt.createSpan({ text: msg, cls: 'mythic-error' });
		}
	}
}
export class SceneModal extends Modal {
	scene: Scene;
	action: string = "Save";
	mandDisplay?: DisplayValueComponent;
	saveButton?: ButtonComponent;
	randomButton?: ButtonComponent;
	alterationDropdown?: DropdownComponent;
	alterationText?: TextAreaComponent;
	fateDataModal?: FateDataModal;
	meaningDropdown?: DropdownComponent;
	infoDisplay1?: DisplayValueComponent;
	infoDisplay2?: DisplayValueComponent;
	infoDisplay3?: DisplayValueComponent;
	hasRandom: boolean = false;
	checkAndShow(tables: Tables, narr?: string): void {
		assertDefined(this.mandDisplay);
		assertDefined(this.saveButton);
		assertDefined(this.randomButton);
		assertDefined(this.alterationDropdown);
		assertDefined(this.alterationText);
		// assertDefined(this.meaningDropdown);
		assertDefined(this.infoDisplay1);
		assertDefined(this.infoDisplay2);
		assertDefined(this.infoDisplay3);
		const status = this.scene.check();
		// mTrace("scene status checked as", SceneStatus[status], this.scene.fate === undefined ? "haven't fate," : "have fate,", narr ?? "other");
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
			case SceneStatus.NeedsFate:
				this.mandDisplay.setValue("Enter the Fate Question.");
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
		const cannotEditAlteration = status < SceneStatus.NeedsAlteration || this.scene.sceneType == SceneType.Expected;
		this.alterationText.setDisabled(cannotEditAlteration);
		const showFate = this.scene.fate !== undefined;
		if (status == SceneStatus.NeedsFate && this.scene.fate === undefined) console.warn("fate needed but missing!");
		if (showFate) {
			if (this.scene.fate === undefined) console.warn("want to show fate but missing!");
			assertDefined(this.fateDataModal);
			if (this.fateDataModal.fateData === undefined)
				console.warn("fate modal has no data");
		}
		if (this.fateDataModal !== undefined) this.fateDataModal.setVisibility(showFate, "CAS");
		const cannotSetMeaning = status < SceneStatus.NeedsMeaning
			|| this.scene.sceneType == SceneType.Expected;
		if (this.meaningDropdown !== undefined)
			this.meaningDropdown.setDisabled(cannotSetMeaning);
		const [d1, d2, d3] = this.scene.toText(tables);
		this.infoDisplay1.setValue(d1);
		this.infoDisplay2.setValue(d2);
		this.infoDisplay3.setValue(d3);
		mTrace('scene', cannotEditAlteration ? "no alter," : "", cannotSetMeaning ? "no mean," : "", showFate ? "see fate," : "not see fate,", this.scene.fate === undefined ? "haven't fate," : "have fate,", this.scene.meaning === undefined ? "haven't meaning," : "have meaning: " + this.scene.meaning.meaningKind, ", type:", this.scene.sceneType, ", kind:", this.scene.kind, SceneStatus[status]);
	}
	showAlterationKind(tables: Tables) {
		switch (this.scene.kind) {
			case AlterationKind.Expected: break;
			case AlterationKind.Next: break;
			case AlterationKind.Tweak: break;
			case AlterationKind.FateQuestion:
				assertDefined(this.fateDataModal);
				if (this.fateDataModal.fateData == undefined) {
					assertDefined(this.scene.fate);
					this.fateDataModal.setData(this.scene.fate, tables);
				}
				break;
			case AlterationKind.Meaning: break;
			case AlterationKind.Adjustment: break;
		}
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
					this.checkAndShow(tables, "ident");
				});
			});
		new Setting(this.contentEl).setName('Chaos')
			.setDesc("The current Chaos Factor").addSlider((slider) => {
				slider.setLimits(1, 9, 1).setInstant(true).setValue(this.scene.chaos).onChange((value) => {
					this.scene.chaos = value;
					this.checkAndShow(tables, "chaos");
				});
			});
		new Setting(this.contentEl)
			.setDesc("Describe what is expected to happen.").setName('Expected').addTextArea((text) => {
				text.setPlaceholder("What is expected to happen");
				text.setValue(this.scene.expected);
				text.onChange((value) => {
					this.scene.expected = value;
					this.checkAndShow(tables, "exp");
				});
			});
		new Setting(this.contentEl)
			.setDesc("This makes the random change.").addButton((btn) => {
				this.randomButton = btn;
				btn
					.setButtonText("Throw the Dice")
					.setCta()
					.onClick(() => {
						this.scene.setRandom(tables, plugin);
						// if (this.scene.meaning !== undefined)
						// // mTrace('scene', "on scene randomise, meaning kind is", this.scene.meaning?.meaningKind);
						// {
						// 	if (this.scene.fate !== undefined) {
						// 		assertDefined(this.fateDataModal);
						// 		// if (this.fateDataModal === undefined)
						// 		// 	this.fateDataModal = new FateDataModal();
						// 		this.fateDataModal.setVisibility(true); //?? TODO
						// 		this.fateDataModal.setData(this.scene.fate, tables);
						// 	}
						// }
						this.checkAndShow(tables, "dice");
					});
			});
		new Setting(this.contentEl)
			.setDesc("Decide how to alter the scene.").setName('Alteration Kind').addDropdown((dropDown) => {
				this.alterationDropdown = dropDown;
				dropDown.addOptions({
					// expected: 'expected',
					next: 'next',
					tweak: 'tweak',
					fatequestion: 'fatequestion',
					meaning: 'meaning',
					adjustment: 'adjustment',
					table: 'table',
				});
				dropDown.setValue(this.scene.kind);
				dropDown.onChange((value) => {
					mTrace('', "alteration kind", value,);
					this.scene.setAlterationKind(value as AlterationKind);
					this.scene.useAlterationKind();
					// assertDefined(this.fateDataModal);
					// this.fateDataModal.data = this.scene.fate;
					// this.scene.setRandom(tables, plugin);
					this.showAlterationKind(tables);
					if (this.scene.fate !== undefined) {
						assertDefined(this.fateDataModal);
						this.fateDataModal.setVisibility(true);
						this.fateDataModal.setData(this.scene.fate, tables);
					}
					if (this.scene.kind == AlterationKind.Adjustment && this.scene.adjustment !== undefined && this.scene.adjustment?.length == 0)
						this.scene.addSceneAdjustment();
					this.checkAndShow(tables, "alter");
				});
			});
		if (this.fateDataModal === undefined)
			this.fateDataModal = new FateDataModal(this.contentEl, tables,
				(isRandom) => {
					this.setRandom(isRandom);
					/* TODO what if random? */
					this.checkAndShow(tables, "fate");
				});
		this.fateDataModal.setVisibility(this.scene.fate !== undefined, "CON");
		if (this.scene.fate !== undefined)
			this.fateDataModal.setData(this.scene.fate, tables);
		// if (this.scene.meaning !== undefined)
		MeaningModal.makeMeaning(this.contentEl, this.meaningDropdown, tables,
			(meaningKind: string) => {
				if (this.scene.meaning !== undefined) {
					this.scene.meaning.meaningKind = meaningKind;
					this.scene.meaning.explain(tables);
					// mTrace('scene', "after meaning, meaning is", this.scene.meaning);
				}
				this.checkAndShow(tables, "mean");
			}, this.scene.meaning);
		new Setting(this.contentEl).addDisplayValue(disp => {
			this.infoDisplay1 = disp;
		});
		new Setting(this.contentEl).addDisplayValue(disp => {
			this.infoDisplay2 = disp;
		});
		new Setting(this.contentEl).addDisplayValue(disp => {
			this.infoDisplay3 = disp;
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
					// mTrace('scene', "setting alteration to", this.scene.alteration);
					this.checkAndShow(tables, "res");
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
						// mTrace('scene', "setting scene to", json);
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
		this.checkAndShow(tables, "start");
	}
	setRandom(hasRandom: boolean) {
		this.hasRandom = hasRandom;
		this.scene.hasRandom = hasRandom;
	}
}
