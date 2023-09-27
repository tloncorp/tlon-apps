# Channels
## Table of Contents
 - [Agents](#agents)
 - [Using Channels](#using-channels)
   - [Scries](#scries)
     - [/shelf](#shelf)
     - [/briefs](#briefs)
     - [/init](#init)
   - [Pokes](#pokes)
     - [Create a Group](#create-a-group)
     - [%channel-action](#channel-action)
       - [%create](#create)
       - [%diary](#diary)
         - [%join](#join)
         - [%leave](#leave)
         - [%read](#read)
         - [%read-at](#read-at)
         - [%watch](#watch)
         - [%unwatch](#unwatch)
         - [%note](#note-add)
           - [%add](#note-add)
           - [%edit](#note-edit)
           - [%del](#note-del)
           - [%add-feel](#note-add-feel)
           - [%del-feel](#note-del-feel)
           - [%quip](#note-quip-add)
             - [%add](#note-quip-add)
             - [%del](#note-quip-del)
             - [%add-feel](#note-quip-add-feel)
             - [%del-feel](#note-quip-del-feel)
         - [%view](#view)
         - [%sort](#sort)
         - [%order](#order)
         - [%add-writers](#add-writers)
         - [%del-writers](#del-writers)
     - [%channel-migration](#channel-migration)
   - [Subscriptions](#Subscriptions)
     - [/briefs](#briefs-1)
     - [/ui](#ui)
     - [/\[han\]/\[ship\]/\[name\]/ui](#hanshipnameui)
     - [/said/\[han\]/\[ship\]/\[name\]/note/\[time\]/\[(unit quip)\]](#saidhanshipnamenotetimeunit-quip)
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
#### /shelf
```hoon
=c -build-file /=groups=/sur/channel/hoon
.^(rr-shelf:c %gx /=channels=/shelf/channel-shelf)
```

Get the channels our ship is in and their contents. Returns `rr-shelf`

[rr-shelf](#rr-shelf)
#### /briefs
```hoon
=c -build-file /=groups=/sur/channel/hoon
.^(briefs:c %gx /=channels=/briefs/channel-briefs)
```

Get unread information for the channels our ship is in. Returns `briefs`

[briefs](#briefs-2)
#### /init
```hoon
=c -build-file /=groups=/sur/channel/hoon
.^([briefs:c rr-shelf:c] %gx /=channels=/init/noun)
```

Combination of `/shelf` and `/briefs`. Returns `[briefs rr-shelf]`

[briefs](#briefs-2) \| [rr-shelf](#rr-shelf)
### Pokes
#### Create a group
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

This is done with `%groups` instead of `%channels`, but it's necessary for testing. 

#### %channel-action

Takes an [a-shelf](#a-shelf), which can be one of several actions. Each action is covered below

##### %create
```hoon
=c -build-file /=groups=/sur/channel/hoon
=g -build-file /=groups=/sur/groups/hoon

=create-diary :*
  %chat
  %mychat
  [our %mygroup]
  title='My chat channel'
  description='Chat about things'
  readers=~
  writers=~
==

:channels &channel-action [%create create-diary]
```

[create-diary](#create-diary). 

##### %diary
[nest](#nest)

###### %join
```hoon
=nest [%chat ~palnet-sampel %mychat]
=action [%join group=[~sampel-palnet %mygroup]]

:channels &channel-action [%diary nest action]
```

Join a channel. In this example, ~sampel-palnet is the group host and ~palnet-sampel is the channel host.
###### %leave
```hoon
=nest [%chat ~palnet-sampel %mychat]
=action [%leave ~]

:channels &channel-action [%diary nest action]
```

Leave a channel
###### %read
```hoon
=nest [%chat our %mychat]
=action [%read ~]

:channels &channel-action [%diary nest action]
```

Mark a channel as read.
###### %read-at
```hoon
=nest [%chat our %mychat]
=action [%read-at now]

:channels &channel-action [%diary nest action]
```

Mark a channel as read up to a certain time.
###### %watch
```hoon
=nest [%chat our %mychat]
=action [%watch ~]

:channels &channel-action [%diary nest action]
```

Watch a channel for unreads.
###### %unwatch
```hoon
=nest [%chat our %mychat]
=action [%unwatch ~]

:channels &channel-action [%diary nest action]
```

Stop watching a channel for unreads.
###### %note %add
```hoon
=nest [%chat our %mychat]
=memo :*
  ~[[%inline ~['hello world!']]]
  author=our
  sent=now
==
=han-data [%chat ~]
=essay [memo han-data]
=note-action [%add essay]
=action [%note note-action]

:channels &channel-action [%diary nest action]
```

Add a note to a channel

[essay](#essay)
###### %note %edit
```hoon
=nest [%chat our %mychat]
=memo :*
  ~[[%inline ~['howdy world!']]]
  author=our
  sent=now
==
=han-data [%chat ~]
=essay [memo han-data]
=note-action [%edit ~2023.1.1 essay]
=action [%note note-action]

:channels &channel-action [%diary nest action]
```

Edit a note in a channel

[essay](#essay) \| [id-note](#id-note)
###### %note %del
```hoon
=nest [%chat our %mychat]
=note-action [%del ~2023.1.1]
=action [%note note-action]

:channels &channel-action [%diary nest action]
```

Delete a note

[id-note](#id-note)
###### %note %add-feel
```hoon
=nest [%chat our %mychat]
=note-action [%add-feel ~2023.1.1 our %':grinning:']
=action [%note note-action]

:channels &channel-action [%diary nest action]
```

Add a reaction to a note

[feel](#feel)
###### %note %del-feel
```hoon
=nest [%chat our %mychat]
=note-action [%del-feel ~2023.1.1 our]
=action [%note note-action]

:channels &channel-action [%diary nest action]
```

Remove a reaction from a note

[feel](#feel)
###### %note %quip %add
```hoon
=nest [%chat our %mychat]
=memo :*
  ~[[%inline ~['howdy world!']]]
  author=our
  sent=now
==
=quip-action [%add memo]
=note-action [%quip ~2023.1.1 quip-action]
=action [%note note-action]

:channels &channel-action [%diary nest action]
```

Add a comment to a note

[id-note](#id-note) \| [memo](#memo)
###### %note %quip %del
```hoon
=nest [%chat our %mychat]
=quip-action [%del ~2023.2.2]
=note-action [%quip ~2023.1.1 quip-action]
=action [%note note-action]

:channels &channel-action [%diary nest action]
```

Delete a comment from a note

[id-note](#id-note) \| [id-quip](#id-quip)
###### %note %quip %add-feel
```hoon
=nest [%chat our %mychat]
=quip-action [%add-feel ~2023.2.2 our %':grinning:']
=note-action [%quip ~2023.1.1 quip-action]
=action [%note note-action]

:channels &channel-action [%diary nest action]
```


Add a reaction to a comment

[id-note](#id-note) \| [id-quip](#id-quip) \| [feel](#feel)
###### %note %quip %del-feel
```hoon
=nest [%chat our %mychat]
=quip-action [%del-feel ~2023.2.2 our]
=note-action [%quip ~2023.1.1 quip-action]
=action [%note note-action]

:channels &channel-action [%diary nest action]
```

Delete a reaction from a comment

[id-note](#id-note) | [id-quip](#id-quip)
###### %view
```hoon
=nest [%chat our %mychat]
=action [%view %grid]

:channels &channel-action [%diary nest action]
```

Set the display format for a diary

[view](#view)
###### %sort
```hoon
=nest [%chat our %mychat]
=action [%sort %alpha]

:channels &channel-action [%diary nest action]
```

Set the sorting mechanism for a diary

[sort](#sort)
###### %order
```hoon
=nest [%chat our %mychat]
=action [%order `~[~2023.1.1 ~2023.2.2]]

:channels &channel-action [%diary nest action]
```

Set manual note ordering for a diary

[arranged-notes](#arranged-notes)
###### %add-writers
```hoon
=nest [%chat our %mychat]
=action [%add-writers (sy ~[%role1 %role2])]

:channels &channel-action [%diary nest action]
```


Enable writing to a diary for a certain set of roles

[sect:groups](#sectgroups)
###### %del-writers
```hoon
=nest [%chat our %mychat]
=action [%del-writers (sy ~[%role1 %role2])]

:channels &channel-action [%diary nest action]
```

Disable writing to a diary for a certain set of roles

[sect:groups](#sectgroups)
#### %channel-migration

Used internally to handle migrating from the previous version's state

### Subscriptions
#### /briefs
Subscribe to unread & preview information. Each fact is a `[nest brief]`

[nest](#nest) \| [brief](#brief)
#### /ui
"Firehose" subscription path. Each fact is an `r-shelf` (response shelf)

[r-shelf](#r-shelf)
#### /[han]/[ship]/[name]/ui
(This is effectively /[nest]/ui)

Similar to `/ui`, but only include updates for a particular nest. Each fact is an `r-shelf` (response shelf)

[nest](#nest) \| [r-shelf](#r-shelf)
#### /said/[han]/[ship]/[name]/note/[time]/[(unit quip)]
(This is effectively /[nest]/note/[time]/[(unit quip)])

Read a reference. Facts are either of the `%channel-denied` mark (meaning you cannot view the channel) or of the `%channel-said` mark and the `said` type

[nest](#nest) \| [said](#said)
## Types
### essay
```hoon
+$  essay  [memo =han-data]
```

Top-level post with metadata

[memo](#memo) \| [han-data](#han-data)
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

Chunk of post content. Blocks stand on their own, while inlines come and groups and are wrapped in a paragraph.

[block](#block) \| [inline](#inline)
### block
```hoon
+$  block  $+  diary-block
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
+$  inline  $+  diary-inline
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
### han-data
```hoon
+$  han-data
  $%  [%diary title=@t image=@t]
      [%heap title=(unit @t)]
      [%chat kind=$@(~ [%notice ~])]
  ==
```

Post metadata that varies by channel type
### id-note
```hoon
+$  id-note   time
```

Notes are uniquely identified and indexed by the time they're received by the channel host.
### id-quip
```hoon
+$  id-quip   time
```

Like notes, quips (comments) are uniquely identified and indexed by the time they're received by the channel host.
### feel
```hoon
+$  feel  @ta
```

Reaction, in the form of a text description of an emoji like ':grinning:'
### view
```hoon
+$  view  $~(%list ?(%grid %list))
```

The persisted display format for a diary
### sort
```hoon
+$  sort  $~(%time ?(%alpha %time %arranged))
```

The persisted sort format for a diary
### arranged-notes
```hoon
+$  arranged-notes  (unit (list time))
```

Manually arranged notes. If null, use ordinary sorting.
### briefs
```hoon
+$  briefs  (map nest brief)
```

Unread info for channels. Map of [nest](#nest) to [brief](#brief)

### brief
```hoon
+$  brief   [last=time count=@ud read-id=(unit time)]
```

Unread info for a channel. 

`last`: last read time
`count`: number of unread messages
`read-id`: ID of last read message
### r-shelf
```hoon
+$  r-shelf  [=nest =r-diary]
```
Response (subscriber to client communication) for a shelf

[nest](#nest) \| [r-diary](#r-diary)
### r-diary
```hoon
+$  r-diary
  $%  [%notes =rr-notes]
      [%note id=id-note =r-note]
      [%order order=arranged-notes]
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

Response (subscriber to client communication) for a diary.
### rr-notes
```hoon
+$  rr-notes  ((mop id-note (unit rr-note)) lte)
```

Notes without revision numbers
### create-diary
```hoon
+$  create-diary
  $:  =han
      name=term
      group=flag:g
      title=cord
      description=cord
      readers=(set sect:g)
      writers=(set sect:g)
  ==
```

Action for creating diaries. 

[han](#han) | [flag:groups](#flaggroups) | [sect:groups](#sectgroups)
### sect:groups
```hoon
::
::  $sect: ID for cabal, similar to a role
::
+$  sect  term
```

### rr-shelf
```hoon
+$  rr-shelf  (map nest rr-diary)
```

A [shelf](#shelf) with no revision numbers

### rr-diary
A [diary](#diary) with no revision numbers.

### shelf
```hoon
+$  shelf  (map nest diary)
```

A map of [nest](#nest) to [diary](#diary)

### diary
The messages/notes/links in a channel. Contains a [global:diary](#globaldiary), a [local:diary](#localdiary), and some internal syncing information.

### global:diary
```hoon
+$  global
    $:  =notes
        order=(rev order=arranged-notes)
        view=(rev =view)
        sort=(rev =sort)
        perm=(rev =perm)
    ==
```

The parts of a diary that are synced. 

[notes](#notes) | [order](#order) | [view](#view) | [sort](#sort) | [perm](#perm)

### local:diary
```hoon
+$  local
    $:  =net
        =log
        =remark
        =window
        =future
    ==
  --
```

The parts of a diary that are not synced. 

[net](#net) | [log](#log) | [remark](#remark) | [window](#window) | [future](#future)

### nest
```hoon
+$  nest  [=han =ship name=term]
```

Uniquely identifies a channel.

[han](#han)

### han
```hoon
+$  han  ?(%diary %heap %chat)
```

Channel type. A diary is a notebook, a heap is a link collection, and a chat is a chat.
