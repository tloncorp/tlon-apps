# Channels

Adding, arranging, renaming, restricting, leaving and deleting the channels inside a group, plus sections, channel permissions and channel templates.

## Open the screen for managing a group's channels
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/features/top/chatDetails.tsx, packages/app/ui/components/GroupChannelsScreenView.tsx, packages/app/ui/components/ManageChannels/ManageChannelsShared.tsx -->
<!-- covers: route:ManageChannels -->

Phone: on the Workspaces tab, press and hold the group, tap `Workspace info & settings`, then `Channels`. Or open the group and tap the list-with-a-pencil icon at the top right of its channel list.
Desktop: hover the group in the Home sidebar, open its three-dot menu, pick `Workspace info & settings`, then `Channels`. The same icon is at the top of the group's channel list.
Who: group admins only. Both are greyed out while the app can't reach the group's host.
Notes: the `Channels` screen lists each channel under its section, with its type under its name. `Sort` and `New` are at the top right. A phone opens a one-channel group straight into the channel, so use the first route there.

## Add a channel to a group
<!-- src: packages/app/ui/components/ManageChannels/ManageChannelsShared.tsx, packages/app/ui/components/ManageChannels/CreateChannelSheet.tsx, packages/app/ui/components/SystemNotices.tsx -->

Phone: on the group's `Channels` screen, tap `New`, then `New channel`. Type a `Title`, choose `Chat`, `Notebook` or `Gallery` under `Channel type`, and tap `Create channel`.
Who: group admins.
Notes: `Chat` is selected to start with. There is no description field here; add one afterwards by renaming the channel. Bulletin channels can no longer be created. If you're an admin but not the group's host, a `Hosted on your node` notice appears: the new channel runs on your node, not the host's.

## Limit a new channel to certain roles
<!-- src: packages/app/ui/components/ManageChannels/CreateChannelSheet.tsx, packages/app/ui/components/ManageChannels/ChannelPermissions.tsx, packages/app/features/groups/CreateChannelPermissionsScreen.tsx, packages/app/ui/components/ManageChannels/channelAccessSections.ts -->
<!-- covers: route:CreateChannelPermissions -->

Phone: in the `Create a new channel` sheet, switch on `Custom Permissions`. The button changes to `Next`; tap it. On `Channel permissions`, set `Everyone` to `No access`, `Can view` or `Can post`, then set each role under `Roles` the same way. `New role…` at the bottom makes a role. Tap `Create` at the top right.
Who: group admins.
Notes: `Everyone` starts at `No access`, and each role starts there too, except a role you make with `New role…`, which starts at `Can view`. `Can post` includes seeing the channel. The admin role is not listed, because it always has access. Leave `Custom Permissions` off and every member of the group can read and post. A Notebook has only `No access` and `Can view and edit`.

## Change who can read or post in a channel
<!-- src: packages/app/features/top/chatDetails.tsx, packages/app/features/groups/EditChannelPrivacyScreen.tsx, packages/app/ui/components/ManageChannels/ChannelPermissions.tsx, packages/app/ui/components/ManageChannels/channelAccessSections.ts, packages/app/ui/components/ChatDetailsScreenView.tsx -->
<!-- covers: route:EditChannelPrivacy -->

Phone: open the channel's info screen and tap `Permissions`. On `Channel permissions`, set `Everyone` to `No access`, `Can view` or `Can post`, or change one role's level under `Roles`, then tap `Save` at the top right.
Who: group admins. The row is greyed out while the app can't reach the group's host.
Notes: `Permissions` reads `Everyone` when every member can read and post, and `Custom` otherwise. These screens never use the word "private". A role marked `Same as everyone` has no access of its own beyond what everyone has, and while `Everyone` has access the role can't go below it, so set `Everyone` to `No access` first to take that away. Setting `Everyone` back to `Can post` opens the channel up again.

## Make a channel where only admins can post
<!-- src: packages/app/features/top/chatDetails.tsx, packages/app/features/groups/EditChannelPrivacyScreen.tsx, packages/app/ui/components/ManageChannels/ChannelPermissions.tsx, packages/app/ui/components/ManageChannels/channelAccessSections.ts, packages/app/ui/components/ChatDetailsScreenView.tsx -->

