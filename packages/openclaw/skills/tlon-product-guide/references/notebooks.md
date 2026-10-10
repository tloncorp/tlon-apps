# Notebooks and Bulletins

Writing in a Notebook channel (notes, folders, the Markdown note editor, saving, publishing a note to a public link, searching, importing files) and reading or posting in an older Bulletin channel.

## Open a notebook and see what's in it

Phone: open the group and tap the Notebook channel. Folders come first, A to Z, then notes, most recently changed at the top. A note shows its title (or `Untitled`), a line of its text and when it last changed. A dot marks an unread note and any folder holding one. Tap a note to open it. An empty notebook says `No notes or folders`.
Desktop: the notebook's folders and notes replace the group's channel list in the sidebar, and the note opens on the right. The first note opens by itself; with none open you see `Select a note`. The back arrow above the list returns to the channels. A narrow window behaves like the phone.
Notes: the order can't be changed by hand.

## A notebook says it's unavailable or that I'm not in it

Notes: while it loads you see `Loading notebook`. `You're not in this notebook` means you have left, or never joined, that channel; the screen adds `Join it from the group's channel list.` `Unable to join notebook` comes with `This notebook is private or no longer available.` `Notebook unavailable` means its contents have not reached your device yet.

## Open a folder in a notebook

Phone: tap the folder. It opens on its own screen with the folder's name at the top, listing the folders and notes inside. The back arrow goes up a level. In the list, a folder shows how many notes it holds, counting its subfolders, or just `Folder` when it has none.
Desktop: click the folder and the sidebar shows its contents. The back arrow above the list goes up one level.
Notes: anything you create or import while a folder is open goes into that folder.

## Create a note

Phone: in the notebook, or inside the folder you want it in, tap `New` at the top right, then `New note`. A blank note opens ready for typing, with the cursor in the title. You can also press and hold a folder and tap `New note` to put it there.
Desktop: click the plus icon above the notebook's list in the sidebar, then `New note`. With no note open, the main pane also has a `New note` button. For a folder, hover it and open its three-dot menu, or right-click it.
Who: people with edit access to the notebook. Without it, `New` is not shown.
Notes: the note exists as soon as you tap. A note with no title shows as `Untitled`.

## Create a folder, or a folder inside a folder

Phone: tap `New` at the top right, then `New folder`. A sheet titled `Add folder` says where it will be created. Type a name where it says `Folder name` and tap `Add folder`. To nest it, open the parent folder first, or press and hold the parent and tap `New folder`.
Desktop: click the plus icon above the notebook's list, then `New folder`. For a subfolder, hover the parent and open its three-dot menu, or right-click it.
Who: people with edit access to the notebook.
Notes: folders can sit inside folders. The app calls the top level `Root`.

## Rename a note or a folder

Phone: for a note, press and hold it and tap `Rename note`. The note opens with the cursor in its title; change it and it saves by itself. You can also open the note, tap `Edit`, and change the title there. For a folder, press and hold it, tap `Rename folder`, type the new name and tap `Rename`.
Desktop: hover the note or folder and open its three-dot menu, or right-click it.
Who: people with edit access to the notebook.

## Move a note or a folder

Phone: press and hold the note and tap `Move to folder`. In the `Move note` sheet, pick a folder (use `Search folders` to narrow the list), then tap the button at the bottom that reads "Move to" and the folder's name. For a folder, press and hold it and tap `Move folder`, then pick its new parent.
Desktop: hover the note or folder and open its three-dot menu, or right-click it.
Who: people with edit access to the notebook.
Notes: the top level is listed as `Root`, marked `Top level`. A folder can't be moved into itself or one of its own subfolders, so those are not offered. Notes and folders can't be dragged to move them.

## Delete a note or a folder

Phone: press and hold the note and tap `Delete note`, then `Delete` to confirm. For a folder, press and hold it and tap `Delete folder`, then confirm.
Desktop: hover the note or folder and open its three-dot menu, or right-click it. A confirmation box asks first.
Who: people with edit access to the notebook.
Notes: deleting a folder also permanently deletes every note and folder inside it. When the folder isn't empty, the confirmation says how many (on a phone it is headed `Delete folder and contents?`). Notebooks have no trash and no undo.

## Read, write or edit a note

