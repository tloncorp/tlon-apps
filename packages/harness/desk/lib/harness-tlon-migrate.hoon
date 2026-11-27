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
+$  lane-3  [to=destination epoch=@ud tools=(list tool-grant:h)]
::  Version 4 added pending browser handoffs ahead of the version 3 fields.
::  Its lanes are version 3's.
+$  browser-result-4  $%([%form url=@t] [%payment id=@t])
+$  browser-phase-4
  $%  [%authorize ~]  [%prepare local=?]  [%payment ~]
      [%post result=browser-result-4]  [%wait result=browser-result-4]
      [%check result=browser-result-4]
      [%revoke ~]
  ==
+$  browser-entry-4  [next=@da phase=browser-phase-4]
::  Version 6 added per-place grants and their cutoffs.
+$  state-6
  $:  %6
      automation=automation
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
      place-cuts=(map [@p place] @da)
      channel-after=@da
      channel-cuts=(map nest:c @da)
      uploads=(map @uv upload)
      last-sent=@da
      tool-receipts=(map @uv tool-receipt)
      computing=(map path presence-lease)
      policy=policy
      epoch=@ud
      after=@da
      lanes=(map @t lane)
      jobs=(map @uv job)
      deliveries=(map @uv delivery)
      notices=(list notice)
      next-notice=@ud
      listeners=(set @t)
      watching=?
      wake=(unit @da)
      error=@t
  ==
::  Version 7 added approval requests, each for a ship's access in a place.
+$  approval-7  [who=@p =place at=@da]
+$  approvals-7  [by-id=(map @t approval-7) by-place=(map [@p place] @t)]
+$  state-7
  $:  %7
      approvals=approvals-7
      automation=automation
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
      place-cuts=(map [@p place] @da)
      channel-after=@da
      channel-cuts=(map nest:c @da)
      uploads=(map @uv upload)
      last-sent=@da
      tool-receipts=(map @uv tool-receipt)
      computing=(map path presence-lease)
      policy=policy
      epoch=@ud
      after=@da
      lanes=(map @t lane)
      jobs=(map @uv job)
      deliveries=(map @uv delivery)
      notices=(list notice)
      next-notice=@ud
      listeners=(set @t)
      watching=?
      wake=(unit @da)
      error=@t
  ==
::  Version 5 added the Steward automation ahead of the version 4 fields.
::  Its policy, lanes and browser handoffs are version 4's.
+$  state-5
  $:  %5
      automation=automation
      browser-entries=(map @uv browser-entry-4)
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
      lanes=(map @t lane-3)
      jobs=(map @uv job)
      deliveries=(map @uv delivery)
      notices=(list notice)
      next-notice=@ud
      listeners=(set @t)
      watching=?
      wake=(unit @da)
      error=@t
  ==
+$  state-4
  $:  %4
      browser-entries=(map @uv browser-entry-4)
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
      lanes=(map @t lane-3)
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
      lanes=(map @t lane-3)
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
::  Each saved version steps forward one version at a time: a %3 through
::  +three-to-four, every %4 through +four-to-five, every %5 through
::  +five-to-six, every %6 through +six-to-seven, then every %7 through
::  +seven-to-eight.
::
++  load
  |=  old=vase
  ^-  state-8
  ?>  ?=(^ q.old)
  ?:  =(%8 -.q.old)  !<(state-8 old)
  =/  seven=state-7
    ?:  =(%7 -.q.old)  !<(state-7 old)
    ?:  =(%6 -.q.old)  (six-to-seven !<(state-6 old))
    ?:  =(%5 -.q.old)  (six-to-seven (five-to-six !<(state-5 old)))
    ?:  =(%4 -.q.old)  (six-to-seven (five-to-six (four-to-five !<(state-4 old))))
    (six-to-seven (five-to-six (four-to-five (three-to-four (three old)))))
  (seven-to-eight seven)
::  Ready routes of conversations +two-to-three drops. Their bindings may
::  still hold queued input, so the caller disables them and fences their
::  sessions.
::
++  dropped
  |=  old=vase
  ^-  (list [sid=@t binding=@t])
  ?>  ?=(^ q.old)
  ?:  ?=(?(%3 %4 %5 %6 %7 %8) -.q.old)  ~
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
::  Steward names, edits and the schedule snapshot start empty; the head's
::  first /v1/schedule-events fact fills the snapshot.
::
++  four-to-five
  |=  old=state-4
  ^-  state-5
  [%5 *automation +.old]
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
  =/  dms=(map @t lane-3)
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
++  five-to-six
  |=  old=state-5
  ^-  state-6
  :*  %6
      automation.old
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
::  Approval requests start empty; everything else is kept as saved.
::
++  six-to-seven
  |=  old=state-6
  ^-  state-7
  [%7 *approvals-7 +.old]
::  Every request is for its place, and none waits on %groups; everything
::  else is kept as saved.
::
++  seven-to-eight
  |=  old=state-7
  ^-  state-8
  =*  saved  approvals.old
  =/  =approvals
    :+  (~(run by by-id.saved) |=(approval-7 [who [%place place] at]))
      %-  malt
      %+  turn  ~(tap by by-place.saved)
      |=([[who=@p =place] id=@t] [[who %place place] id])
    ~
  [%8 approvals +>.old]
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