Phone: open the channel's info screen and tap `Permissions`. On `Channel permissions`, set `Everyone` to `Can view`, then tap `Save` at the top right.
Who: group admins.
Notes: everyone in the group can still read, and only admins can post. A role still set to `Can post` can post too, so set it to `Can view` to stop that. This doesn't work for a Notebook, where its only levels are `No access` and `Can view and edit`.

## Give a role read-only access to a Notebook
<!-- src: packages/shared/src/logic/notesPermissionsCompat.ts, packages/app/ui/components/ManageChannels/channelAccessSections.ts, packages/app/features/groups/EditChannelPrivacyScreen.tsx -->

Notes: this isn't possible. A Notebook has a single permission, so a role is either `No access` or `Can view and edit`, and any role that can read a notebook can also edit it. The line under the roles reads "… can see and edit this notebook." To stop people editing, leave their role out. Chat and Gallery channels do have separate `Can view` and `Can post` levels.

## Open a channel's info and settings
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/features/top/ChannelScreen.tsx, packages/app/ui/components/Channel/ChannelHeader.tsx, packages/app/ui/components/ManageChannels/ManageChannelsShared.tsx, packages/app/features/top/ChannelDetailsScreen.tsx, packages/app/features/top/ChatDetailsScreen.tsx, packages/app/ui/components/listItems/ChannelListItem.tsx -->
<!-- covers: route:ChannelInfo -->

Phone: open the group, press and hold the channel in its channel list, and tap `Channel info & settings`. Or, inside the channel, tap its name at the top. Admins can also tap the three-dot icon next to the channel on the group's `Channels` screen.
Desktop: hover the channel in the group's channel list and open its three-dot menu, or right-click it, then pick `Channel info & settings`. Clicking the channel's name at the top works too.
Notes: all of these open `Channel info`. In a group with a single channel, the menu and the name at the top are the group's, not the channel's; only the `Channels` screen reaches that channel's own info.

## What the Channel info screen shows
<!-- src: packages/app/features/top/chatDetails.tsx, packages/app/features/top/ChannelDetailsScreen.tsx, packages/app/features/top/ChatDetailsScreen.tsx, packages/app/ui/utils/channelUtils.tsx, packages/app/ui/components/ChatDetailsScreenView.tsx -->

Notes: from the top: the channel's name and the group it belongs to; an `Invite` button if you're allowed to invite people to the group; `Pin` or `Unpin`; `Forward` and `Copy link` for a channel in a group, except a Notebook; `Permissions`, for admins only, reading `Everyone` or `Custom`; `Notifications`, with the current level beside it; `Host`, the node that runs the channel, which you can tap to open its profile; `Scheduled tasks` with a count, when your bot has tasks posting here or could post here; then "Leave channel" and `Delete channel` at the bottom when they apply to you. Admins also get `Edit` at the top right.

## Rename a channel or change its description
<!-- src: packages/app/features/top/ChatDetailsScreen.tsx, packages/app/features/top/ChannelDetailsScreen.tsx, packages/app/ui/components/ManageChannels/EditChannelMetaScreenView.tsx, packages/app/ui/components/Channel/ChannelHeader.tsx, desk/app/notes.hoon, packages/app/ui/components/ChatDetailsScreenView.tsx -->
<!-- covers: route:EditChannelMeta -->
<!-- absent: channel icon -->

Phone: open the channel's `Channel info` screen and tap `Edit` at the top right. On `Edit channel info`, change `Name` and `Description`, then tap `Save`.
Who: group admins. `Edit` is greyed out while the app can't reach the group's host.
Notes: a name can be up to 30 characters and a description up to 300. In a group with several channels, the description shows under the channel's name at the top of the channel. A channel has no picture of its own to set, and its type can't be changed after it's made. For a Notebook channel, the new name also becomes the notebook's title.

## Reorder channels or move one to another section
<!-- src: packages/app/ui/components/ManageChannels/ManageChannelsShared.tsx, packages/app/ui/components/ManageChannels/ManageChannelsScreenView.tsx, packages/app/ui/components/ManageChannels/ManageChannelsScreenView.web.tsx, packages/app/hooks/useSortableChannelNav.ts -->
<!-- absent: move to section -->

