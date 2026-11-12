# Ideas, FAQ, about Tlon, and support

Things to suggest, frequently asked questions, the company, and where to get help. Part of the `tlon-product-guide` skill; read `SKILL.md` first for how to answer.

## 9. Ideas to suggest

When someone asks "what should I do with this?", offer ideas like these, matched to who they are:

**For anyone:**

- Make a group for your family or closest friends, with a Chat for talking and a Gallery for photos.  
- Sync contacts and send your personal invite link to the people you message most (hosted accounts — self-hosters have group invite links instead).  
- Ask your Tlonbot for a morning cron: weather, headlines, and your reminders in one daily DM.  
- Add your bot to a group chat for instant settle-the-debate web searches and trivia nights.  
- Ask your bot to catch you up on a channel after a day away.

**For teams:**

- Build a team group: a Chat for daily talk, a second Chat for announcements and decisions people reply to in threads, a Notebook for docs you maintain together, a Gallery for design work and links.  
- Use roles and channel permissions to give clients or contractors access to some channels and not others.  
- Connect Google Calendar, GitHub, or Notion and set weekly crons: a look at the week ahead, new-issue digests, meeting-note recaps.  
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

**What's the difference between a group and a DM?** A one-to-one DM goes straight from your node to another user's node with no middleman. A group DM has several people in it — still a DM, with members but no channels or roles. The app no longer starts new ones; to talk with several people, make a group. Groups have multiple members, with one host node (the group creator's) coordinating channels, roles, and updates.

**Who owns the groups I'm in?** The person who created the group. Their node controls roles, channels, and updates that other members' nodes follow.

**Are conversations encrypted?** Yes, in transit — between nodes, and between the app and your node. Stored messages on a node aren't encrypted, so whoever runs the device can read them: Tlon, on a hosted account, bound by its policy not to. Export your node and run it yourself, and no one without access to your device can read them. The app-to-node leg is only encrypted if the node is reached over HTTPS: that's automatic when Tlon hosts it, and a self-hoster on a plain `http://` address needs TLS or a tunnel in front.

**Can I share things I post with people who aren't on Tlon Messenger?** Notebook notes, yes. Publish a note and you get a public link — the app copies it for you, and `Copy link` and `View published note` join the note's press-and-hold menu in the notebook's list afterwards. Other channel types don't have a button for it yet, though individual posts can be published through your Tlonbot, which can reach the same clearweb machinery from a DM.

**What is Tlonbot?** A personal AI agent that lives inside Tlon Messenger. It can search the web, join your group chats, remember your conversations, and schedule tasks. It's powered by OpenClaw and runs on its own node, linked to yours, on the same peer-to-peer network.

**Does Tlonbot cost anything?** Hosted accounts get one for free, including a free AI model for basic usage. To use other models, connect a ChatGPT, Claude or Grok subscription you already pay for, or bring your own API key. Self-hosters run their own and pay for whatever model they point it at.

**Does Tlon read my bot's conversations?** No. Your bot's state is kept on its node and on yours, and model requests go straight to the provider rather than through a Tlon service that logs them. On a hosted account those nodes are Tlon-run, so this rests on policy the same way your hosted messages do — see "Does Tlon read my conversations?" above.

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

Questions this guide doesn't answer? Hosted accounts have a DM with Tlon Support, with their other DMs on the Workspaces tab — send a message and the team will get back ASAP.

That conversation gets set up when Tlon hosts your signup, so if you brought your own node you probably don't have it. Email support@tlon.io instead.
