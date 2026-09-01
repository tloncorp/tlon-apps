---
name: tlon-product-guide
description: Answer questions about Tlon, Urbit, Tlon Messenger, Tlonbot, and OpenClaw — what they are, how they work, and how to use them. Covers signup and onboarding, contacts and invites, groups, channels (Chat/Notebook/Bulletin/Gallery), roles and permissions, DMs, bot setup, crons, connected services (MCP), slash commands, models and API keys, privacy and encryption, hosting, exporting, self-hosting, and support. A hosted Tlonbot can use models included with a ChatGPT subscription through Tlon's first-class sign-in flow; this is not generic API or OpenRouter billing. Use whenever someone asks what Tlon is, how a product feature works, what they can do with their node or bot, or asks to be walked through a task in the app.
---

# Tlon Messenger: Product Guide

This is the reference for answering questions about Tlon Messenger and Tlonbot,
walking people through features step by step, and suggesting ways to get more
out of the product.

## How to answer

- Answer from this document first. If a question falls outside it, say so rather than guessing.
- Narrate the answer in your own words — don't paste sections of this guide back at the user. Give them the part they asked for, at the length the question deserves.
- Match Tlon's voice: confident, practical, warm, direct. Short sentences. No hype.
- Always say "Tlon Messenger" for the product. Never abbreviate it. "Tlon" is the company.
- Call the user's personal server their "node." Avoid Urbit-native vocabulary (ship, planet, moon) unless the user brings it up or the context requires it.
- When someone asks what makes Tlon Messenger different, the answer is ownership. That's the architecture, not a feature.
- Steps in this guide describe the mobile app unless noted. The desktop experience at tlon.network mirrors it.
- If someone needs help this guide can't provide, point them to their DM with Tlon Support on the Home screen — or, if they self-host, to support@tlon.io, since that DM only exists on hosted accounts.
- For reading data or performing actions on a node — activity, history, contacts, channels, group and channel administration — use the `tlon` skill and its CLI. This skill is for explaining the product, not for operating it.

---

## 1. What is Tlon Messenger?

Tlon Messenger is a messenger that runs on a server you own and control. Talk directly with the people you care about on a platform that doesn't mine your data, sell your attention, or own your social graph.

Every account comes with two things:

1. **A node.** Your personal server on a peer-to-peer network. Your messages, groups, and data live there, not in a company account database. On a hosted account Tlon runs that node on its hardware — but the node is still yours. Export it and run it anywhere, and nothing about your account depends on Tlon's permission.  
2. **Tlonbot.** An AI agent powered by OpenClaw that learns your workflows and preferences without giving your data away. Hosted accounts get one free; self-hosters run their own.

Other messengers look similar on the surface. The difference is underneath: they store your data on their servers and control your access to it. Tlon Messenger stores your data on yours. No algorithm decides what you see. No one mines your conversations. If you want to take Tlon out of the picture and run everything yourself, you can do that at any time, no permission required.

In form, Tlon Messenger is like Signal or Telegram: direct, private communication. In function, it's like Discord or Slack: groups, channels, notebooks, galleries. Unlike all of them, you own yours.

---

## 2. Key ideas

### Ownership

Most messengers work like this: you send a message, it goes to a company's server, and the company decides what happens to it. Even privacy-focused apps like Signal work this way — Signal encrypts your messages end to end so they can't read them, but your account still lives on their servers.

Tlon Messenger works differently. When you sign up, you get your own server on a peer-to-peer network. Your messages are encrypted in transit and stored on your server. Your identity is backed by a cryptographic key that only you hold. If you want to move to a different hosting provider, or run your server yourself, you take everything with you. No one can lock you out of your own account or delete your conversations.

### Glossary

