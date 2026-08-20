::  apps: host for app channels — structured state instead of posts
::
::    an app channel is a group channel whose nest kind is %apps, so
::    %groups routes it through the generic channel-host convention and
::    this agent stores its contents: one opaque JSON document per
::    channel, carrying a revision.
::
::    the three obligations of a channel host (see
::    docs/backend/channel-hosts.md) are the %group-channel-join /
::    %group-channel-leave pokes, the /joined/<host>/<name> scry, and the
::    group-channel-active report back to %groups.
::
::    permissions are the group's, not ours. reads are gated on the
::    group's can-read and writes on its can-write, both scried from our
::    local %groups replica. this agent owns no membership of its own.
::
::    channels are keyed by flag (host ship + name); the nest kind is
::    always %apps, so we rebuild the nest where %groups wants one.
::
/-  a=apps, g=groups
/+  default-agent, verb, dbug, j=apps-json
::
=>
  |%
  +$  card  card:agent:gall
  ::  .pending: joins we have asked the host about but not yet heard
  ::    back on, mapping channel flag to group flag. kept out of .docs so
  ::    a not-yet-synced channel can never be read as an empty document.
  ::
  +$  state-0
    $:  %0
        docs=(map flag:g doc:v1:a)
        pending=(map flag:g flag:g)
    ==
  --
=|  state-0
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init  `this
  ++  on-save  !>(state)
  ++  on-load
    |=  ole=vase
    =.  state  !<(state-0 ole)
    `this
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state  abet:(watch:cor path)
    [cards this]
  ++  on-peek   peek:cor
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state  abet:(agent:cor wire sign)
    [cards this]
  ++  on-leave  on-leave:def
  ++  on-arvo   on-arvo:def
  ++  on-fail   on-fail:def
  --
|_  [=bowl:gall cards=(list card)]
++  cor  .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  give  |=(=gift:agent:gall (emit %give gift))
++  from-self  =(our src):bowl
::  +poke: %apps actions plus the two channel-host pokes
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+  mark  ~|(bad-apps-mark+mark !!)
      %apps-action-1
    =/  =action:v1:a  !<(action:v1:a vase)
    ?-  -.action
        %create  (create +.action)
        %delete  (delete chan.action)
      ::
        %write
      ?.  =(our.bowl p.chan.action)
        ::  not ours to decide. only our own client may ask, and the
        ::  host authorizes the writer for itself. the cast widens the
        ::  vase back to the whole union: the ?- above narrowed it, and
        ::  a poke carrying the narrow face is a nest-fail waiting for
        ::  whoever reads it as $action.
        ?>  from-self
        %-  emit
        :*  %pass  (doc-wire chan.action)
            %agent  [p.chan.action %apps]
            %poke  apps-action-1+!>(`action:v1:a`action)
        ==
      ?~  d=(~(get by docs) chan.action)  ~|(no-such-app+chan.action !!)
      ?>  (can-write src.bowl chan.action u.d)
      (apply-write chan.action u.d [id expected body]:action)
    ==
  ::
  ::  channel-host convention: %groups auto-joins and auto-leaves app
  ::  channels as the group fleet and its permissions change. same-ship
  ::  pokes. a groups nest is [kind flag], so its tail is our key.
  ::
      %group-channel-join
    ?>  from-self
    =+  !<(cj=channel-join:v1:a vase)
    =/  chan=flag:g  [host.nest.cj name.nest.cj]
    ?:  =(our.bowl p.chan)  cor
    ?:  (~(has by docs) chan)  cor
    (start-watch chan group.cj)
  ::
      %group-channel-leave
    ?>  from-self
    =+  !<(cl=channel-leave:v1:a vase)
    =/  chan=flag:g  [host.nest.cl name.nest.cl]
    ?:  =(our.bowl p.chan)  cor
    (stop-watch chan)
  ==
