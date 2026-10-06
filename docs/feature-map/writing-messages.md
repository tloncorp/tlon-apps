# Writing messages

Typing, formatting and sending messages in chats, DMs and threads: attachments, voice memos, mentions, the bot slash-command list, links, drafts, failed sends, and why the message box might be missing.

## Send a message
<!-- src: packages/app/ui/components/BareChatInput/index.tsx, packages/app/ui/components/MessageInput/MessageInputBase.tsx, packages/app/ui/components/draftInputs/ChatInput.tsx, packages/app/features/top/ChannelScreen.tsx, packages/app/ui/components/ChatMessage/ChatMessageDeliveryStatus.tsx, packages/app/ui/components/ChatMessage/StaticChatMessage.tsx, packages/shared/src/store/SessionActionQueue.ts -->
<!-- covers: route:Channel, route:ChannelRoot -->

Phone: open the chat, DM or Bot tab. Tap the box at the bottom that says `Message`, type, then tap the up-arrow button on its right.
Desktop: the box is already selected when you open a chat. Type and press Enter, or click the up arrow.
Notes: the arrow is greyed out until there is text or an attachment. Your message shows in the chat straight away, with two small arrows at its top right. They darken as it goes through and disappear once the message is confirmed. If the app has lost its connection, the message waits and goes out when it reconnects.

## Start a new line without sending
<!-- src: packages/app/ui/components/BareChatInput/index.tsx -->

Phone: the return key on the keyboard starts a new line. Only the up-arrow button sends.
Desktop: press Shift+Enter for a new line. Enter on its own sends.
Notes: on a phone the box grows to five lines and then scrolls inside itself. There is no setting to change what Enter does.

## Attach a photo, video or file
<!-- src: packages/app/ui/components/MessageInput/AttachmentButton.native.tsx, packages/app/ui/components/MessageInput/AttachmentButton.tsx, packages/app/ui/components/AttachmentSheet.tsx, packages/app/ui/components/MessageInput/AttachmentPreviewList.tsx, packages/app/ui/components/BareChatInput/index.tsx, packages/app/ui/components/PostScreenView.tsx -->

Phone: tap the plus icon to the left of the message box. Tap `Media Library` for photos and videos already on your phone, or `Upload a File` for anything else. A preview appears above your text in the message box. Add text if you like, then tap the up arrow.
Desktop: click the plus icon. It opens your computer's file picker straight away, with no menu in between.
Notes: you can pick several photos or files at once and they go out as one message. To drop one before sending, tap the small X on its preview. The reply box in a chat or DM thread has the same plus icon.

## Take a photo or video and send it
<!-- src: packages/app/ui/components/AttachmentSheet.tsx, packages/app/ui/components/MessageInput/AttachmentButton.tsx -->

Phone: tap the plus icon to the left of the message box. On an iPhone tap `Capture Photo or Video`. On Android tap `Capture photo` or `Capture video`. Take the shot and it shows as a preview in the message box. Tap the up arrow to send.
Notes: the first time, your phone asks for camera access. Desktop has no camera option; the plus icon there only opens the file picker.

## Send a voice message
<!-- src: packages/app/ui/components/AttachmentSheet.tsx, packages/app/ui/components/AudioRecorder/AudioRecorder.tsx, packages/app/ui/components/AudioRecorder/AudioRecorderSheet.tsx, packages/app/utils/filepicker.ts, packages/shared/src/store/postActions/postActions.ts, packages/shared/src/transcription.ts -->

Phone: tap the plus icon to the left of the message box, then `Voice Memo`. Recording starts as soon as the panel opens. Tap the stop button when you are done. Then tap play to listen, the up arrow to send, or the X to throw it away.
Notes: it sends straight away as its own message, without going through the message box. If the microphone is blocked you'll see `Missing microphone access`. Recording stops if you leave the app. Where the phone supports it, a transcript made on the device is sent with the audio. Desktop can't record; attach an audio file with the plus icon and it plays as audio in the chat.

## What can I attach, and how big?
<!-- src: packages/app/ui/contexts/attachmentRules.ts, packages/app/ui/contexts/attachment.tsx, packages/app/utils/filepicker.ts, packages/app/ui/components/AttachmentSheet.tsx, packages/shared/src/store/storage/storageActions.ts -->

Notes: any type of file can be attached, and several photos or files can go in one message. A video has to travel alone: add one alongside something else and you get `Video posts support one video and optional text only.` Videos must be MP4, MOV or WebM, and on a phone they must be under 150 MB. On a phone, anything the app turns down shows an `Unable to attach` alert with the reason. Photos are resized before upload so the longest side is 1200 pixels; GIFs go up unchanged. The app sets no size limit of its own on other files.

