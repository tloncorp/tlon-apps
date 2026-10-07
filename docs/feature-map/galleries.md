# Galleries

Browsing, posting to, commenting on, editing and saving from Gallery channels.

## What does a gallery channel look like?
<!-- src: packages/api/src/types/PostCollectionConfiguration.ts, packages/app/ui/components/Channel/Scroller.tsx, packages/app/ui/components/postCollectionViews/ListPostCollectionView.tsx, packages/app/ui/components/GalleryPost/GalleryPost.tsx, packages/app/ui/components/GalleryPost/GalleryContentRenderer.tsx -->

Phone: open the gallery from its group. Posts sit in a grid of same-sized tiles, two across, newest first. Each tile has the poster's name and the date on top, a preview in the middle (a picture, video, link card, the start of a text post, or a `File upload` label), and reactions and a comment count at the bottom.
Desktop: the grid fits more columns as the window gets wider.
Notes: every tile is the same size, and pictures are cropped to fill it. A dot beside the comment count means unread comments. There is no list view, no sorting, no search button, and no way to drag posts into a different order.

## Add a photo, video or file to a gallery
<!-- src: packages/app/ui/components/draftInputs/GalleryInput.tsx, packages/app/ui/components/AddGalleryPost.tsx, packages/app/ui/components/AttachmentSheet.tsx -->

Phone: in the gallery, tap `New` at the top right, then `Media or File`. Choose `Media Library`, `Upload a File`, `Voice Memo`, or a camera option: `Capture Photo or Video` on iPhone, `Capture photo` or `Capture video` on Android. After picking one item you see a preview with an `Add a caption...` box. Type a caption if you want one, then tap `Post`.
Desktop: `New`, then `Media or File`, opens your computer's file picker.
Who: members who are allowed to post in the channel.
Notes: the caption is optional, and media posts have no separate title. A voice memo is posted when you send the recording, with no caption step.

## Add several photos or files to a gallery at once
<!-- src: packages/app/ui/components/draftInputs/GalleryInput.tsx, packages/app/ui/components/draftInputs/galleryPost.ts, packages/app/ui/components/AddGalleryPost.tsx, packages/app/ui/components/AttachmentSheet.tsx, packages/app/ui/components/Channel/index.tsx, packages/app/ui/components/FileDrop/FileDrop.tsx -->

Phone: tap `New`, then `Media or File`, then `Media Library` or `Upload a File`, and select more than one item.
Desktop: select several files in the file picker, or drag files from your computer onto the gallery.
Notes: each item becomes its own post and is sent straight away, with no caption step. A gallery post holds one picture, video or file, so there are no albums or multi-image posts. Files dragged onto the gallery on desktop are also posted immediately, even a single one. To caption a picture afterwards, edit its post.

## Add a link to a gallery
<!-- src: packages/app/ui/components/draftInputs/LinkInput.tsx, packages/app/ui/components/AddGalleryPost.tsx, packages/app/ui/components/draftInputs/GalleryInput.tsx, packages/app/ui/components/PostContent/BlockRenderer.tsx -->

Phone: tap `New`, then `Link`. Enter the address under `URL`. The app fetches a preview and fills in `Title` and `Description` if you left them empty. Change them if you like, then tap `Post`.
Notes: `Post` stays unavailable until the address is valid and the preview has finished loading. `Unable to fetch link preview` means the page couldn't be read; you can still post the link. Titles are limited to 240 characters and descriptions to 580. An address that points straight at a picture is posted as a picture. In the opened post, tapping the link card opens the page in your browser.

## Add a text post to a gallery
<!-- src: packages/app/ui/components/AddGalleryPost.tsx, packages/app/ui/components/draftInputs/GalleryInput.tsx, packages/app/ui/components/BigInput.tsx, packages/app/ui/components/GalleryPost/GalleryContentRenderer.tsx -->

Phone: tap `New`, then `Text`. Write in the full-screen editor and tap `Post` at the top right.
Notes: `Post` becomes available once you have typed something. Gallery text posts have no title field and no formatting toolbar; those belong to notebook posts. The tile in the grid shows only the start of the text, so open the post to read all of it. The back arrow leaves the editor without posting.

## Open a gallery post and comment on it
<!-- src: packages/app/ui/components/GalleryPost/GalleryPost.tsx, packages/app/ui/components/PostScreenView.tsx, packages/app/ui/components/DetailView.tsx, packages/app/ui/components/postCollectionViews/ListPostCollectionView.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx -->

