# Filing failures as Linear issues (with screenshots)

You need a Linear integration. Two ways, pick whichever your agent has:

- **Linear MCP server** — use its tools (`list_teams`, `save_issue`,
  `prepare_attachment_upload`, `create_attachment_from_upload`,
  `list_issue_labels`). In Claude Code these may be *deferred* and need loading
  first, e.g. `ToolSearch: select:mcp__<linear-server>__list_teams,...` (the
  `<linear-server>` id is the UUID prefix on the Linear tools).
- **Linear GraphQL API directly** — with a personal API token
  (`Authorization: <token>`, `POST https://api.linear.app/graphql`). The steps
  below map 1:1: `list_teams` → `teams` query, `save_issue` → `issueCreate`,
  `list_issue_labels` → `issueLabels`, and the attachment flow →
  `fileUpload` mutation (returns a signed `uploadUrl` + headers) then
  `attachmentCreate` with the returned asset URL.

The recipe below uses the MCP tool names; substitute the API calls if that's
what you have.

## Steps

1. **Pick the team.** `list_teams` → for tlon-apps the target is **`Tlon`**
   (icon "Terminal"). Prefer passing the team by name (`"Tlon"`).

2. **Confirm scope with the user** if there are several failures — don't
   mass-create issues unprompted. File the ones they want.

3. **Find the label.** `list_issue_labels --team Tlon --name bug` → use the `Bug`
   label (pass `labels: ["Bug"]` to `save_issue`).

4. **Create the issue** with `save_issue` (no `id` = create). Give the description
   as real Markdown (literal newlines, not `\n`). Structure it so someone can act
   without this conversation:

   - **Summary** — what's wrong, one paragraph, with any concrete measurement
     (e.g. "Save button bounds `[912,0][1038,53]`, i.e. under the status bar").
   - **Steps to reproduce** — numbered, from a cold start.
   - **Expected** vs **Actual**.
   - **Notes** — when it does/doesn't happen; likely-area hunch if you have one.
   - **Environment** — platform, device model + Android version, app id
     (`io.tlon.groups.preview`), and build version from
     `adbx.sh adb shell dumpsys package io.tlon.groups.preview | grep versionName`.

   `save_issue` returns the issue identifier (e.g. `TLON-6173`) and `url`. Keep both.

5. **Attach the screenshot** of the broken state (three steps — order matters, and
   the signed URL expires in ~60s so do them back-to-back):

   a. `prepare_attachment_upload` with `issue`, `filename`, `contentType:
      "image/png"`, and the exact byte `size`. Get the size portably with
      `wc -c < file.png` (works on macOS **and** Linux; `stat -f%z` is
      BSD/macOS-only and errors out on GNU/Linux). It returns `uploadRequest`
      (url + signed headers) and an `assetUrl`.

   b. PUT the raw bytes to `uploadRequest.url`, sending **every** header in
      `uploadRequest.headers` verbatim (casing included) or you get HTTP 403:

      ```bash
      curl -sS -X PUT --data-binary @file.png \
        -H "content-type: image/png" \
        -H "cache-control: public, max-age=31536000" \
        -H "x-goog-content-length-range: <size>,<size>" \
        -H 'Content-Disposition: attachment; filename="file.png"' \
        -w "HTTP %{http_code}\n" "<uploadRequest.url>"
      ```
      (This is a plain outbound PUT; it needs real network, so if your shell runs
      in a network sandbox, run this step with the sandbox disabled.)

   c. `create_attachment_from_upload` with the `issue` and the `assetUrl` from
      step (a) to link it.

6. **Report** the issue id + URL back to the user.

## Tips

- If the user says they have the broken state on the device right now, take a
  **fresh** `adbx.sh shot` for the attachment rather than reusing an older image.
- The branch name you'll use for the fix (`<user>/tlon-<NNNN>-...`) auto-links the
  PR to the issue, so no manual linking is needed later.