## See how much upload storage I have left
<!-- src: packages/app/ui/components/AttachmentSheet.tsx, packages/app/ui/components/StorageQuotaIndicator.tsx, packages/shared/src/store/storage/storageUtils.ts, packages/app/ui/components/MessageInput/AttachmentButton.tsx -->

Phone: tap the plus icon to the left of the message box. The top of the sheet shows how many GB you have used out of your total, with a bar underneath. Tap it to refresh.
Who: hosted accounts using Tlon's storage. A node set up with its own S3 storage shows `Attach a file` there instead, with no figures.
Notes: `No storage available` means the account has no storage allowance. `Could not fetch storage availability` means the check failed; tap it to try again. On desktop the plus icon goes straight to the file picker, so this isn't shown there.

## There is no plus icon next to the message box
<!-- src: packages/app/ui/components/MessageInput/MessageInputBase.tsx, packages/shared/src/store/dbHooks.ts, packages/shared/src/store/storage/storageUtils.ts, packages/shared/src/store/sync/sync.ts, packages/shared/src/store/storage/storageActions.ts, packages/app/ui/contexts/attachment.tsx, packages/app/ui/components/BareChatInput/index.tsx, packages/app/ui/components/FileDrop/FileDrop.tsx -->

Who: self-hosted nodes that have no file storage set up.
Notes: the plus icon only appears when your node has somewhere to upload files to. Hosted accounts always have storage from Tlon. A self-hosted node needs S3-compatible storage, with an endpoint, an access key and a secret; until then the icon is hidden. The app reads those details from your node and has no screen for entering them. On desktop, pasting or dropping in a file still attaches it, but the upload fails, so the message fails to send.

## Drag and drop or paste a file into a chat
<!-- src: packages/app/ui/components/FileDrop/FileDrop.tsx, packages/app/ui/components/FileDrop/FileDrop.native.tsx, packages/app/ui/components/Channel/index.tsx, packages/app/ui/components/PostScreenView.tsx, packages/app/ui/components/BareChatInput/index.tsx, packages/app/ui/components/BareChatInput/pastedImage.ts, packages/app/ui/components/BareChatInput/PasteableTextInput.native.tsx -->

Phone: copy an image, then paste it into the message box. It attaches as a preview. There is no drag and drop on a phone.
Desktop: drag files from your computer onto an open chat or thread and let go. They attach as previews in the message box. You can also copy an image or video and paste it while the chat is open; the message box doesn't have to be selected first.
Notes: nothing is sent until you press send. On desktop, pasting attaches one image or video at a time. On a phone only images can be pasted. Other kinds of file can't be pasted; use the plus icon or, on desktop, drag and drop.

## Upload progress, and attachments that fail
<!-- src: packages/app/ui/contexts/attachment.tsx, packages/app/ui/components/MessageInput/AttachmentPreviewList.tsx, packages/app/ui/components/FileUploadPreview.tsx, packages/shared/src/store/storage/storageUploadState.ts, packages/shared/src/store/postActions/postActions.ts, packages/app/ui/components/ChatMessage/ChatMessageReplySummary.tsx -->

Notes: uploading starts as soon as you attach something. There is no progress bar. You don't have to wait: send, and the message shows straight away, then goes out when the upload finishes. A file still on its way shows `Uploading attachment...` in the message, then becomes a `File Upload` card with its name and size. If a photo or video preview in the message box says `Attachment failed to load.`, tap its X and attach it again. If an upload fails after you have sent, or takes more than a minute, the message is marked as failed and you can retry it.

## Mention someone with @
<!-- src: packages/app/ui/components/BareChatInput/useMentions.tsx, packages/app/ui/components/MentionPopup.tsx, packages/app/ui/components/MessageInput/InputMentionPopup.tsx, packages/app/ui/components/BareChatInput/index.tsx, packages/shared/src/db/queries.ts -->

Phone: in the message box type @ and the first letters of a name or ID. A list appears above the box. Tap the person to fill in and highlight their name. Tap outside the list to close it.
Desktop: the same; arrow keys move, Enter chooses and Esc closes.
Notes: the list appears once you type at least one letter after the @, and only when the @ starts a word. Typing ~ works too. It shows up to four matches on a phone and seven on desktop. Name matches rank above ID matches; within each, people in this chat come first, then your contacts, then others your node knows. Blocked people are left out. Mentions work in group chats, DMs and threads.

