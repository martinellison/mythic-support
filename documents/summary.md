# Summary

This page provides an introduction to internals of the Mystic GME plugin.

The plugin is for Obsidian so see the Obsidian plugin document.

## Data blocks

The data is stored in Markdown "code blocks" with `mythic-` language codes. Obsidian has support for collecting these blocks as 'metadata' so they can be scanned by plugins. 

The content of the "code" blocks for Mythic is stored as JSON, which the plugin decodes to TypeScript class objects.

The plugin processes these blocks:

* displays Modal dialogs to allow the player to create blocks.
* reads existing blocks and uses the same Modals to allow the player to edit the blocks.
* converts the blocks to HTML and displays them in Reading mode.

### Block types

The block types are:

| Block type  | Use                             | Comments                                           |
| ----------- | ------------------------------- | -------------------------------------------------- |
| Adventure   | top level                       |                                                    |
| Dice        | dice thrower, e.g. for `2d6+d4` | can be used with other rule sets                   |
| Event focus | event focus                     | not a stand-alone block/Modal                      |
| Fate data   | fate questions                  |                                                    |
| Meaning     | meaning                         | may be stand-alone, or part of a question or scene |
| Object      | anything that can go on a list  | also used for oracle responses and simple text     |
| Question    | fate question                   | can contain event focus, fate data or meaning      |
| Scene       | scene in the story              | can contain event focus, fate data or meaning      |

### An example of a block

This is an example of a "code" block used to store Mythic data.

	```mythic-scene
	{"ident":"0","chaos":5,"sceneType":"altered","kind":"next","expected":"Many things","alteration":"A bit different"}
	```
This is a typical block.

	```mythic-scene
This is the header line. The block 'pretends' to be code of type `mythic-scene`. In fact, it is data of this kind (this is common in Obsidian plugins).

	{"ident":"0","chaos":5,"sceneType":"altered","kind":"next","expected":"Many things","alteration":"A bit different"}
This is the data about the scene in JSON format.

	```			
This is the footer (ends the block).
