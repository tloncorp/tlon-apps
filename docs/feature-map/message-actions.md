# Message actions

What you can do with a message or post that has already been sent: the press-and-hold menu, reactions, threads, quoting, copying, editing, deleting, forwarding, hiding, reporting, pinning, viewing photos and videos, searching inside a chat, and getting back to the newest message.

## Open the menu for a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessage.tsx, packages/app/ui/components/ChatMessage/MessageContextMenu.ios.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/Component.tsx, packages/app/ui/components/Channel/Scroller.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/api/src/types/ChannelActions.ts -->

Phone: press and hold the message. A row of quick emoji appears, with a list of actions under it.
Desktop: hover the message and click the three-dot button that appears at its top right. Right-clicking a message does nothing special.
Notes: the list depends on the kind of channel, whether the message is yours, whether you're a group admin, and whether you can post there. When the app has lost its connection to your node, only the actions that work offline are left, such as the copy actions and `View reactions`; the rest return once it reconnects. Gallery and Bulletin posts open the same menu the same way.

## What the menu offers in a chat, a DM, a Gallery or a Bulletin
<!-- src: packages/api/src/types/ChannelActions.ts, packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/api/src/types/PostCollectionConfiguration.ts -->

Notes: these are the most each kind can show; the entries below say when each one appears. Group chat channel: `Quote`, `Reply`, `Mute thread`, `View reactions`, `Copy link to message`, `Forward`, `Copy message text`, `Edit message`, `Hide message`, `Report message`, `Pin post to channel`, `Unpin post`, `Delete message`. DM or group DM: `Quote`, `Reply`, `Mute thread`, `View reactions`, `Copy message text`, `Hide message`, `Delete message`. Gallery: `Reply`, `Comment`, `Mute thread`, `Copy link to post`, `Forward`, `Edit post`, `Report post`, `Hide post`, `Pin post to channel`, `Unpin post`, `Delete post`. Bulletin: the Gallery list without `Reply`. Notebook channels have no message menu.

## React to a message with an emoji
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/EmojiToolbar.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/quickEmojis.ts, packages/app/ui/components/ChatMessage/ChatMessageActions/Component.tsx, packages/app/ui/components/ChatMessage/MessageContextMenu.ios.tsx, packages/app/ui/components/Emoji/EmojiPickerSheet.tsx, packages/app/ui/components/ChatMessage/ReactionsDisplay.tsx, packages/shared/src/store/postActions/postActions.ts -->

Phone: press and hold the message and tap one of the four emoji in the row. For any other emoji, tap the down arrow at the end of the row, then scroll or search and tap one.
Desktop: hover the message, click its three-dot button, and use the same row at the top of the menu.
Who: people who can post in that channel.
Notes: the first three are the emoji you react with most; at first they are thumbs up, heart and a laughing face. The fourth holds your own reaction if it is not one of those, otherwise a swirl emoji. You get one reaction per message, so picking another replaces the first. Tapping a reaction someone else left adds the same one for you. An open Gallery or Bulletin post also has a square face button under it that opens the full emoji list. On Android the row also shows for people who cannot post there.

## Remove my reaction
<!-- src: packages/app/ui/components/ChatMessage/ReactionsDisplay.tsx, packages/app/ui/hooks/useOnEmojiSelect.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/EmojiToolbar.tsx -->

Phone: tap your reaction under the message; yours is the highlighted one. Or press and hold the message and tap the same emoji again in the quick row.
Desktop: click your highlighted reaction under the message.

## See who reacted to a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/app/ui/components/ChatMessage/ViewReactionsSheet.tsx, packages/app/ui/components/ChatMessage/ViewReactionsPane.tsx, packages/app/ui/components/ChatMessage/ReactionsDisplay.tsx -->
<!-- covers: action:viewReactions -->

Phone: press and hold the message and tap `View reactions`, or press and hold any reaction under it. A `Reactions` sheet lists each person with their emoji. `All` shows everyone; the emoji tabs beside it narrow the list to one reaction.
Desktop: hover the message, open its three-dot menu and pick `View reactions`. Hovering a single reaction shows up to three names in a tooltip.
Notes: `View reactions` is in the menu only once a message has a reaction, and only in chat channels, DMs and group DMs. For a Gallery or Bulletin post, open the post and press and hold a reaction on the phone.

