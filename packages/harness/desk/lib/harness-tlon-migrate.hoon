::  Persisted Tlon state conversion. Runtime policy uses only the current shape.
/-  *harness-tlon, h=harness, ad=harness-adapter, c=channels
|%
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
++  load
  |=  old=vase
  ^-  state-3
  ?>  ?=(^ q.old)
  ?:  =(%3 -.q.old)  (need ((soft state-3) q.old))
  ?:  =(%2 -.q.old)
    =/  saved  !<(state-2 old)
    [%3 ~ +.saved]
  =/  saved
    ?:  =(%0 -.q.old)  (zero-to-one !<(state-0 old))
    !<(state-1 old)
  [%3 ~ *lens-sync +.saved]
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
