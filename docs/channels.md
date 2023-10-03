# Channels
## Table of Contents
 - [Agents](#agents)
 - [Using Channels](#using-channels)
   - [Scries](#scries)
     - [/channels](#channels)
     - [/unreads](#unreads)
     - [/init](#init)
   - [Pokes](#pokes)
     - [%channel-action](#channel-action)
       - [%create](#create)
       - [%channel](#channel)
         - [%join](#join)
         - [%leave](#leave)
         - [%read](#read)
         - [%read-at](#read-at)
         - [%watch](#watch)
         - [%unwatch](#unwatch)
         - [Commands](#commands)
           - [%post](#post-add)
             - [%add](#post-add)
             - [%edit](#post-edit)
             - [%del](#post-del)
             - [%add-react](#post-add-react)
             - [%del-react](#post-del-react)
             - [%reply](#post-reply-add)
               - [%add](#post-reply-add)
               - [%del](#post-reply-del)
               - [%add-react](#post-reply-add-react)
               - [%del-react](#post-reply-del-react)
           - [%view](#view)
           - [%sort](#sort)
           - [%set-order](#set-order)
           - [%add-writers](#add-writers)
           - [%del-writers](#del-writers)
     - [%channel-migration](#channel-migration)
 - [Create a Group](#create-a-group)
   - [Subscriptions](#Subscriptions)
     - [/unreads](#unreads-1)
     - [/](#)
     - [/\[kind\]/\[ship\]/\[name\]](#kindshipname)
     - [/said/\[kind\]/\[ship\]/\[name\]/post/\[time\]/\[(unit reply)\]](#saidkindshipnameposttimeunit-reply)
 - [Types](#types)

## Agents
These agents keep track of chats, notebooks, and galleries. They don't handle group membership (that's `%groups`) or DMs (that's `%chat`)

```
    --action-->     --command-->
client       subscriber       publisher
  <--response--     <--update--
```

### %channels
This agent is responsible for the channels that a ship is in. It's the "subscriber" in the above diagram.

### %channels-server
This is an internal agent that handles channel publishing. A third-party or the groups frontend wouldn't interact with this agent directly, only indirectly through %channels. It's the "publisher" in the above diagram.

## Using %channels
Code examples here are dojo commands.

### Scries
#### /channels
```hoon
=c -build-file /=groups=/sur/channel/hoon
.^(channels:c %gx /=channels=/channels/channel-channels)
```

Get the channels our ship is in and their contents. Returns `channels`

[channels](#channels-1)
#### /unreads
```hoon
=c -build-file /=groups=/sur/channel/hoon
.^(unreads:c %gx /=channels=/unreads/channel-unreads)
```

Get unread information for the channels our ship is in. Returns `unreads`

[unreads](#unreads-2)
#### /init
```hoon
=c -build-file /=groups=/sur/channel/hoon
.^([unreads:c channels:c] %gx /=channels=/init/noun)
```

Combination of `/channels` and `/unreads`. Returns `[unreads channels]`

[unreads](#unreads-2) \| [channels](#channels-1)
### Pokes
#### %channel-action

Takes an [a-channels](#a-channels), which can be one of several actions. Each action is covered below.

##### %create
```hoon
=c -build-file /=groups=/sur/channel/hoon
=g -build-file /=groups=/sur/groups/hoon

=create-channel :*
  %chat
  %mychat
  [our %mygroup]
  title='My chat channel'
  description='Chat about things'
  readers=~
  writers=~
==

:channels &channel-action [%create create-channel]
```

Create a channel. This also updates the metadata in the %groups agent.

[create-channel](#create-channel)

##### %channel
[nest](#nest)

###### %join
```hoon
=nest [%chat ~palnet-sampel %mychat]
=action [%join group=[~sampel-palnet %mygroup]]

:channels &channel-action [%channel nest action]
```

Join a channel. In this example, ~sampel-palnet is the group host and ~palnet-sampel is the channel host.
###### %leave
```hoon
=nest [%chat ~palnet-sampel %mychat]
=action [%leave ~]

:channels &channel-action [%channel nest action]
```

Leave a channel
###### %read
```hoon
=nest [%chat our %mychat]
=action [%read ~]

:channels &channel-action [%channel nest action]
```

Mark a channel as read.
###### %read-at
```hoon
=nest [%chat our %mychat]
=action [%read-at now]

:channels &channel-action [%channel nest action]
```

Mark a channel as read up to a certain time.
###### %watch
```hoon
=nest [%chat our %mychat]
=action [%watch ~]

:channels &channel-action [%channel nest action]
```

Watch a channel for unreads.
###### %unwatch
```hoon
=nest [%chat our %mychat]
=action [%unwatch ~]

:channels &channel-action [%channel nest action]
```

Stop watching a channel for unreads.

##### Commands
The following pokes are commands. 

###### %post %add
```hoon
=nest [%chat our %mychat]
=memo :*
  ~[[%inline ~['hello world!']]]
  author=our
  sent=now
==
=kind-data [%chat ~]
=essay [memo kind-data]
=post-action [%add essay]
=action [%post post-action]

:channels &channel-action [%channel nest action]
```

Add a post to a channel

[essay](#essay)
###### %post %edit
```hoon
=nest [%chat our %mychat]
=memo :*
  ~[[%inline ~['howdy world!']]]
  author=our
  sent=now
==
=kind-data [%chat ~]
=essay [memo kind-data]
=post-action [%edit ~2023.1.1 essay]
=action [%post post-action]

:channels &channel-action [%channel nest action]
```

Edit a post in a channel

[essay](#essay) \| [id-post](#id-post)
###### %post %del
```hoon
=nest [%chat our %mychat]
=post-action [%del ~2023.1.1]
=action [%post post-action]

:channels &channel-action [%channel nest action]
```

Delete a post

[id-post](#id-post)
###### %post %add-react
```hoon
=nest [%chat our %mychat]
=post-action [%add-react ~2023.1.1 our %':grinning:']
=action [%post post-action]

:channels &channel-action [%channel nest action]
```

Add a reaction to a post

[react](#react)
###### %post %del-react
```hoon
=nest [%chat our %mychat]
=post-action [%del-react ~2023.1.1 our]
=action [%post post-action]

:channels &channel-action [%channel nest action]
```

Remove a reaction from a post

[react](#react)
###### %post %reply %add
```hoon
=nest [%chat our %mychat]
=memo :*
  ~[[%inline ~['howdy world!']]]
  author=our
  sent=now
==
=reply-action [%add memo]
=post-action [%reply ~2023.1.1 reply-action]
=action [%post post-action]
:channels &channel-action [%channel nest action]
```

Add a reply to a post

[id-post](#id-post) \| [post](#post)
###### %post %reply %del
```hoon
=nest [%chat our %mychat]
=reply-action [%del ~2023.2.2]
=post-action [%reply ~2023.1.1 reply-action]
=action [%post post-action]
:channels &channel-action [%channel nest action]
```

Delete a reply from a post

[id-post](#id-post) \| [id-reply](#id-reply)
###### %post %reply %add-react
```hoon
=nest [%chat our %mychat]
=reply-action [%add-react ~2023.2.2 our %':grinning:']
=post-action [%reply ~2023.1.1 reply-action]
=action [%post post-action]
:channels &channel-action [%channel nest action]
```

Add a reaction to a reply

[id-post](#id-post) \| [id-reply](#id-reply) \| [react](#react)
###### %post %reply %del-react
```hoon
=nest [%chat our %mychat]
=reply-action [%del-react ~2023.2.2 our]
=post-action [%reply ~2023.1.1 reply-action]
=action [%post post-action]
:channels &channel-action [%channel nest action]
```

Delete a reaction from a reply

[id-post](#id-post) | [id-reply](#id-reply)
###### %view
```hoon
=nest [%chat our %mychat]
=action [%view %grid]
:channels &channel-action [%channel nest action]
```

Set the display format for a channel

[view](#view-1)
###### %sort
```hoon
=nest [%chat our %mychat]
=action [%sort %alpha]
:channels &channel-action [%channel nest action]
```

Set the sorting mechanism for a channel

[sort](#sort-1)
###### %set-order
```hoon
=nest [%chat our %mychat]
=action [%set-order `~[~2023.1.1 ~2023.2.2]]
:channels &channel-action [%channel nest action]
```

Set manual post ordering for a channel

[arranged-posts](#arranged-posts)
###### %add-writers
```hoon
=nest [%chat our %mychat]
=action [%add-writers (sy ~[%role1 %role2])]
:channels &channel-action [%channel nest action]
```

Enable writing to a channel for a certain set of roles

[sect:groups](#sectgroups)

###### %del-writers
```hoon
=nest [%chat our %mychat]
=action [%del-writers (sy ~[%role1 %role2])]

:channels &channel-action [channel nest action]
```

Disable writing to a diary for a certain set of roles

[sect:groups](#sectgroups)

#### %channel-migration
Used internally to handle migrating from the previous version's state

#### Create a Group
```hoon
=g -build-file /=groups=/sur/groups/hoon

=create :*
  name=%mygroup
  title='My group'
  description='This is my group'
  image=''
  cover=''
  cordon=`cordon:g`[%open ban=[ships=~ ranks=~]]
  members=`(jug ship sect:g)`(~(put ju *(jug ship sect:g)) our %admin)
  secret=%.n
  ==

:groups &group-create create
```

This is done with `%groups` instead of `%channels`, but it's included here since it's necessary for testing.
### Subscriptions
#### /unreads
Subscribe to unread & preview information. Each fact is a `[channels unreads]`

[channels](#channels) \| [unreads](#unreads)
#### /
"Firehose" subscription path. Each fact is an `r-channels` (response channels)

[r-channels](#r-channels)
#### /[kind]/[ship]/[name]
(This is effectively /[nest])

Similar to `/`, but only include updates for a particular channels. Each fact is a `r-channels` (response channels)

[nest](#nest) \| [r-channels](#r-channels)
#### /said/[kind]/[ship]/[name]/post/[time]/[(unit reply)]
(This is effectively /said/[nest]/post/[time]/[(unit reply)])

Read a reference. Facts are either of the `%channel-denied` mark (meaning you cannot view the channel) or of the `%channel-said` mark and the `said` type

[nest](#nest) \| [said](#said)
## Types
### said
```hoon
+$  said  (pair nest note)
```

A nest and a note (post with no revision numbers). Used for references

[nest](#nest) \| [note](#note)
### essay
```hoon
+$  essay  [memo =kind-data]
```

Top-level post with metadata

[memo](#memo) \| [kind-data](#kind-data)
### memo
```hoon
+$  memo
  $:  content=story
      author=ship
      sent=time
  ==
```

A post itself

[story](#story)
### story
```hoon
+$  story  (list verse)
```

The body of a post

[verse](#verse)
### verse
```hoon
+$  verse
  $%  [%block p=block]
      [%inline p=(list inline)]
  ==
```

Chunk of post content. Blocks stand on their own, while inlines come in groups and are wrapped in a paragraph.

[block](#block) \| [inline](#inline)
### block
```hoon
+$  block  $+  channel-block
  $%  [%image src=cord height=@ud width=@ud alt=cord]
      [%cite =cite:c]
      [%header p=?(%h1 %h2 %h3 %h4 %h5 %h6) q=(list inline)]
      [%listing p=listing]
      [%rule ~]
      [%code code=cord lang=cord]
  ==
```

Standalone chunk of post content

`%image`: a visual, we record dimensions for better rendering
`%cite`: an Urbit reference
`%header`: a traditional HTML heading, h1-h6
`%listing`: a traditional HTML list, ul and ol
`%code`: a block of code

[listing](#listing)
### listing
```hoon
+$  listing
  $%  [%list p=?(%ordered %unordered %tasklist) q=(list listing) r=(list inline)]
      [%item p=(list inline)]
  ==
```

HTML-style list. Recursively nesting

[inline](#inline)
### inline
```hoon
+$  inline  $+  channel-inline
  $@  @t
  $%  [%italics p=(list inline)]
      [%bold p=(list inline)]
      [%strike p=(list inline)]
      [%blockquote p=(list inline)]
      [%inline-code p=cord]
      [%code p=cord]
      [%ship p=ship]
      [%block p=@ud q=cord]
      [%tag p=cord]
      [%link p=cord q=cord]
      [%task p=?(%.y %.n) q=(list inline)]
      [%break ~]
  ==
```

Chunk of post content that can live inside of a paragraph

`@t`: plain text
`%italics`: italic text
`%bold`: bold text
`%strike`: strikethrough text
`%inline-code`: code formatting for small snippets
`%blockquote`: blockquote surrounded content
`%block`: link/reference to blocks
`%code`: code formatting for large snippets
`%tag`: tag gets special signifier
`%link`: link to a URL with a face
`%break`: line break
### kind-data
```hoon
+$  kind-data
  $%  [%diary title=@t image=@t]
      [%heap title=(unit @t)]
      [%chat kind=$@(~ [%notice ~])]
  ==
```

Post metadata that varies by channel type
### id-post
```hoon
+$  id-post   time
```

Posts are uniquely identified and indexed by the time they're received by the channel host.
### id-reply
```hoon
+$  id-reply   time
```

Like posts, replies (comments) are uniquely identified and indexed by the time they're received by the channel host.
### react
```hoon
+$  react  @ta
```

Reaction, in the form of a text description of an emoji like `':grinning:'`
### view
```hoon
+$  view  $~(%list ?(%grid %list))
```

The persisted display format for a channel
### sort
```hoon
+$  sort  $~(%time ?(%alpha %time %arranged))
```

The persisted sort format for a channel
### arranged-posts
```hoon
+$  arranged-posts  (unit (list time))
```

Manually arranged posts. If null, use ordinary sorting.
### unreads
```hoon
+$  unreads  (map nest unread)
```

Unread info for channels. Map of [nest](#nest) to [unread](#unread)

### unread
```hoon
+$  unread   [last=time count=@ud read-id=(unit time)]
```

Unread info for a channel. 

`last`: last read time
`count`: number of unread messages
`read-id`: ID of last read message
### r-channels
```hoon
+$  r-channels  [=nest =r-channel]
```
Response (subscriber to client communication) for a channels

[nest](#nest) \| [r-channel](#r-channel)
### r-channel
```hoon
+$  r-channel
  $%  [%posts =posts]
      [%post id=id-post =r-post]
      [%set-order order=arranged-posts]
      [%view =view]
      [%sort =sort]
      [%perm =perm]
    ::
      [%create =perm]
      [%join group=flag:g]
      [%leave ~]
    ::
      [%read ~]
      [%read-at =time]
      [%watch ~]
      [%unwatch ~]
  ==
```

Response (subscriber to client communication) for a channel.
### posts
```hoon
+$  posts  ((mop id-post (unit post)) lte)
```

Posts indexed by time.

[id-post](#id-post) \| [note](#note)
### post
```hoon
+$  post   [reply-seal essay]
```

An individual post.

[reply-seal](#reply-seal) \| [essay](#essay)
### reply-seal
```hoon
+$  reply-seal
  $:  id=id-post
      =reacts
      =replies
      =reply-meta
  ==
+$  reacts  (map ship react)
+$  reply   [reply-seal memo]
+$  replies  ((mop id-reply reply) lte)
+$  reply-seal   [id=id-reply =reacts]
```

Metadata for a post.

[id-reply](#id-reply) \| [memo](#memo) \| [reply-meta](#reply-meta)
### reply-meta
```hoon
+$  reply-meta
  $:  reply-count=@ud
      last-repliers=(set ship)
      last-reply=(unit time)
  ==
```

Metadata for replies.
### create-channel
```hoon
+$  create-channel
  $:  =kind
      name=term
      group=flag:g
      title=cord
      description=cord
      readers=(set sect:g)
      writers=(set sect:g)
  ==
```

Action for creating channels. 

[kind](#kind) | [flag:groups](#flaggroups) | [sect:groups](#sectgroups)
### sect:groups
```hoon
+$  sect  term
```

Groups role.
### flag:groups
```hoon
+$  flag  (pair ship term)
```

Unique identifier for a group.
### r-channels
```hoon
+$  r-channels  (map nest r-channel)
```
Response (subscriber to client communication) for channels.

### r-channel
```hoon
+$  r-channel
  $%  [%posts =kind-data-posts]
      [%post id=id-post =r-post]
      [%set-order order=pin-channel-posts]
      [%view =view]
      [%sort =sort]
      [%perm =perm]
    ::
      [%create =perm]
      [%join group=flag:g]
      [%leave ~]
    ::
      [%read ~]
      [%read-at =time]
      [%watch ~]
      [%unwatch ~]
  ==
```

Response (subscriber to client communication) for a channel.

### channels
```hoon
+$  channels  (map nest channel)
```

A map of [nest](#nest) to [channel](#channel)

### channel
```hoon
++  channel
  |^  ,[global local]
  +$  global
    $:  posts=posts
        order=arranged-posts
        =view
        =sort
        =perm
    ==
  ::
  +$  local
    $:  =net
        =remark
    ==
  --
```

Posts and view/sort/order info for a channel

[posts](#posts) \| [arranged-posts](#arranged-posts) \| [view](#view) \| [sort](#sort) \| [perm](#perm)

### perm
```hoon
+$  perm
  $:  writers=(set sect:g)
      group=flag:g
  ==
```

Permissions for a channel

[sect:groups](#sectgroups) \| [flag:groups](#flaggroups)
### v-channel
Internal representation of a channel. Contains syncing information and revision numbers.

[channel](#channel)

### nest
```hoon
+$  nest  [=kind =ship name=term]
```

Uniquely identifies a channel.

[kind](#kind)

### kind
```hoon
+$  kind  ?(%notebook %gallery %chat)
```

Channel type.