## Mention everyone, or everyone with a role
<!-- src: packages/app/ui/components/BareChatInput/useMentions.tsx, packages/app/ui/components/MentionPopup.tsx, packages/app/ui/components/BareChatInput/index.tsx, packages/app/ui/components/draftInputs/ChatInput.tsx, packages/app/ui/components/PostContent/InlineRenderer.tsx -->

Phone: type @ and start spelling `All`, or the name of a role, then tap it in the list. `All` is the entry described as `All members in this channel`.
Desktop: the same; you can also choose with the arrow keys and Enter.
Notes: roles are matched from the start of their name, so "@adm" finds a role called Admin. Roles belong to groups, so a DM only offers `All`. Roles and `All` sit below people in the list, and the list is short, so keep typing if they don't show. The app offers these to anyone who can post, not just admins. Once sent, an everyone mention reads "@all".

## Get a bot's attention in a group chat
<!-- src: packages/app/ui/components/MentionPopup.tsx, packages/app/ui/components/BotBadge.tsx, packages/app/ui/components/BareChatInput/useMentions.tsx, packages/app/ui/components/Wayfinding/Notices.tsx, packages/shared/src/store/dbHooks.ts -->

Phone: type @ and the first letters of the bot's name, then tap it in the list. Bots carry a `Bot` tag there. Finish your message and send.
Desktop: the same; you can also choose with the arrow keys and Enter.
Notes: in the private chat with your own Tlonbot you don't need to mention it. The first-time hint in that chat says so, and adds: `In a group, @-mention it to bring it into the conversation.` A tag reading `Bot · Offline` means the bot is marked as offline.

## Use the slash-command list with a bot
<!-- src: packages/app/ui/components/BareChatInput/useSlashCommands.ts, packages/app/ui/components/SlashCommandPopup.tsx, packages/app/ui/components/MessageInput/InputSlashCommandPopup.tsx, packages/app/ui/components/MessageInput/MessageInputBase.tsx, packages/app/ui/components/BareChatInput/index.tsx, packages/app/ui/components/draftInputs/ChatInput.tsx, packages/shared/src/store/useBotSlashCommandManifest.ts, packages/shared/src/domain/slashCommands.ts -->

Phone: in the bot's chat, type / as the very first character of a message. A list of commands appears above the message box. Keep typing to narrow it, tap one to fill it in, add anything it needs, then send.
Desktop: the same; move with the arrow keys, choose with Enter, close with Esc.
Who: the list appears in a DM with your own bot, in a DM with any bot that has already written to you there, and in a group chat with exactly one bot of yours in it. Never in threads.
Notes: it includes `/help`, `/status`, `/new` and `/model` among others, depending on the bot. Where there is no list, a command you type is sent like any other message.

## Make text bold or italic, or add code and quotes
<!-- src: packages/api/src/client/content-helpers.ts, packages/app/ui/components/BareChatInput/index.tsx, packages/app/ui/components/MessageInput/MessageInputBase.tsx -->

Notes: the chat message box has no formatting buttons or shortcuts, on phone or desktop. You type the marks yourself and the styling shows once the message is sent. Put two asterisks on each side of words for bold, one asterisk on each side for italic, and a backtick on each side for code. Start a line with a greater-than sign and a space to make it a quote. For a block of code, put three backticks on a line of their own before and after it. Lists, headings, strikethrough, underscores and Markdown-style named links are not converted; they arrive exactly as typed.

## Send a link with a preview
<!-- src: packages/app/ui/components/BareChatInput/index.tsx, packages/app/ui/components/MessageInput/AttachmentPreviewList.tsx, packages/shared/src/store/metagrabActions.ts, packages/api/src/client/content-helpers.ts -->

Phone: type or paste a web address beginning with http:// or https:// into the message box. After a moment a preview card with the page's title and the site's domain appears above your text. Send as usual.
Notes: tap the X on the card to send the link without a preview. Deleting the address from your text removes the card too. An address that points straight at an image attaches the image instead. Addresses typed inside backticks get no preview. In the sent message the address itself is a link people can tap.

## Link to another message
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessage.tsx, packages/app/ui/components/BareChatInput/index.tsx, packages/app/ui/components/MessageInput/AttachmentPreviewList.tsx, packages/api/src/client/references.ts, packages/api/src/client/utils.ts, packages/api/src/types/ChannelActions.ts -->

