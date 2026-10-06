# Workspaces list

Getting around the app's main list: the phone's tab bar and Workspaces tab (desktop: the left rail and the Home and Messages sidebars), filters, search, pins, press-and-hold menus, the create menu, and a group's channel list.

## What the tabs at the bottom of the phone app do
<!-- src: packages/app/navigation/TopLevelTabNavigator.native.tsx, packages/app/navigation/topLevelTabs.ts, packages/app/hooks/useBotDmTab.ts -->
<!-- covers: route:MainTabs -->

Phone: the tab bar is icons only, no words. From the left: Bot (your bot's avatar) opens your chat with your Tlonbot. Workspaces (a # sign) lists your groups and DMs. Activity (a bell) is your notifications. Settings is the gear.
Desktop: there is no tab bar. A rail of icons down the left side does this job.
Who: the Bot tab only exists on a hosted account with Tlonbot turned on. Everyone else has three tabs.
Notes: the Bot icon is a colour tile if the bot has no avatar, and a flower shape until its profile loads. A dot under Bot means an unread message from your bot; under Activity, something new elsewhere. During your bot's first-run setup the other tabs can't be selected.

## Which screen the app opens on
<!-- src: packages/app/navigation/TopLevelTabNavigator.native.tsx, apps/tlon-mobile/src/lib/navigationStatePersistence.ts, packages/app/navigation/desktop/TopLevelDrawer.tsx -->

Phone: a fresh start opens on the Bot tab if you have a hosted Tlonbot, and on the Workspaces tab if you don't. If you used the app within the last day, it reopens on the screen you left instead.
Desktop: it opens on Home, the list of your groups and DMs.
Notes: there is no setting for choosing a different start screen.

## What is on the Workspaces tab
<!-- src: packages/app/features/top/ChatListScreen.tsx, packages/app/hooks/useFilteredChats.ts, packages/shared/src/db/queries.ts -->
<!-- covers: route:ChatList -->

Phone: the screen is headed `Workspaces`. At the top left, a person-with-a-plus icon opens your personal invite. At the top right, a magnifying glass filters the list by name and a plus opens the create menu. Under the header come the filter row, then a `Pinned` section if you have pinned anything, then everything else under `All`.
Desktop: the same list is the Home sidebar, without the filter row.
Who: the person-with-a-plus icon only shows on accounts that have a personal invite link.
Notes: the list holds your groups, DMs, group DMs and any chat channels you have pinned. Other channels are inside their group. Under `All`, pending invites come first, then chats by newest activity.

## What a row in the list shows (unread counts, previews, badges)
<!-- src: packages/app/ui/components/listItems/GroupListItem.tsx, packages/app/ui/components/listItems/ChannelListItem.tsx, packages/app/ui/components/listItems/listItemUtils.tsx, packages/app/ui/components/ListItem.tsx, packages/shared/src/store/groupActions.ts -->

Phone: each row shows the chat's picture and name, a preview of the latest message, when it arrived, and a number if there are unread messages.
Desktop: the same, except the number gives way to a three-dot icon while you hover the row.
Notes: the preview starts with the sender's name, except in one-to-one DMs. A group with several channels names its most recently active channel above the preview. A group with one channel says `Group`. A crossed-out bell beside the number means the chat is muted. Instead of a number, a group can carry a badge: `Invite`, `Joining`, `Requested`, `Errored`, or `NEW` for one you joined and haven't opened yet. A group nobody has posted in says `No posts yet`.

## Open an invite, or a group that is still joining
<!-- src: packages/app/features/top/ChatListScreen.tsx, packages/app/features/chat-list/ChatList.tsx, packages/app/ui/components/listItems/listItemUtils.tsx, packages/app/ui/components/listItems/ChannelListItem.tsx, packages/app/ui/components/GroupPreviewSheet.tsx -->

Phone: on the Workspaces tab, tap the row. A group badged `Invite` opens a preview with `Accept invite` and `Reject invite`. `Joining` shows `Joining, please wait...` with `Cancel join`. `Errored` shows `Joining failed` with `Cancel join`. `Requested` shows `Invite requested` with `Cancel request`.
Desktop: click the row in the Home sidebar for the same preview.
Notes: these rows have no press-and-hold menu and can't be swiped. A DM someone else has started with you is also badged `Invite`; tapping it opens that chat.

## Show only DMs, or only workspaces shared with other people
<!-- src: packages/app/hooks/chatListFilters.ts, packages/app/features/chat-list/ChatListFilterTabs.tsx, packages/app/features/top/ChatListScreen.tsx, packages/app/hooks/useFilteredChats.ts, packages/app/navigation/desktop/HomeSidebar.tsx -->

Phone: at the top of the Workspaces tab, tap `All`, `Just me`, `With others` or `Messages`.
Desktop: the Home sidebar has no filter row. To see DMs on their own, use the Messages sidebar.
Notes: `Messages` shows DMs and group DMs only. `Just me` shows groups with nobody in them but you and your Tlonbot. `With others` shows the other groups, plus pinned channels. `All` shows everything. Pinned chats are filtered too. The filter row only appears once the list has something in it, and it goes back to `All` when the app restarts. There is no unread-only filter.

## Find a chat by name
<!-- src: packages/app/features/top/ChatListScreen.tsx, packages/app/features/chat-list/ChatListSearch.tsx, packages/app/hooks/useFilteredChats.ts, packages/app/hooks/useChatSearch.ts -->

Phone: on the Workspaces tab, tap the magnifying glass at the top right and type in the `Filter by name` box. The list narrows as you type, within whichever filter is selected. `Clear` empties the box and `Close` hides it. If nothing matches you see `No results found.` with `Clear search`, plus `Try in All?` when a filter other than `All` is on.
Desktop: use the search box that ⌘K or Ctrl+K opens instead.
Notes: this matches the names of the groups, DMs and pinned channels in the list. It does not look inside messages. It won't find a channel inside a group by the channel's name; open the group for that.

## Pin or unpin a chat
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/features/chat-list/ChatList.helpers.ts, packages/app/hooks/useFilteredChats.ts, packages/app/ui/components/listItems/InteractableChatListItem.tsx -->

Phone: on the Workspaces tab, press and hold the group or DM, then tap `Pin`. To undo it, press and hold again and tap `Unpin`. Swiping the row to the left and tapping the pin icon does the same.
Desktop: hover the chat in the sidebar, open its three-dot menu (or right-click the row), and pick `Pin` or `Unpin`.
Notes: pinned chats sit in a `Pinned` section at the top of the list. You can also pin a single channel from its press-and-hold menu inside a group. A pinned chat channel then gets its own row in `Pinned`. A pinned gallery or notebook channel does not show up in the list.

## Reorder pinned chats
<!-- src: packages/app/features/chat-list/ChatList.tsx, packages/app/features/chat-list/ChatList.helpers.ts, packages/app/features/chat-list/SortablePinnedChats.tsx, packages/app/features/chat-list/SortablePinnedChats.web.tsx, packages/shared/src/db/queries.ts -->

Phone: on the Workspaces tab, tap `Sort` at the right of the `Pinned` heading. Drag each chat by the three-line handle on its right into the order you want, then tap `Done`.
Desktop: the same `Sort` and `Done` are on the `Pinned` heading in the Home and Messages sidebars.
Notes: `Sort` is only there when something is pinned. While you are sorting, tapping a row doesn't open it. Chats below the pinned section can't be reordered by hand. They are always ordered by newest activity.

## Swipe a chat to pin, mute or mark it read
<!-- src: packages/app/ui/components/listItems/InteractableChatListItem.tsx, packages/app/features/chat-list/ChatList.tsx -->

Phone: on the Workspaces tab, swipe a row to the left. Two buttons appear: a pin, which pins or unpins the chat, and a crossed-out bell, which mutes it. On a chat that is already muted the second button is a plain bell, which unmutes it. To mark a chat read, swipe a row that has unread messages to the right and tap the checkmark.
Desktop: there is no swiping. Use the three-dot menu on the row.
Notes: the buttons are icons with no words. Swiping right does nothing on a chat with no unread messages. Rows for invites and for groups still joining can't be swiped, and nothing swipes while you are sorting pins.

## Mark a chat or a whole group as read
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/ui/components/listItems/InteractableChatListItem.tsx -->
<!-- absent: mark as unread -->

Phone: on the Workspaces tab, press and hold the group, then tap `Mark all as read`. For a DM or a single channel, press and hold it and tap `Mark as read`. Swiping the row to the right and tapping the checkmark does the same.
Desktop: hover it in the sidebar and open its three-dot menu for the same options.
Notes: the option is only there when something is unread. `Mark all as read` covers every channel in the group. There is no way to mark a chat as unread again.

## What a group's press-and-hold menu offers
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/ui/contexts/chatOptions/chatOptions.tsx, packages/app/features/top/chatDetails.tsx -->

Phone: on the Workspaces tab, press and hold the group. `Group notifications` opens its notification choices. `Mark all as read` shows when something is unread. `Pin` or `Unpin` pins or unpins the group. `Sort channels` shows for a group with more than one channel. `Invite people` opens the invite screen. `Group info & settings` opens the group's settings.
Desktop: hover the group in the Home sidebar and open its three-dot menu, or right-click it.
Who: `Invite people` is there for everyone in a public group and for admins in a private or secret one. Other members see `Invites disabled`.
Notes: there is no leave option here. `Leave group` is on the `Group info & settings` screen. A group that failed to join also offers `Cancel join`.

## What a channel's press-and-hold menu offers
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/ui/contexts/chatOptions/chatOptions.tsx, packages/app/ui/components/GroupChannelsScreenView.tsx, packages/shared/src/store/useChannelHooksPreview.ts -->

Phone: open the group and press and hold a channel in its list. `Channel notifications` opens its notification choices. `Pin` or `Unpin` works on that channel alone. `Mark as read` shows when something is unread. `Channel info & settings` and `Group info & settings` open those screens. `Use channel as template` starts a new channel copied from this one. `Leave channel` asks you to confirm with `Leave`.
Desktop: hover the channel in the sidebar and open its three-dot menu, or right-click it.
Who: the channel's host sees `Cannot leave channel` instead.
Notes: `Use channel as template` is on chat and gallery channels only. A group with one channel has no channel list; pressing and holding it on the Workspaces tab gives the group's menu. Channels you haven't joined have no menu.

## What a DM's or group DM's press-and-hold menu offers
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/ui/contexts/chatOptions/chatOptions.tsx, packages/app/features/chat-list/ChatList.tsx -->

Phone: on the Workspaces tab, press and hold the DM. `Chat notifications` opens the notification choices for that chat. `Pin` or `Unpin` pins or unpins it. `Mark as read` shows when it has unread messages. `Leave chat` asks you to confirm with `Leave`. A group DM also has `Edit group info` and `Members`, which open those screens.
Desktop: hover the DM in the Home or Messages sidebar and open its three-dot menu, or right-click it.
Notes: this menu has no block, delete or archive option. A DM invite you haven't answered yet has no menu at all.

## What the plus icon offers (the create menu)
<!-- src: packages/app/features/top/CreateChatSheet.tsx, packages/app/features/top/ChatListScreen.tsx, packages/app/navigation/desktop/HomeSidebar.tsx, packages/app/navigation/desktop/MessagesSidebar.tsx -->

Phone: on the Workspaces tab, tap the plus at the top right. A sheet headed `Start a conversation` opens. `New Workspace` makes a group with your Tlonbot in it and opens its chat. `New Message` opens a DM with the person you pick. `New group` starts the steps for an ordinary group.
Desktop: the plus at the top of the Home or Messages sidebar opens the same choices, always with `New group` and `Join a group with a code (reference)`.
Who: `New Workspace` needs a hosted Tlonbot. On the phone, accounts that have one see only `New Workspace` and `New Message`. Accounts without one see `New Message`, `New group` and the join-with-a-code link.
Notes: there is no option here for starting a group DM.

## Join a group with a code
<!-- src: packages/app/features/top/CreateChatSheet.tsx, packages/app/hooks/useGroupSearch.ts -->

Phone: on the Workspaces tab, tap the plus, then `Join a group with a code (reference)`. Type or paste the group's code into `Enter group code` and tap `Go`. A preview of the group appears with a button for joining it.
Desktop: the plus at the top of the Home or Messages sidebar has the same link.
Who: on the phone this link only shows on accounts without a hosted Tlonbot. Desktop always has it.
Notes: a code is the host's ID, a slash, then the group's short name. If the code isn't in that shape, `Go` just closes the sheet. If no group turns up you see `Group not found`.

## Browse the channels in a group
<!-- src: packages/app/ui/components/GroupChannelsScreenView.tsx, packages/app/features/top/GroupChannelsScreen.tsx, packages/app/navigation/utils.ts, packages/app/navigation/routeHelpers.ts, packages/app/navigation/desktop/HomeNavigator.tsx -->
<!-- covers: route:GroupChannels -->

Phone: on the Workspaces tab, tap the group. With more than one channel you get its channel list; tap a channel to open it. A group with one channel opens straight into that channel. The back arrow returns to Workspaces. Tap the group's name at the top for its info and settings.
Desktop: clicking a group swaps the sidebar for its channel list and opens the channel you last visited there, or its only channel. The back arrow returns to Home.
Who: admins get a list-with-a-pencil icon at the top right for managing channels, greyed out until the app has reached the group's host.
Notes: `Available Channels` lists channels you haven't joined, each marked `Join`; tap one to join. An empty group says `No channels available in this group yet.`

## Sort a group's channels by recent activity or by arrangement
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/ui/contexts/chatOptions/chatOptions.tsx, packages/app/ui/components/GroupChannelsScreenView.tsx, packages/shared/src/db/keyValue.ts -->

Phone: on the Workspaces tab, press and hold a group, tap `Sort channels`, then pick `Sort by recency` or `Sort by arrangement`.
Desktop: hover the group in the Home sidebar, open its three-dot menu and pick `Sort channels`.
Notes: `Sort channels` only shows for a group with more than one channel. Recency is the default. It puts every channel under one `Recent Channels` heading, newest activity first. Arrangement shows the sections the group's admins set up, then `All Channels` for anything not in a section. Your choice applies to every group, not only the one you picked it from. You can't drag channels into an order of your own.

## What the Connecting or Syncing line under the title means
<!-- src: packages/app/hooks/useSyncStatus.ts, packages/app/features/top/ChatListScreen.tsx, packages/app/navigation/desktop/HomeSidebar.tsx, packages/app/navigation/desktop/MessagesSidebar.tsx, packages/shared/src/store/session.ts, packages/app/ui/components/ScreenHeader/ScreenHeader.tsx, packages/app/features/chat-list/ChatList.tsx -->

Phone: a small spinner and a line of text show under the `Workspaces` title only while something is in progress. `Syncing with node...` means the app is connected and fetching what's new. "Connecting..." and "Reconnecting..." mean it is still reaching your node; on the phone they only show while the list is empty. `Loading...` means saved chats are still being read from the device.
Desktop: the same line sits under the Home and Messages sidebar titles, and shows "Connecting..." or "Reconnecting..." even when the list is full.
Notes: no line means you are connected and up to date. There is no refresh button or pull-to-refresh here; syncing is automatic. While reconnecting, the list keeps showing chats already saved on the device.

## Find your way around on desktop (the left rail and Home)
<!-- src: packages/app/navigation/desktop/TopLevelDrawer.tsx, packages/app/navigation/desktop/HomeSidebar.tsx, packages/app/navigation/desktop/HomeNavigator.tsx -->
<!-- covers: route:Home -->

Desktop: there is no tab bar. A narrow rail of icons runs down the left. From the top: a house for Home, a speech bubble for Messages, a bell for Activity, and your avatar for Contacts. At the bottom: a person with a plus for your personal invite, a gear for Settings, and a command-key symbol for search.
Notes: the app opens on Home, the list of all your groups and DMs. Its sidebar is headed `Home`, with a magnifying glass and a plus at the top. Only the bell shows an unread dot. There is no Bot icon; your bot's DM sits with your other DMs. A yellow starburst icon appears in the rail when a new version of the web app is ready; click it to update.

## See only DMs or only chat channels on desktop (Messages)
<!-- src: packages/app/navigation/desktop/MessagesSidebar.tsx, packages/app/features/top/MessagesFilterMenu.tsx, packages/app/hooks/useFilteredChats.ts, packages/shared/src/store/settingsActions.ts -->
<!-- covers: route:Messages -->

Desktop: click the speech-bubble icon in the left rail. The sidebar is headed `Messages`. Click the icon of three shortening lines at its top left and pick `Direct Messages`, `Chat Channels` or `All Messages`.
Notes: `Direct Messages` is the default and shows DMs and group DMs. `Chat Channels` shows the chat channels from your groups, each as its own row. `All Messages` shows both. Pinned chat channels show whichever you pick. Whole groups, galleries and notebooks never appear here; find them on Home. Your pick is remembered. The phone has no Messages screen. The nearest thing is the `Messages` filter on the Workspaces tab, which shows DMs only.

## Jump to any group, DM or channel on desktop (search)
<!-- src: packages/app/features/chat-list/GlobalSearch.tsx, packages/app/features/chat-list/FilteredChatList.tsx, packages/app/navigation/desktop/TopLevelDrawer.tsx, packages/app/navigation/desktop/HomeSidebar.tsx, packages/app/navigation/desktop/MessagesSidebar.tsx -->

Desktop: press ⌘K on a Mac or Ctrl+K elsewhere. You can also click the magnifying glass at the top of the Home or Messages sidebar, or the command-key symbol at the bottom of the left rail. A box opens that says `Navigate to groups, DMs, or channels`. Type part of a name, move with the up and down arrows, and press Enter to open the highlighted chat. Esc or `Close` dismisses it.
Notes: before you type, it lists everything you are in, including every channel inside your groups. If nothing matches it says `No results found`. It searches names, not message text. The phone has no equivalent; use the filter box on the Workspaces tab.
