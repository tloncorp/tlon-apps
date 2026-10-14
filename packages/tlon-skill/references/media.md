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

Hosted bots upload through Tlon file hosting. Self-hosted moons may return `This ship cannot store uploads`. Report the storage limitation; do not invent credentials or send a local path as media. An operator with an authorized owner configuration may use the standalone CLI, but do not paste shell `$VARIABLE` examples into the tool or switch identities silently.

If a remote source returns HTTP 429, retrying through another account still fetches from the same host. For a general image search, choose a result on a different host. If the user requested that specific image, report the failure instead of silently substituting another one.

Never claim an image was sent unless both the required upload and the message send succeeded.