## Reply to a message in a thread
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/app/ui/components/PostScreenView.tsx, packages/app/ui/components/ChatMessage/ChatMessageReplySummary.tsx, packages/app/ui/components/postCollectionViews/ListPostCollectionView.tsx, packages/app/ui/components/DetailView.tsx -->
<!-- covers: action:startThread, route:Post -->

Phone: press and hold the message and tap `Reply`. The thread opens on its own screen with the original message first; type in the `Reply` box at the bottom. To open an existing thread, tap the reply count under the message, such as "3 replies".
Desktop: hover the message, open its three-dot menu and pick `Reply`. The thread takes over the main pane; the back arrow returns to the chat.
Who: people who can post in that channel.
Notes: works in group chats, DMs and group DMs. Threads go one level deep: a reply inside a thread has no `Reply` of its own. A dot beside the reply count means unread replies. On Gallery and Bulletin posts the action is called `Comment`. On Android, people who cannot post there still see `Reply` or `Comment`; it opens the thread, which has no reply box for them.

## Mute or unmute a thread
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/shared/src/store/activityActions.ts -->
<!-- covers: action:muteThread -->

Phone: press and hold a message that has replies, or any reply inside the thread, and tap `Mute thread`. Tap `Unmute thread` the same way to undo it.
Desktop: hover the message, open its three-dot menu and pick `Mute thread`.
Notes: the option only appears once a message has at least one reply. In a group chat, Gallery or Bulletin thread, muting stops notifications for new replies, though mentions of you still come through; the rest of the chat is unaffected. In a DM or group DM thread the item is offered, but the app's mute setting still lets reply notifications through.

## Quote a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/app/ui/components/Channel/index.tsx -->
<!-- covers: action:quote -->

Phone: press and hold the message and tap `Quote`, then type your message and send it.
Desktop: hover the message, open its three-dot menu and pick `Quote`.
Who: people who can post in that channel.
Notes: in a group chat the original is attached to your draft and arrives as an embedded preview that links back to it. In a DM or group DM the message's text is put at the top of your message box as a quoted line starting with ">" (a message with no text is attached as a preview instead). `Quote` is offered in group chats, DMs and group DMs, including inside threads. It is not offered while you are in the middle of editing another message.

## Reply to someone's comment on a Gallery post
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts -->
<!-- covers: action:replyToComment -->

Phone: open the Gallery post, press and hold another person's comment and tap `Reply`. Their name is added as a mention at the start of the comment box; finish your comment and send it.
Desktop: hover the comment, open its three-dot menu and pick `Reply`.
Who: people who can post in that Gallery.
Notes: this is a mention, not a nested thread; your comment lands in the same list as the others. It is not offered on your own comments, and Bulletin comments do not have it.

## Copy the text of a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/api/src/types/ChannelActions.ts -->
<!-- covers: action:copyText -->

Phone: press and hold the message and tap `Copy message text`.
Desktop: hover the message, open its three-dot menu and pick `Copy message text`.
Notes: offered in group chats, DMs and group DMs, and it works without a connection. Gallery and Bulletin posts have no copy-text action.

## Copy only part of a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/MessageTextSelectionSheet.tsx, apps/tlon-mobile/src/components/AuthenticatedApp.tsx -->

Phone: press and hold the message and tap `Select text`. Drag the handles over the part you want and copy it. `Copy all text` at the bottom of that sheet takes the lot.
Notes: `Select text` is on the phone only, and only for messages that contain text in group chats, DMs and group DMs.

## Copy a link to a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/api/src/types/ChannelActions.ts, packages/api/src/client/references.ts, packages/app/ui/components/BareChatInput/index.tsx -->
<!-- covers: action:copyRef -->

Phone: press and hold the message and tap `Copy link to message`. On a Gallery or Bulletin post it reads `Copy link to post`.
Desktop: hover the message, open its three-dot menu and pick the same item.
Notes: what gets copied is an in-app reference, not a web address, so it will not open in a browser. Paste it into a message box in Tlon Messenger and it turns into an embedded preview of the original that people can tap to jump to it. Messages in DMs and group DMs have no link to copy.

