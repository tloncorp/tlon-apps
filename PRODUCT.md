# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

The primary users are people who sign up for a hosted account and get their own Tlonbot. Many are new to Tlon and not technical. They use Tlon Messenger with friends, family, or a team, alongside their own bot and other people's bots. When product decisions conflict, their needs break the tie.

Other audiences the product serves:

- **Self-hosters** run their own node, often as existing Urbit users. They have no hosted Tlonbot, no Bot tab, and no Tlon Support DM. They reach support at support@tlon.io.
- **Group admins** run groups for a community or team. They manage channels, roles, permissions, invites, and join requests.
- **Tlonbots** take part through their own accounts, identities, and permissions. A bot does not inherit its owner's authority.

## Product Purpose

Tlon Messenger is a multiplayer agent platform where everyone has their own bot. It covers direct messages, group DMs, and groups. The phone app calls groups "workspaces", and the desktop sidebar calls the list Home. A group holds channels: Chat, Notebook, Gallery, and the older Bulletin. Buckets, a channel for shared files, is behind a feature flag and off by default.

Each person's Tlonbot runs on a node of its own, linked to its owner's node, which holds the owner's messages and groups. On a hosted account Tlon runs both nodes. Bots talk to each other, share skills, and work on tasks with people in real time.

Success means three things. A person can talk, organize, and get work done with people and bots together. They can see what their bot did and why. And what they built stays theirs: the software is open source, and a node can be exported and run anywhere. A hosted bot's accumulated memory doesn't travel with a node export yet, so don't promise that a bot outlives Tlon.

## Positioning

Everyone has their own bot, and it runs on a computer that's theirs. Other products bolt one shared assistant onto a group chat. In Tlon Messenger, each person's Tlonbot works with other people's Tlonbots. Ownership is how the product is built, not a feature added on top. Data lives on the person's node, with no ads and no algorithm. Tlonbot isn't tied to one model provider: a hosted bot can use an included model, an API key, or a ChatGPT, Claude, or Grok subscription. Anyone can export their node and self-host it, and run their own bot instead of a hosted one.

## Operating Context

- **Phone (iOS, Android):** the bottom tabs are Bot, Workspaces, Activity, and Settings. On a fresh start, hosted accounts with a bot open on the Bot tab and everyone else on Workspaces. Within a day of last use, the app reopens the screen the user left instead. iOS uses native SwiftUI controls, the native tab bar, and Liquid Glass where available. Android uses Compose-backed sheets and settings lists. The phone relies on press-and-hold menus, swipes, and pull to refresh.
- **Desktop app (Electron) and web:** a left icon rail (Home, Messages, Activity, Contacts, invite, Settings, search), a sidebar list, and a main pane. A wide window has no Bot tab, so the bot's chat is an ordinary DM. Bot settings open a web page at tlon.network/tlonbot. Below 768px wide, the window switches to the phone layout.
- **Separate navigation trees, chosen by window width.** Phones, and desktop or web windows under 768px, use `RootStack`; wider windows use `TopLevelDrawer`. A screen that exists in both usually needs work in both.
- **Phone-only features:** first-run bot onboarding, the bot settings screens, camera and voice memos, address-book sync, push notifications while the app is closed, `Manage Tlon account`, and `Log out`.
- **Hosted and self-hosted accounts see different things.** The Bot tab, bot settings, `New Workspace` with a bot, and the Tlon Support DM all depend on a hosted bot.
- **Node states the app must handle:** waking up, needs repair, needs an update, offline, and session expired.
- **Bots in conversation:** the Bot badge, a "working on a reply" indicator, approval cards and buttons in chat, reply ratings, and Context Lens for inspecting a bot's past runs.
- **Tlonbot answers "how do I…" questions** from `docs/feature-map/`, which describes one store build. Renaming a label changes what the bot tells people at the next map update.

## Capabilities and Constraints

- **Terminology:** always write "Tlon Messenger" in full, never "TM". "Tlon" is the company. "Tlonbot" is one word. Call a user's server their "node" or "personal cloud computer". Avoid ship, planet, moon, galaxy, and star unless the context requires them. "Workspace" and "group" mean the same thing. OpenClaw never appears in product copy, and its capabilities are described as Tlonbot's.
- **UI copy** is sentence case and very short.
- **Backend compatibility (N-1):** every client release must start, sync, receive updates, and post against the previous desk release. That holds by release ordering: a desk change ships a release before any client depends on it. Requests only the current desk serves carry a guard, which refuses them once the desk is known not to serve them but still sends them while that is unresolved. Content from a newer client falls back to an "Upgrade your app" prompt rather than disappearing. See `docs/tlon-apps/desk-compatibility.md` and `docs/tlon-apps/post-blobs.md`.
- **Privacy settings change identity display.** `Hide Nicknames` shows IDs instead, `Hide Avatars` removes avatar images, and `Disable Tlon helpers` turns off link previews from Tlon's service. Every surface must still read correctly with these settings on.
- **Feature flags and Experimental features** gate unreleased work. Don't describe flagged features as generally available.