Phone: tap a tile. The post opens full size with its author, time, caption, reactions and comment count, and the comments listed below. Type in the `Reply` box at the bottom to comment. Swipe left or right to move to the next or previous post.
Desktop: click a tile. There is no swiping; go back to the grid to open another post.
Who: anyone who can read the channel can open posts. Commenting needs permission to post.
Notes: a post nobody has commented on shows `No comments` and `No replies yet`. The comment box has no attach button. Pressing and holding a tile and choosing `Comment` opens the same screen.

## View a gallery picture full screen and save it
<!-- src: packages/app/ui/components/GalleryPost/GalleryPost.tsx, packages/app/features/top/MediaViewerScreen.tsx -->

Phone: open the post and tap the picture. In the full-screen viewer, tap the down-arrow button at the top to save it to your photo library, or the X to close.
Desktop: the down-arrow button downloads the picture through your browser.
Notes: tap the picture once to hide or show the buttons. The first time, the app asks for permission to save to your photos. If you refused earlier, the app offers `Open Settings` so you can allow it. Videos open in the same viewer and save the same way. The viewer has no share button.

## Share a gallery post or copy its link
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts, packages/api/src/client/postContent.ts, packages/api/src/client/references.ts, packages/app/ui/components/GalleryPost/GalleryPost.tsx -->

Phone: in the grid, press and hold the post's tile. `Forward` lets you send the post to another chat. `Copy link to post` copies a link to the post itself, as a reference rather than a web address.
Desktop: hover the tile and click the three-dot button that appears at its top right.
Notes: these options are on the tile in the grid, not on the opened post. There is no system share sheet for gallery posts.

## Copy the web address of the picture or file in a gallery post
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts -->

Phone: in the grid, press and hold the post's tile and tap `Copy link to file`.
Desktop: hover the tile, click its three-dot button and pick the same item.
Notes: it only shows when the post holds an uploaded picture, video, file or voice memo.

## Edit a gallery post
<!-- src: packages/app/ui/components/PostScreenView.tsx, packages/app/ui/components/Channel/ChannelHeader.tsx, packages/app/ui/components/draftInputs/GalleryInput.tsx, packages/app/ui/components/draftInputs/LinkInput.tsx, packages/app/ui/components/BigInput.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/shared/src/store/postActions/postActions.ts -->

Phone: open the post and tap `Edit` at the top right, or press and hold its tile in the grid and tap `Edit post`. Make the change and tap `Save`.
Desktop: hover the tile, click its three-dot button and pick `Edit post`, or open the post and click `Edit`.
Who: the person who made the post. Group admins also see `Edit` on other people's posts they open.
Notes: what you can change depends on the post. Picture: the caption only. Video, file or voice memo: the caption, in the text editor. Link: the `URL`, `Title` and `Description`. Text: the text. On the phone, `Edit` goes by the post you first opened, so if it is missing after swiping to your post, open it from the grid.

## Delete a gallery post
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/app/ui/components/GalleryPost/GalleryPost.tsx -->

Phone: in the grid, press and hold the post's tile, tap `Delete post`, then confirm.
Desktop: hover the tile, click the three-dot button at its top right, pick `Delete post`, then confirm in the prompt.
Who: the person who made the post, and group admins. For an admin deleting someone else's post the option reads "Admin: Delete post".
Notes: the confirmation warns `This action cannot be undone.` Delete is on the tile's menu only; the opened post has no delete button. The option is hidden while your node is disconnected.

## What's in the menu on a gallery post?
<!-- src: packages/api/src/types/ChannelActions.ts, packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/app/ui/components/ChatMessage/ChatMessageActions/Component.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/Component.android.tsx, packages/app/ui/components/GalleryPost/GalleryPost.tsx, packages/app/ui/components/GalleryPost/GalleryContentRenderer.tsx -->

Phone: press and hold a tile in the grid. The menu can include `Comment`, `Mute thread`, `Copy link to post`, `Forward`, `Edit post`, `Report post`, `Hide post`, `Pin post to channel` and `Delete post`. Members who can post also get a row of emoji for reacting; on Android everyone does.
Desktop: hover the tile and click its three-dot button.
Who: `Edit post` shows on your own posts and `Hide post` on other people's. Pinning is for admins; deleting is for the author and admins.
Notes: `Mute thread` shows once a post has comments. A hidden post's tile reads `You have hidden or reported this post`; choose `Show post` to bring it back. A text post's text can't be copied from this menu.

## Who can post in a gallery, and what read-only members see
<!-- src: packages/app/ui/components/Channel/index.tsx, packages/app/ui/components/Channel/ReadOnlyNotice.tsx, packages/app/ui/components/draftInputs/GalleryInput.tsx, packages/app/ui/utils/channelUtils.tsx, packages/app/ui/components/PostScreenView.tsx -->