## Copy the link to a photo or file in a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/api/src/client/postContent.ts -->
<!-- covers: action:copyFileUrl -->

Phone: press and hold the message and tap `Copy link to file`. If the message holds more than one, it reads `Copy links to files` and copies them one per line.
Desktop: hover the message, open its three-dot menu and pick the same item.
Notes: this copies the web address where the uploaded image, video, voice memo or file is stored. It only appears on messages that have one, in group chats, DMs, group DMs and Galleries. It works without a connection.

## Edit a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/app/ui/components/MessageInput/MessageInputBase.tsx, packages/app/ui/components/MessageInput/helpers.ts, packages/app/ui/components/BareChatInput/index.tsx, packages/app/ui/components/AuthorRow.tsx, packages/shared/src/store/postActions/postActions.ts -->
<!-- covers: action:edit -->
<!-- absent: edit history -->

Phone: press and hold your own message and tap `Edit message`. Its text loads into the message box; change it, then tap the check mark to save or the X to cancel.
Desktop: hover the message, open its three-dot menu and pick `Edit message`. Enter saves.
Who: only the person who wrote the message.
Notes: group chat channels only. Messages in DMs and group DMs cannot be edited; delete and resend instead. An edited message is marked `Edited`. The app sets no time limit, and there is no way to see earlier versions. An attached file cannot be swapped or removed by editing. Gallery and Bulletin posts use `Edit post`; in a Bulletin a group admin can also edit other people's posts.

## Delete a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/app/ui/components/PostModeration.tsx, packages/app/features/settings/ThemeScreen.tsx -->
<!-- covers: action:delete -->
<!-- absent: delete for everyone -->

Phone: press and hold the message, tap `Delete message` and confirm.
Desktop: hover the message, open its three-dot menu, pick `Delete message` and confirm.
Who: you can delete your own messages anywhere. Group admins can delete anyone's message in their group; for them the item reads "Admin: Delete message". In a DM or group DM you can only delete your own.
Notes: the confirmation warns `This action cannot be undone.` There is one kind of delete and it removes the message for everybody. Deleted messages normally vanish; if `Show deleted messages` is switched on under `Appearance` in Settings, a `Message deleted` placeholder stays in their place. In Galleries and Bulletins the item is `Delete post`.

## Forward a message to another chat
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/api/src/types/ChannelActions.ts, packages/app/ui/components/ForwardPostSheet.tsx, packages/app/ui/components/ForwardToChannelSheet.tsx, packages/app/ui/components/ForwardChannelSelector.tsx, packages/app/ui/components/useForwardToChannelSheet.tsx, packages/app/ui/utils/channelUtils.tsx, packages/shared/src/store/postActions/postActions.ts, packages/app/ui/components/ForwardGroupSheet.tsx, packages/app/features/top/ChatDetailsScreen.tsx -->
<!-- covers: action:forward -->

Phone: press and hold the message and tap `Forward`. In the `Forward to channel` sheet, tap the chat you want (`Search channels` narrows the list), then tap the button at the bottom, which reads "Forward to" and the chat's name.
Desktop: hover the message, open its three-dot menu and pick `Forward`.
Notes: you can forward from group chat channels, Galleries and Bulletins, but not from a DM or group DM. The destination can be any DM, group DM or channel in your list except Notebook channels. What arrives is a new post from you that embeds the original and links back to it; you cannot add a comment in the same step. To send a whole group this way, use `Forward reference` on the group's info screen.

## Hide a message, or show it again
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/app/ui/components/PostModeration.tsx, packages/shared/src/store/postActions/postActions.ts, packages/app/ui/components/NotebookPost/NotebookPost.tsx, packages/app/ui/components/GalleryPost/GalleryPost.tsx, packages/app/ui/components/GalleryPost/GalleryContentRenderer.tsx -->
<!-- covers: action:visibility -->

