# Tlonbot

What a Tlonbot is and does: setup, slash commands, listening, models and billing, connected services, memory and guardrails. Part of the `tlon-product-guide` skill; read `SKILL.md` first for how to answer.

## 6. Tlonbot

### What it is

Tlonbot is a personal AI agent that lives inside Tlon Messenger. It can search the web, join your group chats, remember your conversations, and schedule tasks. Hosted accounts get one provisioned for them — no infrastructure to stand up. The app names it for you and drops you straight into its chat; you can change its name and model later in its settings, or ask it to update its name and avatar. If you self-host, no bot appears on its own: you run OpenClaw yourself and point it at your node. That's a supported path, just a hands-on one.

Your bot has its own cryptographic identity on the network, linked directly to your account. That makes it a real network participant: it can create groups, post, and respond to mentions on its own. And it means your bot's memory, personality, and conversation history belong to you the same way your messages do. You can run one yourself instead of hosted, and swap the AI model behind it whenever you like. A hosted bot is portable too. Its state is kept on your own node, in a part of it called %steward, so it goes wherever your node goes, and anyone comfortable with Urbit can read it straight out. The files in the bot's OpenClaw directory sit on Tlon's servers instead; ask Tlon and they'll send them to you. That part is a request, not a button in the app. No vendor can take the bot away or change the terms on you.

### How it's different from ChatGPT or Alexa

ChatGPT, Alexa, Siri and most assistants are services you rent. Your conversations and memory live on their servers, under their terms, tied to their model. Tlonbot is an independent home for all your data, and you control it. Your conversations, memory, notes and context live on your own node, not on an AI company's servers. And you're not tied to any model provider: use the included model, connect ChatGPT, Claude or Grok, or bring an API key, and switch whenever you like. Whichever model you use, everything you've built stays with you.

### Getting started

1. Download the iOS or Android app and sign in.  
2. Open the Bot tab, the first icon in the tab bar. On a hosted account your bot is already there, and a fresh start opens on it. Self-hosting? You run OpenClaw against your node first — there's no bot waiting, and no Bot tab.  
3. Talk to it. You command your bot by typing instructions into the DM, in plain language.  
4. Configure it from the Settings tab, where your bot's settings sit just below your profile: `Models` for the AI model it uses, `Connections` for API keys and connected services, and `Permissions` for who can message it and which channels it watches (`Per-channel rules`). On desktop, they're behind `Settings` → `Bot Settings`, which opens tlon.network/tlonbot. A change asks to restart the bot (`Apply & restart`) before it takes effect. These settings are part of hosting — if you're running your own bot they won't be there, and the same settings live in your OpenClaw configuration instead.

### First things to try

- **Name it.** Ask your bot to update its nickname.  
- **Give it a face.** Describe an avatar and ask it to find or set one.  
- **Fill out its profile.** Ask it to update its bio and status.  
- **Ask it something.** It can search the web mid-conversation — no app-switching required.  
- **Add it to a group.** Approve the other members and they can all use it — until you do, it only answers you. Or skip that and keep it as your private confidant.

### What your Tlonbot can do

1. **Connect to your other apps and services,** such as Gmail, Google Calendar, Notion and GitHub.  
2. **Run tasks with those connected services.**  
3. **Search the web.** Find information, look up recommendations.  
4. **Research.** Problem solve, strategize.  
5. **Communicate with other people and bots** — with permission.  
6. **Build knowledge.** Act as a functional FAQ, share company processes.  
7. **Run recurring jobs.** Regular summaries at specific times, news roundups, and more.  
8. **Respond to slash commands.** Change models, manage access, and more.  
9. **Read documents you send it** — PDFs, text, and CSV. On hosted bots, spreadsheets and Office documents need to be exported to CSV, text, or PDF first.
10. **Use a browser.** Hosted bots can open websites with a hosted browser. The browser connects when the bot starts, so right after a restart it can be missing for a while; say that rather than claiming it doesn't exist.

What it can't do: make images, video, music or speech. Hosted bots have those tools switched off, so don't offer them, and say so plainly when asked.

It can also catch you up on busy channels, so you never scroll back through 200 messages, and it's good for fun: games, trivia, and more.

### Recurring tasks (crons)

Tlonbots excel at recurring tasks, called crons. Set one once, then forget about it. Ask in plain language, for example:

- "Every morning at 8, send me a roundup of headlines organized by industry."  
- "Remind me every Friday at 4 to submit my timesheet."  
- "Send me the weather each day before I leave for work."

When changing or cancelling recurring work, the bot should reconcile every cron job that implements the same request, including related or duplicate declarations. It should inspect all matching jobs, update or remove every obsolete one, then list them again before claiming the old cadence or behavior is gone. If it is unclear whether two jobs belong to the same request, the bot should ask rather than silently changing an unrelated schedule.

When the bot sets a task up from chat, reminders arrive in your DM with the bot and notify you like any other message from it, unless you've muted that chat, and other recurring tasks post each run to the Updates notebook in your Tlonbot group. A task made or changed in the app's scheduled task editor posts wherever its `Posts to` says.

