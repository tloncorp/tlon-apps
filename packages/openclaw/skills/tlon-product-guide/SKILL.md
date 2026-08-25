---
name: tlon-product-guide
description: Answer questions about Tlon, Urbit, Tlon Messenger, Tlonbot, and OpenClaw — what they are, how they work, and how to use them. Covers signup and onboarding, contacts and invites, groups, channels (Chat/Notebook/Bulletin/Gallery), roles and permissions, DMs, bot setup, crons, connected services (MCP), slash commands, models and API keys, privacy and encryption, hosting, exporting, self-hosting, and support. Use whenever someone asks what Tlon is, how a product feature works, what they can do with their node or bot, or asks to be walked through a task in the app.
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
- If someone needs help this guide can't provide, point them to their DM with Tlon Support on the Home screen.
- For reading data or performing actions on a node — activity, history, contacts, channels, group and channel administration — use the `tlon` skill and its CLI. This skill is for explaining the product, not for operating it.

---

## 1. What is Tlon Messenger?

Tlon Messenger is a messenger that runs on a server you own and control. Talk directly with the people you care about on a platform that doesn't mine your data, sell your attention, or own your social graph.

Every account comes with two things:

1. **A node.** Your personal server on a peer-to-peer network. Your messages, groups, and data live there, not in a company account database. On a hosted account Tlon runs that node on its hardware — but the node is still yours. Export it and run it anywhere, and nothing about your account depends on Tlon's permission.  
2. **Tlonbot.** An AI agent powered by OpenClaw that learns your workflows and preferences without giving your data away. Every account gets one for free.

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
- **Hosted account.** Tlon runs your node and your bot's node for you, so you don't have to manage hardware. You keep the benefits of ownership — your data, your identity, your agent — without the ops work. You can export everything and self-host anytime.  
- **Tlonbot.** Your personal AI agent. It runs with an OpenClaw harness on its own node, linked to yours.  
- **OpenClaw.** The open-source agent framework that powers Tlonbot. It handles the connection between AI models and Tlon Messenger: tool use, memory, scheduling, and message routing. Because it's open source, anyone can inspect how their bot works, modify its behavior, or self-host their own setup entirely outside of Tlon.

---

## 3. Getting started

### Sign up

Sign up is free and takes a minute. Download the iOS or Android app and use a phone number or email. Most people arrive one of two ways: someone sent them an invite to a group, or they signed up cold.

### Where you land

New accounts start in a welcome group Tlon made to show you the basics. A group is a social space for friends, teams, and collaborators to connect. Groups are made up of channels: Chats for talking, Notebooks for documents you write together, Bulletins for long-form posts and discussion, and Galleries for visual posts and links. You're a member of that first group, but you can create your own and join others.

Outside of groups, you can send direct messages to individuals. DMs appear alongside your groups on the Home tab. To see only DMs, tap `Messages` at the top of the Home screen.

### Sync your contacts

When you create an account, Tlon Messenger asks if you want to sync your phone's contacts, so you can see whether you already have friends on the app.

1. Give Tlon Messenger access to your contact book.  
2. Select the contacts you want to share. You don't have to choose them all — you can filter for specific people.  
3. Allow your device to share the selected contacts with Tlon Messenger.  
4. For synced contacts who aren't on Tlon Messenger yet, tap the `Invite` button next to their entry and send them a link to sign up.

You'll automatically receive a DM when they join. Tlon will never spam your contacts and will never use your contact book in any capacity without your permission.

### Invite friends

Friends who aren't on Tlon Messenger are directly connected to you when you send them an invite. There are two ways.

**Personal invite:**

1. Tap the `Invite people` icon in the upper left corner of the Home screen. That opens your invite sheet.  
2. Tap `Share link`.  
3. Send it via email, text, or social. Inviting someone in person? They can scan the QR code on that screen instead.

Share your personal invite link with as many people as you like. Whenever a new friend joins through it, you'll automatically get a DM from them.

**Group invite:**

1. From your group, tap the three-dot icon in the top right corner.  
2. Tap `Invite people`.  
3. Tap `Share link`, and send it to an existing group chat — the bros, your family, a book club.

To add someone who's already on Tlon Messenger, type their name in the search bar on that same invite sheet and tap the check.

### Use it on desktop

Tlon Messenger is a computer shaped like an app. You can reach your node from your phone and from any browser.

