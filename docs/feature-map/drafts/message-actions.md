# Message actions

## Copy only part of a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/MessageTextSelectionSheet.tsx, apps/tlon-mobile/src/components/AuthenticatedApp.tsx -->

Phone: press and hold the message and tap `Select text`. Drag the handles over the part you want and copy it. `Copy all text` at the bottom of that sheet takes the lot.
Notes: `Select text` is on the phone only, and only for messages that contain text in group chats, DMs and group DMs.

## Copy the link to a photo or file in a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/api/src/client/postContent.ts -->
<!-- covers: action:copyFileUrl -->

Phone: press and hold the message and tap `Copy link to file`. If the message holds more than one, it reads `Copy links to files` and copies them one per line.
Desktop: hover the message, open its three-dot menu and pick the same item.
Notes: this copies the web address where the uploaded image, video, voice memo or file is stored. It only appears on messages that have one, in group chats, DMs, group DMs and Galleries. It works without a connection.