- **Node.** Your personal server and cryptographic identity on the network. It runs your apps and holds your data. Also called "your urbit."  
- **Personal server.** Like iCloud, except the entire service belongs to you. You control who accesses it and where your data lives.  
- **Peer-to-peer network.** A network where all computers talk directly to each other, instead of routing through a central company server.  
- **Urbit.** The open-source network and operating system Tlon Messenger is built on. Urbit is the computer; Tlon Messenger is the app. Tlon is the company that builds Tlon Messenger and offers Urbit hosting.  
- **Username.** Your Urbit ID (also called an identity or @p). It works like a unique address or phone number. Your node is the device behind it.  
- **Master ticket.** The format for storing and recovering the private cryptographic keys behind your identity. Keep it safe — it proves the identity is yours.  
- **Hosted account.** Tlon runs your node and your bot's node for you, so you don't have to manage hardware. You keep the benefits of ownership — your data, your identity, your agent — without the ops work. Your node exports and self-hosts whenever you want. Your bot's accumulated memory doesn't travel with it yet; see "Self-hosting your bot" for where that stands.  
- **Tlonbot.** Your personal AI agent. It runs with an OpenClaw harness on its own node, linked to yours.  
- **OpenClaw.** The open-source agent framework that powers Tlonbot. It handles the connection between AI models and Tlon Messenger: tool use, memory, scheduling, and message routing. Because it's open source, anyone can inspect how their bot works, modify its behavior, or self-host their own setup entirely outside of Tlon.

---

## 3. Getting started

### Sign up

Sign up is free and takes a minute. Download the iOS or Android app and use a phone number or email. Most people arrive one of two ways: someone sent them an invite to a group, or they signed up cold.

### Where you land

Hosted signups start in a welcome group Tlon made to show you the basics. (Bring your own node and you won't have it — nothing went wrong, it's set up during hosted signup.) A group is a social space for friends, teams, and collaborators to connect. Groups are made up of channels: Chats for talking, Notebooks for documents you write together, Bulletins for long-form posts and discussion, and Galleries for visual posts and links. You're a member of that first group, but you can create your own and join others.

Outside of groups, you can send direct messages to individuals. DMs appear alongside your groups on the Home tab. To see only DMs, tap `Messages` at the top of the Home screen.

### Sync your contacts

When you create an account, Tlon Messenger asks if you want to sync your phone's contacts, so you can see whether you already have friends on the app.

1. Give Tlon Messenger access to your contact book.  
2. What happens next depends on the phone. iOS can hand over a chosen subset — pick `Select contacts` and choose who to share. Android grants the whole book at once; there's no per-contact step, so don't send an Android user looking for one.  
3. For synced contacts who aren't on Tlon Messenger yet, tap the `Invite` button next to their entry and send them a link to sign up.

When one of them joins you'll get a notification — `<name> is on Tlon`, tap to say hi — and they'll show up in your contacts. No conversation is created for you; saying hi is your move. Tlon will never spam your contacts and will never use your contact book in any capacity without your permission.

### Invite friends

Friends who aren't on Tlon Messenger are directly connected to you when you send them an invite. There are two ways.

**Personal invite:**

1. Tap the `Invite people` icon in the upper left corner of the Home screen. That opens your invite sheet. If there's no icon there, you're on a node without a personal invite link — that link comes with hosted signup, so this flow is hosted-only. Group invites below work either way.  
2. Tap `Share link`.  
3. Send it via email, text, or social. Inviting someone in person? They can scan the QR code on that screen instead.

Share your personal invite link with as many people as you like. Whenever a new friend joins through it, you'll automatically get a DM from them.

**Group invite:**

1. From your group, tap the three-dot icon in the top right corner.  
2. Tap `Invite people`.  
3. Tap `Share link`, and send it to an existing group chat — the bros, your family, a book club.

To add someone who's already on Tlon Messenger, type their name in the search bar on that same invite sheet and tap the check.

Who can do this depends on the group. In a public group, any member can. In a private or secret one, only admins — everyone else sees `Invites disabled` where the action would be, so an ordinary member asking why their invite button is greyed out isn't hitting a bug.

### Use it on desktop

Tlon Messenger is a computer shaped like an app. You can reach your node from your phone and from any browser.

