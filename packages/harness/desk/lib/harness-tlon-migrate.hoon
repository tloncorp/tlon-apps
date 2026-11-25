::  Persisted Tlon state conversion. Runtime policy uses only the current shape.
/-  *harness-tlon, h=harness, ad=harness-adapter, c=channels
|%
::  Saved shapes are frozen here, so a change to the current lane cannot
::  silently change what an older state decodes as.
+$  lane-2  [actor=@p to=destination epoch=@ud tools=(list tool-grant:h)]
+$  policy-3
  $:  enabled=?
      owner=(unit @p)
      trusted=(map @p (list tool-grant:h))
      response=$~(%mentions response)
      allowed=(set @p)
      channels=(map nest:c channel-rule)
  ==
+$  state-4
  $:  %4
      browser-entries=(map @uv browser-entry)
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
      policy=policy-3
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
      policy=policy-3
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
      policy=policy-3
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
      policy=policy-3
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
  ^-  state-5
  ?>  ?=(^ q.old)
  ?:  =(%5 -.q.old)  !<(state-5 old)
  ?:  =(%4 -.q.old)  (four-to-five !<(state-4 old))
  (four-to-five (three-to-four (three old)))
::  Ready routes of conversations +two-to-three drops. Their bindings may
::  still hold queued input, so the caller disables them and fences their
::  sessions.
::
++  dropped
  |=  old=vase
  ^-  (list [sid=@t binding=@t])
  ?>  ?=(^ q.old)
  ?:  |(=(%3 -.q.old) =(%4 -.q.old) =(%5 -.q.old))  ~
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
::  Per-place grants and their cutoffs start empty; the ship-wide lists and
::  channel rules are kept as saved.
::
++  four-to-five
  |=  old=state-4
  ^-  state-5
  :*  %5
      browser-entries.old
      lens.old
      owner-initialized.old
      sibling-moon-owners.old
      sibling-owner-after.old
      activity-through.old
      catching-up.old
      identities.old
      routes.old
      cuts.old
      ~
      channel-after.old
      channel-cuts.old
      uploads.old
      last-sent.old
      tool-receipts.old
      computing.old
      [enabled owner trusted response allowed channels ~ ~]:policy.old
      epoch.old
      after.old
      lanes.old
      jobs.old
      deliveries.old
      notices.old
      next-notice.old
      listeners.old
      watching.old
      wake.old
      error.old
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
