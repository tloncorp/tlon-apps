::  Role changes grant access, not subscriptions. Reconcile only our own role
::  notifications, using the native group's live read policy and joined state.
/-  a=activity-ver, g=groups-ver, ng=groups, dv=channels-ver
/+  paths=harness-tlon-paths
|%
++  target
  |=  [our=@p enabled=? event=incoming-event:v8:a]
  ^-  (unit flag:g)
  ?.  enabled  ~
  ?.  ?=(%group-role -.event)  ~
  ?.  =(our ship.event)  ~
  `group.event
++  ready
  |=  [active=(set nest:g) channels=v-channels:v9:dv]
  ^-  (set nest:g)
  ::  Native Groups can mark a channel active before its first checkpoint
  ::  arrives. A denied initial subscription can leave such a local stub.
  %-  silt
  %+  skim  ~(tap in active)
  |=  nest=nest:g
  ?.  ?=(?(%chat %diary %heap) p.nest)  &
  =/  channel  (~(get by channels) nest)
  ?~  channel  |
  load.net.u.channel
++  missing
  |=  [our=@p group=group:v9:g can-read=$-([@p nest:g] ?)]
  ^-  (list nest:g)
  ::  A directory entry without our seat is not a joined group. In particular,
  ::  public readability alone must not subscribe us to an unrelated group.
  ?~  seat=(~(get by seats.group) our)  ~
  ?:  =(0 joined.u.seat)  ~
  %+  skim  ~(tap in ~(key by channels.group))
  |=  nest=nest:g
  &(!(~(has in active-channels.group) nest) (can-read our nest))
++  io
  |_  bowl=bowl:gall
  +*  read-path  ~(. paths [our now]:bowl)
  ++  join
    |=  [flag=flag:g nest=nest:g]
    ^-  card:agent:gall
    =/  wire  /channel-join/[p.nest]/(scot %p p.q.nest)/[q.q.nest]
    ?:  ?=(?(%chat %diary %heap) p.nest)
      :*  %pass  wire  %agent  [our.bowl %channels]  %poke  %channel-action-2
          !>(`a-channels:v10:dv`[%channel nest %join flag])
      ==
    ::  Native group-linked apps (including Notes) own their subscriptions.
    [%pass wire %agent [our.bowl p.nest] %poke %group-channel-join !>(`channel-join:ng`[nest flag])]
  ++  reconcile
    |=  flag=flag:g
    ^-  (list card:agent:gall)
    ?.  .^(? %gu /(scot %p our.bowl)/groups/(scot %da now.bowl)/$)  ~
    =/  =groups:v9:g
      .^(groups:v9:g %gx /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/noun)
    =/  group  (~(get by groups) flag)
    ?~  group  ~
    ::  Use Groups' own policy, including bans and admin roles. Do not infer
    ::  authority from the roles carried in a potentially replayed notification.
    =/  can-read=$-([@p nest:g] ?)
      .^  $-([@p nest:g] ?)  %gx
        (group-can-read:read-path flag)
      ==
    =/  channels=v-channels:v9:dv
      ?.  .^(? %gu /(scot %p our.bowl)/channels/(scot %da now.bowl)/$)  ~
      .^(v-channels:v9:dv %gx /(scot %p our.bowl)/channels/(scot %da now.bowl)/v4/v-channels/noun)
    =.  active-channels.u.group  (ready active-channels.u.group channels)
    (turn (missing our.bowl u.group can-read) |=(nest=nest:g (join flag nest)))
  --
--
