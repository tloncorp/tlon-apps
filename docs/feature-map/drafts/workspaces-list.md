# Workspaces list

## Show only DMs, or only workspaces shared with other people
<!-- src: packages/app/hooks/chatListFilters.ts, packages/app/features/chat-list/ChatListFilterTabs.tsx, packages/app/features/top/ChatListScreen.tsx, packages/app/hooks/useFilteredChats.ts, packages/app/hooks/useChatListFilterSelection.ts, packages/app/navigation/desktop/HomeSidebar.tsx -->

Phone: at the top of the Workspaces tab, tap `All`, `With others`, `Messages` or `Just me` when it appears.
Desktop: the Home sidebar has no filter row. To see DMs on their own, use the Messages sidebar.
Notes: `Messages` shows DMs and group DMs. `Just me` shows groups with only you, with or without your Tlonbot; it hides when none qualify. If it disappears while selected, the list returns to `All`. `With others` includes other groups, pinned channels and groups whose members haven't loaded yet. Pinned chats are filtered too. The row needs a nonempty list. Restarting selects `All`. There is no unread-only filter.