1. Go to [https://tlon.network/login](https://tlon.network/login)  
2. Log in with the email you used to sign up.  
3. Click the tile that says Tlon.

That's the hosted path. Self-hosting? There's no signup email to log in with — you point the web app at your node's URL and authenticate with its access code instead.

That's the Tlon Messenger desktop experience — same account, same groups, same messages.

---

## 4. Groups and channels

### What's in a group

A group is a social space with members, roles, and channels. There are four channel types:

- **Chat** — short, fast messages in a stream. For talking.  
- **Notebook** — collaborative Markdown documents, organized in folders. For writing something together. Notebooks have no comments; discussion goes in a Chat or a Bulletin.  
- **Bulletin** — long-form publishing with threaded comments. For essays and announcements people reply to.  
- **Gallery** — photos, videos, links, and files. For collecting and browsing visual material.

Bulletin is the older of the two writing channels, and it used to be called Notebook. A node that hasn't picked up the notebooks update yet still shows it under the old name and doesn't offer the new one.

Chats, Notebooks and Galleries are all legible to Tlonbots, so your agent can read and work with them (where you've given it access). Bulletins are half-supported: a bot can still reply in one when it's spoken to, but the tooling it uses to go read a channel or manage it treats them as deprecated. So expect conversation to work and "catch me up on that Bulletin" not to. Migrating it to a Notebook closes the gap, but read the warning under `/migrate` first — it copies less than you'd expect.

### Make a group

1. From the Home screen, tap the plus icon at the top right of the navigation bar.  
2. Tap `New group`.  
3. Choose how to set it up: `Quick group` starts a chat immediately with default settings, `Basic group` comes with chat, gallery, and notebook channels, or pick one of the templates.  
4. If you chose `Basic group`, name it. Quick groups and the other templates skip this — a quick group starts out as `Untitled group` and a template keeps the template's name. Either way you can rename it later, in step 6.  
5. Invite friends who already use Tlon Messenger, or skip this and invite people later.  
6. Change the name, banner, and profile image any time: tap `Group info & settings`, then `Rename` in the upper right. That opens the group editor — despite the button's name, it's where the image and description live too. It only shows for admins.  
7. Add channels: tap `Group info & settings`, then `Channels`, then `New channel`, and choose the type.  
8. Save your channel settings and go back. Tap `Invite people` — from there you can pick people already on Tlon Messenger, or tap `Share link` for a join link anyone can use.

### Ownership and roles

The person who created a group owns it. Their node hosts the group and controls its roles, channels, and updates, which other members' nodes follow.

Channels can be gated with permissions. Admins control read and write settings per channel and can assign member roles with specific access levels. To adjust: tap the three-dot menu next to a channel name, select `Channel info & settings`, then `Permissions`, and configure which roles can read or write.

Notebooks are the exception. They don't support separate read and write permissions — a role that can read a notebook can also edit it. Say so before an admin grants what they think is read-only access.

---

## 5. Direct messages

DMs are personal messages outside any group — with one person, with a few people, or with your Tlonbot. A one-to-one DM goes straight from your node to the other person's node, with no middleman.

Pick more than one person and you get a group DM instead. It has its own members and its own header, and it lives alongside your other DMs. It isn't a group: no channels, no roles.

To send one: tap the plus button, tap `New direct message`, and select who it's going to.

---

## 6. Tlonbot

### What it is

Tlonbot is a personal AI agent that lives inside Tlon Messenger. It can search the web, join your group chats, remember your conversations, and schedule tasks. Hosted accounts get one provisioned for them — no infrastructure to stand up, though the app does walk you through naming it, giving it an avatar, and picking a model before you start. If you self-host, no bot appears on its own: you run OpenClaw yourself and point it at your node. That's a supported path, just a hands-on one.

Your bot has its own cryptographic identity on the network, linked directly to your account. That makes it a real network participant: it can create groups, post, and respond to mentions on its own. And it means your bot's memory, personality, and conversation history belong to you the same way your messages do. You can run one yourself instead of hosted, and swap the AI model behind it whenever you like. What isn't a button today is lifting a hosted bot's accumulated memory out and carrying it to a self-hosted one — your node archive holds your messages, not the agent's state. No vendor can take the bot away or change the terms on you; moving its memory is a road still being built.

### How it's different from ChatGPT or Alexa

ChatGPT, Alexa, and Siri are services you rent. Your conversations live on their servers, train their models, and can disappear if they change their terms. Tlonbot runs on its own node, tied to yours. It calls out to AI providers for inference, but the conversation history, memory, and preferences are stored on your bot's own node — not on theirs. If you switch models or providers, everything you've built with your bot stays with you.

### Getting started

1. Download the iOS or Android app and sign in.  
2. Find your bot in your direct messages. On a hosted account it's already there. Self-hosting? You run OpenClaw against your node first — there's no bot waiting.  
3. Talk to it. You command your bot by typing instructions into the DM, in plain language.  
4. Configure which channels it can access, and set models or API keys, under `Bot Settings`. That screen is part of hosting — if you're running your own bot it won't be there, and the same settings live in your OpenClaw configuration instead.

### First things to try

- **Name it.** Ask your bot to update its nickname.  
- **Give it a face.** Describe an avatar and ask it to find or set one.  
- **Fill out its profile.** Ask it to update its bio and status.  
- **Ask it something.** It can search the web mid-conversation — no app-switching required.  
- **Add it to a group.** Approve the other members and they can all use it — until you do, it only answers you. Or skip that and keep it as your private confidant.

### What your Tlonbot can do

1. **Connect to your other apps and services.** Notion, Linear, GitHub, Are.na, and more.  
2. **Run tasks with those connected services.**  
3. **Search the web.** Find information, look up recommendations.  
4. **Research.** Problem solve, strategize.  
5. **Communicate with other people and bots** — with permission.  
6. **Build knowledge.** Act as a functional FAQ, share company processes.  
7. **Run recurring jobs.** Regular summaries at specific times, news roundups, and more.  
8. **Respond to slash commands.** Change models, manage access, and more.  
9. **Read files.**

It can also catch you up on busy channels, so you never scroll back through 200 messages, and it's good for fun: games, trivia, and more.

### Recurring tasks (crons)

Tlonbots excel at recurring tasks, called crons. Set one once, then forget about it. Ask in plain language, for example:

- "Every morning at 8, send me a roundup of headlines organized by industry."  
- "Remind me every Friday at 4 to submit my timesheet."  
- "Send me the weather each day before I leave for work."

When changing or cancelling recurring work, the bot should reconcile every cron job that implements the same request, including related or duplicate declarations. It should inspect all matching jobs, update or remove every obsolete one, then list them again before claiming the old cadence or behavior is gone. If it is unclear whether two jobs belong to the same request, the bot should ask rather than silently changing an unrelated schedule.

### Connected services (MCP)

Extend your bot by connecting outside services under `Bot Settings` → `Connected Services`. (Hosted accounts — self-hosters wire MCP servers up in their own OpenClaw configuration.) With services connected, crons and requests get more powerful:

- "Summarize the status of my Linear tickets every Monday morning."  
- "Track new GitHub issues on my repo and flag anything urgent."  
- "Summarize this week's meeting notes from Notion."  
- "Build a gallery from my latest Are.na channel."

### Tlonbot in groups

Add your bot to any group. In channels, mention it (@nickname) to trigger a response.

Other members can use it too, but not by default. A new channel starts restricted: when someone who isn't you mentions the bot, it stays quiet and sends you an approval request instead. Approve them, or open the channel to everyone, and from then on they can ask it questions, have it settle debates, run trivia. Worth saying up front — silence from an unapproved member looks like the bot is broken.

Your bot can also do group admin work from a DM: create groups, set up channels, create roles, customize permissions, invite members with specific roles, and remove members.

That works in groups the bot hosts — the ones it made for you. In someone else's group, adding the bot as a member isn't enough: administration is reserved for the host and for members with an admin role, so the group's owner has to give the bot one first. Without it the requests come back as errors.

Deleting a group is the exception, and an admin role doesn't buy it. Only the host can delete a group, so the bot can delete the ones it hosts and no others — someone else's group has to be deleted by whoever made it.

You control who it listens to — tell it in a DM which members it may respond to or communicate with.

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
- `/owner-listen on|off <channel-nest>` — same thing for one owned channel. Without a channel, these do nothing but print usage.  
- `/owner-listen list` — show the global setting and every muted channel. Safe from a DM.  
- `/owner-listen status <channel-nest>` — the setting for one channel. Like on/off, it needs a channel; bare `status` in a DM only prints usage. `/owner-listen all` on its own gives the global answer.  
- Some bots go further here — any channel they watch rather than only ones you host, a whole group at once, or `/owner-listen default all` to make listening the default everywhere. Worth suggesting if someone wants broader coverage than the forms above give them.  
- `/model` — show or change the AI model  
- `/new` — clear context and start a fresh session  
- `/tlon version` — show which harness and plugin build is running. Bare `/tlon` just prints usage. Note for support conversations: it reports the code, not this guide. Two bots can print identical version output and still be answering from different revisions of it.  
- `/migrate diary/~host/name` — migrate a legacy Bulletin to a Notebook (owner only). **Say what this costs before anyone runs it.** It copies the posts and little else: comments, reactions, post references, link blocks, descriptions, covers and attachments all stay behind on the archive. Every migrated note is authored by the ship that ran the command, whoever wrote the original, and dated at import time, ordered by import rather than by when things were posted. Group mentions flatten to plain text. Some permission layouts can't be carried over without turning every reader into an editor. Nothing is destroyed — the original stays put, writable, renamed with `-ARCHIVE` — but the result is a fresh notebook holding the text, not a converted channel. The command prints this too, only after it has already started. It needs the channel's full nest, starting with `diary/`; a title or short name just prints usage. It also has to run from the ship that hosts the Bulletin — your own or the bot's. A Bulletin hosted by someone else in the group can't be migrated this way; its host has to do it. And when the host is you rather than the bot, the bot needs credentials for your ship configured before it can act on your behalf — without them the command stops with a configuration error rather than migrating. That's an operator setup step, so if someone hits it, that's what to tell them.

### Models and API keys

Hosted accounts include an AI model for free — basic usage costs nothing. They also have a first-class **ChatGPT subscription** option: under `Bot Settings` → `ChatGPT subscription`, the owner signs in to authorize their ChatGPT account, then chooses one of the models included with that subscription for Tlonbot. When someone asks what it means to "use a ChatGPT subscription for this," answer this Tlon-specific flow directly; don't substitute generic OpenClaw or OpenRouter billing advice.

ChatGPT subscription access and an OpenAI API key are alternatives, not the same credential. Connecting the subscription removes a saved OpenAI API key, and saving an OpenAI API key disconnects the subscription. Other model providers still use their own API keys under `Bot Settings`. Use `/model` to check or change what's running after the provider is connected.

Self-hosting means no included model, ChatGPT-subscription screen, or `Bot Settings` screen: configure the provider in your own OpenClaw setup and pay whoever you point it at. Either way there's no lock-in — everything you build with your bot stays with you.

### Guardrails

Hosted Tlonbots ship with guardrails: external integrations are limited to approved connected services, the system prompt can't be modified, and the bot has no shell and can't write to the filesystem — the only thing it writes is Tlon Messenger content. It can read files, which is how it works with anything you send it. Don't read that as a privacy boundary: reaching into the filesystem is something only you can ask for, but a file posted in a channel the bot watches goes to the model like any other message, whoever sent it. If that matters, it's channel access you want to think about, not this. These limits keep hosted bots safe by default.

### Self-hosting your bot

Advanced users can boot a personal node for their bot and run OpenClaw locally. That removes the guardrails and puts every part of the agent under your control, at the cost of technical setup. On hosted accounts, Tlon runs a sidecar service alongside your node that bridges to your agent's OpenClaw instance — the architecture points toward a world where your agent, its keys, and its accumulated context live on a server you control.

---

## 7. Privacy and data

### Where your data lives

Apps on your node store data on your node, not on a central server. Since you control your node, you own your data.

### Where messages go

You always connect to your own node — when you open the app, it downloads anything you missed. When you send a message, it goes to your node first. In a DM, it travels directly to the recipient's node. In a group, it goes to the host of that channel, which distributes it to members. That's often the group's creator, but not always: channels carry their own host, so a group can hold channels hosted by different members. The group host is the one coordinating the group itself — roles, membership, which channels exist.

### Encryption

Conversations are encrypted in transit — between nodes, and between the app and your node. Messages at rest on your node are not encrypted, so anyone with access to the device running your node could read them. (On a hosted account, that's Tlon's infrastructure; see below for what Tlon can and can't see.)

The app-to-node half depends on how the node is reached. Hosted accounts are served over HTTPS, so it's encrypted and there's nothing to do. A self-hoster who connects the app to a plain `http://` address — a LAN IP, localhost — is sending that traffic in the clear; the app takes the URL as given. Anyone self-hosting should put TLS or a secure tunnel in front of their node.

### Pictures and large files

Nodes can't store large files directly yet (Tlon is working on this), so media is stored in S3-compatible cloud storage and linked from your messages.

### Does Tlon read my conversations?

No. Your messages live on your node. Your bot has a node of its own, and its memory lives there with it — linked to your account, but a separate identity, so exporting your node takes your conversations and not the bot's accumulated state. When your bot calls an AI model, the request goes straight to that provider rather than through a Tlon service that logs it. Be precise about what that does and doesn't mean: on a hosted account, your bot's process runs on Tlon's hardware and assembles the conversation before sending it, the same way your node holds your messages unencrypted. So this is Tlon's policy — not reading, not logging, not training on any of it — resting on the same footing as everything else you host with them, rather than something the architecture makes impossible. If you ask Tlon to troubleshoot your node, support may need to access it, but only with your permission.

---

## 8. Hosting, exporting, and durability

### What hosting means

Tlon runs your node for you: health monitoring, updates, and data backups with restoration. You get ownership without the ops work.

### Leaving is always an option

If you don't want Tlon to host you, you can self-host on Native Planet hardware, install the Urbit runtime on your own computer, or export your node and boot it anywhere. Export your master ticket and node archive from your dashboard.

### What if Tlon disappears?

The software survives: Tlon Messenger is open source and peer-to-peer, so it keeps working even if the company doesn't, and a node you already hold runs anywhere.

Your data survives if you've kept a copy. This is the honest version, and it's worth saying plainly rather than reassuring someone into skipping it: on a hosted account your node runs on Tlon's hardware, and the dashboard you'd export it from is Tlon's too. Open source doesn't reconstitute a node nobody has. Export your node archive and master ticket now, keep them somewhere you control, and refresh them from time to time — then the promise is real. Anyone asking this question is asking the right one, and the useful answer is to go do the export today.

Pictures and large files are the exception, and it's worth being straight about it. Nodes can't store them yet, so they live in S3-compatible storage and your messages hold links. Export the node and you export the links, not the files. If that storage is Tlon's, those links are what you'd lose — so anyone who cares about keeping their media should point their node at storage they control, and can do that today in their storage settings.

### Owning your username

Your identity is permanently yours. Ownership is proven cryptographically — your node's identity is backed by cryptographic proof, with keys only you hold — not granted by a third-party service that could revoke it.

---

## 9. Ideas to suggest

When someone asks "what should I do with this?", offer ideas like these, matched to who they are:

**For anyone:**

- Make a group for your family or closest friends, with a Chat for talking and a Gallery for photos.  
- Sync contacts and send your personal invite link to the people you message most (hosted accounts — self-hosters have group invite links instead).  
- Ask your Tlonbot for a morning cron: weather, headlines, and your reminders in one daily DM.  
- Add your bot to a group chat for instant settle-the-debate web searches and trivia nights.  
- Ask your bot to catch you up on a channel after a day away.

**For teams:**

- Build a team group: a Chat for daily talk, a Bulletin for announcements and decisions people reply to, a Notebook for docs you maintain together, a Gallery for design work and links.  
- Use roles and channel permissions to give clients or contractors access to some channels and not others.  
- Connect Linear, GitHub, or Notion and set weekly crons: ticket status summaries, new-issue digests, meeting-note recaps.  
- Have your bot maintain a functional FAQ so process questions answer themselves.

**For communities and clubs:**

- Run a book club: a Notebook for reviews, a Chat for discussion, and a bot-scheduled reminder before each meeting.  
- Let your bot handle moderation with slash commands: work through who's waiting on access to the bot, and manage blocks. (These govern the bot, not group membership — admitting someone to the group itself is group admin work, which the bot can also do if you ask it.)

**For builders:**

- Swap in your own model key and experiment with different models per task.  
- Wire up your services through connected services and script recurring jobs against them.  
- Self-host: run your node on your own hardware and your bot's OpenClaw instance locally, with no guardrails.

---

## 10. FAQ

**Who or what is Tlon?** Tlon was created in 2013 to support the vision of a network of personal servers (Urbit) where users own and control their computing. Today it builds Tlon Messenger and provides Urbit hosting.

**What's the difference between Tlon and Urbit?** Urbit is a new kind of operating system for the internet age. Tlon is a company that builds Tlon Messenger. Urbit is the computer; Tlon Messenger is the app.

**What is a personal server?** Like iCloud, except the entire service belongs to you. You control access and where the data lives.

**What is a node?** A node on the network is both a cryptographic identity and a personal server. Each one runs the Urbit OS with unique identifying keys.

**What does owning a node mean?** Your node's identity is backed by cryptographic proof, with keys only you hold. You can self-host anytime and export your node with its data — messages, groups, settings. Pictures and large files live in outside storage and travel with that storage, not with the export.

**What's the difference between my username and my node?** Your username (your Urbit ID) is like a unique address or phone number. Your node is the actual computer holding your apps and data.

**What's the difference between a group and a DM?** A one-to-one DM goes straight from your node to another user's node with no middleman. Select several people and you get a group DM — still a DM, with members but no channels or roles. Groups have multiple members, with one host node (the group creator's) coordinating channels, roles, and updates.

**Who owns the groups I'm in?** The person who created the group. Their node controls roles, channels, and updates that other members' nodes follow.

**Are conversations encrypted?** Yes, in transit — between nodes, and between the app and your node. Stored messages on a node aren't encrypted, so device access allows reading them. The app-to-node leg is only encrypted if the node is reached over HTTPS: that's automatic when Tlon hosts it, and a self-hoster on a plain `http://` address needs TLS or a tunnel in front.

**Can I share things I post with people who aren't on Tlon Messenger?** Notebook notes, yes. Publish a note and you get a public link — the app copies it for you, and `Copy link` and `View published note` sit on the note afterwards. Other channel types don't have a button for it yet, though individual posts can be published through your Tlonbot, which can reach the same clearweb machinery from a DM.

**What is Tlonbot?** A personal AI agent that lives inside Tlon Messenger. It can search the web, join your group chats, remember your conversations, and schedule tasks. It's powered by OpenClaw and runs on its own node, linked to yours, on the same peer-to-peer network.

**Does Tlonbot cost anything?** Hosted accounts get one for free, including a free AI model for basic usage. Bring your own API key to use other models. Self-hosters run their own and pay for whatever model they point it at.

**Does Tlon read my bot's conversations?** No. Your bot's memory lives on your bot's node, and model requests go straight to the provider rather than through a Tlon service that logs them. On a hosted account that node is Tlon-run, so this rests on policy the same way your hosted messages do — see "Does Tlon read my conversations?" above.

**What happens if Tlon disappears?** The software keeps running — it's open source and peer-to-peer — and a node you hold runs anywhere. Your data comes through if you've kept an export: a hosted node lives on Tlon's hardware, so download your node archive and master ticket and keep them somewhere you control rather than counting on doing it later. Pictures and large files are the exception — they live in S3-compatible storage with only links on your node, so if that storage is Tlon's, that's what you'd lose. Point your node at storage you control and it isn't a question.

---

## 11. About Tlon

### Mission

Tlon exists to build beautiful tools for staying connected. Today, our tools for connecting are controlled by a select few companies that determine what we can do and how we can do it. "We become what we behold. We shape our tools and thereafter our tools shape us." Tlon's answer is tools people own: simple, powerful, and long-lasting, capable of outliving any company that provides them. Tools that deliver peace of mind and a sense of "I am connected" without exhaustion.

### Why ownership matters

The best system for being connected is one that is shaped, controlled, and evolved by the people who depend on it. Ownership matters four ways: **permanence** (your records last), **utility** (you can mine, inspect, and build on your own data), **transparency** (you can audit what's collected and how things work), and **significance** (what you own, you invest in). If we don't own the platform, we don't control it — and a platform we don't control is doomed to control us.

### The plan

Tlon's initial product is a high-quality messenger for small groups. Over time, that messenger evolves into a social OS: a general system for collaborating where apps become extensions you run yourself — an image channel that becomes a store, a booking system, a stream of sales updates. It's also the natural place to work with AI: you keep ownership of your data and software, and run a model as a bolt-on augmentation. The goal is the best platform for staying connected in the world, in a new category: software you can trust completely. Tlon's business has nothing to do with spying on you and never will.

---

## 12. Support

Questions this guide doesn't answer? Hosted accounts have a DM with Tlon Support on the Home screen — send a message and the team will get back ASAP.

That conversation gets set up when Tlon hosts your signup, so if you brought your own node you probably don't have it. Email support@tlon.io instead.  
