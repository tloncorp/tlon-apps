# Standalone media and message attachments

The `message` tool's Tlon `media` argument takes an HTTPS URL, not a local file path. For a local image, upload first:

```json
{"command":"upload generated-chart.png"}
```

`message` is a separate OpenClaw tool, not a Tlon subcommand: do not call `help message` through `tlon`. Use the `message` tool schema supplied by the runtime. Pass the returned uploaded URL to that tool as `media`. A public HTTPS source URL can be passed directly to `message` without re-uploading. If a new hosted copy is needed:

```json
{"command":"upload https://example.com/image.png"}
```

Use this standalone-media path for posts/profiles and attachments. For files inside a group Bucket, read [buckets.md](buckets.md).

Relative file paths use the active agent workspace. The tool cannot provide stdin, expand variables, or execute pipes. Use `help upload` for options; its stdin examples apply only to an operator's shell.

`upload` runs as the harness's default identity (see the tool description); upload as the bot whenever the bot will send the URL with `message`. Self-hosted ships may return `This ship cannot store uploads`; report it rather than switching identity or inventing credentials. Do not send a local path as media.

If a remote source returns HTTP 429, retrying through another account still fetches from the same host. For a general image search, choose a result on a different host. If the user requested that specific image, report the failure instead of silently substituting another one.

## Gallery posts and attachments with `posts send`

To post an image, file, video or link to a gallery (`heap/` channel), use `posts send` with an attachment flag. `--image`, `--file` and `--video` take an HTTPS URL: upload a local file first and pass the returned URL. `--link` takes an HTTP or HTTPS URL.

```json
{"command":"posts send heap/~host/gallery \"Caption\" --image https://storage.example.com/photo.png --title \"Photo\""}
{"command":"posts send heap/~host/gallery \"Q3 report\" --file https://storage.example.com/report.pdf"}
{"command":"posts send heap/~host/gallery --video https://storage.example.com/clip.mp4"}
{"command":"posts send heap/~host/gallery --link https://example.com --title \"Example\""}
```

- A gallery post takes at most one attachment (`--image`, `--file`, `--video`, `--link`, or a file, video or voice-memo entry in `--blob`); a text-only post is fine. To post several, send one `posts send` per attachment.
- A link post has no caption; put its text in `--title`. The link posts as a bare card with the given `--title`; page previews are not fetched.
- `posts send` to a chat channel, a DM (`posts send ~ship …`) or a group DM (`posts send 0v… …`) accepts several `--image`, `--file` and `--video` flags in one send (at most four images); `dms send` takes one `--image` and refuses a second. Images keep their flag order among themselves, as do files and videos (after any `--blob` entries); images always render before the text.
- `--quote` cannot be combined with `--image`, `--file`, `--video` or `--link`; a `--blob` is still allowed with it.
- Put the message in quotes when it contains a flag word such as `--file`; an unquoted flag word starts the options.

Never claim an image was sent unless both the required upload and the message send succeeded.