Phone: on the group's `Channels` screen, tap `Sort`. A three-line handle appears on every channel and section header. Drag a channel by its handle to a new spot; drop it below another section's header to move it into that section. Tap `Done`.
Desktop: the same, dragging the handle with the mouse.
Who: group admins.
Notes: dragging is the only way. There are no up and down buttons and no menu for picking a section. A channel belongs to the section header above it. Dragging a section header moves only the header, so channels join whichever header ends up above them. `New` and the three-dot icons are hidden until you tap `Done`.

## Group channels into sections
<!-- src: packages/app/ui/components/ManageChannels/ManageChannelsShared.tsx, packages/app/ui/components/ManageChannels/EditSectionNameSheet.tsx, packages/app/ui/components/GroupChannelsScreenView.tsx -->

Phone: on the group's `Channels` screen, tap `New`, then `New section`. In the `Add section` sheet, type a `Title` and tap `Save`. The new section starts empty, so tap `Sort` and drag channels under its header.
Who: group admins.
Notes: a section with no channels in it doesn't appear in the group's channel list. Members only see sections when their own channel list is set to sort by arrangement; see "The channel order or sections an admin set aren't showing".

## Rename or delete a section
<!-- src: packages/app/ui/components/ManageChannels/ManageChannelsShared.tsx, packages/app/ui/components/ManageChannels/EditSectionNameSheet.tsx, desk/app/groups.hoon -->

Phone: on the group's `Channels` screen, tap the three-dot icon on the section's header. `Edit name` opens `Change section name`: type the new name and tap `Save`. `Delete section` removes the section.
Who: group admins.
Notes: `Delete section` acts at once, with no confirmation. The channels in it are not deleted; they move to the section above. A section at the very top has nothing above it, so the group's host puts its channels in the default section instead. The group's default section has no three-dot icon, so it can't be renamed or deleted. The three-dot icons are hidden while you are in `Sort` mode.

## The channel order or sections an admin set aren't showing
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/ui/components/GroupChannelsScreenView.tsx, packages/shared/src/db/keyValue.ts -->

Phone: on the Workspaces tab, press and hold the group, tap `Sort channels`, then `Sort by arrangement`.
Desktop: hover the group in the Home sidebar and open its three-dot menu for the same options.
Notes: the app starts on `Sort by recency`, which lists a group's channels under `Recent Channels` with the most recently active first and ignores sections. `Sort by arrangement` shows the sections and order admins set. It is your own display setting and covers all your groups; every member chooses their own, and an admin can't set it for them. `Sort channels` only appears for groups with more than one channel.

## Leave a channel
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/ui/contexts/chatOptions/chatOptions.tsx, packages/app/features/top/chatDetails.tsx, packages/app/ui/utils/channelUtils.tsx, packages/app/ui/components/GroupChannelsScreenView.tsx -->

Phone: open the group, press and hold the channel in its channel list, tap `Leave channel`, then `Leave` to confirm. `Leave channel` is also at the bottom of the channel's info screen.
Desktop: hover the channel in the group's channel list and open its three-dot menu.
Who: anyone except the channel's host.
Notes: the confirmation says `You will no longer receive updates from this channel.` You stay in the group, and the channel moves to `Available Channels` at the bottom of the group's channel list, where you can join it again.

## Why the menu says Cannot leave channel
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/features/top/chatDetails.tsx, packages/shared/src/store/channelActions.ts, packages/app/ui/components/ChatDetailsScreenView.tsx -->

Notes: your node hosts that channel, usually because you made it. The press-and-hold menu shows `Cannot leave channel` with `Host (you) must delete to leave` under it, greyed out, and the channel's info screen has no `Leave channel` for you. The only way out is `Delete channel` at the bottom of the channel's info screen, which removes the channel for everyone. The `Host` row on that screen shows whose node runs a channel.

## Rejoin a channel you left
<!-- src: packages/app/ui/components/GroupChannelsScreenView.tsx, packages/app/features/top/GroupChannelsScreen.tsx, packages/shared/src/db/queries.ts -->

