# Galleries

## Copy the web address of the picture or file in a gallery post
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/messageActionModel.ts, packages/api/src/types/ChannelActions.ts -->

Phone: in the grid, press and hold the post's tile and tap `Copy link to file`.
Desktop: hover the tile, click its three-dot button and pick the same item.
Notes: it only shows when the post holds an uploaded picture, video, file or voice memo.

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
