::  Persisted Tlon state conversion. Runtime policy uses only the current shape.
/-  *harness-tlon, h=harness, ad=harness-adapter, c=channels
|%
::  Saved shapes are frozen here, so a change to the current lane cannot
::  silently change what an older state decodes as.
+$  lane-2  [actor=@p to=destination epoch=@ud tools=(list tool-grant:h)]
+$  state-3
  $:  %3
      lens=lens-sync
      owner-initialized=@ud
      sibling-moon-owners=$~(| ?)
      sibling-owner-after=@da
      activity-through=@da
      catching-up=$~(| ?)
      identities=(map destination @t)
      routes=(map @t route)
      cuts=(map @p @da)
      channel-after=@da
      channel-cuts=(map nest:c @da)
      uploads=(map @uv upload)
      last-sent=@da
      tool-receipts=(map @uv tool-receipt)
      computing=(map path presence-lease)
      policy=policy
      epoch=@ud
      after=@da
      lanes=(map @t lane)  ::  admitted authorization generations; head keeps history
      jobs=(map @uv job)
      deliveries=(map @uv delivery)
      notices=(list notice)
      next-notice=@ud
      listeners=(set @t)
      watching=?
      wake=(unit @da)
      error=@t
  ==
+$  state-2
  $:  %2
      lens=lens-sync
      owner-initialized=@ud
      sibling-moon-owners=$~(| ?)
      sibling-owner-after=@da
      activity-through=@da
      catching-up=$~(| ?)
      identities=(map [actor=@p to=destination] @t)
      routes=(map @t route)
      cuts=(map @p @da)
      channel-after=@da
      channel-cuts=(map nest:c @da)
      uploads=(map @uv upload)
      last-sent=@da
      tool-receipts=(map @uv tool-receipt)
      computing=(map path presence-lease)
      policy=policy
      epoch=@ud
      after=@da
      lanes=(map @t lane-2)
      jobs=(map @uv job)
      deliveries=(map @uv delivery)
      notices=(list notice)
      next-notice=@ud
      listeners=(set @t)
      watching=?
      wake=(unit @da)
      error=@t
  ==
+$  state-1
  $:  %1
      owner-initialized=@ud
      sibling-moon-owners=$~(| ?)
      sibling-owner-after=@da
      activity-through=@da
      catching-up=$~(| ?)
      identities=(map [actor=@p to=destination] @t)
      routes=(map @t route)
      cuts=(map @p @da)
      channel-after=@da
      channel-cuts=(map nest:c @da)
      uploads=(map @uv upload)
      last-sent=@da
      tool-receipts=(map @uv tool-receipt)
      computing=(map path presence-lease)
      policy=policy
      epoch=@ud
      after=@da
      lanes=(map @t lane-2)
      jobs=(map @uv job)
      deliveries=(map @uv delivery)
      notices=(list notice)
      next-notice=@ud
      listeners=(set @t)
      watching=?
      wake=(unit @da)
      error=@t
  ==
+$  state-0
  $:  %0
      owner-initialized=@ud
      sibling-moon-owners=$~(| ?)
      sibling-owner-after=@da
      activity-through=@da
      catching-up=$~(| ?)
      identities=(map [actor=@p to=destination] @t)
      routes=(map @t route)
      cuts=(map @p @da)
      channel-after=@da
      uploads=(map @uv upload)
      last-sent=@da
      tool-receipts=(map @uv tool-receipt)
      computing=(map path presence-lease)
      policy=[enabled=? owner=(unit @p) trusted=(map @p (list tool-grant:h)) mentions=?]
      epoch=@ud
      after=@da
      lanes=(map @t lane-2)  ::  admitted authorization generations; head keeps history
      jobs=(map @uv job)
      deliveries=(map @uv delivery)
      notices=(list notice)
      next-notice=@ud
      listeners=(set @t)
      watching=?
      wake=(unit @da)
      error=@t
  ==
++  load
  |=  old=vase
  ^-  state-4
  ?>  ?=(^ q.old)
  ?:  =(%4 -.q.old)  !<(state-4 old)
  (three-to-four (three old))