Phone: open the group and scroll to `Available Channels` at the bottom of its channel list. Tap the channel with the `Join` badge.
Desktop: the same section is at the bottom of the group's channel list in the sidebar.
Notes: `Available Channels` holds the channels in the group that you aren't in and that your roles are allowed to read, so it is also where you join a channel you were never in. One tap joins; there is no confirmation. The section isn't shown when there is nothing to join.

## Delete a channel
<!-- src: packages/app/features/top/chatDetails.tsx, packages/app/ui/utils/channelUtils.tsx, packages/app/ui/components/ChatDetailsScreenView.tsx -->

Phone: open the channel's info screen, scroll to the bottom, and tap `Delete channel`. In the dialog, tap `Delete channel` again to confirm or `Cancel` to back out.
Who: group admins, and the channel's host.
Notes: the dialog warns `This action cannot be undone. All messages in this channel will be permanently deleted.` For a Notebook it says the notebook and its notes will be permanently deleted. The channel goes away for everyone, and there is no archive or undo. Deleting is only on the info screen, not in the press-and-hold menu.

## Use a channel as a template for a new one
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/ui/components/ChannelFromTemplateView.tsx, packages/shared/src/store/useChannelHooksPreview.ts, packages/app/navigation/RootStack.tsx -->
<!-- covers: route:ChannelTemplate -->

Phone: press and hold the channel in its group's channel list and tap `Use channel as template`. On `New Channel with Modifications`, type a `Title`, pick a group under `Choose where to create this channel`, and tap `Create Channel`.
Desktop: the option is in the three-dot menu, but its screen is only in the phone app.
Who: you can only pick groups you host that have a name.
Notes: this makes an empty channel of the same type and copies over the add-ons listed under `Modifications running in this channel:`. Messages aren't copied. Only Chat and Gallery channels offer it, a moment after the menu opens, once the app has loaded the add-on list (even an empty one). If copying fails, you see `Channel failed to setup with modifications` and the new channel is removed.

## Share a channel in a chat, or copy its link
<!-- src: packages/app/features/top/ChatDetailsScreen.tsx, packages/app/features/top/chatDetails.tsx, packages/app/ui/components/ChatDetailsScreenView.tsx, packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/ui/components/ForwardChannelSheet.tsx, packages/app/ui/components/ContentReference/ContentReference.tsx -->

Phone: open the channel's info screen and tap `Forward`. In the `Forward channel` sheet, tap the chat you want, then tap the button at the bottom, which reads "Forward to" and the chat's name. To copy a link instead, press and hold the channel in its group's channel list and tap `Copy link to channel`; the info screen's `Copy link` does the same.
Notes: what arrives is a card for the channel. Someone who is in its group can tap it to open the channel; anyone else is taken to the group's preview. A copied link works the same way once you paste it into a message box. Notebooks have neither option.

## Add a Buckets channel for shared files
<!-- src: packages/app/ui/components/ManageChannels/CreateChannelSheet.tsx, packages/app/lib/featureFlags.ts, packages/app/ui/components/SettingsScreenView.tsx, packages/app/ui/utils/channelUtils.tsx, packages/app/ui/components/SystemNotices.tsx -->
<!-- flag: buckets -->

Phone: on the Settings tab, open `Experimental features` and switch on `Buckets channels`. Then start a new channel the usual way: `Buckets` now appears under `Channel type`, described as `Shared files for members and agents`.
Who: group admins, in groups the app can tell are hosted on Tlon. In other groups the sheet says `Buckets are currently available only in workspaces hosted on Tlon.` and leaves the type out. Your node also needs a version that supports Buckets.
Notes: the switch is off by default and is set per device. A Bucket always lives on the group host's node and uses its storage. It can't be left, and it can't be deleted from its info screen.

## See who is in a channel
<!-- src: packages/app/features/top/chatDetails.tsx, packages/app/features/top/ChannelDetailsScreen.tsx, packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/ui/components/ChatDetailsScreenView.tsx -->

Notes: a channel in a group has no member list of its own. Its info screen shows the `Host` but not who is in it. Everyone in the group can see a channel unless its "Permissions" row limits it to certain roles, so look at the group's members and their roles instead, from `Workspace info & settings`. The `Members` item in a press-and-hold menu belongs to group DMs, not to channels in a group.
