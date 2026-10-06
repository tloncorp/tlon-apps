# Desktop and web

Where things are when Tlon Messenger runs in a browser or the desktop app: the left rail and sidebars, what replaces the phone's tabs and gestures, keyboard shortcuts, logging in and out, notifications, updates, and what only the phone or only a computer can do.

## Find my way around Tlon Messenger on a computer
<!-- src: packages/app/navigation/desktop/TopLevelDrawer.tsx, packages/app/navigation/desktop/HomeNavigator.tsx, packages/app/navigation/desktop/HomeSidebar.tsx, packages/app/features/top/DesktopEmptyStates.tsx -->

Desktop: the window has three parts. A thin rail of icons runs down the far left. Beside it is a sidebar holding a list. The rest of the window is the main pane, which shows whatever you click in the sidebar. The rail chooses which list the sidebar shows, and it starts on `Home`.
Notes: there is no tab bar along the bottom. Until you pick a chat, the main pane on Home says `Start messaging!` and `Your chats will appear here.` On Messages, Activity and Settings the main pane is blank until you pick something. On Contacts it shows your own profile.

## What each icon in the left rail does
<!-- src: packages/app/navigation/desktop/TopLevelDrawer.tsx, packages/app/ui/components/NavBar/NavIcon.tsx -->

Desktop: the rail is icons only, with no labels. From the top: a house opens Home (all your groups and DMs), a speech bubble opens Messages (DMs and chat channels), a bell opens Activity, and your own avatar opens Contacts and your profile. At the bottom: a person with a plus opens your personal invite, a gear opens Settings, and a ⌘ symbol opens search.
Notes: a blue dot under the bell means there is activity you have not seen. The house and speech bubble never show a dot. In a browser, a yellow button with a starburst icon appears under your avatar when a newer version of the app is ready; click it to reload into that version.

## See all my groups and DMs on desktop (Home)
<!-- src: packages/app/navigation/desktop/HomeSidebar.tsx, packages/app/hooks/useFilteredChats.ts, packages/app/hooks/chatListFilters.ts -->

Desktop: click the house at the top of the left rail. The sidebar is headed `Home` and lists your groups, DMs and any chat channels you pinned, with pinned ones under `Pinned` and the rest under `All`. Click one to open it in the main pane. The magnifying glass at the top opens search, and the plus icon beside it opens the create menu.
Notes: this is the desktop version of the phone's Workspaces tab. It has no `Just me`, `With others` or `Messages` filter row; use the Messages view to see only DMs. With nothing in the list yet, the sidebar shows a `Welcome to Tlon` card instead.

## Show only DMs or only chat channels on desktop (Messages)
<!-- src: packages/app/navigation/desktop/MessagesSidebar.tsx, packages/app/features/top/MessagesFilterMenu.tsx, packages/app/hooks/useFilteredChats.ts -->

Desktop: click the speech bubble in the left rail. The sidebar is headed `Messages`. Click the filter icon at its top left (three lines, each shorter than the one above) and pick `Direct Messages`, `Chat Channels` or `All Messages`.
Notes: it starts on `Direct Messages`. Chat channels you pinned show under every choice. Groups, notebooks and galleries never show here; open those from Home. The magnifying glass and plus icon at the top right do the same as on Home. The phone has no Messages view.

## Open a group and switch between its channels on desktop
<!-- src: packages/app/navigation/desktop/HomeNavigator.tsx, packages/app/features/top/GroupChannelsScreen.tsx, packages/app/ui/components/GroupChannelsScreenView.tsx, packages/app/navigation/routeHelpers.ts, packages/app/navigation/utils.ts -->

Desktop: in Home, click the group. The sidebar switches from your chat list to that group's channels, with the group's name at the top. Click a channel to show it in the main pane. Click the back arrow beside the group's name to return to the Home list.
Notes: opening a group goes straight to the channel you last had open in it, or to its only channel if it has just one. Otherwise the main pane stays empty until you pick a channel.

## Check Activity on desktop
<!-- src: packages/app/navigation/desktop/ActivityNavigator.tsx, packages/app/ui/components/Activity/ActivityScreenView.tsx, packages/app/ui/components/Activity/ActivityTabs.tsx, packages/app/navigation/utils.ts -->

Desktop: click the bell in the left rail. The sidebar is headed `Activity`, with `All`, `Mentions` and `Replies` across the top. Click an item to open that chat or thread. To clear everything, open the three-dot menu at the top of the sidebar, pick `Mark all as read`, then confirm with `Mark all read`.
Notes: the chat opens in Home or Messages, whichever of the two you used last, so the sidebar changes to that list. There is no pull to refresh on a computer.

