::  Authorization changes rotate routes without discarding conversation
::  history. Detaching a conversation gives subsequent input a fresh identity.
/-  t=harness-tlon, h=harness, a=activity-ver, c=channels, hh=harness-hand
/+  p=harness-tlon-policy
|%
::
++  detach-routes
  |=  [saved=state-2:t hands=state:hh]
  ^-  state-2:t
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
    |=  [[key=[actor=@p to=destination:t] sid=@t] identities=(map [@p destination:t] @t)]
    =/  replacement
      ?.  (~(has in detached) sid)  sid
      (cat 3 (session-id:p epoch.saved actor.key to.key) '-stable')
    (~(put by identities) key replacement)
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
  [%trusted (silt u.tools)]
::
++  actor-changed
  |=  [before=policy:t after=policy:t actor=@p]
  ^-  ?
  |(!=(enabled.before enabled.after) !=((authority-for before actor) (authority-for after actor)))
::
++  cutoffs
  |=  $:  before=policy:t
          new=policy:t
          known=(map [@p destination:t] @t)
          prior=(map @p @da)
          now=@da
      ==
  ^-  (map @p @da)
  ::  Keep unchanged cutoffs. Removed actors without conversations need no
  ::  tombstone: granting them again establishes a fresh cutoff. This bounds
  ::  the map by the identity directory and the two policy snapshots.
  =/  actors=(set @p)
    %-  silt
    ;:  weld
        (turn ~(tap by known) |=([[actor=@p to=destination:t] sid=@t] actor))
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
++  channel-cutoffs
  |=  [before=policy:t after=policy:t prior=(map nest:c @da) now=@da]
  ^-  (map nest:c @da)
  ::  Removed overrides retain a cutoff until a default change covers it.
  =?  prior  !=(response.before response.after)  ~
  =/  nests
    %-  ~(uni in ~(key by prior))
    (~(uni in ~(key by channels.before)) ~(key by channels.after))
  %+  roll  ~(tap in nests)
  |=  [nest=nest:c cutoffs=(map nest:c @da)]
  =/  cutoff=(unit @da)
    ?:  !=((channel-rule:p before nest) (channel-rule:p after nest))  `now
    (~(get by prior) nest)
  ?~  cutoff  cutoffs
  (~(put by cutoffs) nest u.cutoff)
::
++  affected
  |=  [before=policy:t after=policy:t lane=lane:t]
  ^-  ?
  ?|  (actor-changed before after actor.lane)
      ?&  ?=(%channel -.to.lane)
          !=((channel-rule:p before nest.to.lane) (channel-rule:p after nest.to.lane))
      ==
  ==
::
++  identity
  |=  [actor=@p to=destination:t]
  ^-  @t
  (cat 3 (session-id:p 0 actor to) '-stable')
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
