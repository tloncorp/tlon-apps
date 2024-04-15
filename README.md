# Landscape apps

## Groups

Start, host, and cultivate communities. Own your communications, organize your
resources, and share documents. Groups is a decentralized platform that
integrates with Talk, Notebook, and Gallery for a full, communal suite of tools.

## Talk

Send encrypted direct messages to one or many friends. Talk is a simple chat
tool for catching up, getting work done, and everything in between.

## Notebook

Notebook is a standard short and long form text editor. Within Groups, you can
use Notebook to write, edit, and publish text.

## Gallery

Gallery is a versatile repository for collective knowledge and references you
want to share or remember. Within Groups, you can use Gallery to collect links,
images, media, and even random musings.

---

## Developer documentation

This project uses the [formal comment spec](https://developers.urbit.org/reference/hoon/style#comments-and-unparsed-bytes)
for all Hoon code to ensure compatibility with
[doccords](https://github.com/urbit/urbit/pull/5873).

Additionally, detailed documentation is available in the [Docs Landscape
app](https://urbit.org/applications/~pocwet/docs) if you have both Docs and
Groups installed on a running Urbit ship.

Visit this repository's wiki for [an overview of how to use Landscape and
its apps](https://github.com/tloncorp/tlon-apps/wiki).

## Integrating with Groups agents

The `%groups` desk provides several simple agents with discrete concerns. This list may expand over time.

- `%groups` - The organizational substrate for constructing, joining, finding,
  and managing groups (different than the in-group activity of chatting,
  writing, or collecting)
- `%groups-ui` - Optimized scries for the Groups UI
- `%chat` - 1:1 and multi-DM capabilities for Talk and Chat channels in Groups
- `%diary` - Notebook channels in Groups
- `%heap` - Gallery channels in Groups
- `%notify` - Hooks for iOS push notifications
- `%grouper` - Handler for Lure invitiations

All actions are performed with
[pokes](https://developers.urbit.org/reference/glossary/poke).
See the on-ship developer documentation for more details.

## Use of Landscape agents

At the moment, Groups and Talk make use of `%settings`, `%storage`, `%hark`,
and `%contacts` agents in the `%landscape` desk.
