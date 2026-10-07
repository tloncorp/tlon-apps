# Channels

Adding, arranging, renaming, restricting, leaving and deleting the channels inside a group, plus sections, channel permissions and channel templates.

## Open the screen for managing a group's channels

Phone: on the Workspaces tab, press and hold the group, tap `Group info & settings`, then `Channels`. Or open the group and tap the list-with-a-pencil icon at the top right of its channel list.
Desktop: hover the group in the Home sidebar, open its three-dot menu, pick `Group info & settings`, then `Channels`. The same icon is at the top of the group's channel list.
Who: group admins only. Both are greyed out while the app can't reach the group's host.
Notes: the `Channels` screen lists each channel under its section, with its type under its name. `Sort` and `New` are at the top right. A phone opens a one-channel group straight into the channel, so use the first route there.

## Add a channel to a group

Phone: on the group's `Channels` screen, tap `New`, then `New channel`. Type a `Title`, choose `Chat`, `Notebook` or `Gallery` under `Channel type`, and tap `Create channel`.
Who: group admins.
Notes: `Chat` is selected to start with. There is no description field here; add one afterwards by renaming the channel. Bulletin channels can no longer be created. If you're an admin but not the group's host, a `Hosted on your node` notice appears: the new channel runs on your node, not the host's.

## Limit a new channel to certain roles

Phone: in the `Create a new channel` sheet, switch on `Custom Permissions`. The button changes to `Next`; tap it. On `Channel permissions`, tap `Add roles`, pick the roles that should get in, and save. Then tap the circle under `Write` for each role that should be able to post, and tap `Create channel`.
Who: group admins.
Notes: the table starts with only the admin role, which always has `Read` and `Write`. Roles you add can read but not post until you fill their `Write` circle. A Notebook is the exception: a role that can read it can also edit it. Leave `Custom Permissions` off and every member of the group can read and post.

## Choose which roles can get into a channel

Phone: on the `Channel permissions` screen, tap `Add roles`. On `Select roles`, tap a role to tick or untick it. `Search roles` narrows the list. Tap `Save` at the top right.
Who: group admins.
Notes: `Members` stands for everyone in the group; untick it to keep ordinary members out. The admin role isn't listed because it always has access. `Create new role` at the bottom makes a new role and ticks it for you when you come back. You reach this screen both when making a channel with custom permissions and when editing an existing channel's permissions.

## Change who can read or post in a channel

Phone: open the channel's info screen and tap `Permissions`. Switch on `Custom Permissions`. Tap `Add roles` to choose which roles get in, tap the circle under `Write` to let a role post or stop it posting, and tap the X under `Remove` to take a role out. Tap `Save`.
Who: group admins. The row is greyed out while the app can't reach the group's host.
Notes: `Permissions` reads `Public` when every member can read and post, and `Custom` otherwise. These screens never use the word "private". Switching on starts with admins and `Members` both allowed, so nothing changes until you edit the table. Switch it off and save to open the channel up again.

## Make a channel where only admins can post

Phone: open the channel's info screen and tap `Permissions`. Switch on `Custom Permissions`; a `Members` row appears. In that row, tap the circle under `Write` so it is empty, and leave `Read` filled. Tap `Save`.
Who: group admins.
Notes: everyone in the group can still read, and only admins can post. To let one more role post, tap `Add roles`, add it, and fill its `Write` circle. The admin role's circles can't be changed. If the channel already had custom permissions, start from the rows that are there. This doesn't work for a Notebook, where reading and editing can't be separated.

## Give a role read-only access to a Notebook

Notes: this isn't possible. A Notebook has a single permission, so any role that can read it can also edit it. With `Custom Permissions` on, the screen says `Notebook channels do not support separate read and write permissions. Roles that can read a notebook can also edit it.` The `Read` and `Write` circles move together, so emptying `Write` for a role takes it out of the notebook altogether. To stop people editing, leave their role out. Chat and Gallery channels do have separate `Read` and `Write`.

## Open a channel's info and settings

Phone: open the group, press and hold the channel in its channel list, and tap `Channel info & settings`. Or, inside the channel, tap its name at the top. Admins can also tap the three-dot icon next to the channel on the group's `Channels` screen.
Desktop: hover the channel in the group's channel list and open its three-dot menu, or right-click it, then pick `Channel info & settings`. Clicking the channel's name at the top works too.
Notes: all of these open `Channel info`. In a group with a single channel, the menu and the name at the top are the group's, not the channel's; only the `Channels` screen reaches that channel's own info.

## What the Channel info screen shows

Notes: from the top: the channel's name and the group it belongs to; an `Invite` button if you're allowed to invite people to the group; `Pin` or `Unpin`; `Permissions`, for admins only; `Notifications`, with the current level under it; `Host`, the node that runs the channel, which you can tap to open its profile; then `Leave channel` and `Delete channel` at the bottom when they apply to you. Admins also get `Rename` at the top right, or a pencil icon if they came from the group's `Channels` screen.

## Rename a channel or change its description

