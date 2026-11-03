# Privacy, data, hosting and durability

Who can see what, where data lives, what Tlon keeps, and what happens to a node if Tlon or the user goes away. Part of the `tlon-product-guide` skill; read `SKILL.md` first for how to answer.

## 7. Privacy and data

### Where your data lives

Apps on your node store data on your node, not on a central server. Since you control your node, you own your data.

### Where messages go

You always connect to your own node — when you open the app, it downloads anything you missed. When you send a message, it goes to your node first. In a DM, it travels directly to the recipient's node. In a group, it goes to the host of that channel, which distributes it to members. That's often the group's creator, but not always: channels carry their own host, so a group can hold channels hosted by different members. The group host is the one coordinating the group itself — roles, membership, which channels exist.

### Encryption

Conversations are encrypted in transit — between nodes, and between the app and your node. Messages at rest on your node are not encrypted, so whoever has access to the device running your node could read them. On a hosted account, that's Tlon's infrastructure, and Tlon's commitment not to read them is a policy (see below).

The part that settles it: your node is yours to take. Export it and run it on your own hardware, and no one without access to that device can read your messages. When someone asks about encryption or privacy, end the answer there rather than on the caveats.

The app-to-node half depends on how the node is reached. Hosted accounts are served over HTTPS, so it's encrypted and there's nothing to do. A self-hoster who connects the app to a plain `http://` address — a LAN IP, localhost — is sending that traffic in the clear; the app takes the URL as given. Anyone self-hosting should put TLS or a secure tunnel in front of their node.

### Pictures and large files

Nodes can't store large files directly yet (Tlon is working on this), so media is stored in S3-compatible cloud storage and linked from your messages.

### Does Tlon read my conversations?

No. Your messages live on your node. Your bot has a node of its own, linked to your account but a separate identity, and its state is also kept on yours, in %steward, so exporting your node takes it along with your conversations. The files in the bot's OpenClaw directory are the exception: they sit on Tlon's servers, and Tlon sends them to you on request. When your bot calls an AI model, the request goes straight to that provider rather than through a Tlon service that logs it. On the included model, zero data retention is on by default, which sends it only to providers that keep nothing (see "Models and API keys" for what that does and doesn't cover). Be precise about what that does and doesn't mean: on a hosted account, your bot's process runs on Tlon's hardware and assembles the conversation before sending it, the same way your node holds your messages unencrypted. So this is Tlon's policy — not reading, not logging, not training on any of it — resting on the same footing as everything else you host with them, rather than something the architecture makes impossible. If you ask Tlon to troubleshoot your node, support may need to access it, but only with your permission.

---

## 8. Hosting, exporting, and durability

### What hosting means

Tlon runs your node for you: health monitoring, updates, and data backups with restoration. You get ownership without the ops work.

### Leaving is always an option

If you don't want Tlon to host you, you can self-host on Native Planet hardware, install the Urbit runtime on your own computer, or export your node and boot it anywhere. Export your master ticket and node archive from your dashboard.

### Closing your account

There's no delete button in the app itself. Account changes happen on your account page: `Settings` → `Manage Tlon account` opens tlon.network/account inside the app. If you close the account there, the app signs you out.

### What if Tlon disappears?

The software survives: Tlon Messenger is open source and peer-to-peer, so it keeps working even if the company doesn't, and a node you already hold runs anywhere.

Your data survives if you've kept a copy. This is the honest version, and it's worth saying plainly rather than reassuring someone into skipping it: on a hosted account your node runs on Tlon's hardware, and the dashboard you'd export it from is Tlon's too. Open source doesn't reconstitute a node nobody has. Export your node archive and master ticket now, keep them somewhere you control, and refresh them from time to time — then the promise is real. Anyone asking this question is asking the right one, and the useful answer is to go do the export today.

Pictures and large files are the exception, and it's worth being straight about it. Nodes can't store them yet, so they live in S3-compatible storage and your messages hold links. Export the node and you export the links, not the files. If that storage is Tlon's, those links are what you'd lose — so anyone who cares about keeping their media should point their node at storage they control. That's set on the node itself, not in the app, which has no storage settings screen.

### Owning your username

Your identity is permanently yours. Ownership is proven cryptographically — your node's identity is backed by cryptographic proof, with keys only you hold — not granted by a third-party service that could revoke it.

---