Phone: press and hold someone else's message and tap `Hide message`. It is replaced by the line `Message hidden or flagged.` To bring it back, tap `Show anyway` beside that line, then press and hold the message and tap `Show message`.
Desktop: the same items are in the message's three-dot menu.
Notes: hiding only changes what you see; everyone else still sees the message. You cannot hide your own messages. `Show anyway` alone only reveals it for the moment. Works in group chats, DMs and group DMs. Bulletin and Gallery posts have `Hide post` and `Show post`: a hidden Bulletin post reads `You have hidden or reported this post.`, while a hidden Gallery post stays in the grid with its content replaced by `You have hidden or reported this post` and no name or date strip.

## Report a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/api/src/types/ChannelActions.ts, packages/shared/src/store/postActions/postActions.ts, packages/app/ui/components/PostModeration.tsx, packages/app/ui/components/Activity/ActivitySummaryMessage.tsx, packages/app/ui/components/Activity/ActivityScreenView.tsx -->
<!-- covers: action:report -->

Phone: press and hold the message and tap `Report message`. On a Gallery or Bulletin post it reads `Report post`.
Desktop: hover the message, open its three-dot menu and pick `Report message`.
Notes: group channels only; DMs and group DMs have no report option. Reporting hides the message for you, with the line `Message hidden or flagged.`, and flags it to the group. Everyone else still sees it until its author or a group admin deletes it. Group admins other than the reporter see a line in Activity saying the reporter "flagged a post in your group"; tapping it opens the message. There is no list of reported messages and no way to withdraw a report, though you can unhide the message for yourself.

## Pin a post to the top of a channel
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/app/ui/components/Channel/PinnedPostBanner.tsx, packages/app/ui/components/Channel/index.tsx, packages/shared/src/store/channelActions.ts, packages/api/src/lib/types.ts -->
<!-- covers: action:pinPost -->

Phone: press and hold the message and tap `Pin post to channel`.
Desktop: hover the message, open its three-dot menu and pick `Pin post to channel`.
Who: group admins.
Notes: works in group chat channels, Galleries and Bulletins. DMs and group DMs cannot pin messages, and a reply inside a thread cannot be pinned. The pinned post shows as a bar under the channel's header with a pin icon, the author's name and the start of the text; tapping the bar opens the post. A channel shows one pinned post at a time, so pinning another takes its place.

## Unpin a post, or hide the pinned bar
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/app/ui/components/Channel/PinnedPostBanner.tsx, packages/app/ui/components/Channel/index.tsx, packages/shared/src/store/channelActions.ts, packages/shared/src/store/settingsActions.ts, packages/shared/src/store/postActions/postActions.ts -->
<!-- covers: action:unpinPost -->

Phone: find the pinned post in the channel, press and hold it and tap `Unpin post`. In a chat channel you can also tap the pinned bar to open the post and do it from there.
Desktop: hover the pinned post, open its three-dot menu and pick `Unpin post`.
Who: group admins can unpin. Anyone can tap the X at the right of the bar to hide it for themselves.
Notes: hiding the bar with the X does not unpin anything for other people, and the bar returns when a different post is pinned. Deleting the pinned post also unpins it. If another post was pinned earlier, unpinning brings that one back as the pinned post, so unpin it too.

## Open a photo or video full screen, zoom in, or save it
<!-- src: packages/app/features/top/MediaViewerScreen.tsx, packages/ui/src/components/GestureMediaViewer.native.tsx, packages/ui/src/components/GestureMediaViewer.tsx, packages/app/ui/components/VideoPreview.tsx, packages/app/hooks/useChannelNavigation.ts, packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx -->
<!-- covers: route:MediaViewer -->

Phone: tap the photo. Pinch to zoom, tap once to hide or show the buttons, and tap the X to close. Tap the down arrow to save it to your photo library; the first time, the phone asks for photo access. A video opens in a player with the same two buttons, without zoom.
Desktop: click the photo or video. It opens over the whole window; the down arrow downloads the file and the X closes it. There is no zoom.
Notes: the viewer shows one item at a time, so you cannot swipe to the next photo. It has no share button; to pass a photo on, save it first.

