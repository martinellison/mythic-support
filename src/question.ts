import { Type, plainToInstance, instanceToPlain } from 'class-transformer';
// import 'reflect-metadata';
import { Modal, App, Setting, MarkdownPostProcessorContext } from 'obsidian';
import { CodeBlock } from './codeblock.js';
// import { MythicSupportPluginSettings } from './settings.js';
import { Tables } from './tables2.js';
import { MeaningKind, RandomEvent } from './randomevent.js';
import MythicSupportPlugin from './main.js';
import { Metadata } from './metadata.js';
const NONIDENT = /[^a-zA-Z0-9]+/g;
export class QuestionOdds {
    display: string;
    ident: string;
    fate_check_modifier: number;
    constructor(
        display: string,
        mod: number) {
        this.display = display;
        this.ident = this.display.trim().replaceAll(NONIDENT, '_');
        this.fate_check_modifier = mod;
    }
}
// question text should come after a question block
export class Question {
    static readonly TAG = "mythic-question";
    description: string;
    odds: string;
    chaos_factor: number;
    dice: Array<number>;
    @Type(() => RandomEvent)
    random_event: RandomEvent;
    constructor(description: string) {
        this.description = description;
        this.odds = 'certain';
        this.chaos_factor = 0;
        this.dice = [0, 0];
        this.random_event = new RandomEvent();
    }
    static fromJson(source: string): Question {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.parse returns any
        let question: Question = plainToInstance(Question, JSON.parse(source));
        return question;
    }
    toJson(): string {
        return JSON.stringify(instanceToPlain(this));
    }
    chaosMod(): number {
        return this.chaos_factor > 7 ? this.chaos_factor - 4 : this.chaos_factor < 3 ? this.chaos_factor - 6 : this.chaos_factor - 5;
    }
    isRandom(): boolean { return ((this.dice[0] ?? 0) == (this.dice[1] ?? 0) && (this.dice[0] ?? 0) <= this.chaos_factor); }
    static toHtml(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext, tables: Tables) {
        const question: Question = Question.fromJson(source);
        let divElt: HTMLDivElement = el.createDiv({ cls: 'mythic-question' });
        divElt.createSpan({ text: `Question: ${question.description} ${question.dice[0]}/${question.dice[1]}` });
        divElt.createSpan({ text: ` odds: ${question.odds}` });
        let mod: number = tables.getQuestionOdds(question.odds).fate_check_modifier;
        let roll_total = (question.dice[0] ?? 0) + (question.dice[1] ?? 0) + mod + question.chaosMod();
        let answer = Tables.resolveCheckTable(tables.fateCheckAnswers, roll_total);
        divElt.createSpan({ text: ` roll total ${roll_total} (${answer.text})` });
        // if ((question.dice[0] ?? 0) == (question.dice[1] ?? 0) && (question.dice[0] ?? 0) <= question.chaos_factor) {
        if (question.isRandom()) {
            el.createDiv({ text: question.random_event.explain(tables), cls: 'mythic-random' });
        }
    }
    throwDice(tables: Tables, metadata: Metadata): void {
        for (let d = 0; d < 2; d++) this.dice[d] = Question.dice(10);
        // this.event_focus = Question.dice(100);
        // for (let d = 0; d < 2; d++) this.event_meaning[d] = Question.dice(100);
        this.random_event.throwDice();
        this.random_event.interpret(tables, metadata);
    }
    // random number 1 to `n`
    static dice(n: number): number { return Math.floor(Math.random() * n) + 1; }
}
export class QuestionModal extends Modal {
    question: Question;
    constructor(app: App, question: Question, block: CodeBlock, tables: Tables, plugin: MythicSupportPlugin) {
        super(app);
        this.question = question;
        this.setTitle('Question');
        new Setting(this.contentEl)
            .setName('Description')
            .addText((text) => {
                text.setValue(this.question.description);
                text.onChange((value) => {
                    this.question.description = value;
                });
            });

        new Setting(this.contentEl).setName('Odds').addDropdown((dropDown) => {
            // // console.log("loading odds to dropdown", tables);
            for (let o of tables.questionOdds) dropDown.addOption(o.ident, o.display);
            dropDown.setValue(this.question.odds);
            dropDown.onChange((value) => {
                this.question.odds = value;
            });
        });
        new Setting(this.contentEl).setName('Chaos').addSlider((slider) => {
            slider.setLimits(1, 9, 1).setInstant(true).setValue(this.question.chaos_factor).onChange((value) => {
                this.question.chaos_factor = value;
            });
        });
        new Setting(this.contentEl).setName('Meaning').addDropdown((dropDown) => {
            for (let o of tables.meaning) {
                const om = o[0];
                if (om[om.length - 1] != '2')
                    dropDown.addOption(om, om);
            }
            dropDown.setValue(this.question.random_event.meaning_kind);
            dropDown.onChange((value) => {
                this.question.random_event.meaning_kind = value as MeaningKind;
            });
        });
        this.makeSaveButton(app, question, block, QuestionButtonKind.Save, tables, plugin);
        this.makeSaveButton(app, question, block, QuestionButtonKind.ThrowDice, tables, plugin);
        new Setting(this.contentEl)
            .addButton((btn) => btn
                .setButtonText('Cancel')
                .setCta()
                .onClick(() => {
                    this.close();
                }));
    }
    makeSaveButton(app: App, question: Question, block: CodeBlock, kind: QuestionButtonKind, tables: Tables, plugin: MythicSupportPlugin) {
        if (plugin === undefined) console.error("no plugin");
        else if (plugin.metadata === undefined) console.error("no metadata");
        new Setting(this.contentEl)
            .addButton((btn) => btn
                .setButtonText(QuestionModal.buttonText(kind))
                .setCta()
                .onClick(async (): Promise<void> => {
                    this.close();
                    // console.log("saving question", kind);
                    switch (kind) {
                        case QuestionButtonKind.Save:
                            break;
                        case QuestionButtonKind.ThrowDice:
                            question.throwDice(tables, plugin.metadata);
                            question.random_event.interpret(tables, plugin.metadata);
                            break;
                        default:
                            console.error("unknown button kind", kind);
                    }
                    const json = question.toJson();
                    let editor = app.workspace.activeEditor?.editor;
                    if (editor !== undefined)
                        block.replaceContents(Question.TAG, json, editor);
                }));
    }
    static buttonText(kind: QuestionButtonKind): string {
        switch (kind) {
            case QuestionButtonKind.Save:
                return "Save";
            case QuestionButtonKind.ThrowDice:
                return "Throw dice and save";
            default:
                return "?";
        }
    }
}
const enum QuestionButtonKind {
    ThrowDice, Save,
}
