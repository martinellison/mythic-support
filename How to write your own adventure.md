# the Mythic Game Master Emulator Obsidian Plugin
This plugin helps with using the Mythic Game Master Emulator to play solo role-playing games.

This assumes that you have a copy of Tana Pigeon's *Mythic Game Master Emulator* (2nd ed.), Word Mill Games, 2026, Riverside CA. If not, buy a copy. See https://www.wordmillgames.com/ for further information.

## Setup
- install the Obsidian note-taking application. See https://obsidian.md/
- create a new vault for this plugin, so you do not corrupt your other notes when the plugin malfunctions. For vaults, and other Obsidian features, see the Obsidian documentation.
- The plugin releases are stored on GitHub at https://github.com/martinellison/mythic-support/releases. You want the latest release.
- Pull down a copy of the latest plugin release from GitHub, unzip it,  and move it into the `.obsidian/plugins` directory in your vault (this step will change in later version of this plugin). 
- copy the `tables.kdl` file into a `tables.md` file in your vault. (This step will be automated in a later release).
- open the Settings for your vault, go to Community plugins and enable the Mythic GME plugin. 
- to upgrade to a new version of the plugin, follow the above steps, and (in Settings/Community plugins) stop and restart the plugin. 
## Starting a new story
- create a new folder for your story.
- create a the first note in this folder.
- go to the plugin properties and set the Adventure Folder property to the path to the folder for your story (to the same folder that you have just created).
- create an adventure
    - Get into edit mode and make sure that the cursor is on a blank line.
    - Bring up the *Mythic GME: Create a Mythic Object* command (you may want to define a hotkey for this); this will display a dialog for creating 'blocks' for this plugin..
    - select adventure in the drop-down and click create. This will display a new modal dialog for creating your new adventure.
    - enter a short description into the big box and click create.
    - edit your Obsidian note:
      - Create sections for Characters and Threads
      - Create at least one character under Characters.
- when you start a new story, you will need to update the plugin properties to point to your new folder for the new story/adventure, so that the plugin can find thw characters and threads for the new story.
## Creating characters and threads
- this is for Non-player characters. You do not want to create a character entry for your player character(s).
- you probably want to create an Obsidian subheading for each character so you can refer to them by Obsidian links.
- position your cursor outside any existing blocks and bring up the *Mythic GME: Create a Mythic Object* command; this will display a dialog for creating 'blocks' for this plugin.
- select character and click create.
- enter a short description of your character into the big box and click create. This will display a new modal dialog for creating your new character.
- Create at least one thread under Threads.
    - you probably want to create an Obsidian subheading for each thread so you can refer to it by Obsidian links
    - position your cursor outside any existing blocks and bring up the *Mythic GME: Create a Mythic Object* command, in the same way that you have just created a character.
    - select thread and click create
    - enter a short description of your thread into the big box and click create.
- You can edit your character or thread by selecting them and then using the *Mythic GME: Edit selected* command (you may want to define a hotkey for this).
## Journalling
- You probably want to create space for your journal. For a short story this could just be a heading. For a long story, this should be a separate folder.
- create a heading for your first chapter.

## Creating a new scene
- creating a new scene is somewhat complicated. See the "Scenes" chapter of the Mystic GME book.
- To create a new scene first make sure that you are in edit mode and the cursor is on a new empty line.
- add in a heading as required using the usual Obsidian commands.
- then use the *Mythic GME: Create a Mythic Object* command and select create a scene. A dialog box will come up for the new scene. Enter the 'expected' box (i.e. for the expected events in the scene) and click on roll dice. It will decide whether the scene is *expected*, *interrupted* or *altered*. 
- if Mythic decides that your scene is *altered*
, re-edit the scene to add the altered scene.
- there several *blocks* that you can add in your scene. See below.
- you can also add new objects (characters and threads) as described above. You can also mark the objects as deleted. Mythic should automatically update the Lists.
## Questions

You can add *yes/no questions*. See the "Fate Questions" chapter of the Mystic GME book. 
- use the *Mythic GME: Create a Mythic Object* command and select create a question. A dialog box will come up for the new question.
- enter your question and click on "throw the dice".
- the plugin may decide to create a random event. For this, see the "Random Events" chapter of the Mystic GME book, and answer any extra questions that appear in the dialog box.
- save the results. 

## Dice

