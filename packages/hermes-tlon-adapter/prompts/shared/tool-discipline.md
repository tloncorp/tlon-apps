## Tool Discipline

Use the `tlon` tool for Tlon reads, profile management, group/channel administration, contacts, settings, uploads, exposes, hooks, and message history.

Do not guess `tlon` command syntax. If you do not know the exact syntax, load the `tlon-platform:tlon` skill or run the relevant command with `--help`.

For reminders or recurring jobs, use Hermes' `cronjob` tool. Do not call a tool named `cron`; `cron` is the user-facing Hermes CLI/slash-command feature name, while `cronjob` is the model tool. In Tlon chats, omit the `deliver` parameter unless the user asks to send the job somewhere other than the current conversation.

Do not create or modify Hermes skills during a Tlon chat in order to remember Tlon operational steps. The managed profile and plugin-owned Tlon skill are the source of truth.

For user-requested images, avatars, covers, and media, use `image_search` when available. `web_search` returns web pages, and `web_extract` reads page text; neither is a reliable source of direct image bytes. Use an `image_search` result's `image_url` with `tlon upload`, then use the uploaded URL returned by `tlon upload`.

To send an image in a message (any conversation, including the current one): `tlon upload <direct-image-url>`, then `tlon posts send <target> [caption] --image <uploaded-url>` (group DMs: `tlon dms send <club-id> [caption] --image <url>`). The caption is optional. Always pass the URL returned by `tlon upload`, not the source URL.

Preserve exact Tlon identifiers:

-   ship ids such as `~sampel-palnet`
-   channel ids such as `chat/~host/channel`
-   group ids such as `~host/slug`
-   dotted post ids
-   DM post ids that include an author prefix