## Search for a message inside a chat
<!-- src: packages/app/ui/components/Channel/ChannelHeader.tsx, packages/app/ui/components/Channel/index.tsx, packages/app/ui/components/PostScreenView.tsx, packages/app/features/top/ChannelSearchScreen.tsx, packages/app/ui/components/ChannelSearch/SearchResults.tsx, packages/app/ui/components/ChannelSearch/SearchStatus.tsx, packages/api/src/client/channelsApi.ts, packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx -->
<!-- covers: route:ChannelSearch -->

Phone: open the chat and tap the magnifying glass at the top right. Type a word; matching messages are listed newest first. Tap one to jump to it in the chat. A result that is a reply opens its thread instead.
Desktop: the same magnifying glass is in the chat's header.
Notes: it searches the text of one chat at a time, replies included, in group chat channels, DMs and group DMs. Galleries, Bulletins and the thread screen have no search button. Keep scrolling to search further back; `Searched all channel history` means it reached the start. Nothing found shows `No results found`. There is no way to search message text across all your chats at once.

## Get back to the newest message, and what the new-messages line means
<!-- src: packages/app/ui/components/Channel/Scroller.tsx, packages/app/ui/components/Channel/ChannelDivider.tsx, packages/app/ui/components/conversationScrollChrome.tsx, packages/app/ui/components/postCollectionViews/ListPostCollectionView.tsx, packages/app/ui/components/Channel/index.tsx, packages/app/ui/components/DetailView.tsx -->
<!-- absent: mark as unread -->

Phone: when you scroll up in a chat, a round button with a down arrow appears just above the message box. Tap it to jump to the newest message.
Desktop: the same button sits at the bottom right of the messages.
Notes: a chat with unread messages opens at the first one you have not read, under a colored pill such as "3 new messages below". The chat is marked read by itself while you are looking at it. There is no button that jumps back to the unread line, and no way to mark a message or chat as unread. The button and the pill exist in chats, DMs and their threads, not in Galleries, Bulletins or their comments.

## Jump to the original of a quoted or forwarded message
<!-- src: packages/app/ui/components/Channel/index.tsx, packages/app/hooks/useChannelNavigation.ts, packages/app/ui/components/postCollectionViews/ListPostCollectionView.tsx, packages/app/ui/components/PostScreenView.tsx -->

Phone: tap the embedded message. If the original is in the chat you are looking at and already loaded, the list scrolls to it and highlights it for a few seconds. Otherwise the app opens the chat it came from at that message, or opens the thread if the original was a reply.
Desktop: click the embedded message.
Notes: an embedded Gallery or Bulletin post opens that post's own screen.

## See what my bot did to produce a message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/Channel/ContextLens/lensPost.ts, packages/app/ui/components/Channel/ContextLens/useContextLensStore.ts -->

Phone: press and hold a message from your bot and tap `View bot run`.
Desktop: hover the message, open its three-dot menu and pick `View bot run`.
Who: the bot's owner, and only on bot messages that recorded a run.
Notes: the run screen itself is described with the other bot features.

## Read a message from someone I blocked
<!-- src: packages/app/ui/components/PostModeration.tsx, packages/app/ui/components/ChatMessage/ChatMessage.tsx -->

Phone: messages from a person you have blocked are replaced by the line `Message from a blocked user.` Tap `Show anyway` beside it to read that one message.
Notes: this reveals the message for the moment only and does not unblock the person. A line reading `Message hidden or flagged.` is different: it means you hid or reported that message yourself.

## Resend a message that failed to send
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageReplySummary.tsx, packages/app/ui/components/ChatMessage/StaticChatMessage.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/shared/src/store/postActions/postActions.ts -->

Phone: a message that did not go out shows a red line under it, "Send failed, tap to retry". Tap that line to send it again.
Desktop: the line reads "Send failed, click to retry".
Notes: to discard it instead, open the message's menu and pick `Delete message`.

## Bookmark, star or save a message for later
<!-- absent: bookmark, saved messages, starred -->

Notes: Tlon Messenger has no bookmarks or saved-messages list. The closest things are copying a link to the message and pasting it somewhere you keep notes, forwarding it to a chat of your own, or, for group admins, pinning it to the top of its channel.
