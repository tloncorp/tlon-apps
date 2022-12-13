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

## Learn more about Landscape, Tlon, and Urbit

- [Learn more about Landscape →](https://tlon.io/product)
- [Learn more about Urbit →](https://urbit.org)
- [Learn more about Tlon →](https://tlon.io)

---

## Developer documentation

This project uses the [formal comment spec](https://developers.urbit.org/reference/hoon/style#comments-and-unparsed-bytes)
for all Hoon code to ensure compatibility with
[doccords](https://github.com/urbit/urbit/pull/5873) once support is released. 

Additionally, detailed documentation is available in the [Docs Landscape
app](https://urbit.org/applications/~pocwet/docs) if you have both Docs and
Groups installed on a running Urbit ship. 

Visit this repository's wiki for [an overview of how to use Landscape and
its apps](https://github.com/tloncorp/landscape-apps/wiki).

## Integrating with Groups agents

The `%groups` desk provides several simple agents with discrete concerns. This
list may expand over time, but new agents are unlikely for the time being.

- `%groups` - The organizational substrate for constructing, joining, finding,
  and managing groups (different than the in-group activity of chatting,
  writing, or collecting)
- `%chat` - 1:1 and multi-DM capabilities for Talk and Chat channels in Groups
- `%diary` - Notebook channels in Groups
- `%heap` - Gallery channels in Groups
- `%hark` - Notifications within Groups and Talk, and a general notification bus
  for Landscape, which will eventually be moved to Landscape proper
- `%notify` - Hooks for iOS push notifications

All actions are performed with 
[pokes](https://developers.urbit.org/reference/glossary/poke). 
See the on-ship developer documentation for more details.

## Use of current-day Landscape agents

At the moment, Groups and Talk both make use of `%settings-store`, `%s3-store`,
and `%contact-store` agents in the `%landscape` desk (the historical name for
the Groups 1 app). We will eventually distribute these as part of the base
`%garden` desk (the system launcher UI we now call Landscape). Finally, we will
rename `%garden` to `%landscape`, reducing confusion everywhere.

We have plans to replace `%contact-store`with a Groups agent (and standalone
contact + identity management app) on the tails of Tlon core devs’ [subscription
reform
efforts](https://gist.github.com/belisarius222/15bcf267689f1dd95e12005bd944608e).
Nothing is changing in the short-term, but if your app uses this store, you may
want to stay subscribed to our announcements in the [urbit-dev mailing
list](https://groups.google.com/a/urbit.org/g/dev).