::  +create: mint a document and register the channel with its group
::
++  create
  |=  $:  name=term
          group=flag:g
          title=@t
          description=@t
          readers=(list role-id:g)
          writers=(list role-id:g)
          body=@t
      ==
  ^+  cor
  ?>  from-self
  ?>  ((sane %tas) name)
  =/  chan=flag:g  [our.bowl name]
  ?<  (~(has by docs) chan)
  =/  d=doc:v1:a  [group (silt writers) 0 body ~ now.bowl]
  =.  docs  (~(put by docs) chan d)
  ::  register the listing with %groups, carrying .readers so the
  ::  group's can-read gates this channel. join=& so %groups pokes each
  ::  member's %apps as the fleet grows.
  =/  chn=group-channel:v1:a
    [[title description '' ''] now.bowl %default (silt readers) &]
  =.  cor
    %-  emit
    :*  %pass  /create/[name]
        %agent  [our.bowl %groups]
        %poke
      :-  %group-action-5
      !>(`group-add:v1:a`[%group group %channel (nest-of chan) %add chn])
    ==
  =.  cor  (report-active chan group &)
  (give %fact ~[/v1/updates] apps-update-1+!>(`update:v1:a`[%doc chan d]))
::  +delete: drop the document and its group listing
::
++  delete
  |=  chan=flag:g
  ^+  cor
  ?>  from-self
  ?>  =(our.bowl p.chan)
  ?~  d=(~(get by docs) chan)  cor
  =.  docs  (~(del by docs) chan)
  =.  cor
    %-  emit
    :*  %pass  /delete/[q.chan]
        %agent  [our.bowl %groups]
        %poke
      :-  %group-action-5
      !>(`group-del:v1:a`[%group group.u.d %channel (nest-of chan) %del ~])
    ==
  =.  cor  (report-active chan group.u.d |)
  =.  cor  (give %kick ~[(doc-path chan)] ~)
  (give %fact ~[/v1/updates] apps-update-1+!>(`update:v1:a`[%deleted chan]))
::  +apply-write: the revision and idempotency rules
::
++  apply-write
  |=  [chan=flag:g d=doc:v1:a id=@t expected=(unit @ud) body=@t]
  ^+  cor
  ::  already applied. no state change, no revision bump, and no fact —
  ::  which means a client sitting in optimistic state after a double
  ::  tap receives nothing and must fall back to re-reading the document
  ::  rather than waiting.
  ?:  (lien applied.d |=(i=@t =(i id)))  cor
  ::  a stale .expected loses. nothing changes; the writer is told the
  ::  revision actually stored so it can re-read instead of guessing.
  ?:  ?&(?=(^ expected) !=(u.expected revision.d))
    (tell chan [%conflict chan revision.d])
  ::  a write resolving to the stored body is a no-change: remember the
  ::  id so a retry stays idempotent, but leave the revision alone.
  =.  revision.d  ?:(=(body body.d) revision.d +(revision.d))
  =.  body.d  body
  =/  ids=(list @t)  [id applied.d]
  =.  applied.d  (scag max-applied:a ids)
  =.  updated.d  now.bowl
  =.  docs  (~(put by docs) chan d)
  (tell chan [%doc chan d])
::  +tell: fact to the document's subscribers and to our local stream
::
++  tell
  |=  [chan=flag:g =update:v1:a]
  ^+  cor
  =.  cor  (give %fact ~[(doc-path chan)] apps-update-1+!>(update))
  (give %fact ~[/v1/updates] apps-update-1+!>(update))
::  +start-watch: mirror a channel we do not host
::
++  start-watch
  |=  [chan=flag:g group=flag:g]
  ^+  cor
  ?:  (~(has by wex.bowl) [(doc-wire chan) p.chan %apps])  cor
  =.  pending  (~(put by pending) chan group)
  %-  emit
  :*  %pass  (doc-wire chan)
      %agent  [p.chan %apps]
      %watch  (doc-path chan)
  ==
