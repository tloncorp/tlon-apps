# Tlon Messenger: the product

What Tlon Messenger is, the ideas behind it, getting started, groups and channels, and direct messages. Part of the `tlon-product-guide` skill; read `SKILL.md` first for how to answer.

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
- **Hosted account.** Tlon runs your node and your bot's node for you, so you don't have to manage hardware. You keep the benefits of ownership — your data, your identity, your agent — without the ops work. Your node exports and self-hosts whenever you want, and your bot's state is kept on it, so that goes too; see "What it is" under Tlonbot.  
- **Workspace.** What the app calls a group. The Workspaces tab lists your groups alongside your DMs.  
- **Tlonbot.** Your personal AI agent. It runs with an OpenClaw harness on its own node, linked to yours.  
- **OpenClaw.** The open-source agent framework that powers Tlonbot. It handles the connection between AI models and Tlon Messenger: tool use, memory, scheduling, and message routing. Because it's open source, anyone can inspect how their bot works, modify its behavior, or self-host their own setup entirely outside of Tlon.

---

## 3. Getting started

### Sign up

Sign up is free and takes a minute. Download the iOS or Android app and use a phone number or email. Most people arrive one of two ways: someone sent them an invite to a group, or they signed up cold.

### Where you land

A hosted signup opens in a private chat with your Tlonbot, which walks you through setup. Your first workspace comes with it: a group on your own node with your bot already in it, and an `Updates` notebook where the bot writes for you. Once you tell the bot what you're interested in, the workspace is renamed after those topics. (Bring your own node and there's no bot waiting, so the app opens on your list of workspaces instead — nothing went wrong.)

A group is a social space for friends, teams, and collaborators to connect. Groups are made up of channels: Chats for talking, Notebooks for documents you write together, Bulletins for long-form posts and discussion, and Galleries for visual posts and links. You can create your own and join others.

The tab bar along the bottom is icons only, so describe them by shape:

- **Bot** — your bot's avatar, or a color tile if it has none (a flower stands in until its profile loads). Your private chat with your Tlonbot. It only appears on hosted accounts with a bot, and it's where a fresh start opens. Come back within a day and the app reopens on the screen you left.
- **Workspaces** — a `#`. Every group and DM you're in. The screen is headed `Workspaces`.
- **Activity** — a bell. Mentions, replies, and other notifications.
- **Settings** — a gear. Your own profile is the first row; on a hosted account your bot's settings come right after it.

Until the bot accepts your first setup answers, or about 30 seconds after the chat opens, the other tabs stay locked.

Outside of groups, you can send direct messages to individuals. DMs appear alongside your workspaces on the Workspaces tab. The filters at the top narrow the list: `Messages` shows only DMs, `Just me` shows workspaces that hold only you and your bot, and `With others` shows the rest. `Just me` only appears when you have a workspace like that; without one, the filters are `All`, `With others`, and `Messages`.

### Sync your contacts

When you create an account, Tlon Messenger asks if you want to sync your phone's contacts, so you can see whether you already have friends on the app.

1. Give Tlon Messenger access to your contact book.  
2. What happens next depends on the phone. iOS can hand over a chosen subset — its own prompt has a choice to select contacts, and you pick who to share there. Android grants the whole book at once; there's no per-contact step, so don't send an Android user looking for one.  
3. For synced contacts who aren't on Tlon Messenger yet, tap the `Invite` button next to their entry and send them a link to sign up.

When one of them joins you'll get a notification — `<name> is on Tlon`, tap to say hi — and they'll show up in your contacts. The app also adds an empty DM with them to your Workspaces list, reading `is on Tlon Messenger`; saying hi is still your move. Tlon will never spam your contacts and will never use your contact book in any capacity without your permission.

### Invite friends

Friends who aren't on Tlon Messenger are directly connected to you when you send them an invite. There are two ways.

**Personal invite:**

1. On the Workspaces tab, tap the person-with-a-plus icon in the upper left corner. That opens your invite sheet. If there's no icon there, you're on a node without a personal invite link — that link comes with hosted signup, so this flow is hosted-only. Group invites below work either way.  
2. Tap `Share link`.  
3. Send it via email, text, or social. Inviting someone in person? They can scan the QR code on that screen instead.

