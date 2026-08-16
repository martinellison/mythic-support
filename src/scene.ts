import { Type, plainToInstance, instanceToPlain } from 'class-transformer';
import { Modal, App, Setting, MarkdownPostProcessorContext } from 'obsidian';
import { CodeBlock } from './codeblock.js';
import { Tables } from './tables2.js';
import { MeaningKind, RandomEvent } from './randomevent.js';
import MythicSupportPlugin, { assertDefined } from './main.js';
import { Question } from './question.js';

export const enum AlterationKind {
	Expected = 'expected',
	Next = 'next',
	Tweak = 'tweak',
	Fate = 'fate',
	Meaning = 'meaning',
	Adjustment = 'adjustment',
	Table = 'table',
}
export const enum SceneTest {
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
// scene text should come after a scene block
export class Scene {
	static readonly TAG = 'mythic-scene';
	num: number = 0;
	chaos: number = 5;
	sceneTest: SceneTest = SceneTest.Expected;
	kind: AlterationKind = AlterationKind.Expected;
	expected: string = '';
	alteration: string = '';
	adjustment: Array<SceneAdjustment> = [];
	has_random_event: boolean = false;
	@Type(() => RandomEvent)
	random_event: RandomEvent = new RandomEvent();
	eventMeaning: Array<number> = [1, 1];
	constructor(num?: number) {
		this.num = num ?? 0;
	}
	setRandom(tables: Tables, plugin: MythicSupportPlugin): void {
		const sceneTestRandom = Question.dice(10);
		if (sceneTestRandom > this.chaos) {
			this.sceneTest = SceneTest.Expected; this.has_random_event = false;
		}
		else if (sceneTestRandom % 2 == 1) {
			this.sceneTest = SceneTest.Altered; this.has_random_event = false;
		}
		else this.sceneTest = SceneTest.Interrupt;
		this.adjustment = [];
		this.addSceneAdjustment();
		this.random_event.throwDice();
		this.random_event.interpret(tables, plugin.metadata);
		this.eventMeaning = [Question.dice(100), Question.dice(100)];
	}
	addSceneAdjustment() {
		const sceneAdjustRandom = Question.dice(10);
		switch (sceneAdjustRandom) {
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

	static fromJson(source: string): Scene {
		// @ts-ignore
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
		return plainToInstance(Scene, JSON.parse(source));
	}
	toJson(): string {
		return JSON.stringify(instanceToPlain(this));
	}
	static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext, tables: Tables) {
		assertDefined(tables);
		// console.log("rendering scene", source);
		const scene: Scene = Scene.fromJson(source);
		let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-scene' });
		divElt.createSpan({ text: `Scene ${scene.num}: chaos ${scene.chaos}:` });
		switch (scene.sceneTest) {
			case SceneTest.Expected:
				divElt.createSpan({ text: ` (expected)` });
				divElt.createEl('i', { text: ` ${scene.expected} ` });
				break;
			case SceneTest.Altered:
				divElt.createSpan({ text: `(altered ${scene.kind})` });
				switch (scene.kind) {
					case AlterationKind.Meaning:
						divElt.createSpan({
							text: ` ${RandomEvent.meanings(tables, scene.eventMeaning, scene.random_event.meaning_kind)}`
						});
						break;
					case AlterationKind.Adjustment:
						for (let adj of scene.adjustment) divElt.createSpan({ text: ` ${adj}` });
						break;
					default:
				}
				divElt.createEl('s', { text: ` (expected) ${scene.expected} ` });
				divElt.createEl('i', { text: `(altered ${scene.kind}) ${scene.alteration}` });
				break;
			case SceneTest.Interrupt:
				divElt.createSpan({ text: ` (interrupt)` });
				divElt.createEl('s', { text: ` (expected) ${scene.expected} ` });
				divElt.createSpan({ text: ` ${scene.alteration}` });
				break;
		}
		// if (scene.alteration == "") {
		// 	divElt.createEl('b', { text: ' interrupted' });
		// 	divElt.createSpan({ text: ' edit this scene to provide the new interruption scene' });
		// } else {
		// 	divElt.createSpan({ text: ` (interruption)` });
		// 	divElt.createEl('i', { text: ` ${scene.kind} (${scene.alteration})` });
		// }
		// break;
		// default: console.error("bad test", scene.sceneTest);
		if ((scene.kind != AlterationKind.Expected) && (scene.alteration == "")) {
			divElt.createEl('b', { text: " needs alteration" });
			divElt.createSpan({ text: ' edit this scene to provide the adjusted scene' });
		}
		if (scene.has_random_event) {
			// // console.log("random event");
			let randElt = divElt.createSpan({ text: `(random) `, cls: 'mythic-random' });
			randElt.createSpan({ text: scene.random_event.explain(tables), });
		}
	}
}
export class SceneModal extends Modal {
	scene: Scene;
	constructor(app: App, scene: Scene, block: CodeBlock, tables: Tables, plugin: MythicSupportPlugin) {
		super(app);
		// let alterationSetting: Setting;
		// let randomSetting: Setting;
		this.scene = scene;
		this.setTitle('Scene');
		new Setting(this.contentEl).setName('Number').addText((text) => {
			text.setValue(this.scene.num.toString());
			text.onChange((value) => {
				if (parseInt(value) !== undefined)
					this.scene.num = parseInt(value);
			});
		});
		new Setting(this.contentEl).setName('Chaos')
			.setDesc("The current Chaos Factor").addSlider((slider) => {
				slider.setLimits(1, 9, 1).setInstant(true).setValue(this.scene.chaos).onChange((value) => {
					this.scene.chaos = value;
				});
			});
		if (this.scene.sceneTest == SceneTest.Interrupt) {
			new Setting(this.contentEl).setName("Random Event").addToggle(
				(flag) => {
					flag.setValue(this.scene.has_random_event);
					flag.onChange(
						(value) => {
							this.scene.has_random_event = value;
						});
				});
		}

		new Setting(this.contentEl).setName('Expected').addTextArea((text) => {
			text.setPlaceholder("What is expected to happen");
			text.setValue(this.scene.expected);
			text.onChange((value) => {
				this.scene.expected = value;
			});
		});
		new Setting(this.contentEl).setName('Alteration kind').addDropdown((dropDown) => {
			dropDown.addOptions({
				expected: 'expected',
				next: 'next',
				tweak: 'weak',
				fate: 'fate',
				meaning: 'meaning',
				adjustment: 'adjustment',
				table: 'table',
			});
			dropDown.setValue(this.scene.kind);
			dropDown.onChange((value) => {
				// console.log("alteration kind", value,);
				this.scene.kind = value as AlterationKind;
				// if (alterationSetting !== undefined)
				// 	alterationSetting.setDisabled(this.scene.sceneTest == SceneTest.Expected);
				// if (randomSetting !== undefined)
				// 	randomSetting.setDisabled(this.scene.sceneTest != SceneTest.Interrupt);
			});
		});
		if (this.scene.sceneTest != SceneTest.Expected) {
			new Setting(this.contentEl)
				.setName('Alteration')
				.addTextArea((text) => {
					text.setPlaceholder("What actually happens");
					text.setValue(this.scene.alteration);
					text.onChange((value) => {
						this.scene.alteration = value;
					});
				});
		}
		// .setDisabled(this.scene.kind == AlterationKind.Expected);
		new Setting(this.contentEl).setName('Meaning').addDropdown((dropDown) => {
			// // console.log(tables);
			// // console.log("meaning is", tables.meaning);
			for (let o of tables.meaning) {
				const om = o[0];
				if (om[om.length - 1] != '2')
					dropDown.addOption(om, om);
			}
			dropDown.setValue(this.scene.random_event.meaning_kind);
			dropDown.onChange((value) => {
				// console.log("scene meaning changed to", value);
				// this.scene.setRandom();
				this.scene.random_event.meaning_kind = value as MeaningKind;
				this.scene.setRandom(tables, plugin);
			});
		});
		this.addSaveButton(app, scene, block, tables, plugin, true, "Throw dice and save");
		this.addSaveButton(app, scene, block, tables, plugin, false, "Save");
		new Setting(this.contentEl).addButton((btn) =>
			btn
				.setButtonText('Cancel')
				.setCta()
				.onClick(() => {
					this.close();
				}),
		);
	}
	addSaveButton(app: App, scene: Scene, block: CodeBlock, tables: Tables, plugin: MythicSupportPlugin, randomise: boolean, caption: string): void {
		new Setting(this.contentEl).addButton((btn) =>
			btn
				.setButtonText(caption)
				.setCta()
				.onClick(() => {
					this.close();
					if (randomise)
						this.scene.setRandom(tables, plugin);
					const json = scene.toJson();
					let editor = app.workspace.activeEditor?.editor;
					if (editor !== undefined)
						block.replaceContents(Scene.TAG, json, editor);
				}),
		);
	}
};