### Connected services (MCP)

Extend your bot by connecting outside services under `Connections` → `Connected services` in its settings — the Settings tab on a phone, `Settings` → `Bot Settings` on desktop. (Hosted accounts only; self-hosters wire MCP servers up in their own OpenClaw configuration.) That screen lists what's available. The list comes from Tlon, is the same for every hosted account, and grows as services are added. A hosted bot can look it up with `tlon_connectable_services`: answer from that list by name. If a service isn't on it, say plainly it can't be connected yet and name the closest ones that can. Never say a service is probably or maybe there. Gmail connects as "Send Gmail", which sends email from the owner's account but can't read their inbox. With services connected, crons and requests get more powerful:

- "Every morning, list today's meetings from my calendar."  
- "Track new GitHub issues on my repo and flag anything urgent."  
- "Summarize this week's meeting notes from Notion."  
- "Send this summary to my team from my Gmail."

### Tlonbot in groups

Add your bot to any group. In channels, mention it (@nickname) to trigger a response.

Other members can use it too, but not by default. A new channel starts restricted: when someone who isn't you mentions the bot, it stays quiet and sends you an approval request instead. Approve them, or open the channel to everyone, and from then on they can ask it questions, have it settle debates, run trivia. Worth saying up front — silence from an unapproved member looks like the bot is broken.

Your bot can also do group admin work from a DM: create groups, set up channels, create roles, customize permissions, invite members with specific roles, and remove members. On a hosted account, channels it sets up in a group on your node live on your node too.

That works in the groups the bot made for you: on a hosted account they live on your node with the bot as an admin, and a self-hosted bot hosts them itself. In someone else's group, adding the bot as a member isn't enough: administration is reserved for the host and for members with an admin role, so the group's owner has to give the bot one first. Without it the requests come back as errors.

Deleting a group is the exception, and an admin role doesn't buy it. Only the host can delete a group, so the bot can delete only the groups it hosts. A workspace it made on your node is yours to delete, and someone else's group has to be deleted by whoever made it.

You control who it listens to — tell it in a DM which members it may respond to or communicate with.

### Seeing what the bot did

Context Lens shows how the bot handled a message. In your bot's DM, or a group it's in, the context lens button in the header lists its recent runs. Each reply it sends you also has a `View bot run` button. A run shows the context it used, the tools it called, the model, what it wrote, and a retry button.

### Slash commands

The access and moderation commands below are owner-only, and approving a member to talk to the bot doesn't hand them those. The last few — `/model`, `/new` and the other built-ins — are a different layer: they belong to the bot's harness rather than to Tlon, and some deployments let an admin or an allowlisted member use them. So don't promise an owner that nobody else can ever reset their session; if that matters to them, it's a question about their bot's configuration.

Treat the forms below as the baseline rather than the complete list. Bots run on more than one setup, and some accept extra forms of the same command. If a user reports one that isn't here, don't tell them it doesn't exist — have them try it, or check with `/help`. What another member sees when they try one varies: sometimes an owner-only message, sometimes nothing at all, because the gateway drops unauthorized commands before the bot answers. Don't promise them an explanation — say it won't work for them.

Access and moderation. The approval commands take a **request ID**, not a nickname — run `/pending` first and use the ID it prints:

- `/pending` — view pending requests  
- `/allow <request-id>` — approve one  
- `/reject <request-id>` — deny one  
- `/ban <request-id>` — deny a pending request and block the ship behind it. Some bots also take `/ban ~ship` directly, blocking them outright whether or not a request is pending.  
- `/banned` — list blocked ships  
- `/unban ~ship-name` — unblock a ship. This takes their Urbit ID, the `~sampel-palnet` one, not the display name on their profile. `/banned` lists them in the right form.

Two things to be clear about when someone asks. Blocking is not the same as removing someone from a group — that's group admin work, which the bot can do from a DM. And `/unban` only lifts the block; it doesn't put anyone back in a group. They'll need a fresh invite or a new request.

Bot behavior:

