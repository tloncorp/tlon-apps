# Groups and Talk

Start, host, and cultivate communities with Groups. Own your communications, organize your resources, and share documents. Groups is a decentralized platform that integrates with Talk, Notebook, and Gallery for a full, communal suite of tools.

Send encrypted direct messages to one or many friends with Talk. Talk is a simple chat tool for catching up, getting work done, and everything in between.

- [Learn more about Tlon Corporation →](https://tlon.io/)
- [Learn more about Urbit →](https://urbit.org/)

## Slated for Launch

Groups and Talk are under active development with a full 1.0 release date in sight. We are currently working on:

- Mobile-responsive layout and interaction fixes
- Mute controls for all notification-producing events, by type or in specific instances
- Secret, invite-only groups
- Group templates for new groups
- Emoji reactions
- An as-is port of the S3 uploader in [Groups 1](https://github.com/urbit/urbit/tree/master/pkg/interface)

## Coming Later

- Arrangeable ordering in Notebooks and Gallery
- Blocking users in Talk
- Rich embeds of web2 content
- Content search within channels
- Standalone Notebook, Gallery, and Contacts apps in Landscape
- Remote storage updates
- Group discovery and user onboarding updates

---

## Glossary

_brief_
: a representation of the last thing we've seen, and how many new items since

_cabal_
: contains the metadata for a role

_chat_
: backend term for a group chat

_club_
: backend term for a multi-DM group (distinct from a `chat` and a `dm`)

_cordon_
: represents a group's permissions. `open` allows anyone to enter but
those banned, `shut` requires requesting to join, `afar` is a custom policy
determined by another agent

_curio_
: represents an item in a collection

_dm_
: backend term for a 1:1 message

_flag_
: composite identifier consisting of `ship/group-name` used to key state and in routes

_fleet_
: the map of ships that are part of a group

_gang_
: a group invite

_heap_
: a collection

_sect_
: a term representing a role

_stash_
: all heaps we are a part of

_vessel_
: represents the roles a group member has and their join time