## Find my contacts and my own profile on desktop
<!-- src: packages/app/navigation/desktop/ProfileNavigator.tsx, packages/app/ui/components/ContactsScreenView.tsx, packages/app/features/top/UserProfileScreen.tsx, packages/app/ui/components/UserProfileScreenView.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/navigation/desktop/SettingsNavigator.tsx -->

Desktop: click your own avatar in the left rail. The sidebar is headed `Contacts`: you come first, marked `You`, then your contacts. Your own profile shows in the main pane; click the pencil icon at its top right to edit it. Click a contact to see their profile. The plus icon at the top of the sidebar adds contacts.
Notes: Settings on desktop has no `Your profile` or `Contacts` row, so the avatar is the way in. Suggested people sit under `Suggested from %pals and DMs` with an `Add` badge; to dismiss one, open their profile and click `Clear Suggestion`. People from your phone's address book are not listed on desktop.

## Open Settings on desktop
<!-- src: packages/app/navigation/desktop/SettingsNavigator.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Desktop: click the gear near the bottom of the left rail. The sidebar lists the settings, and the one you click opens in the main pane. Under `App` you get `Notifications`, `Appearance`, `Privacy`, `Blocked users`, `App info`, `Report a bug` and `Experimental features`.
Who: `Bot Settings` shows above that list only on a hosted account that already has a DM with its bot.
Notes: rows the phone has that desktop lacks: `Your profile` and `Contacts` (use your avatar in the rail), `Manage Tlon account`, `Tlon Messenger on the Web` and `Log out`.

## Find my bot's chat and its settings on desktop
<!-- src: packages/app/navigation/desktop/TopLevelDrawer.tsx, packages/app/navigation/desktop/SettingsNavigator.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/utils/botSettings.ts, packages/app/features/top/UserProfileScreen.tsx, packages/app/ui/components/UserProfileScreenView.tsx -->

Desktop: there is no Bot tab. Your chat with your bot is an ordinary DM: find it by the bot's name in the Home list, or in Messages. For its settings, click the gear in the left rail, then `Bot Settings`. That opens Tlon's bot settings web page, tlon.network/tlonbot, in your browser. The `Bot settings` row on the bot's own profile opens the same page.
Who: `Bot Settings` only appears on a hosted account that already has a DM with its bot.
Notes: the desktop and web app have no bot settings screens of their own; the row only opens that page. On the phone the bot's settings are on the Settings tab.

## Start a DM, make a group or join one on desktop
<!-- src: packages/app/features/top/CreateChatSheet.tsx, packages/app/navigation/desktop/HomeSidebar.tsx, packages/app/navigation/desktop/MessagesSidebar.tsx -->

Desktop: click the plus icon at the top right of the Home or Messages sidebar. A menu titled `Start a conversation` opens with `New Message` (a DM with one person) and `New group`. Under them is `Join a group with a code (reference)`.
Who: `New Workspace` is added at the top only when the app knows the account has a hosted Tlonbot.
Notes: the app learns that when you sign in to Tlon hosting, which only the phone app does. So expect `New Workspace` to be missing in a browser and in the desktop app; make a workspace with your bot in it from the phone. `New group` makes an ordinary group without the bot.

## Share my personal invite link on desktop
<!-- src: packages/app/navigation/desktop/TopLevelDrawer.tsx, packages/app/ui/components/PersonalInviteSheet.tsx, packages/app/ui/components/PersonalInviteButton.tsx -->

Desktop: click the person-with-a-plus icon near the bottom of the left rail. A sheet titled `Invite Friends to Tlon Messenger` opens with a QR code and your link. Click `Copy` to copy the link, or `Share link`.
Notes: `Share link` opens the browser's own share dialog where the browser has one; otherwise it copies the link. The icon is always there on desktop, even on an account with no personal invite link. In that case the link box stays on `Preparing invite link` and both buttons stay disabled; use a group invite instead.

## Jump to a group, DM or channel with search on desktop
<!-- src: packages/app/features/chat-list/GlobalSearch.tsx, packages/app/features/chat-list/FilteredChatList.tsx, packages/app/navigation/desktop/TopLevelDrawer.tsx, packages/app/navigation/desktop/HomeSidebar.tsx, packages/app/hooks/useChatSearch.ts -->

Desktop: press ⌘K on a Mac or Ctrl+K elsewhere. You can also click the ⌘ symbol at the bottom of the left rail, or the magnifying glass at the top of the Home or Messages sidebar. A box opens over the app; type part of a name. Move through the results with the up and down arrows, press Enter to open one, and press Esc or click `Close` to leave.
Notes: before you type, it lists your chats. It matches chat names, group names and IDs, not the text of messages. It exists only in the wide desktop layout, not on the phone or in a narrow window.