Phone: tap the note. It opens formatted, for reading. Tap `Edit` at the top right to change it: the title box is at the top (`Untitled` when empty) and the text goes below, where it says `Note body`. Tap `Preview` to see it formatted again. A note you just created opens straight in editing.
Who: people with edit access to the notebook. Others can read, and can tap `Edit` to see the raw text, but can't change it.
Notes: above the title are the note's folder, its save status and the date it last changed. The title can only be changed while editing. Until the app restarts, a note reopens in the view you last left it in.

## What formatting can I use in a note?

Notes: a note's text is Markdown that you type yourself. There is no formatting toolbar and no rich-text mode: while editing you see plain text in a fixed-width font, and `Preview` shows how it renders. Headings, bold, italic, strikethrough, links, images, bulleted and numbered lists, task lists, tables, quotes and code blocks are understood, and so are mentions of people by their ID. If a note is empty, the preview says `Nothing to preview yet.` To show an image, write it in Markdown with its web address; there is no attach button in a note.

## Does a note save by itself?

Notes: yes. There is no save button. A note saves about ten seconds after you change it, and straight away when you leave the note, switch to another one, or put the app in the background. The line above the title shows `Not synced` while you have unsaved changes, `Syncing...` while it saves, and `Synced` when it is done. Unsaved text is also kept on your device, so it comes back if the app closes before the save went through.

## Two people changed the same note

Notes: notes are not edited live together. You don't see someone else's typing; their changes show up after they save, and only while you have no unsaved changes of your own. If someone else saves the note while you have unsaved changes, your save is refused and a red banner says `This note was changed elsewhere. Your unsaved changes are kept.` Tap `Keep mine` to save your version over theirs, or `Use theirs` to drop your changes and load their version. Saving is paused until you choose.

## Publish a note to a public link

Phone: in the notebook's list, press and hold the note and turn on `Publish to web`. The app copies the link for you and says `Published note. Link copied to clipboard.` The menu stays open and now also shows `Copy link` and `View published note`.
Desktop: hover the note and open its three-dot menu, or right-click it.
Who: people with edit access to the notebook.
Notes: the link is a web page served from your own node, and anyone with the link can open it without logging in. It shows the note's title and text as they were when you published; later edits don't appear there until you update it. The switch is only in the list menu, not inside the open note.

## Copy the link to a published note, view it, or update it

Phone: press and hold the published note. `Copy link` copies its public address. `View published note` opens the page in your browser. `Update published note` sends the note's current title and text to the public page.
Desktop: hover the note and open its three-dot menu, or right-click it.
Who: only whoever published the note sees `Copy link` and `View published note`, since the page lives on their own node. `Update published note` also needs edit access to the notebook.
Notes: `Update published note` appears when the note has changed since you published it. The app only knows that for notes you published since opening the notebook this time; for the rest it shows the option anyway.

## Unpublish a note

Phone: press and hold the note and turn off `Publish to web`. The app says `Unpublished note.`, and `Copy link` and `View published note` leave the menu.
Desktop: hover the note and open its three-dot menu, or right-click it.
Who: people with edit access to the notebook.

## Search the notes in a notebook

Phone: in the notebook, tap the magnifying glass at the top right. On the `Search notes` screen, type a word. Each result shows the note's title, its folder and the matching text, highlighted. Tap one to open it.
Desktop: with the notebook open, press ⌘⇧F on a Mac or Ctrl+Shift+F elsewhere. A search box opens over the app; use the arrow keys and Enter, and Esc or `Close` to dismiss it. There is no search button in the notebook's sidebar. In a narrow window, use the magnifying glass at the top right instead.
Who: the magnifying glass and the shortcut only work when your node runs a recent enough version of Tlon's software.
Notes: it searches titles and text in this one notebook (`Search this notebook by note title or content.`), not across notebooks.

## Import Markdown or text files into a notebook

Phone: tap `New` at the top right, then `Import files`, and pick the files. `Import folder`, where your device offers it, brings in a whole folder and recreates its subfolders in the notebook.
Desktop: click the plus icon above the notebook's list for the same two options, or drag files or a folder onto the main pane.
Who: people with edit access to the notebook.
Notes: files ending in .md, .markdown or .txt are imported; each becomes a note named after the file. Others are skipped, and if none qualify you see `No markdown or text files found.` Notes land in the folder you have open. A name already taken in that folder gets a number added.