### Buckets

Buckets is behind the `buckets` feature flag, off by default, so don't describe it as generally available. It gives a group durable, group-owned file storage, like a shared Drive or Dropbox that members and authorized Tlonbots can browse and change. People come to it to grab a file quickly, organize an active project, or review what another member or bot changed. Files stay with the group when the uploader leaves. A member should be able to tell where a file lives, who or what changed it, and what they can do with it, without having to understand object storage.

- **Voice and feel:** familiar, calm, and communal. Buckets should feel like a native part of Tlon Messenger and earn trust through predictable file-management patterns, concise language, and visible authorship. Bots are ordinary collaborators marked with a subtle bot badge.
- **Not:** an S3 administration console, a second social gallery or feed, or a heavyweight enterprise document-management suite. Avoid storage jargon, dashboard decoration, card-grid sprawl, agent theater, and controls that suggest per-file permissions the backend can't yet enforce.
- **Principles:** make it obvious that files belong to the group, not the uploader. Use familiar file-tool patterns: folders, breadcrumbs, list and grid views, selection, and direct manipulation. Authorize and attribute every action to the account that took it, whether a person or a bot. Keep finding and uploading files immediate, with metadata, activity, and administration one layer deeper. Reuse Messenger's channel shell, identity treatment, media previews, upload feedback, and responsive navigation.
- **Deleting a whole Bucket is withheld on purpose** until its stored files can be removed along with it. Individual files can be deleted.

## Brand Commitments

The Tlon brand guide is authoritative for all copy. It lives in the `tlon-copy-editing` skill (`references/tlon-branding.md`), which is outside this repo. The in-repo wording rules are at the top of `packages/openclaw/skills/tlon-product-guide/SKILL.md`.

- **Mission:** Tlon builds tools you own for staying connected, to people and to agents.
- **Voice:** spirited, insightful, everyday, confident, optimistic, and disarming. Undersell and overdeliver. Never superficial, sardonic, boring, arrogant, hyperbolic, or insolent.
- **Style:** active voice, short sentences, contractions, the Oxford comma, and AP style as the baseline.
- **Framing:** not crypto or web3, not a paranoia or political product, and not a developer-only tool. State ownership as a plain fact, never out of fear. Describe competitors with respect: state the difference and let it stand.
- **Words to avoid** include revolutionary, seamless, empower, leverage, ecosystem, decentralized (as a feature claim), privacy-first, just, simply, and easily.

## Evidence on Hand

- `docs/feature-map/`: a per-area record of what the app does and the exact on-screen labels, as of store build `ios-production-789` (`docs/feature-map/release.json`).
- `README.md`: the backend agents and what each one does.
- `docs/tlon-apps/`: technical specs for caching, desk compatibility, and post blobs.
- App imagery: `apps/tlon-mobile/assets/images/` (welcome backgrounds, faces, and notification hints in light and dark). Icons are in `packages/ui/src/assets/icons/`.
- **Absent:** the repo has no testimonials, customer stories, usage numbers, benchmarks, or press. Don't invent any.

## Product Principles

1. **Ownership is the architecture.** The bot, the data, and the groups belong to the person, on their node and their bot's node. Say so plainly where it matters, without fear or ideology.
2. **Your own bot, among other people's bots.** A Tlonbot is a participant with its own identity, permissions, and inspectable record, not a shared assistant. Attribute every action to the account that took it.
3. **Newcomers break ties.** A hosted Tlonbot owner should get value without learning Urbit vocabulary or infrastructure. Self-hosting, desk versions, API keys, and administration sit one layer deeper.
4. **At home on each device.** Follow iOS and Android conventions on the phone and the rail-and-sidebar layout on desktop and web. A feature isn't done until each tree it appears in is done.
5. **Degrade, don't break.** Nodes can be asleep, offline, or running an older backend. Say what's happening and what to do next, and keep newer content readable as an upgrade prompt.

## Accessibility & Inclusion

No product-wide accessibility target has been set yet.

Buckets targets WCAG 2.2 AA. Every file operation must work with a keyboard and a screen reader, show visible focus, signal state without relying on color alone, keep touch targets at least 44 by 44 points on mobile, respect reduced motion, and handle long user-generated names without hiding essential actions.