::  +stop-watch: drop a mirrored channel
::
++  stop-watch
  |=  chan=flag:g
  ^+  cor
  =/  had=(unit doc:v1:a)  (~(get by docs) chan)
  =.  pending  (~(del by pending) chan)
  =.  docs  (~(del by docs) chan)
  =?  cor  ?=(^ had)  (report-active chan group.u.had |)
  =?  cor  (~(has by wex.bowl) [(doc-wire chan) p.chan %apps])
    %-  emit
    :*  %pass  (doc-wire chan)
        %agent  [p.chan %apps]
        %leave  ~
    ==
  (give %fact ~[/v1/updates] apps-update-1+!>(`update:v1:a`[%deleted chan]))
::  +report-active: tell %groups whether this channel is live for us
::
++  report-active
  |=  [chan=flag:g group=flag:g joined=?]
  ^+  cor
  %-  emit
  :*  %pass  /report-active/[q.chan]
      %agent  [our.bowl %groups]
      %poke  group-channel-active+!>([group (nest-of chan) joined])
  ==
::  +watch: local update stream, plus the per-document stream we serve
::    to group members
::
++  watch
  |=  =path
  ^+  cor
  ?+  path  ~|(bad-apps-watch+path !!)
    [%v1 %updates ~]  ?>(from-self cor)
  ::
      [%v1 %doc @ @ ~]
    =/  chan=flag:g  [(slav %p i.t.t.path) i.t.t.t.path]
    ?~  d=(~(get by docs) chan)  ~|(no-such-app+chan !!)
    ::  the gate that makes an app channel private: a ship the group
    ::  will not let read this channel cannot open the stream.
    ?>  (can-read src.bowl chan u.d)
    (give %fact ~ apps-update-1+!>(`update:v1:a`[%doc chan u.d]))
  ==
::  +peek: local reads, plus the channel-host liveness scry
::
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
    ::  channel-host convention: %groups asks whether we hold this
    ::  channel. it guards on our liveness first, so an uninstalled
    ::  %apps reads as not-joined rather than crashing its scry.
      [%u %joined @ @ ~]
    =/  chan=flag:g  [(slav %p i.t.t.path) i.t.t.t.path]
    ``loob+!>((~(has by docs) chan))
  ::
      [%x %v1 %docs ~]
    ``apps-update-1+!>(`update:v1:a`[%docs (readable-docs our.bowl)])
  ::
      [%x %v1 %doc @ @ ~]
    =/  chan=flag:g  [(slav %p i.t.t.t.path) i.t.t.t.t.path]
    ?~  d=(~(get by docs) chan)  [~ ~]
    ::  a mirror we have lost access to reads as absent. the check is at
    ::  access time rather than on a revocation watch, so a stale mirror
    ::  is never served.
    ?.  (can-read our.bowl chan u.d)  [~ ~]
    ``apps-update-1+!>(`update:v1:a`[%doc chan u.d])
  ==
::  +agent: results from the host we mirror, and our own poke-acks
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ?+  wire  cor
      [%doc @ @ ~]
    =/  chan=flag:g  [(slav %p i.t.wire) i.t.t.wire]
    ?-  -.sign
        %poke-ack
      ?~  p.sign  cor
      %-  (slog leaf+"apps: write to {<chan>} refused" u.p.sign)
      cor
    ::
        %watch-ack
      ?~  p.sign  cor
      ::  the host refused the stream — most likely we cannot read it.
      ::  drop the pending join rather than retrying into a closed door.
      =.  pending  (~(del by pending) chan)
      %-  (slog leaf+"apps: watch {<chan>} refused" u.p.sign)
      cor
    ::
        %kick
      ::  the channel is gone, or our access is. either way, stop
      ::  serving it locally.
      (stop-watch chan)
    ::
        %fact
      ?.  ?=(%apps-update-1 p.cage.sign)  cor
      =/  =update:v1:a  !<(update:v1:a q.cage.sign)
      ?-  -.update
          %docs  cor
        ::
          %conflict
        (give %fact ~[/v1/updates] apps-update-1+!>(update))
      ::
          %deleted
        (stop-watch flag.update)
      ::
          %doc
        =/  first=?  (~(has by pending) flag.update)
        =.  pending  (~(del by pending) flag.update)
        =.  docs  (~(put by docs) flag.update doc.update)
        =?  cor  first  (report-active flag.update group.doc.update &)
        (give %fact ~[/v1/updates] apps-update-1+!>(update))
      ==
    ==
  ::
      ?([%create *] [%delete *] [%report-active *])
    ?.  ?=(%poke-ack -.sign)  cor
    ?~  p.sign  cor
    %-  (slog leaf+"apps: {<wire>} failed" u.p.sign)
    cor
  ==