## Link to a note from a chat

Phone: press and hold the note in the notebook's list and tap `Copy Tlon reference`. Paste it into a message, and it shows as a card with the note's title, author and opening lines.
Desktop: hover the note and open its three-dot menu, or right-click it.
Notes: anyone who can open the notebook can copy a reference. Tapping the card opens the note for people who are in that notebook. For a link anyone can open in a browser, publish the note instead.

## Who can edit a notebook, and can it be read-only?

Notes: a Notebook has one level of access, not separate reading and writing. On the notebook's `Channel permissions` screen, with `Custom Permissions` turned on, the app says so itself: `Notebook channels do not support separate read and write permissions. Roles that can read a notebook can also edit it.` Changing `Read` or `Write` for a role changes both. So that screen can limit which roles get into a notebook, but it can't make a role read-only. To share something read-only, publish the note to a public link.

## Comments, reactions and version history on notes

Notes: a note has no comments, replies or emoji reactions. To discuss one, copy a reference to it and talk in a Chat channel. The app also has no list of a note's earlier versions and no way to roll a note back; the only time it offers two versions is when two people's changes collide. It doesn't show who else has a note open.

## What is a Bulletin channel, and can I create one?

Notes: a Bulletin is the older writing channel: posts with a title, an optional header image and a body, each with comments underneath. The app labels the type `Bulletin`. New ones can't be created: adding a channel offers `Chat`, `Notebook` and `Gallery`. Existing Bulletins keep working. `Use channel as template` is not offered on a Bulletin, because a template makes a channel of the same type. A Bulletin's posts can be copied into a Notebook with the bot command `/migrate`, when the bot or its owner hosts that Bulletin.

## Read a Bulletin post

Phone: open the Bulletin channel. Each post is a card with its header image, title, author and first few lines, plus how many replies it has. Tap a card to open the full post; the comments are underneath it.
Notes: a post saved without a title shows as `Untitled Post`. With no comments yet, the post says `No replies yet`.

## Write a Bulletin post

Phone: in the Bulletin channel, tap `New` at the top right. Type the title where it says `New Title`, tap `Add header image` for a picture at the top, and write the body. The floating button at the bottom right, marked with an italic I, opens the formatting bar: bold, italic, link, checklist, heading, image, code, strikethrough, quote, lists, indent, undo and redo. Tap `Post` at the top right.
Desktop: the formatting bar sits above the body.
Who: members allowed to write in the channel. Others have no `New` button and see `This channel is read-only for you.`
Notes: `Post` stays greyed out until there is both a title and body text. Once a picture is chosen the row reads `Edit header image`.

## Edit or delete a Bulletin post

Phone: open the post and tap `Edit` at the top right, change the title, header image or body, then tap `Save`. Or press and hold the post in the channel's list and tap `Edit post`. To delete, press and hold it and tap `Delete post`, then confirm.
Desktop: hover the post in the list and open the three-dot menu at its top right.
Who: the post's author. Group admins can edit and delete anyone's Bulletin post; for them the menu items start with "Admin:".
Notes: deleting can't be undone.

## Comment on a Bulletin post

Phone: open the post, type in the `Reply` box at the bottom and send. Or press and hold the post in the channel's list and tap `Comment`, which opens the post for you.
Desktop: hover the post, open the three-dot menu and pick `Comment`, or open the post and use the `Reply` box.
Who: members allowed to write in the channel. Without that there is no `Reply` box.
Notes: comments on a Bulletin post have no attach button.

## Other things I can do with a Bulletin post

Phone: press and hold the post in the channel's list. Above the menu is a row of emoji for reacting. The menu can hold `Comment`, `Copy link to post`, `Forward`, `Edit post`, `Report post`, `Hide post`, `Pin post to channel` and `Delete post`. `Mute thread` appears once the post has comments.
Desktop: hover the post and open the three-dot menu at its top right.
Who: `Pin post to channel` and `Unpin post` are for group admins. `Hide post` is only on other people's posts. On iPhone and desktop the emoji row needs permission to write in the channel; on Android it always shows.
Notes: unlike a chat message, a Bulletin post has no `Quote`, `Copy message text` or `View reactions` in this menu.
