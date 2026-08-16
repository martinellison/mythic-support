#  
This plugin helps with using the Mythic Game Master Emulator to play solo role-playing games.

This assumes that you have a copy of Tana Pigeon's *Mythic Game Master Emulator* (2nd ed.), Word Mill Games, 2026, Riverside CA. If not, buy a copy. See https://www.wordmillgames.com/ for further information.

### Setup
- install the Obsidian note-taking application. See https://obsidian.md/
- create a new vault for this, so you do not corrupt your other notes.
- For the alpha or beta versions, pull down a copy of the latest plugin release from GitHub and move it into the `.obsidian/plugins` directory in your vault.
- copy the `tables.kdl` file into a `tables.md` file in your vault. (This step will be automated in a later release).
- go to Community plugins and enable the Mythic GME plugin.
### Starting a new story
- create a new folder for your story.
- create a new note in this folder
- go to the plugin properties and set the Adventure Folder property to the path to the folder for your story (same as above).
- create an adventure
    - Get into edit mode and make sure that the cursor is on a blank line.
    - Bring up the *Mythic GME: Create a Mythic Object* command (you may want to define a hotkey for this).
    - select adventure in the drop-down and click create.
    - enter a short description into the big box and click create.
- Create sections for Characters and Threads
- Create at least one character under Characters.
    - this is for Non-player characters
    - you probably want to create an Obsidian subheading for each character so you can refer to them by Obsidian links.
    - position your cursor outside any existing blocks and bring up the *Mythic GME: Create a Mythic Object* command
    - select character and click create.
    - enter a short description of your character into the big box and click create.
- Create at least one thread under Threads.
    - you probably want to create an Obsidian subheading for each thread so you can refer to it by Obsidian links
    - position your cursor outside any existing blocks and bring up the *Mythic GME: Create a Mythic Object* command
    - select thread and click create
    - enter a short description of your thread into the big box and click create.
- You can edit your character or thread by selecting them and then using the *Mythic GME: Edit selected* command (you may want to define a hotkey for this).
## Journalling
- You probably want to create space for your journal. For a short story this could just be a heading. For a long story, this should be a separate folder.
- create a heading for your first chapter.

### Creating a new scene
- To create a new scene first make sure that you are in edit mode and the cursor is on a new empty line.
- add in a heading as required using the usual Obsidian commands.
- then use the My… create object command and select create scene. A dialog box will come up for the new scene. Enter the expected summary and click on roll dice and create. To make the scene.
- if Mythic decides that your scene is *altered*
, re-edit the scene to add the altered scene.
- there several *blocks* that you can add in your scene. See below.
- you can also add new objects (characters and threads) as described above. You can also mark the objects as deleted. Mythic should automatically update the Lists.
### Questions

You can add *yes/no questions* (as described in the Mythic book).

### Dice

There is a dice roller. Enter the question (e.g. "how many monsters appear?") and the dice expression (e.g. "2d6+2") and click on "throw the dice".

### Random

This will occur if you have customised the tables. To do this, create a random entry and then select your specific table and throw the dice.

### Notes

It is also possible to add notes. These do not have any formatting; they are just plain text.

By default, there are three kinds of notes:

- to do: if you need a reminder, e.g. to write some more text;
- out of character (OOC): anything not as a player character;
- note: anything else.

But this list can be changed in the options.

## The format

Like many Obsidian plugins, the Mythic GME plugin uses a form of modified MarkDown to record the information that is being maintained.

In the specific case of Mythic, the plugin uses *code blocks* to record the plugin-specific data. This can be seen by opening a Mythic note and going into *source mode* (in the top right menu).

The source blocks begin with a line starting "\`\`\`mythic-…" and with a line of "\`\`\`". These need to be on a line of their own, so, if the formatting gets confused, edit the source to correct this.

The content of the blocks is in JSON notation (this may change later) and you could edit this if you are careful and know what you are doing.

Otherwise use the 'Mythic edit' command to bring up an edit dialog and later click *Save* to save your changes.

## To edit the options

It is possible to edit some options. This provides some alternatives to the standard Mythic tables.

At writing, the options are stored in the `tables.md` note in the Obsidian vault, but this will change.

The options are stored in KDL ("cuddle") format. Hopefully, the the sample options file will be readable in itself. KDL is documented at https://kdl.dev/, although most of the detail will not be necessary for this plugin.

*To do: describe the specific options.*

## To edit the formatting

Obsidian has features for editing the appearance of your data. See the Obsidian CSS documentation for this.

The *CSS classes* all begin with "mythic-". *To do: document the specifics.*