::  Ready routes of conversations +two-to-three drops. Their bindings may
::  still hold queued input, so the caller disables them and fences their
::  sessions.
::
++  dropped
  |=  old=vase
  ^-  (list [sid=@t binding=@t])
  ?>  ?=(^ q.old)
  ?:  |(=(%3 -.q.old) =(%4 -.q.old))  ~
  =/  saved  (two old)
  %+  murn  ~(tap by lanes.saved)
  |=  [sid=@t lane=lane-2]
  ?:  (kept lane)  ~
  =/  route  (~(get by routes.saved) sid)
  ?.  &(?=(^ route) =(%ready phase.u.route))  ~
  `[sid binding.u.route]
::
++  three
  |=  old=vase
  ^-  state-3
  ?>  ?=(^ q.old)
  ?:  =(%3 -.q.old)  !<(state-3 old)
  (two-to-three (two old))
::  No browser handoff can be pending in a state saved before version 4.
::
++  three-to-four
  |=  old=state-3
  ^-  state-4
  [%4 ~ +.old]
::
++  two
  |=  old=vase
  ^-  state-2
  ?>  ?=(^ q.old)
  ?:  =(%2 -.q.old)  !<(state-2 old)
  =/  saved
    ?:  =(%0 -.q.old)  (zero-to-one !<(state-0 old))
    !<(state-1 old)
  [%2 *lens-sync +.saved]
::  A conversation is keyed by its destination alone. A DM's speaker is its
::  partner, so its identity already is; a channel's per-speaker
::  conversations are dropped and the channel starts one shared afresh.
::
++  kept
  |=  lane=lane-2
  ^-  ?
  &(?=(%dm -.to.lane) =(actor.lane who.to.lane))
::
++  two-to-three
  |=  old=state-2
  ^-  state-3
  =/  dms=(map @t lane)
    %-  malt
    %+  murn  ~(tap by lanes.old)
    |=  [sid=@t old=lane-2]
    ?.  (kept old)  ~
    `[sid [to epoch tools]:old]
  %=  old
    -  %3
  ::
      identities
    %-  malt
    %+  murn  ~(tap by identities.old)
    |=  [[actor=@p to=destination] sid=@t]
    ?.  &(?=(%dm -.to) =(actor who.to))  ~
    `[to sid]
  ::
    lanes  dms
    routes  (my (skim ~(tap by routes.old) |=([sid=@t *] (~(has by dms) sid))))
    jobs  (my (skim ~(tap by jobs.old) |=([* =job] (~(has by dms) sid.job))))
  ==
::
++  zero-to-one
  |=  saved=state-0
  ^-  state-1
  =/  next  *state-1
  =.  policy.next
    :*  enabled.policy.saved  owner.policy.saved  trusted.policy.saved
        ?:(mentions.policy.saved %mentions %all)  ~  ~
    ==
  =.  owner-initialized.next  owner-initialized.saved
  =.  sibling-moon-owners.next  sibling-moon-owners.saved
  =.  sibling-owner-after.next  sibling-owner-after.saved
  =.  activity-through.next  activity-through.saved
  =.  catching-up.next  catching-up.saved
  =.  identities.next  identities.saved
  =.  routes.next  routes.saved
  =.  cuts.next  cuts.saved
  =.  channel-after.next  channel-after.saved
  =.  uploads.next  uploads.saved
  =.  last-sent.next  last-sent.saved
  =.  tool-receipts.next  tool-receipts.saved
  =.  computing.next  computing.saved
  =.  epoch.next  epoch.saved
  =.  after.next  after.saved
  =.  lanes.next  lanes.saved
  =.  jobs.next  jobs.saved
  =.  deliveries.next  deliveries.saved
  =.  notices.next  notices.saved
  =.  next-notice.next  next-notice.saved
  =.  listeners.next  listeners.saved
  =.  watching.next  watching.saved
  =.  wake.next  wake.saved
  =.  error.next  error.saved
  next
--