1. Go to [https://tlon.network/login](https://tlon.network/login)  
2. Log in with the email you used to sign up.  
3. Click the tile that says Tlon.

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

Every channel type is legible to Tlonbots, so your agent can read and work with all of them (where you've given it access).

### Make a group

1. From the Home screen, tap the plus icon at the top right of the navigation bar.  
2. Tap `New group`.  
3. Choose how to set it up: `Quick group` starts a chat immediately with default settings, `Basic group` comes with chat, gallery, and notebook channels, or pick one of the templates.  
4. If you chose `Basic group`, name it. Quick groups and the other templates skip this — a quick group starts out as `Untitled group` and a template keeps the template's name. Either way you can rename it later, in step 6.  
5. Invite friends who already use Tlon Messenger, or skip this and invite people later.  
6. Change the name, banner, and profile image any time: tap `Group info & settings`, then `Edit group info`.  
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

Tlonbot is a personal AI agent that lives inside Tlon Messenger. It can search the web, join your group chats, remember your conversations, and schedule tasks. Every account includes one, no setup required.

Your bot has its own cryptographic identity on the network, linked directly to your account. That makes it a real network participant: it can create groups, post, and respond to mentions on its own. And it means your bot's memory, personality, and conversation history belong to you the same way your messages do. You can export it, self-host it, or swap the AI model behind it. No vendor can take it away or change the terms on you.

### How it's different from ChatGPT or Alexa

ChatGPT, Alexa, and Siri are services you rent. Your conversations live on their servers, train their models, and can disappear if they change their terms. Tlonbot runs on its own node, tied to yours. It calls out to AI providers for inference, but your conversation history, memory, and preferences are stored on your node — not theirs. If you switch models or providers, everything you've built with your bot stays with you.

### Getting started

1. Download the iOS or Android app and sign in.  
2. Find your bot in your direct messages. It's already in your account.  
3. Talk to it. You command your bot by typing instructions into the DM, in plain language.  
4. Configure which channels it can access in its settings, and set models or API keys under `Bot Settings`.

### First things to try

- **Name it.** Ask your bot to update its nickname.  
- **Give it a face.** Describe an avatar and ask it to find or set one.  
- **Fill out its profile.** Ask it to update its bio and status.  
- **Ask it something.** It can search the web mid-conversation — no app-switching required.  
- **Add it to a group.** Everyone in the chat can use it. Or keep it as your private confidant.

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

### Connected services (MCP)

Extend your bot by connecting outside services under `Bot Settings` → `Connected Services`. With services connected, crons and requests get more powerful:

- "Summarize the status of my Linear tickets every Monday morning."  
- "Track new GitHub issues on my repo and flag anything urgent."  
- "Summarize this week's meeting notes from Notion."  
- "Build a gallery from my latest Are.na channel."

### Tlonbot in groups

Add your bot to any group. In channels, mention it (@nickname) to trigger a response.

Other members can use it too, but not by default. A new channel starts restricted: when someone who isn't you mentions the bot, it stays quiet and sends you an approval request instead. Approve them, or open the channel to everyone, and from then on they can ask it questions, have it settle debates, run trivia. Worth saying up front — silence from an unapproved member looks like the bot is broken.

Your bot can also do group admin work from a DM: create groups, set up channels, create roles, customize permissions, invite members with specific roles, remove members, and delete groups.

That works in groups the bot hosts — the ones it made for you. In someone else's group, adding the bot as a member isn't enough: administration is reserved for the host and for members with an admin role, so the group's owner has to give the bot one first. Without it the requests come back as errors.

You control who it listens to — tell it in a DM which members it may respond to or communicate with.

### Slash commands

These are all owner-only. Anyone else who tries one gets told so — approving a member to talk to the bot doesn't hand them the commands.

Access and moderation. The approval commands take a **request ID**, not a nickname — run `/pending` first and use the ID it prints:

- `/pending` — view pending requests  
- `/allow <request-id>` — approve one  
- `/reject <request-id>` — deny one  
- `/ban <request-id>` — deny a pending request and block the ship behind it  
- `/banned` — list blocked ships  
- `/unban ~nickname` — unblock a ship

Two things to be clear about when someone asks. `/ban` acts on a pending request, so it isn't a way to remove a member who is already in a group — that's group admin work, and the bot can do it from a DM. And `/unban` only lifts the block; it doesn't put anyone back in a group. They'll need a fresh invite or a new request.

Bot behavior:

- `/owner-listen all on|off` — the global switch for whether it responds to you without a direct mention. This is the form to use in a DM.  
- `/owner-listen on|off <channel-nest>` — same thing for one owned channel. Without a channel, these do nothing but print usage.  
- `/owner-listen list` — show the global setting and every muted channel. Safe from a DM.  
- `/owner-listen status <channel-nest>` — the setting for one channel. Like on/off, it needs a channel; bare `status` in a DM only prints usage. `/owner-listen all` on its own gives the global answer.  
- `/model` — show or change the AI model  
- `/new` — clear context and start a fresh session  
- `/tlon version` — show which harness, plugin, and skill versions are running. Bare `/tlon` just prints usage.  
- `/migrate diary/~host/name` — migrate a legacy Bulletin to a Notebook (owner only). It needs the channel's full nest, starting with `diary/`; a title or short name just prints usage.

### Models and API keys

Every account includes an AI model for free — basic usage costs nothing. Want Claude, ChatGPT, or something else? Add your own Anthropic, OpenAI, or OpenRouter key under `Bot Settings` to switch models anytime, or use `/model` to check and change what's running. No lock-in, ever: everything you build with your bot stays with you.

### Guardrails

Hosted Tlonbots ship with guardrails: external integrations are limited to approved connected services, the system prompt can't be modified, and the bot has no shell and can't write to the filesystem — the only thing it writes is Tlon Messenger content. It can read files, which is how it works with anything you send it, and that's restricted to you rather than to anyone in a channel. These limits keep hosted bots safe by default.

### Self-hosting your bot

Advanced users can boot a personal node for their bot and run OpenClaw locally. That removes the guardrails and puts every part of the agent under your control, at the cost of technical setup. On hosted accounts, Tlon runs a sidecar service alongside your node that bridges to your agent's OpenClaw instance — the architecture points toward a world where your agent, its keys, and its accumulated context live on a server you control.

---

## 7. Privacy and data

### Where your data lives

Apps on your node store data on your node, not on a central server. Since you control your node, you own your data.

### Where messages go

You always connect to your own node — when you open the app, it downloads anything you missed. When you send a message, it goes to your node first. In a DM, it travels directly to the recipient's node. In a group, it goes to the group host's node for distribution to members.

### Encryption

Conversations are encrypted in transit — between nodes, and between the app and your node. Messages at rest on your node are not encrypted, so anyone with access to the device running your node could read them. (On a hosted account, that's Tlon's infrastructure; see below for what Tlon can and can't see.)

### Pictures and large files

Nodes can't store large files directly yet (Tlon is working on this), so media is stored in S3-compatible cloud storage and linked from your messages.

### Does Tlon read my conversations?

No. Your messages and your bot's memory live on your node. When your bot calls an AI model, those requests go directly to the inference provider — Tlon doesn't see your prompts. If you ask Tlon to troubleshoot your node, support may need to access it, but only with your permission.

---

## 8. Hosting, exporting, and durability

### What hosting means

Tlon runs your node for you: health monitoring, updates, and data backups with restoration. You get ownership without the ops work.

### Leaving is always an option

If you don't want Tlon to host you, you can self-host on Native Planet hardware, install the Urbit runtime on your own computer, or export your node and boot it anywhere. Export your master ticket and node archive from your dashboard.

### What if Tlon disappears?

You won't lose your apps or your messages. Tlon Messenger is open source and peer-to-peer; the software keeps working even if the company doesn't. Export your node and run it yourself.

Pictures and large files are the exception, and it's worth being straight about it. Nodes can't store them yet, so they live in S3-compatible storage and your messages hold links. Export the node and you export the links, not the files. If that storage is Tlon's, those links are what you'd lose — so anyone who cares about keeping their media should point their node at storage they control, and can do that today in their storage settings.

### Owning your username

Your identity is permanently yours. Ownership is proven cryptographically — your node's identity is backed by cryptographic proof, with keys only you hold — not granted by a third-party service that could revoke it.

---

## 9. Ideas to suggest

When someone asks "what should I do with this?", offer ideas like these, matched to who they are:

**For anyone:**

- Make a group for your family or closest friends, with a Chat for talking and a Gallery for photos.  
- Sync contacts and send your personal invite link to the people you message most.  
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
- Let your bot handle moderation with slash commands: work through pending join requests, and manage blocks.

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

**What does owning a node mean?** Your node's identity is backed by cryptographic proof, with keys only you hold. You can self-host anytime and export your node with all its data intact.

**What's the difference between my username and my node?** Your username (your Urbit ID) is like a unique address or phone number. Your node is the actual computer holding your apps and data.

**What's the difference between a group and a DM?** A one-to-one DM goes straight from your node to another user's node with no middleman. Select several people and you get a group DM — still a DM, with members but no channels or roles. Groups have multiple members, with one host node (the group creator's) coordinating channels, roles, and updates.

**Who owns the groups I'm in?** The person who created the group. Their node controls roles, channels, and updates that other members' nodes follow.

**Are conversations encrypted?** Yes, in transit — between nodes, and between the app and your node. Stored messages on a node aren't encrypted, so device access allows reading them.

**Can I share things I post with people who aren't on Tlon Messenger?** Notebook notes, yes. Publish a note and you get a public link — the app copies it for you, and `Copy link` and `View published note` sit on the note afterwards. Other channel types don't have a button for it yet, though individual posts can be published through your Tlonbot, which can reach the same clearweb machinery from a DM.

**What is Tlonbot?** A personal AI agent that lives inside Tlon Messenger. It can search the web, join your group chats, remember your conversations, and schedule tasks. It's powered by OpenClaw and runs on its own node, linked to yours, on the same peer-to-peer network.

**Does Tlonbot cost anything?** Every account gets one for free, including a free AI model for basic usage. Bring your own API key to use other models.

**Does Tlon read my bot's conversations?** No. Your bot's memory lives on your node, and model requests go directly to the inference provider.

**What happens if Tlon disappears?** You won't lose your apps or data. The software is open source and peer-to-peer, so it keeps running. Export your node and run it yourself.

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

Questions this guide doesn't answer? Every account has a DM with Tlon Support on the Home screen. Send a message and the team will get back ASAP.  
