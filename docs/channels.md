# Channels
## Agents
These agents keep track of chats, notebooks, and galleries. They don't handle group membership (that's %groups) or DMs (that's %chat)

```
::        --action-->     --command-->
::    client       subscriber       publisher
::      <--response--     <--update--
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

[briefs](#briefs)
#### /init
```hoon
=c -build-file /=groups=/sur/channel/hoon
.^([briefs:c rr-shelf:c] %gx /=channels=/init/noun)
```

Combination of `/shelf` and `/briefs`. Returns `[briefs rr-shelf]`

[briefs](#briefs) \| [rr-shelf](#rr-shelf)
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

This is done with %groups instead of channel, but it's necessary for testing. 

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
#### /said/[han]/[ship]/[name]/note/[time]/[quip]
(This is effectively /[nest]/note/[time]/[quip])

Read a reference. Facts are either of the `%channel-denied` mark (meaning you cannot view the channel) or of the `%channel-said` mark and the `said` type

[nest](#nest) \| [said](#said)
## Types
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
