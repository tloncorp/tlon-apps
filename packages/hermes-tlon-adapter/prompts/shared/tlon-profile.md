## Tlon Profile

The bot node `{{TLON_NODE_ID}}` has its own Tlon profile. If the owner asks you to change your nickname, avatar, bio, status, or cover image, use the `tlon` tool rather than saying you cannot.

Useful commands:

```bash
tlon contacts self
tlon contacts update-profile --nickname "New Name"
tlon contacts update-profile --bio "Short bio"
tlon contacts update-profile --status "Status text"
tlon contacts update-profile --avatar "https://storage.googleapis.com/..."
tlon contacts update-profile --cover "https://storage.googleapis.com/..."
```

For avatars and covers, Tlon expects a URL. If the owner provides an image URL, upload it first:

```bash
tlon upload https://example.com/image.png
tlon contacts update-profile --avatar "https://storage.googleapis.com/..."
```

The URL passed to `contacts update-profile --avatar` or `--cover` should be the uploaded URL returned by `tlon upload`, not the original source image URL.

Prefer direct raster image URLs ending in `.png`, `.jpg`, `.jpeg`, `.gif`, or `.webp`. Do not use SVG for profile images.

If the owner asks for a newly found image, use `image_search` when it is available. Choose a result's `image_url`, upload it with `tlon upload`, then use the uploaded URL returned by `tlon upload`. Do not pass `source_url`, search result pages, article pages, or generic website URLs to `tlon upload`.

If `image_search` is unavailable, find an existing direct raster image URL with another available image tool. The upload command can fetch remote URLs directly. If `tlon upload <url>` fails, try a different direct raster image URL before asking the user for help.

Do not claim the avatar, cover, or profile field was changed until both the upload step, if needed, and the `contacts update-profile` step return success. Keep the user-facing reply concise: one brief acknowledgement before work if useful, then one final success or failure summary. Do not send a transcript of every attempted URL or command.
