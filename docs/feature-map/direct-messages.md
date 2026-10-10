# Direct messages

Starting, accepting, blocking, leaving and managing one-to-one DMs and group DMs, and where the DMs with your bot and with Tlon Support sit.

## Find my DMs
<!-- src: packages/app/hooks/chatListFilters.ts, packages/app/hooks/useFilteredChats.ts, packages/app/navigation/desktop/HomeSidebar.tsx, packages/app/navigation/desktop/MessagesSidebar.tsx, packages/app/features/top/MessagesFilterMenu.tsx, packages/app/navigation/desktop/TopLevelDrawer.tsx -->

Phone: DMs are on the Workspaces tab, mixed in with your groups. Tap `Messages` at the top to show only DMs.
Desktop: DMs are in two sidebars. The first icon in the left rail opens `Home`, which mixes them with your groups. The second opens `Messages`, which lists DMs and group DMs under `Direct Messages`. The filter icon at the top left of `Messages` switches between `Direct Messages`, `Chat Channels` and `All Messages`.
Notes: on desktop, pinned chat channels stay in `Messages` whichever filter is picked.

## Start a DM with someone
<!-- src: packages/app/features/top/CreateChatSheet.tsx, packages/app/features/top/ChatListScreen.tsx, packages/app/navigation/desktop/HomeSidebar.tsx, packages/app/navigation/desktop/MessagesSidebar.tsx, packages/app/ui/components/ContactBook.tsx, packages/shared/src/store/channelActions.ts -->
<!-- covers: route:DM -->

Phone: on the Workspaces tab, tap the plus icon at the top right. In the `Start a conversation` sheet tap `New Message`, then tap the person. The DM opens straight away.
Desktop: click the plus icon at the top of the `Home` or `Messages` sidebar, pick `New Message`, then pick the person.
Notes: the list shows your saved contacts. With none saved it reads `No Contacts`. Picking someone you already have a DM with opens that chat. The other person hears nothing until you send your first message.

## Message someone who isn't in my contacts
<!-- src: packages/app/features/top/CreateChatSheet.tsx, packages/app/ui/components/ContactBook.tsx, packages/app/ui/hooks/contactSorters.ts -->

Phone: tap the plus icon on the Workspaces tab, then `New Message`. In the `Filter by nickname or id` box, type the person's ID, the name that starts with ~. They show up in the results. Tap them to open the DM.
Notes: a complete, valid ID always gets a result, even for someone the app has never seen. Typing the start of a nickname or ID also finds people the app already knows who aren't saved contacts. The box only matches nicknames and IDs, so a phone number or email address won't find anyone.

## Message someone from their profile
<!-- src: packages/app/ui/components/UserProfileScreenView.tsx, packages/app/features/top/UserProfileScreen.tsx, packages/app/ui/components/AuthorRow.tsx -->

Phone: open the person's profile by tapping their name or avatar on a message they sent. On the `Profile` screen, tap `Message`. Your DM with them opens.
Notes: `Message` isn't shown for someone you've blocked. Tap `Unblock` there first. It isn't on your own profile either.

## Accept, deny or block a DM from someone new
<!-- src: packages/app/ui/components/Channel/DmInviteOptions.tsx, packages/app/ui/components/Channel/index.tsx, packages/app/ui/components/listItems/ChannelListItem.tsx, packages/app/features/chat-list/ChatList.tsx, packages/shared/src/store/dmActions.ts, packages/app/ui/components/UserProfileScreenView.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: a first DM from someone shows on the Workspaces tab with an `Invite` badge. Tap it. Where the message box would be there are three buttons. `Accept` makes it a normal DM and the message box appears. `Deny` removes the chat from your list. `Block` denies it and blocks the person.
Notes: an invite to a group DM has only `Accept` and `Deny`. Until you answer, you can't reply, and the chat has no press-and-hold menu (no three-dot menu on desktop). To undo a block, open the person's profile and tap `Unblock`, or open `Blocked users` in Settings.

## What tapping the name at the top of a DM does
<!-- src: packages/app/ui/components/Channel/ChannelHeader.tsx, packages/app/ui/components/Channel/index.tsx, packages/app/features/top/ChannelScreen.tsx, packages/app/ui/components/ScreenHeader/ScreenHeader.tsx, packages/app/ui/components/UserProfileScreenView.tsx -->

