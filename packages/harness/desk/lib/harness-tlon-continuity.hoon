::  Authorization changes rotate routes without discarding conversation
::  history. Detaching a conversation gives subsequent input a fresh identity.
/-  t=harness-tlon, h=harness, a=activity-ver, c=channels, hh=harness-hand
/+  p=harness-tlon-policy, ht=harness-tools
|%
::
++  detach-routes
  |=  [saved=state-5:t hands=state:hh]
  ^-  state-5:t
  ::  Disabled bindings cannot authorize new input. Keep send receipts, but
  ::  start a fresh conversation so late results cannot enter its new history.
  =/  detached
    %-  silt
    %+  murn  ~(tap by routes.saved)
    |=  [sid=@t route=route:t]
    =/  binding  (~(get by bindings.hands) binding.route)
    ?:(&(?=(^ binding) !enabled.u.binding) `sid ~)
  ?:  =(~ detached)  saved
  =.  epoch.saved  +(epoch.saved)
  =.  identities.saved
    %+  roll  ~(tap by identities.saved)
    |=  [[to=destination:t sid=@t] identities=(map destination:t @t)]
    =/  replacement
      ?.  (~(has in detached) sid)  sid
      (cat 3 (session-id:p epoch.saved to) '-stable')
    (~(put by identities) to replacement)
  =.  routes.saved
    %-  my
    %+  skip  ~(tap by routes.saved)
    |=  [sid=@t route=route:t]
    (~(has in detached) sid)
  =.  lanes.saved
    %-  my
    %+  skip  ~(tap by lanes.saved)
    |=  [sid=@t lane=lane:t]
    (~(has in detached) sid)
  =.  jobs.saved
    %-  my
    %+  skip  ~(tap by jobs.saved)
    |=  [id=@uv job=job:t]
    (~(has in detached) sid.job)
  saved
+$  authority
  $%  [%denied ~]
      [%owner ~]
      [%trusted tools=(set tool-grant:h)]
  ==
::
++  actor
  |=  event=incoming-event:v8:a
  ^-  (unit @p)
  ?+  -.event  ~
    %dm-post  `p.id.key.event
    %dm-reply  `p.id.key.event
    %post  `p.id.key.event
    %reply  `p.id.key.event
    %group-join  `ship.event
    %group-kick  `ship.event
    %group-role  `ship.event
    %group-ask  `ship.event
    %group-invite  `ship.event
    %contact  `who.event
    %dm-invite  ?:(?=(%ship -.whom.event) `p.whom.event ~)
  ==
::
++  authority-for
  |=  [policy=policy:t actor=@p]
  ^-  authority
  ?:  =(`actor owner.policy)  [%owner ~]
  =/  tools  (~(get by trusted.policy) actor)
  ?~  tools  ?:((~(has in allowed.policy) actor) [%trusted (silt ~[%web])] [%denied ~])
  ::  Grants only the owner can use don't count here; +actor-changed
  ::  counts their removal.
  [%trusted (silt (guest-tools:ht u.tools))]
::
++  actor-changed
  |=  [before=policy:t after=policy:t actor=@p]
  ^-  ?
  ?|  !=(enabled.before enabled.after)
      !=((authority-for before actor) (authority-for after actor))
      (owner-only-revoked before after actor)
  ==
::  Adding an owner-only tool for another ship changes nothing it can do, but
::  removing one is a change, so the owner can stop work that holds it.
++  owner-only-revoked
  |=  [before=policy:t after=policy:t actor=@p]
  ^-  ?
  ?:  =(`actor owner.before)  |
  =/  kept  (fall (~(get by trusted.after) actor) ~)
  %+  lien  (fall (~(get by trusted.before) actor) ~)
  |=  grant=tool-grant:h
  &((owner-only-tool:ht grant) !(lien kept |=(held=tool-grant:h =(held grant))))
::
++  cutoffs
  |=  $:  before=policy:t
          new=policy:t
          known=(map destination:t @t)
          speakers=(set @p)
          prior=(map @p @da)
          now=@da
      ==
  ^-  (map @p @da)
  ::  Keep unchanged cutoffs. Removed actors without conversations need no
  ::  tombstone: granting them again establishes a fresh cutoff. This bounds
  ::  the map by DM partners, pending speakers and the two policy snapshots.
  =/  actors=(set @p)
    %-  silt
    ;:  weld
        %+  murn  ~(tap by known)
        |=  [to=destination:t sid=@t]
        ?.(?=(%dm -.to) ~ `who.to)
        ~(tap in speakers)
        ~(tap in ~(key by trusted.before))
        ~(tap in ~(key by trusted.new))
        ~(tap in allowed.before)
        ~(tap in allowed.new)
        ?~(owner.before ~ ~[u.owner.before])
        ?~(owner.new ~ ~[u.owner.new])
    ==
  %+  roll  ~(tap in actors)
  |=  [actor=@p cutoffs=(map @p @da)]
  =/  cutoff=(unit @da)
    ?:  (actor-changed before new actor)  `now
    (~(get by prior) actor)
  ?~  cutoff  cutoffs
  (~(put by cutoffs) actor u.cutoff)
::
::  The bot and each policy snapshot's ownership gate, which decide where the
::  owner is heard without a mention.
::
+$  owners  [our=@p before=$-(@p ?) after=$-(@p ?)]
::
++  channel-cutoffs
  |=  [=owners before=policy:t after=policy:t prior=(map nest:c @da) now=@da]
  ^-  (map nest:c @da)
  ::  Removed overrides retain a cutoff until a default change covers it.
  =?  prior  !=(response.before response.after)  ~
  =/  nests
    %-  ~(uni in ~(key by prior))
    (~(uni in ~(key by channels.before)) ~(key by channels.after))
  %+  roll  ~(tap in nests)
  |=  [nest=nest:c cutoffs=(map nest:c @da)]
  =/  cutoff=(unit @da)
    ?:  (channel-changed owners before after nest)  `now
    (~(get by prior) nest)
  ?~  cutoff  cutoffs
  (~(put by cutoffs) nest u.cutoff)
::
::  A DM belongs to its partner. A channel is shared, so no one speaker's
::  change resets it; only the channel's rule or the adapter itself does.
::
++  affected
  |=  [=owners before=policy:t after=policy:t lane=lane:t]
  ^-  ?
  ?-  -.to.lane
    %dm  (actor-changed before after who.to.lane)
  ::
      %channel
    ?|  !=(enabled.before enabled.after)
        (channel-changed owners before after nest.to.lane)
    ==
  ==
::  Gaining or losing its own rule changes who is heard in a channel where
::  the rule-less snapshot hears the owner unmentioned, even when
::  +channel-rule returns the same value.
::
++  channel-changed
  |=  [=owners before=policy:t after=policy:t nest=nest:c]
  ^-  ?
  ?:  !=((channel-rule:p before nest) (channel-rule:p after nest))  &
  =/  had  (~(has by channels.before) nest)
  ?:  =(had (~(has by channels.after) nest))  |
  ?:  had  (owner-channel:p our.owners after nest after.owners)
  (owner-channel:p our.owners before nest before.owners)
::
++  identity
  |=  to=destination:t
  ^-  @t
  (cat 3 (session-id:p 0 to) '-stable')
::
++  binding
  |=  [sid=@t generation=@ud]
  ^-  @t
  (cat 3 'tlon-binding-' (scot %uv (sham [sid generation])))
::
++  posted-at
  |=  event=incoming-event:v8:a
  ^-  @da
  ?+  -.event  `@da`0
    %dm-post  time.key.event
    %dm-reply  time.key.event
    %post  time.key.event
    %reply  time.key.event
  ==
--
