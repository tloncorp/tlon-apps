# Channels

## Agents

These agents keep track of chats, notebooks, and galleries. They don't handle group membership (that's %groups) or DMs (a new agent under active work, name TBD)

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

### Scries

#### /shelf

```hoon
=c -build-file /=groups=/sur/channel/hoon
.^(rr-shelf:c %gx /=channels=/shelf/channel-shelf)
```

Get all the channels we know about. Returns an [rr-shelf](#user-content-rr-shelf)

## Types

### rr-shelf
```hoon
+$  rr-shelf  (map nest rr-diary)
```

A [shelf](#user-content-shelf) with no revision numbers

### rr-diary

A [diary](#user-content-diary) with no revision numbers.

### shelf
```hoon
+$  shelf  (map nest diary)
```

A map of [nest](#user-content-nest) to [diary](#user-content-diary)

### diary
The messages/notes/links in a channel. Contains a [global:diary](#user-content-globaldiary), a [local:diary](#user-content-localdiary), and some internal syncing information.

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

The parts of a diary that are synced. Contains [notes](#user-content-notes), [order](#user-content-order), [view](#user-content-view), [sort](#user-content-sort), and [perm](#user-content-perm)

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

The parts of a diary that are not synced. Contains [net](#user-content-net), [log](#user-content-log), [remark](#user-content-remark), [window](#user-content-window) and [future](#user-content-future)

### nest
```hoon
+$  nest  [=han =ship name=term]
```

A [han](#user-content-han), ship and term (name). Uniquely identifies a channel.

### han
```hoon
+$  han  ?(%diary %heap %chat)
```

Channel type. A diary is a notebook, a heap is a link collection, and a chat is a chat.