Phone: in a one-to-one DM, tap the person's name at the top. Their profile opens, with `Message`, `Add Contact` or `Remove Contact`, and `Block`.
Notes: under the name the header shows the person's status, or `Direct message` if they have none. A group DM's header shows its name, or its members' names if it has none, and a member count. Tapping a group DM's header does nothing, even though a small arrow sits beside the name. DMs have no info or settings screen. Their options are in the menu you get by pressing and holding the DM on the Workspaces tab.

## Open the options menu for a DM
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/features/chat-list/ChatList.tsx, packages/app/ui/components/listItems/ChannelListItem.tsx -->

Phone: on the Workspaces tab, press and hold the DM. The menu has `Chat notifications`, `Pin` or `Unpin`, `Mark as read` when something is unread, and `Leave chat`. A group DM also has `Edit group info` and `Members`.
Desktop: hover the DM in the sidebar and open its three-dot menu, or right-click it.
Notes: this menu only opens from the list. Nothing inside the DM itself opens it. A DM you haven't accepted yet has no menu.

## Change notifications for one DM
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/ui/contexts/chatOptions/useChatVolumeOptions.ts -->

Phone: on the Workspaces tab, press and hold the DM, tap `Chat notifications`, and pick a level.
Desktop: hover the DM in the sidebar, open its three-dot menu, and pick `Chat notifications`.
Notes: the row shows the current level, followed by "(custom)" if you set it for this DM or "(app default)" if it follows your app-wide setting. The levels themselves are explained with the other notification settings.

## Start a group DM
<!-- src: packages/app/features/top/CreateChatSheet.tsx, packages/app/ui/components/UserProfileScreenView.tsx, packages/app/ui/components/listItems/ChannelListItem.tsx -->
<!-- covers: route:GroupDM -->
<!-- absent: new group dm -->

Phone: the app can't start a new group DM. `New Message` opens a chat with one person the moment you tap them, and there's no way to pick several. To talk with several people, make a group from the same plus menu with `New group`. On an account with a bot, the phone offers `New Workspace` instead.
Notes: group DMs you're already in still work. They're listed under their members' names. You can rename one, see its members, change its notifications and leave it, but not add or remove people.

## Rename a group DM or change its icon
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/features/channels/ChannelMetaScreen.tsx, packages/app/ui/components/MetaEditorScreenView.tsx, packages/app/ui/components/Form/inputs.tsx, packages/app/ui/components/listItems/ChannelListItem.tsx -->
<!-- covers: route:ChannelMeta -->

Phone: on the Workspaces tab, press and hold the group DM and tap `Edit group info`. On the `Edit chat info` screen, change `Name`, `Icon image` (tap `Change icon image`) or `Description`, then tap `Save` at the top right. The screen stays open after saving, so tap back to leave.
Desktop: hover the group DM in the sidebar, open its three-dot menu, and pick `Edit group info`.
Notes: any member gets this option. Names are capped at 30 characters, descriptions at 300. The new name shows at the top of the chat, but the row in your list keeps showing the members' names. If the icon button reads `Storage not configured`, you can't change the icon. One-to-one DMs can't be renamed.

## See who is in a group DM
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/features/channels/ChannelMembersScreen.tsx, packages/app/ui/components/ChannelMembersScreenView.tsx, packages/app/ui/components/Channel/ChannelHeader.tsx -->
<!-- covers: route:ChannelMembers -->

Phone: on the Workspaces tab, press and hold the group DM and tap `Members`. The `Members` screen lists each person's name and ID.
Desktop: hover the group DM in the sidebar, open its three-dot menu, and pick `Members`.
Notes: the list is read-only. There's no way to add or remove people, and tapping a person does nothing. It includes people who were invited but haven't accepted yet. Inside the chat, the line under the name gives the member count.

## Leave or delete a DM
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/ui/contexts/chatOptions/chatOptions.tsx, packages/shared/src/store/dmActions.ts, packages/app/hooks/useChatSettingsNavigation.ts, packages/app/features/top/CreateChatSheet.tsx -->
<!-- absent: clear history, delete conversation -->

