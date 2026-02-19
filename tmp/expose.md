# `%expose` / `%profile` History Findings

## Scope
- Repo: `tlon-apps/warsaw`
- Goal: recover prior work relevant to:
  - toggling user public profile visibility
  - managing the exposé widget on profile pages

## Key `%profile` commits

1. `c44f0c5da` (2024-01-29)  
   `profile: agent for serving public profile page`  
   Files:
   - `desk/app/profile.hoon`
   Notes:
   - Introduced `%profile` agent and public page serving.

2. `fbfb1f480` (2024-01-30)  
   `desk: auto-start profile agent`  
   Files:
   - `desk/desk.bill`
   Notes:
   - Added `%profile` to startup list.

3. `7d4fe5104` (2024-01-30)  
   `profile: minimally viable widget system`  
   Files:
   - `desk/app/profile.hoon`
   Notes:
   - Introduced widget command/action surface:
     - `[%update-widget =desk =term =widget]`
     - `[%delete-widget =desk =term]`
     - `[%put-widget =desk =term]`
     - `[%del-widget =desk =term]`

4. `e8d31866d` (2024-02-02)  
   `profile: implement "main" profile block as widget`  
   Files:
   - `desk/app/profile.hoon`
   Notes:
   - Internal profile card moved into widget layout flow.

5. `c8e0fa6e6` (2024-02-07)  
   `profile: stock widgets in separate file`  
   Files:
   - `desk/app/profile.hoon`
   - `desk/app/profile/widgets.hoon`
   Notes:
   - Refactored stock widgets into dedicated file.

6. `e3176379a` (2024-02-07)  
   `profile: add placeholder bio widget`  
   Files:
   - `desk/app/profile.hoon`
   - `desk/app/profile/widgets.hoon`
   Notes:
   - Added `%profile-bio` stock widget.

7. `b8e9686d8` (2024-03-12)  
   `profile: work around clash with realm %profile`  
   Files:
   - `desk/app/profile.hoon`
   Notes:
   - On-load migration guard for conflicting legacy `%profile` state shape.

8. `810215d9c` (2024-03-15)  
   `Merge pull request #3326 ... escape-from-the-profile-realm`  
   Notes:
   - Merge containing `b8e9686d8`.

## Key `%expose` commits

1. `338b7ba67` (2024-09-18)  
   `expose: generate public profile page widget (wip)`  
   Files:
   - `desk/app/expose.hoon`
   Notes:
   - First `%expose` -> `%profile` widget update pathway (`%update-widget` poke).

2. `fc502e902` (2024-12-16)  
   `expose: handle profile widget poke acks`  
   Files:
   - `desk/app/expose.hoon`
   Notes:
   - Added `on-agent` handling for `%profile` widget poke acknowledgements.

3. `1eef37982` (2024-12-16)  
   `expose: inject exposed refs into contact profile`  
   Files:
   - `desk/app/expose.hoon`
   Notes:
   - First contacts-profile injection format (`%expose--all` era).

4. `9d4adead5` (2025-04-10)  
   `expose: handle the poke acks from profile`  
   Files:
   - `desk/app/expose.hoon`
   Notes:
   - More general `%profile` poke-ack handling, including nacks.

5. `9b19112fc` (2025-04-23)  
   `expose: inject references into contacts profile`  
   Files:
   - `desk/app/expose.hoon`
   Notes:
   - Migrated to indexed keys (`%expose-cite-*`).

6. `b6a84179f` (2025-05-01)  
   `expose: add pins into profile as single %set entry`  
   Files:
   - `desk/app/expose.hoon`
   Notes:
   - Migrated again to single key `%expose-cites` with `%set` payload.

7. `73c7d876f` (2025-05-02)  
   `expose: prime cache for pins when we see them`  
   Files:
   - `desk/app/expose.hoon`
   Notes:
   - Reacts to peer profile pin updates and primes cache via channels watches.

8. `19d1075c2` (2025-05-07)  
   `desk: auto-start expose agent`  
   Files:
   - `desk/desk.bill`
   Notes:
   - Added `%expose` to startup list.

## Related commits (pin/share plumbing)

1. `a3f21bf57` (2025-04-28)  
   `channels: share messages if we expose'd them`  
   Files:
   - `desk/app/channels.hoon`
   Notes:
   - Uses `%expose` visibility to authorize sharing for non-readable content.

2. `7f6cf3bfb` (2025-04-23)  
   `ted: -contact-pins, for fetching pinned msg bodies`  
   Files:
   - `desk/ted/contact-pins.hoon`
   Notes:
   - Thread that reads contact profile pin refs and fetches previews.

3. `4a7c6eaa8` (2025-02-13)  
   `lanyard: contacts profile controls`  
   Files:
   - `desk/app/lanyard.hoon`
   - `desk/sur/verifier.hoon`
   Notes:
   - Added profile-display controls (`%full`/`%half`/`%none`) for lanyard entries.

## Current implementation touchpoints (head)

- `desk/app/profile.hoon`
  - widget command/action types and handlers:
    - `+$ command`, `+$ action`, `++ on-command`, `++ on-action`
- `desk/app/profile/widgets.hoon`
  - stock widgets (`%profile`, `%profile-bio`, `%join-button`)
- `desk/app/expose.hoon`
  - widget update function (`++ refresh-widget`)
  - contacts profile injection (`++ inflate-contacts-profile`)
  - `%profile` ack handling under `++ on-agent`
  - current pin key: `%expose-cites`
- `desk/app/lanyard.hoon`
  - profile-display map/state and `%profile` command handling
- `desk/sur/verifier.hoon`
  - verifier command includes `[%profile id show=?(%full %half %none)]`
- `desk/desk.bill`
  - `%profile` and `%expose` auto-start entries present

## Practical takeaway for upcoming switch work

- Reuse existing `%profile` widget command/action flow rather than introducing new widget transport.
- Treat `%expose` contacts-profile format as `%expose-cites` `%set` (latest shape), not `%expose-cite-*` or `%expose--all`.
- Preserve `%profile` poke-ack handling in `%expose` when changing widget-toggle behavior.
- If switch touches verification/profile controls, align with existing `%lanyard` `%profile` command semantics (`%full`/`%half`/`%none`).