::  +readable-docs: the documents `who` may read
::
++  readable-docs
  |=  who=ship
  ^-  (map flag:g doc:v1:a)
  %-  ~(rep by docs)
  |=  [[chan=flag:g d=doc:v1:a] out=(map flag:g doc:v1:a)]
  ?.  (can-read who chan d)  out
  (~(put by out) chan d)
::  +can-read: does the group let `who` read this channel?
::
::    scries the bulk can-read GATE from our local %groups replica —
::    %gx, not %gu, since %groups only serves %x peeks.
::
::    the short-circuit is for the channel's own host, deliberately NOT
::    for our.bowl: on a ship mirroring someone else's channel, our.bowl
::    is the local reader and must still be checked, or a member whose
::    access was revoked keeps reading its stale mirror.
::
++  can-read
  |=  [who=ship chan=flag:g d=doc:v1:a]
  ^-  ?
  ?:  =(p.chan who)  &
  ::  a group we have not replicated yet cannot answer. treat that as
  ::  transient and allow, so a replication gap is not mistaken for a
  ::  revocation; a real revocation has the group present and can-read
  ::  false.
  ?.  (group-synced group.d)  &
  =/  gpath=path
    %+  welp  (groups-scry group.d)
    /channels/can-read/noun
  =/  test=$-([ship nest:v1:a] ?)  .^($-([ship nest:v1:a] ?) %gx gpath)
  (test who (nest-of chan))
::  +can-write: may `who` write this channel?
::
::    read access plus the channel's writer roles, matching +can-write
::    in /lib/channel-utils: an admin or an empty writer set passes, and
::    otherwise the writer's roles must intersect ours.
::
++  can-write
  |=  [who=ship chan=flag:g d=doc:v1:a]
  ^-  ?
  ?:  =(p.chan who)  &
  ?.  (can-read who chan d)  |
  =/  gpath=path
    %+  welp  (groups-scry group.d)
    /channels/apps/(scot %p p.chan)/[q.chan]/can-write/(scot %p who)/noun
  =+  .^(write=(unit [admin=? roles=(set role-id:g)]) %gx gpath)
  ?~  write  |
  ?:  |(admin.u.write =(~ writers.d))  &
  !=(~ (~(int in writers.d) roles.u.write))
::  +group-synced: is this group present in our local %groups replica?
::
++  group-synced
  |=  group=flag:g
  ^-  ?
  =/  gpath=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
  .^(? %gu gpath)
::  +groups-scry: prefix for a v2 group query on our local replica
::
++  groups-scry
  |=  group=flag:g
  ^-  path
  :-  (scot %p our.bowl)
  /groups/(scot %da now.bowl)/v2/groups/(scot %p p.group)/[q.group]
::  +nest-of: the %groups nest for a channel flag
::
++  nest-of
  |=  chan=flag:g
  ^-  nest:v1:a
  [%apps p.chan q.chan]
::  +doc-path: subscription path for one document
::
++  doc-path
  |=  chan=flag:g
  ^-  path
  /v1/doc/(scot %p p.chan)/[q.chan]
::  +doc-wire: wire for our subscription to a document's host
::
++  doc-wire
  |=  chan=flag:g
  ^-  wire
  /doc/(scot %p p.chan)/[q.chan]
--