Phone: if you can post, `New` shows at the top right of the gallery. If you can't, `New` is missing and a line at the bottom says `This channel is read-only for you.`
Who: every member of the group can post unless an admin has limited writing in that channel to certain roles. Then only members holding one of those roles can.
Notes: read-only members can still open posts, read the comments, view and save pictures, and copy links. They can't add posts or comments. An admin changes this in the channel's permissions.

## A gallery post failed to send
<!-- src: packages/app/ui/components/GalleryPost/GalleryPost.tsx -->

Phone: a post that didn't go through shows "Tap to retry" in red at the bottom right of its tile, where the comment count normally is. Tap it to send again.
Desktop: the same spot reads "Click to retry".
Notes: the same message shows when an edit or a delete failed to go through.

## What is a Bucket, and how do I turn Buckets on?
<!-- src: packages/app/lib/featureFlags.ts, packages/app/ui/components/FeatureFlagScreenView.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/features/settings/FeatureFlagScreen.tsx, packages/app/ui/components/ManageChannels/CreateChannelSheet.tsx, packages/app/ui/components/BucketsChannel/BucketsPostCollection.tsx -->
<!-- flag: buckets -->
<!-- covers: flag:buckets -->

Phone: a Bucket is a channel that holds shared files and folders instead of messages. It is experimental and off by default. To be able to make one, open the Settings tab, tap `Experimental features`, and switch on `Enable Buckets channels`.
Desktop: Settings in the left rail, then `Experimental features`.
Notes: the switch only adds `Buckets` to the channel types offered when you create a channel. It is set per device. A Bucket that already exists in a group shows in the channel list and works for members who haven't flipped the switch.

## Create a Bucket in a group
<!-- src: packages/app/ui/components/ManageChannels/CreateChannelSheet.tsx, packages/app/ui/components/ManageChannels/ManageChannelsShared.tsx, packages/shared/src/store/channelActions.ts, packages/shared/src/store/dbHooks.ts -->
<!-- flag: buckets -->

Phone: once Buckets are turned on in experimental features, start a `New channel` from the group's channel settings. In the `Create a new channel` sheet, type a title, pick `Buckets` (`Shared files for members and agents`) under `Channel type`, and tap `Create channel`.
Who: group admins only, and only in groups hosted on Tlon. Your node's backend must also be recent enough to support Buckets.
Notes: when the group's host doesn't qualify, `Buckets` is left off the list and the sheet says `Buckets are currently available only in groups hosted on Tlon.`

## Add files, photos or a folder to a Bucket
<!-- src: packages/app/ui/components/BucketsChannel/BucketsChannel.tsx, packages/app/features/buckets/BucketsLiveChannel.tsx, packages/app/ui/components/BucketsChannel/BucketsDropTarget.tsx -->
<!-- flag: buckets -->

Phone: open the Bucket and tap `New` at the top right. Choose `Upload files`, `Choose photos` or `New folder`. For a folder, type a name and tap `Create folder`. Whatever you add goes into the folder you have open.
Desktop: use the same `New` button, or drag files onto the list; it shows `Drop to upload`.
Who: members who can write in that channel. Others don't see `New`.
Notes: you can pick several files or photos at once. A bar at the bottom tracks uploads and says `You can keep browsing`. A file still uploading has `Cancel` on its row; a failed one has `Retry` and `Remove`.

## Open, preview or download a file in a Bucket
<!-- src: packages/app/ui/components/BucketsChannel/BucketsChannel.tsx, packages/app/ui/components/BucketsChannel/BucketFileViewer.tsx, packages/app/ui/components/BucketsChannel/BucketFileViewer.native.tsx, packages/app/ui/components/BucketsChannel/BucketFileViewer.shared.ts, packages/app/features/buckets/BucketsLiveChannel.tsx, packages/app/features/top/BucketFileScreen.tsx, packages/app/features/buckets/BucketsLiveFile.tsx -->
<!-- flag: buckets -->
<!-- covers: route:BucketFile -->

Phone: tap a file to open its preview on a separate screen. Pictures, videos, PDFs and text files (such as .txt, .md, .json or .csv, up to 2 MB) open inside the app. `Open` at the top right hands it to your browser or another app. To skip the preview, press and hold the file, or tap its three-dot button, then `Download`.
Desktop: the preview replaces the Bucket's list. Hover a row for its three-dot button.
Notes: on the phone, the preview's back arrow returns to the list, or to search if you opened a search result. Other types show `Preview unavailable` with `Open file`. Android PDFs show `Open PDF to view` instead.