## Keyboard shortcuts on desktop
<!-- src: packages/app/features/chat-list/GlobalSearch.tsx, packages/app/ui/components/BareChatInput/index.tsx, packages/app/ui/components/ActionSheet.tsx, packages/app/ui/components/NotesChannel/NotesNativeChannel.tsx, packages/app/ui/components/ManageChannels/CreateChannelSheet.tsx -->

Desktop: ⌘K (Ctrl+K on Windows and Linux) opens or closes search from anywhere, including the message box. Esc closes search, or the menu or sheet that is open. In search, the up and down arrows move and Enter opens. In the message box, Enter sends (or saves an edit) and Shift+Enter starts a new line; while the mention or slash-command list is showing, the arrows move through it, Enter picks and Esc dismisses it. In a `Notebook` channel, ⌘⇧F (Ctrl+Shift+F) opens or closes its search, where the notebook offers search.
Notes: that is the whole list. Nothing switches chats, marks things read or opens Settings from the keyboard, and the app has no shortcut list of its own.

## Where the phone's tabs are on desktop
<!-- src: packages/app/navigation/desktop/TopLevelDrawer.tsx, packages/app/navigation/topLevelTabs.ts, packages/app/navigation/TopLevelTabNavigator.tsx, packages/app/features/top/ChatListScreen.tsx, packages/app/features/settings/SettingsScreen.tsx -->

Phone: four tabs along the bottom: Bot, Workspaces, Activity, Settings.
Desktop: no tab bar; use the rail of icons down the left side. Bot has no equivalent, so open the DM with your bot from Home. Workspaces is the house at the top of the rail (Home). Activity is the bell. Settings is the gear near the bottom. Your profile and contacts, which the phone keeps inside Settings, are behind your avatar in the rail. The person-with-a-plus invite icon, at the top left of the phone's Workspaces tab, is near the bottom of the rail.
Notes: desktop also has a Messages view (the speech bubble) that the phone does not.

## What to do instead of press and hold, swiping or pull to refresh
<!-- src: packages/app/ui/components/listItems/GroupListItem.tsx, packages/app/ui/components/listItems/ChannelListItem.tsx, packages/app/ui/components/listItems/InteractableChatListItem.tsx, packages/app/ui/components/ChatMessage/ChatMessage.tsx, packages/app/ui/components/Activity/ActivityScreenView.tsx, packages/app/features/top/MediaViewerScreen.tsx, apps/tlon-web/src/app.tsx -->

Desktop: instead of pressing and holding a chat in a list, hover it and click the three-dot button that appears, or right-click it. Instead of pressing and holding a message, hover it and click the three-dot button at its top right. Instead of swiping a chat row to mark it read, mute or pin it, use that same three-dot menu. Instead of swiping a photo away, click the X at its top right; the down arrow beside it downloads the file.
Notes: there is no pull to refresh on a computer. In a browser, reload the page and the app fetches everything from your node again.

## The layout changed when I made the window smaller
<!-- src: apps/tlon-web/src/logic/useMedia.ts, apps/tlon-web/src/app.tsx, packages/ui/src/hooks/useIsWindowNarrow.ts, packages/app/navigation/TopLevelTabNavigator.tsx, packages/app/navigation/BasePathNavigator.tsx -->

Desktop: when the window is narrower than 768 pixels, Tlon Messenger switches to the phone layout: one screen at a time, with a bar of icons along the bottom (Workspaces, Activity, Settings) in place of the left rail and sidebar. Make the window 768 pixels wide or more and the rail comes back. This happens in a browser and in the desktop app.
Notes: the narrow layout has no ⌘K search and no Messages view; steps written for the phone apply there. Switching layouts drops the back history, so Back may not work straight after resizing. Phone-only features such as the camera and logging out do not appear just because the window is narrow.

## Attach a file or photo on desktop
<!-- src: packages/app/ui/components/MessageInput/AttachmentButton.tsx, packages/app/ui/components/AttachmentSheet.tsx, packages/app/ui/components/BareChatInput/index.tsx, packages/app/ui/components/FileDrop/FileDrop.tsx, packages/app/ui/components/Channel/index.tsx -->

Desktop: click the plus button beside the message box. It opens your computer's file picker straight away, and you can pick more than one file. You can also drag files from your computer onto the open chat, or paste a copied image or video while a chat is open.
Notes: desktop skips the phone's attachment menu, so its camera options and `Voice Memo` are not offered. You can't take a photo or record a voice message from a computer.