Phone: open the channel's `Channel info` screen and tap `Rename` at the top right. On `Edit channel info`, change `Name` and `Description`, then tap `Save`.
Who: group admins. `Rename` is greyed out while the app can't reach the group's host.
Notes: a name can be up to 30 characters and a description up to 300. In a group with several channels, the description shows under the channel's name at the top of the channel. If you opened the info from the group's channel-management screen, the button is a pencil icon instead of `Rename`. A channel has no picture of its own to set, and its type can't be changed after it's made.

## Reorder channels or move one to another section

Phone: on the group's `Channels` screen, tap `Sort`. A three-line handle appears on every channel and section header. Drag a channel by its handle to a new spot; drop it below another section's header to move it into that section. Tap `Done`.
Desktop: the same, dragging the handle with the mouse.
Who: group admins.
Notes: dragging is the only way. There are no up and down buttons and no menu for picking a section. A channel belongs to the section header above it. Dragging a section header moves only the header, so channels join whichever header ends up above them. `New` and the three-dot icons are hidden until you tap `Done`.

## Group channels into sections

Phone: on the group's `Channels` screen, tap `New`, then `New section`. In the `Add section` sheet, type a `Title` and tap `Save`. The new section starts empty, so tap `Sort` and drag channels under its header.
Who: group admins.
Notes: a section with no channels in it doesn't appear in the group's channel list. Members only see sections when their own channel list is set to sort by arrangement; see "The channel order or sections an admin set aren't showing".

## Rename or delete a section

Phone: on the group's `Channels` screen, tap the three-dot icon on the section's header. `Edit name` opens `Change section name`: type the new name and tap `Save`. `Delete section` removes the section.
Who: group admins.
Notes: `Delete section` acts at once, with no confirmation. The channels in it are not deleted; they move to the section above. A section at the very top has nothing above it, so the group's host puts its channels in the default section instead. The group's default section has no three-dot icon, so it can't be renamed or deleted. The three-dot icons are hidden while you are in `Sort` mode.

## The channel order or sections an admin set aren't showing

Phone: on the Workspaces tab, press and hold the group, tap `Sort channels`, then `Sort by arrangement`.
Desktop: hover the group in the Home sidebar and open its three-dot menu for the same options.
Notes: the app starts on `Sort by recency`, which lists a group's channels under `Recent Channels` with the most recently active first and ignores sections. `Sort by arrangement` shows the sections and order admins set. It is your own display setting and covers all your groups; every member chooses their own, and an admin can't set it for them. `Sort channels` only appears for groups with more than one channel.

## Leave a channel

Phone: open the group, press and hold the channel in its channel list, tap `Leave channel`, then `Leave` to confirm. `Leave channel` is also at the bottom of the channel's info screen.
Desktop: hover the channel in the group's channel list and open its three-dot menu.
Who: anyone except the channel's host.
Notes: the confirmation says `You will no longer receive updates from this channel.` You stay in the group, and the channel moves to `Available Channels` at the bottom of the group's channel list, where you can join it again.

## Why the menu says Cannot leave channel

Notes: your node hosts that channel, usually because you made it. The press-and-hold menu shows `Cannot leave channel` with `Host (you) must delete to leave` under it, greyed out, and the channel's info screen has no `Leave channel` for you. The only way out is `Delete channel` at the bottom of the channel's info screen, which removes the channel for everyone. The `Host` row on that screen shows whose node runs a channel.

## Rejoin a channel you left

Phone: open the group and scroll to `Available Channels` at the bottom of its channel list. Tap the channel with the `Join` badge.
Desktop: the same section is at the bottom of the group's channel list in the sidebar.
Notes: `Available Channels` holds the channels in the group that you aren't in and that your roles are allowed to read, so it is also where you join a channel you were never in. One tap joins; there is no confirmation. The section isn't shown when there is nothing to join.

## Delete a channel

Phone: open the channel's info screen, scroll to the bottom, and tap `Delete channel`. In the dialog, tap `Delete channel` again to confirm or `Cancel` to back out.
Who: group admins, and the channel's host.
Notes: the dialog warns `This action cannot be undone. All messages in this channel will be permanently deleted.` For a Notebook it says the notebook and its notes will be permanently deleted. The channel goes away for everyone, and there is no archive or undo. Deleting is only on the info screen, not in the press-and-hold menu.

## Use a channel as a template for a new one

Phone: press and hold the channel in its group's channel list and tap `Use channel as template`. On `New Channel with Modifications`, type a `Title`, pick a group under `Choose where to create this channel`, and tap `Create Channel`.
Desktop: the option is in the three-dot menu, but its screen is only in the phone app.
Who: you can only pick groups you host that have a name.
Notes: this makes an empty channel of the same type and copies over the add-ons listed under `Modifications running in this channel:`. Messages aren't copied. Only Chat and Gallery channels offer it, a moment after the menu opens, once the app has loaded the add-on list (even an empty one). If copying fails, you see `Channel failed to setup with modifications` and the new channel is removed.

## See who is in a channel

Notes: a channel in a group has no member list of its own. Its info screen shows the `Host` but not who is in it. Everyone in the group can see a channel unless its `Permissions` limit it to certain roles, so look at the group's members and their roles instead, from `Group info & settings`. The `Members` item in a press-and-hold menu belongs to group DMs, not to channels in a group.