## Browse folders in a Bucket
<!-- src: packages/app/features/buckets/BucketsLiveChannel.tsx, packages/app/features/top/BucketFolderScreen.tsx, packages/app/ui/components/BucketsChannel/BucketsChannel.tsx, packages/app/features/top/ChannelScreen.tsx, packages/app/ui/components/Channel/index.tsx -->
<!-- flag: buckets -->
<!-- covers: route:BucketFolder -->

Phone: tap a folder to open it. Its name appears at the top. Each folder opens on its own screen; the back arrow returns to the screen you opened it from, so nested folders let you go back one level at a time. At the Bucket's top level, back leaves the Bucket.
Desktop: a column on the left lists the top-level folders. Folders open in the list beside it. Inside a folder, click the Bucket's name above the list to return to the top level. A narrow window works like the phone.
Notes: if someone deletes the folder you are in, the app leaves that folder automatically.

## A Bucket upload failed or is waiting
<!-- src: packages/app/ui/components/BucketsChannel/BucketsChannel.tsx, packages/app/features/buckets/useLiveBucket.ts, packages/app/features/buckets/bucketUploadQueue.ts, packages/app/features/buckets/bucketUploadPreflight.ts, packages/app/features/buckets/bucketUploadFinish.ts -->
<!-- flag: buckets -->

Phone: `Waiting to upload` means the file is queued; up to three uploads run at once. `Cancel` stops a waiting or running upload. A failed row shows its reason with `Retry` and `Remove`. In the bottom bar, `Retry all` retries several failures and `Remove failed` dismisses them; with one failure these read `Retry` and `Remove`.
Notes: empty files, files larger than 5 GB and files whose size can't be determined fail before uploading. `Uploaded, but the host has not confirmed it yet` means the file may already be there; retry checks that upload again. Removing a failed attempt does not delete a file that was published successfully.

## Copy a link to a file in a Bucket
<!-- src: packages/app/ui/components/BucketsChannel/BucketsChannel.tsx, packages/app/features/buckets/BucketsLiveChannel.tsx, packages/app/features/buckets/bucketLinkCopy.ts -->
<!-- flag: buckets -->

Phone: press and hold the file, or tap its three-dot button, then tap `Copy link`.
Desktop: hover the file's row and click the three-dot button.
Notes: the link is temporary. A message confirms the copy and says how many minutes the link will keep working; after that, copy a fresh one. Only files have `Copy link`, not folders.

## Rename, move or delete a file or folder in a Bucket
<!-- src: packages/app/ui/components/BucketsChannel/BucketsChannel.tsx, packages/app/features/buckets/BucketsLiveChannel.tsx -->
<!-- flag: buckets -->

Phone: press and hold the row, or tap its three-dot button. The menu has rename, move and delete options, worded for a file or a folder. To rename, type the new name and tap `Rename`. To move, pick a destination from the list: the Bucket's top level or any folder, except a folder itself and the folders inside it.
Desktop: hover the row and click its three-dot button.
Who: members who can write in that channel. Read-only members only get the open, download and copy-link options.
Notes: deleting a file happens at once, with no confirmation. Deleting a folder asks first: `This folder and everything inside it will be permanently deleted for everyone. This cannot be undone.` Confirm with `Delete folder`.

## Search a Bucket
<!-- src: packages/app/ui/components/BucketsChannel/BucketsChannel.tsx, packages/app/features/buckets/BucketsLiveChannel.tsx -->
<!-- flag: buckets -->

Phone: tap the magnifying glass at the top of the Bucket and start typing. Results come from the whole Bucket, whichever folder you were in, and show their folder paths. Tap a file to preview it or a folder to open it; the back arrow returns to search.
Desktop: in a wide window, results open in place. Leaving a file preview returns to its folder's list.
Notes: the search screen explains its reach: `Search filenames, folders, and members across this Bucket.` It matches file and folder names (so files inside a matching folder show up too), file types, and the ship name of whoever last changed the item. It does not look inside files. Nothing matching shows `No results found`.

## What Buckets don't do
<!-- src: packages/app/ui/utils/channelUtils.tsx, packages/app/ui/components/ChatOptionsSheet.tsx, packages/app/features/top/chatDetails.tsx, packages/app/features/top/ChannelScreen.tsx, packages/app/ui/components/BucketsChannel/BucketsPostCollection.tsx, packages/app/features/buckets/BucketsLiveChannel.tsx -->
<!-- flag: buckets -->

Notes: a Bucket holds files only. It has no messages, comments or reactions, never shows an unread badge, and has no notification setting. The app does not offer a way to leave a Bucket or to delete the Bucket channel itself; only the files and folders inside can be deleted. Files can't be edited in place: download, change and upload again. If your node's backend is too old, opening a Bucket shows `Opening Buckets needs a newer version of the Tlon backend on your ship.`