There is a dice roller, which answers questions that are answered by a number. 
- use the *Mythic GME: Create a Mythic Object* command and select dice. 
- A dialog box will come up for the dice. Enter the question (e.g. "how many monsters appear?") and the dice expression (e.g. "2d6+2") and click on "throw the dice".

This can be used for other rule sets if you use them in addition to Mythic.

## Oracles

This enables you to ask a question with a text answer. 
- use the *Mythic GME: Create a Mythic Object* command and select oracle. 
- A dialog box will come up for the oracle. Enter the question and select the oracle.

You can add new oracles to the plugin by customising some tables. See the section below on editing the options.

## Notes

It is also possible to add notes. These do not have any formatting; they are just plain text.

By default, there are three kinds of notes:

- *to do*: if you need a reminder, e.g. to write some more text;
- *out of character (OOC)*: anything not as a player character;
- *note*: anything else.

But this list can be changed in the options.

## The format

Like many Obsidian plugins, the Mythic GME plugin uses a form of modified MarkDown to record the information that is being maintained.

In the specific case of Mythic, the plugin uses *code blocks* to record the plugin-specific data. This can be seen by opening a Mythic note and going into *source mode* (in the top right menu).

The source blocks begin with a line starting "\`\`\`mythic-…" and end with a line of "\`\`\`". These need to be on a line of their own, so, if the formatting gets confused, edit the source to correct this.

The content of the blocks is in JSON notation and you could edit this if you are careful and know what you are doing. There is more description on this in the code documentation, which can be found in the source code stored on GitHub.

Otherwise use the 'Mythic edit' command to bring up an edit dialog and later click *Save* to save your changes.

## To edit the options

It is possible to edit some options. This enables additional tables or alternatives to the standard Mythic tables.

At writing, the options are stored in the `tables.md` note in the Obsidian vault. The options can be changed by editing this note or adding the `tables-extra.md` note.

### Options in general

The file is divided into sections, which correspond to the tables printed in the Mystic book. 

### Lines

The individual lines correspond to the different possible outcomes.

The interpretation of each line depends on its parameters.

| Parameter        | Defailt   | Meaning                                   |
| ---------------- | --------- | ----------------------------------------- |
| `display`        | same      | how this line will be shown to the player |
| `mod`            | zero      | adjustment to a dice roll                 |
| `weight`         | 1         | relative probability                      |
| `dice`           | by weight | how the random result is derived          |
| `interpretation` | none      | other table to refer to                   |
| `progress`       | false     | for threads                               |

### Format

The options are stored in KDL ("cuddle") format. Hopefully, the the sample options file will be readable in itself. KDL is documented at https://kdl.dev/, although most of the detail will not be necessary for this plugin.

### New objects

The plugin tracks the 'objects' that the player has created and makes lists of them. Without modification, this means "threads" and "characters".

By adding extra lines to this section, it is possible to add, for example, "locations" or "things". 

### New 'simple' blocks

This section encodes the kinds of 'simple' notes that the player can crate. It is possible to add other kinds as required (for example, as required by another rule set). For example, the 'Lonelog' notation.  

### New oracles

"Oracles" give text answers. These encode the tables found in the book.

Each oracle has its own tables beginning with a `table` node. The `alt` and `noalt` tags are used for the case when two tables are used together to create an response.

The individual lines are the possible responses. Each line has a default weight of 1 but this can be changed by the `weight` tag. There is no mandatory number of entries or weights in a table; the plugin selects from the list using the weights in proportion.

## To edit the formatting

Obsidian has features for editing the appearance of your data. See the Obsidian CSS documentation for this (specifically, see "CSS Code Snippets" https://obsidian.md/help/snippets).

The *CSS classes* for this plugin all begin with "mythic-". See the `styles.css` file in the distribution for the default CSS.

## The Status of this Plugin
This plugin is still being tested.

Also, some features are difficult for users to use. 

If you need help, please open a discussion in the GitHub repository, which is at https://github.com/martinellison/mythic-support. This repository contains the source code for this plugin and some documentation in the `documentation` forlder.

If you discover any errors, or you have any ideas for improvements, raise an issue with the GitHub repository. If you can fix the issue yourself, (raise an issue and then) raise a pull request.

Tip: in Obsidian,  Control-shift-i will bring up the Console, which may provide useful debugging data.
