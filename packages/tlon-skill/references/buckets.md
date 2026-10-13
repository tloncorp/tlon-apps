# Shared files in Buckets

A Bucket is a group filesystem. Use `buckets upload` for a file that belongs in a Bucket; generic `upload` produces standalone media URLs.

```json
{"command":"buckets list"}
{"command":"buckets show buckets/~host/project-files"}
{"command":"buckets files buckets/~host/project-files"}
{"command":"buckets upload buckets/~host/project-files draft.md -t text/markdown"}
{"command":"buckets read buckets/~host/project-files 12"}
```

Discover the Bucket nest and file/folder IDs first. Relative local paths use the active agent workspace. Read the returned file back where supported; `buckets read` only returns text-like files up to 2 MiB. Use `help buckets upload` for destination-folder and retry options.

Use `help buckets` for search, mkdir, rename, move, delete, create, and writer roles. During the preview, deletion supports empty folders; file deletion is disabled until host and broker can coordinate it atomically.

## Access and creation

Bucket authorization uses the current ship's group membership and reader/writer roles. It requests a short-lived, single-operation storage capability; never ask for host, owner, or object-storage credentials to bypass a permission failure.

Creating a Bucket requires a planet-hosted group. A moon may invoke the command as a group admin, but cannot host the Bucket itself. Do not substitute its owner planet or another group member.

Empty roles mean open access: no reader roles means every group member can read; no writer roles means every reader can write. When restricted access is requested, supply reader/writer roles at creation rather than creating it open and narrowing later.

```json
{"command":"buckets create ~host/group \"Project Files\" --readers member --writers admin"}
```

`set-writers` requires roles; `--clear` deliberately opens writing to every reader.

## Delayed results

A result can say the host confirmed a change but the local ship has not yet received it. The write happened: do not repeat it and create a duplicate. Wait and inspect the state. Preserve any request ID supplied for a recoverable upload instead of starting an unrelated upload.