## Things only the desktop and web app can do
<!-- src: packages/app/navigation/desktop/TopLevelDrawer.tsx, packages/app/features/chat-list/GlobalSearch.tsx, packages/app/navigation/desktop/MessagesSidebar.tsx, packages/app/ui/components/FileDrop/FileDrop.tsx, packages/app/ui/components/FileDrop/FileDrop.native.tsx, packages/app/ui/components/listItems/GroupListItem.tsx, packages/app/ui/components/listItems/ChannelListItem.tsx -->

Desktop: jumping to any chat with ⌘K or Ctrl+K. The Messages view, which lists just DMs or just chat channels. Dragging files from the computer onto a chat. Right-clicking a chat in the sidebar to get its menu. Seeing a list and a chat side by side.
Notes: none of these exist in the phone app. Notifications work differently too: the phone gets push notifications, a browser shows its own while the tab is open, and the desktop app uses the computer's system notifications.

## Things only the phone app can do
<!-- src: packages/app/ui/components/AttachmentSheet.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/navigation/desktop/SettingsNavigator.tsx, packages/app/hooks/useContactPermissions.ts, packages/app/navigation/desktop/ProfileNavigator.tsx, packages/app/ui/components/listItems/InteractableChatListItem.tsx, packages/app/features/settings/AppInfoScreen.tsx, packages/app/features/top/CreateChatSheet.tsx, packages/app/features/settings/PushNotificationSettingsScreen.tsx, packages/app/hooks/useBotDmTab.ts -->

Phone: taking a photo or video from inside the app, and recording a `Voice Memo`. Syncing your phone's contacts and inviting people from your address book. Push notifications while the app is closed. The Bot tab, and changing the bot's settings inside the app. `New Workspace`. `Manage Tlon account`. `Log out`. Swiping chats in the list. `Export DB` under `App info`.
Desktop: none of these are offered in a browser or in the desktop app.

## Turn on notifications in the browser
<!-- src: packages/app/features/settings/PushNotificationSettingsScreen.tsx, packages/app/hooks/useBrowserNotificationPermission.ts, packages/app/hooks/useBrowserNotifications.ts, apps/tlon-web/src/sw-1.ts -->

Desktop: click the gear in the left rail, then `Notifications`. Under `Browser notifications` the status reads `Not enabled`. Click `Enable` and allow them when the browser asks. The status changes to `Enabled` and the button goes away.
Notes: `Blocked in browser` means you refused before; there is no `Enable` button, and you have to allow notifications for the site in the browser's own settings. Notifications only arrive while Tlon Messenger is open in a tab and you are not looking at it; nothing arrives once the tab is closed. Clicking one opens that chat. The section only shows when the page is loaded securely (https) in a browser that supports notifications.

## Notifications in the desktop app
<!-- src: apps/tlon-desktop/src/main/notification-service.ts, packages/app/hooks/useDesktopNotifications.ts, packages/app/hooks/useBrowserNotificationPermission.ts, packages/app/features/settings/PushNotificationSettingsScreen.tsx -->

Desktop: the desktop app sends your computer's own system notifications, and there is nothing to switch on inside Tlon Messenger. They appear only while the app is running and its window is not the one in front. The app icon's badge counts them and clears when you come back to the window.
Notes: clicking a notification brings the window forward and marks that chat as read, but does not jump to the chat; open it from the sidebar. The `Browser notifications` section of Settings does not appear in the desktop app.

## Open Tlon Messenger in a browser
<!-- src: apps/tlon-web/src/app.tsx, apps/tlon-web/src/manifest.ts, apps/tlon-web/src/logic/useAppUpdates.ts, packages/app/ui/components/WebAppSplashSheet.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/features/settings/SettingsScreen.tsx -->

Phone: on a hosted account, Settings has a `Tlon Messenger on the Web` row that opens the login page, tlon.network/login.
Desktop: the web app runs from your own node, at your node's address followed by /apps/groups. Hosted: go to tlon.network/login and sign in. Self-hosted: open your node's address and sign in to the node with its access code. The web app has no login screen of its own; if you are not signed in to the node, it sends you to the node's front page to sign in there.
Notes: each time the page loads it shows "Starting up…" while it fetches your data from the node again.

## Log in to the desktop app
<!-- src: apps/tlon-web/src/components/DesktopLoginScreen.tsx, apps/tlon-desktop/src/main/index.ts, apps/tlon-web/src/app.tsx -->