Phone: in a group chat, press and hold the message you want to point to and tap `Copy link to message`. Go to any chat and paste into the message box. The pasted text turns into a preview of that message in the box. Add a comment if you like, then send.
Desktop: hover the message, open its three-dot menu and pick `Copy link to message`, then paste the same way.
Notes: the message goes out with the original shown as a card. Tap the X on the preview to drop it before sending. `Copy link to message` is not offered on messages in DMs.

## Is the text I haven't sent saved?
<!-- src: packages/app/ui/components/BareChatInput/index.tsx, packages/shared/src/store/usePostDraftCallbacks.ts, packages/shared/src/db/keyValue.ts, packages/app/features/top/ChannelScreen.tsx, packages/app/ui/components/PostScreenView.tsx -->

Notes: yes. What you type is saved as you go, separately for each chat, DM and thread. Leave and come back, and it is waiting in the message box. It clears when you send. Drafts stay on the device you typed them on, so a draft started on your phone will not appear on desktop. Only text and mentions are saved; attachments you added but did not send are not part of the draft.

## A message failed to send
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageReplySummary.tsx, packages/app/ui/components/ChatMessage/StaticChatMessage.tsx, packages/app/ui/components/ChatMessage/ChatMessage.tsx, packages/app/features/top/ChannelScreen.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/shared/src/store/postActions/postActions.ts, packages/shared/src/store/sync/sync.ts -->

Phone: the message stays in the chat with red text under it reading "Send failed, tap to retry". Tap that text to send it again. To throw it away instead, press and hold the message, tap `Delete message`, then confirm.
Desktop: the red text reads "Send failed, click to retry". To throw it away, hover the message, open its three-dot menu, pick `Delete message` and confirm.
Notes: retrying uploads any attachments again. `Delete message` only shows in the menu while the app is connected. A message that lost its connection part-way keeps its sending arrows and is checked again when the app reconnects.

## The message box is missing or I can't type
<!-- src: packages/app/ui/components/Channel/index.tsx, packages/app/ui/components/Channel/ReadOnlyNotice.tsx, packages/app/ui/utils/channelUtils.tsx, packages/app/ui/components/Channel/DmInviteOptions.tsx, packages/app/ui/components/PostScreenView.tsx -->

Who: anyone, unless admins have limited writing to certain roles.
Notes: when you can't post, a notice sits where the message box would be. `This channel is read-only for you.` means none of your roles may write here. `You no longer have permission to read this channel.` and `This group no longer exists.` mean what they say. A notice beginning "Your node's version of the Tlon app doesn't match" means the two sides run different versions; sending is off until they match. In an unanswered DM request, `Accept` and `Deny` take the box's place, with `Block` too in a one-to-one DM. A thread's reply box is likewise left out, with a similar notice for a version mismatch.

## Write a reply inside a thread
<!-- src: packages/app/ui/components/PostScreenView.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessage.tsx, packages/app/ui/components/MessageInput/MessageInputBase.tsx, packages/shared/src/store/usePostDraftCallbacks.ts -->

Phone: press and hold a message and tap `Reply` to open its thread. Type in the box at the bottom, which says `Reply`, and tap the up arrow.
Desktop: hover the message, open its three-dot menu and pick `Reply`. Type in the box and press Enter.
Notes: the reply box works like the main message box: the plus icon for attachments, @ mentions, the same formatting marks, and a saved draft for each thread. The bot slash-command list does not appear in threads.

## Share something from another app into a chat
<!-- src: apps/tlon-mobile/src/components/ShareIntentForwardSheetProvider.tsx, apps/tlon-mobile/src/lib/shareIntent.ts, packages/app/ui/components/useForwardToChannelSheet.tsx, packages/app/ui/components/ForwardToChannelSheet.tsx, packages/app/ui/components/Channel/index.tsx -->

Phone: in the other app, use its share button and choose Tlon Messenger. A sheet titled `Send to channel` opens, with `Select where to send it` under the title. Tap a chat, then tap the button at the bottom, which reads "Forward to" followed by the chat's name. That chat opens with the shared text or link in the message box, or the file attached. Check it, add anything you like, and tap the up arrow.
Notes: nothing is sent until you tap the up arrow. One file comes across per share. Bulletin, Notebook and Bucket channels are not offered as destinations. This is on phones only.

## Can I schedule a message, send a GIF, or see who is typing?
<!-- src: packages/app/ui/components/MessageInput/MessageInputBase.tsx, packages/app/ui/components/BareChatInput/index.tsx -->
<!-- absent: send later, schedule send, typing indicator, giphy, sticker -->

Notes: no. The message box has no way to send a message later, no GIF or sticker picker, and no emoji button of its own; use your keyboard's emoji. The app does not show when another person is typing.
