import { Editor } from 'obsidian';
// MarkDown code block
export class CodeBlock {
	start: number = 0;
	end: number = 0;
	kind: string = '';
	is_block: boolean = true;
	static DELIM = '```';
	constructor(
		start: number = 0,
		end: number = 0,
		kind: string = '',
		is_block: boolean = true,
	) {
		this.start = start;
		this.end = end;
		this.kind = kind;
		this.is_block = is_block;
	}
	static nonBlock(): CodeBlock {
		return new CodeBlock(0, 0, '', false);
	}
	// find whether the cursor is in a code block and if so find the extent
	static get(editor: Editor): CodeBlock {
		const line_count = editor.lineCount();
		let line_number = editor.getCursor().line;
		let line = '';
		let last_line = line_number;
		for (; ;) {
			line = editor.getLine(last_line).trim();
			if (last_line == line_count - 1 || line == CodeBlock.DELIM) break;
			last_line++;
		}
		if (line != CodeBlock.DELIM) {
			console.warn(
				"bad last line (%d '%s')",
				last_line,
				editor.getLine(last_line),
			);
			return CodeBlock.nonBlock();
		}
		let first_line = line_number;
		for (; ;) {
			line = editor.getLine(first_line).trim();
			if (first_line == 0 || line.substring(0, 3) == CodeBlock.DELIM)
				break;
			first_line--;
		}
		if (line.substring(0, 3) != CodeBlock.DELIM) {
			console.warn(
				"bad first line (%d '%s')",
				first_line,
				editor.getLine(first_line),
			);
			return CodeBlock.nonBlock();
		}
		let tag = line.substring(3);
		return new CodeBlock(first_line, last_line, tag, true);
	}
	// find the contents of the CodeBlock
	contents(editor: Editor): string {
		if (!this.is_block) return '';
		return editor.getRange(
			{ line: this.start + 1, ch: 0 },
			{ line: this.end, ch: 0 },
		);
	}
	replaceContents(tag: string, json_text: string, editor: Editor) {
		const block = `\`\`\`${tag}\n${json_text}\n\`\`\`\n`;
		editor.replaceRange(
			block,
			{ line: this.start, ch: 0 },
			{ line: this.end + 1, ch: 0 },
		);
	}
}