Desktop: the desktop app opens on a box titled `Connect to Your Ship`. Type your node's web address in `Ship URL` and its access code in `Access Code`, then click `Connect`. `Show` reveals the code as you type.
Who: anyone who has their node's address and access code. A hosted node's address and access code work as well.
Notes: the desktop app has no email, phone number or password login. A wrong code shows an error that includes `Failed to authenticate. Is your access code correct?` The app remembers the connection, so later launches go straight in.

## Log out on desktop or in a browser
<!-- src: packages/app/ui/components/SettingsScreenView.tsx, packages/app/navigation/desktop/SettingsNavigator.tsx, apps/tlon-web/src/app.tsx, packages/app/features/DeskOutdatedScreen.tsx -->

Phone: go to the Settings tab, tap `Log out` at the bottom of the list, then `Log out now`.
Desktop: Settings has no `Log out`, in a browser or in the desktop app.
Notes: in a browser you stay signed in for as long as you are signed in to your node; Tlon Messenger itself has nothing to sign out of. The desktop app offers `Log out` only on the `Update your ship` screen, which appears when the node's software is too old for the app. So the desktop app has no everyday way to disconnect or switch to another node.

## The app says my ship needs an update
<!-- src: packages/app/features/DeskOutdatedScreen.tsx, apps/tlon-web/src/app.tsx -->

Desktop: a full-window screen headed `Update your ship`, with the line `Your ship needs an update`, means your node is running older Tlon software than this copy of the app can talk to. Click `Try again` once the node has updated. `How to update` opens instructions for people who run their own node.
Notes: on a hosted account Tlon runs the update for you, so wait a few minutes and click `Try again`; contact support if it keeps happening. Nothing else in the app can be reached from this screen. In the desktop app it also has `Log out` at the top left, which takes you back to the connect screen.

## Update the desktop app or the web app
<!-- src: apps/tlon-desktop/src/main/index.ts, apps/tlon-desktop/src/preload/preload.ts, apps/tlon-web/src/logic/useAppUpdates.ts, packages/app/navigation/desktop/TopLevelDrawer.tsx, packages/app/features/settings/AppInfoScreen.tsx -->

Desktop: the desktop app updates itself. It checks a few seconds after it starts and downloads any new version in the background. When that is done, a box titled `Update Ready` offers `Restart` or `Later`; with `Later`, the update goes in the next time you quit the app. In a browser, a yellow button with a starburst icon appears in the left rail under your avatar when a new version is ready; click it to reload into it.
Notes: there is no button to check for updates by hand, and `App info` in Settings does not show the desktop app's version number. The browser version looks for a new version every ten minutes while it is open.

## How the desktop app differs from using a browser
<!-- src: apps/tlon-desktop/src/main/index.ts, apps/tlon-desktop/src/main/notification-service.ts, apps/tlon-desktop/package.json, apps/tlon-web/src/app.tsx, apps/tlon-web/src/components/DesktopLoginScreen.tsx -->

Desktop: the desktop app is the same Tlon Messenger you get in a browser, in a window of its own, so the rail, sidebars and shortcuts are identical. What differs: you connect it with your node's address and access code instead of signing in on a web page; it stays connected between launches; it sends system notifications instead of browser ones; it updates itself; and links to other sites open in your default browser, not inside the app.
Notes: the desktop app adds no menu items of its own, and has no tray icon or system-wide shortcuts. Nothing in its menus opens Settings, logs out or checks for updates. It is built for Mac, Windows and Linux.

## Get the phone app from the browser version
<!-- src: packages/app/ui/components/MobileAppPromoBanner.tsx, packages/app/navigation/desktop/HomeSidebar.tsx -->

Desktop: at the bottom of the Home sidebar there is a card that says `Get Tlon for iOS and Android`. Click `App Store` or `Play Store` to open the phone app's store page in a new tab. Click the X at the card's top right to get rid of it.
Notes: the card shows a moment after the app loads. Once dismissed it stays gone for your account, on every computer, and no setting brings it back.

## Install Tlon Messenger from the browser as an app
<!-- src: apps/tlon-web/src/manifest.ts, apps/tlon-web/src/logic/useIsStandaloneMode.ts, apps/tlon-web/src/app.tsx, apps/tlon-web/src/sw-1.ts -->

Desktop: Tlon Messenger has no install button of its own. The web app is set up so that browsers able to install a site as an app can offer it from their own menu or address bar. Installed that way it opens in a window of its own under the name `Tlon`, and is otherwise the same as the browser version.
Notes: this is not the desktop app, which is a separate program with its own connect screen. Notifications for an installed web app follow the browser rules: only while it is open.