Phone: on the Workspaces tab, press and hold the DM or group DM, tap `Leave chat`, then tap `Leave` to confirm.
Desktop: hover it in the sidebar, open its three-dot menu, and pick `Leave chat`.
Notes: the chat is removed from your list and you land back on the list. The confirmation reads `You will no longer receive updates from this channel.` Leaving is the only way to remove a DM. There is no separate delete, and no way to clear a DM's history. To talk to the person again, start a new DM with `New Message`. The app can't add people to a group DM, so it has no way back into one you've left.

## Why is there no message box in this DM?
<!-- src: packages/app/ui/components/Channel/index.tsx, packages/app/ui/components/Channel/ReadOnlyNotice.tsx, packages/app/ui/components/Channel/DmInviteOptions.tsx -->

Phone: two things can take the message box's place. `Accept` and `Deny` buttons mean the DM is an invite you haven't answered. Tap `Accept` to reply. A line reading "Your node's version of the Tlon app doesn't match the other node." means your node and theirs aren't on matching versions. In a group DM it ends "other nodes."
Notes: there's no button to fix a version mismatch. The message box returns once the versions match.

## Block or unblock someone I have a DM with
<!-- src: packages/app/ui/components/Channel/ChannelHeader.tsx, packages/app/ui/components/UserProfileScreenView.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/ui/components/PostModeration.tsx, packages/app/ui/components/AuthorRow.tsx -->

Phone: open the DM, tap the person's name at the top, and tap `Block` on their profile. To undo it, tap `Unblock` in the same spot, or open `Blocked users` in Settings.
Notes: a blocked person's profile has no `Message` button. Their messages are replaced by `Message from a blocked user.` with a `Show anyway` link. A group DM has no block button of its own. Open a member's profile by tapping their name on one of their messages instead.

## Find the DM with my bot
<!-- src: packages/app/hooks/useBotDmTab.ts, packages/app/navigation/TopLevelTabNavigator.native.tsx, packages/app/features/top/ChannelScreen.tsx, packages/app/ui/components/Channel/index.tsx, packages/app/features/top/UserProfileScreen.tsx, packages/app/ui/components/UserProfileScreenView.tsx, packages/app/navigation/desktop/HomeSidebar.tsx, packages/app/navigation/desktop/MessagesSidebar.tsx, packages/app/navigation/desktop/TopLevelDrawer.tsx -->

Phone: it's the Bot tab, the first tab in the bar, and the app opens on it. It has no back arrow because it's a tab. Tap the bot's name at the top to open its profile, which has a `Bot settings` row.
Desktop: there is no Bot tab. The bot's DM sits with your other DMs in the `Home` and `Messages` sidebars.
Who: the Bot tab only appears on a hosted account with its bot turned on.
Notes: the same DM is also in the Workspaces list with your other DMs, where its press-and-hold menu works like any other DM's.

## Find my DM with Tlon Support
<!-- src: packages/app/hooks/useBootSequence.ts, packages/app/lib/bootHelpers.ts, packages/app/hooks/chatListFilters.ts, packages/app/navigation/desktop/HomeSidebar.tsx, packages/app/navigation/desktop/MessagesSidebar.tsx, packages/app/ui/components/Channel/DmInviteOptions.tsx -->

Phone: it's a normal DM on the Workspaces tab. Tap `Messages` at the top to narrow the list to DMs and look for it there.
Desktop: look in the `Home` or `Messages` sidebar.
Who: hosted accounts. The DM arrives during hosted signup.
Notes: the app finds this DM by a fixed node ID, "~wittyr-witbes", which it treats as the Tlon team's node. It accepts the DM for you during signup, so you never see `Accept` and `Deny` on it. The DM from the person whose invite link you signed up with is accepted the same way. After that both behave like any other DM.

## A DM appeared saying someone "is on Tlon Messenger"
<!-- src: packages/app/ui/components/listItems/ChatListItem.tsx, packages/shared/src/db/queries.ts, packages/shared/src/db/modelBuilders.ts -->

Phone: when someone from your synced phone contacts turns out to be on Tlon Messenger, the app adds an empty DM with them to your Workspaces list. Under their name it reads `is on Tlon Messenger`. Tap it and send a message to say hi.
Who: accounts that have a phone number added and have synced their phone contacts.
Notes: you didn't start this DM and neither did they. The app made the row so they're easy to find. The line under their name shows only while the chat has no messages.