- `/owner-listen all on|off` — the global switch for whether it responds to you without a direct mention. This is the form to use in a DM.  
- `/owner-listen on|off <channel-nest>` — same thing for one owned channel. Sent inside a channel without a nest, they apply to that channel; from a DM without a channel, they only print usage.  
- Muting makes the bot mention-only for you in that channel, including threads it has already joined; an @-mention still gets through, as do bare slash commands in chat channels and `/owner-listen` in any channel you or the bot host. Global off does the same everywhere.  
- `/owner-listen list` — show the global setting and every muted channel. Safe from a DM.  
- `/owner-listen status <channel-nest>` — the setting for one channel. Like on/off, it needs a channel; bare `status` in a DM only prints usage. `/owner-listen all` on its own gives the global answer.  
- Some bots go further here — any channel they watch rather than only ones you host, a whole group at once, or `/owner-listen default all` to make listening the default everywhere. Worth suggesting if someone wants broader coverage than the forms above give them.  
- `/model` — show or change the AI model  
- `/new` — clear context and start a fresh session  
- `/status` — show the current session status. Like `/model` and `/new`, it comes from the bot's harness, not from Tlon.  
- `/tlon version` — show which harness and plugin build is running. `/tlon-version` is an older alias that prints the same thing. Bare `/tlon` just prints usage. Note for support conversations: it reports the code, not this guide. Two bots can print identical version output and still be answering from different revisions of it.  
- `/migrate diary/~host/name` — migrate a legacy Bulletin to a Notebook (owner only). **Say what this costs before anyone runs it.** It copies the posts and little else: comments, reactions, post references, link blocks, descriptions, covers and attachments all stay behind on the archive. Every migrated note is authored by the ship that ran the command, whoever wrote the original, and dated at import time, ordered by import rather than by when things were posted. Group mentions flatten to plain text. Some permission layouts can't be carried over without turning every reader into an editor. Nothing is destroyed — the original stays put, writable, renamed with `-ARCHIVE` — but the result is a fresh notebook holding the text, not a converted channel. The command prints this too, only after it has already started. It needs the channel's full nest, starting with `diary/`; a title or short name just prints usage. It also has to run from the ship that hosts the Bulletin — your own or the bot's. A Bulletin hosted by someone else in the group can't be migrated this way; its host has to do it. And when the host is you rather than the bot, the bot needs credentials for your ship configured before it can act on your behalf — without them the command stops with a configuration error rather than migrating. That's an operator setup step, so if someone hits it, that's what to tell them.

### Models and API keys

Hosted accounts include a model for free, with $5 a month of included credits. Tlon picks that model and changes it from time to time, so take its name from your runtime context, not from this guide. The phone app lists the option as Basic followed by the model's name, such as "Basic (GPT-5.6 Luna)", and the bot settings web page as "Tlon Default". Both mean the included model. To choose another, open `Models` in the bot's settings (on desktop, start from `Settings` → `Bot Settings`):

- `Default model` is what the bot uses. Pick a provider, then a model. Only providers you've connected are listed.  
- `Fallback models` are what it switches to if the default fails.

There are two ways to connect a provider, both under `Connections`:

- **A subscription you already pay for.** `Provider subscriptions` covers ChatGPT, Claude and Grok. ChatGPT and Grok sign in with a one-time code. Claude takes a setup token instead: run `claude setup-token` in Claude Code on a computer and paste the token. Then choose one of the models that subscription includes. When someone asks what it means to "use a ChatGPT subscription for this," answer this Tlon-specific flow directly; don't substitute generic OpenClaw or OpenRouter billing advice.  
- **An API key**, under `API keys`, for Anthropic, OpenAI, OpenRouter or xAI.

A subscription and an API key for the same provider are alternatives, not the same credential. Connecting a subscription replaces a saved API key for that provider, and the app asks first. For ChatGPT the reverse holds too: saving an OpenAI API key disconnects the subscription.

**Zero data retention.** It's on by default for hosted bots on the included model. It is about what the model provider keeps: requests still go to a provider, but only to one that keeps no data. Running without it is a real choice, not a mistake to fix. The owner can turn it off with the `Zero data retention` switch under `Models`; while it's on, it may use the included credits faster. And some OpenRouter models are only offered by providers that keep data, so picking one of those means switching the model list's zero-data-retention filter off. It only covers models routed through OpenRouter: the included model and Tlon's fallbacks for it, or an OpenRouter model picked with that filter on. A connected ChatGPT, Claude or Grok subscription, or an API key for Anthropic, OpenAI or xAI, sends requests to that company under its own data policy. Fallback models the owner picks, and a different model set for one channel, are saved without it. Web searches go to the search provider and aren't covered either.

Use `/model` in chat to check or change what's running. When someone asks which model you are, or whether zero data retention is on, answer from your runtime context: it names the model for this run and says whether zero data retention is on for it. `Basic` is only the default.

Self-hosting means no included model, subscription screens, or bot settings in the app: configure the provider in your own OpenClaw setup and pay whoever you point it at. Either way there's no lock-in — everything you build with your bot stays with you.

### Guardrails

Hosted Tlonbots ship with guardrails: external integrations are limited to approved connected services, the base system prompt can't be modified (the owner can still add their own instructions to the bot's prompt files from its profile), and the bot has no shell and can only write files inside its own workspace. It can read PDFs, text files, and CSVs you send it; spreadsheets and Office documents have to be exported first. Don't read that as a privacy boundary: reaching into the filesystem is something only you can ask for, but a file posted in a channel the bot watches goes to the model like any other message, whoever sent it. If that matters, it's channel access you want to think about, not this. These limits keep hosted bots safe by default.

### Self-hosting your bot

Advanced users can boot a personal node for their bot and run OpenClaw locally. That removes the guardrails and puts every part of the agent under your control, at the cost of technical setup. On hosted accounts, Tlon runs a sidecar service alongside your node that bridges to your agent's OpenClaw instance. Moving a hosted bot to your own setup means taking your node, which already holds the bot's state, and asking Tlon for the files in the bot's OpenClaw directory.

---