Share your personal invite link with as many people as you like. Whenever a new friend joins through it, you'll automatically get a DM from them.

**Group invite:**

1. On the Workspaces tab, press and hold the group.  
2. Tap `Invite people`.  
3. Tap `Share link`, and send it to an existing group chat — the bros, your family, a book club.

To add someone who's already on Tlon Messenger, type their name in the search bar on that same screen, tap them so they're checked, then tap the button at the bottom. It reads `Select people to invite` until you check someone, then "Invite 2 and continue", with your own count.

Who can do this depends on the group. In a public group, any member can. In a private or secret one, only admins — everyone else sees `Invites disabled` where the action would be, so an ordinary member asking why their invite button is greyed out isn't hitting a bug.

### Use it on desktop

Tlon Messenger is a computer shaped like an app. You can reach your node from your phone and from any browser.

1. Go to [https://tlon.network/login](https://tlon.network/login)  
2. Log in with the email you used to sign up.  
3. Click the tile that says Tlon.

That's the hosted path. Self-hosting? There's no signup email to log in with. In a browser, open your node's own address — the web app has no login screen of its own, and sends you to your node's front page to log in. The desktop app does have one, `Connect to Your Ship`, where you enter your node's URL and its access code.

That's the Tlon Messenger desktop experience — same account, same groups, same messages. It keeps the app's earlier layout, though, so steps in this guide need translating:

- There's no tab bar. A rail down the left side switches between `Home` (all your groups and DMs, with a `+` at the top for making new ones), `Messages` (starts on DMs only; its filter also offers `Chat Channels` and `All Messages`), Activity (the bell), and Contacts (your avatar). The person-with-a-plus icon near the bottom of the rail is your personal invite, and `Settings` is below it. Desktop shows that icon even without a personal invite link, so on a self-hosted node it opens a sheet stuck on `Preparing invite link`. Use a group invite there instead.
- There's no Bot tab. Your bot's DM sits with your other DMs, and `Settings` → `Bot Settings` opens Tlon's bot settings web page in a new browser tab, because the bot settings screens are in the phone app.
- The create menu has `New Message` and `New custom workspace`. `New Workspace` (a group with your bot in it) shows only when the app knows you have a hosted bot, and on a computer it may not know. If it isn't there, make the workspace from your phone, or ask your bot to make one.
- Where the phone has you press and hold something, hover it in the sidebar and open its three-dot menu instead.

---

## 4. Groups and channels

### What's in a group

A group is a social space with members, roles, and channels. There are four channel types:

- **Chat** — short, fast messages in a stream. For talking.  
- **Notebook** — collaborative Markdown documents, organized in folders. For writing something together. Notebooks have no comments; discussion goes in a Chat.  
- **Bulletin** — long-form publishing with comments underneath. For essays and announcements people reply to.  
- **Gallery** — photos, videos, links, files, and text posts, plus voice memos from the phone. For collecting and browsing visual material.

Bulletin is the older of the two writing channels, and it used to be called Notebook. A node that hasn't picked up the notebooks update yet still shows it under the old name and doesn't offer the new one. Current versions of the app no longer offer Bulletin when you add a channel; existing Bulletins keep working.

Chats, Notebooks and Galleries are all legible to Tlonbots, so your agent can read and work with them (where you've given it access). Bulletins are half-supported: a bot can still reply in one when it's spoken to, but the tooling it uses to go read a channel or manage it treats them as deprecated. So expect conversation to work and "catch me up on that Bulletin" not to. Migrating it to a Notebook closes the gap, but read the warning under `/migrate` first — it copies less than you'd expect.

### Make a group

With a hosted Tlonbot, tap the plus icon at the top right of the Workspaces tab, then `New Workspace`. That makes a group with your bot already in it and opens its chat. You can also ask your bot to make one for you. On a hosted account it makes it on your node with the bot as an admin, like `New Workspace`; a self-hosted bot hosts it itself and makes you an admin. The steps below are the `New custom workspace` flow, for a group without your bot in it. The create menu offers it on desktop, and on phones without a hosted bot; a phone with a hosted bot shows only `New Workspace`. (A self-hosted OpenClaw bot doesn't get `New Workspace` at all — ask the bot to make the group instead.)

1. Tap the plus icon at the top right of the Workspaces tab (on desktop, the `+` at the top of the `Home` sidebar).  
2. Tap `New custom workspace`.  
3. Choose how to set it up: `Quick workspace` starts a chat immediately with default settings, `Basic workspace` comes with chat, gallery, and notebook channels, or pick one of the templates.  
4. If you chose `Basic workspace`, name it. Quick groups and the other templates skip this — a quick group starts out unnamed, showing its members' names (or `Untitled workspace` if it's just you), and a template keeps the template's name. Either way you can rename it later, in step 6.  
5. Pick friends who already use Tlon Messenger and tap `Create workspace`, or skip the picking and invite people later.  
6. Change the name, icon, and description any time from `Workspace info & settings` — press and hold the group on the Workspaces tab to find it, or tap the group's name at the top of its screen. Then tap `Edit` in the upper right. That opens `Edit workspace info`, where the name, icon, and description live. It only shows for admins.  
7. Add channels: in `Workspace info & settings`, tap `Channels`, then `New` in the upper right (a plus icon on an iPhone), then `New channel`, and choose `Chat`, `Notebook`, or `Gallery`.  
8. Tap `Create channel` and the sheet closes. Go back to `Workspace info & settings` and tap `Invite` — from there you can pick people already on Tlon Messenger, or tap `Share link` for a join link anyone can use.

### Finding groups to join

There's no directory of groups to browse. When someone is looking for groups, point them to starting their own and bringing people in: on a phone with the bot, tap the plus icon and `New Workspace`, then `Invite people` → `Share link`. Joining someone else's group takes an invite link or a group code from someone already in it. Don't send them to other sites or search the web for groups to join.

### Join a group with a code

To bring people into your group, use an invite link: `Invite people` → `Share link`. That works for anyone, including people not on Tlon yet. A code is for someone already on Tlon.

A group code is the group's ID, `~host/group-name`. Anyone in a group can copy it: `Workspace info & settings` → `Copy ID`. To join with one, tap the plus icon, then `Join a workspace with a code (reference)`, and paste it. That button is on desktop and on phones without a Tlonbot. A phone with a bot has no code box: ask someone in the group for an invite link, or to send you the group itself (`Forward` in group info), then tap it in the chat to open a preview and join. Asking your bot to join a group adds the bot, not you.

A code isn't an invite link. Invite links come from `Invite people` → `Share link`, and someone new to Tlon pastes one on the `Have an invite?` screen when signing up.

### Ownership and roles

The person who created a group owns it. Their node hosts the group and controls its roles, channels, and updates, which other members' nodes follow.

Channels can be gated with permissions. Admins control read and write settings per channel and can assign member roles with specific access levels. To adjust: in `Workspace info & settings`, tap `Channels`, tap the channel (on Android, the three-dot icon next to it), then `Permissions`, and configure which roles can read or write. (Inside a group with several channels, pressing and holding a channel and picking `Channel info & settings` gets you to the same `Permissions` row.)

Notebooks are the exception. They don't support separate read and write permissions — a role that can read a notebook can also edit it. Say so before an admin grants what they think is read-only access.

---

## 5. Direct messages

DMs are personal messages outside any group — with one person, with a few people, or with your Tlonbot. A one-to-one DM goes straight from your node to the other person's node, with no middleman.

A group DM is a DM with several people in it. It has its own members and its own header, and it lives alongside your other DMs. It isn't a group: no channels, no roles. The app no longer starts new group DMs — to talk with several people, make a group — but group DMs you're already in keep working.

To send a DM: on the Workspaces tab, tap the plus icon at the top right, tap `New Message`, and pick who it's going to. The chat opens as soon as you pick them.

### Mute a chat

Long-press a chat in your list, tap `Chat notifications` (for a DM), `Workspace notifications` (for a group) or `Channel notifications` (for one channel in a group), and choose `Nothing`. That works for your bot's DM too. To silence the whole app instead, use your phone's notification settings.

---
