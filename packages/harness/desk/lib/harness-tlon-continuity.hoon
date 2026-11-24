::  Authorization changes rotate routes without discarding conversation
::  history. Detaching a conversation gives subsequent input a fresh identity.
/-  t=harness-tlon, h=harness, a=activity-ver, c=channels, hh=harness-hand
/+  p=harness-tlon-policy, ht=harness-tools
|%
::
++  detach-routes
  |=  [saved=state-4:t hands=state:hh]
  ^-  state-4:t
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
::  $owners: who owns the ship before and after a policy change
::
+$  owners  [before=$-(@p ?) after=$-(@p ?)]
::  +place-changed: whether admission decides differently for an actor in a place
::
::    A grant beside access the actor already has there, as the owner, a
::    sibling moon's owner, a ship-wide grant or an open channel's reader,
::    changes nothing.
::
++  place-changed
  |=  [before=policy:t after=policy:t =owners actor=@p =place:t]
  ^-  ?
  =/  to=destination:t  ?~(place [%dm actor ~] [%channel u.place ~])
  =/  was  (before.owners actor)
  =/  is  (after.owners actor)
  ::  Grant order alone is not a change.
  ?!  .=  [was (bind (destination-grants:p before actor to ~ was) silt)]
  [is (bind (destination-grants:p after actor to ~ is) silt)]
::  +place-keys: every actor and place a policy grants per place
::
++  place-keys
  |=  policy=policy:t
  ^-  (set [@p place:t])
  =/  dms=(list [@p place:t])
    (turn ~(tap in dm-grants.policy) |=(who=@p [who ~]))
  =/  channels=(list [@p place:t])
    %-  zing
    %+  turn  ~(tap by channel-grants.policy)
    |=  [nest=nest:c ships=(set @p)]
    (turn ~(tap in ships) |=(who=@p [who `nest]))
  (silt (weld dms channels))
::  Adding %tlon or %code for another ship changes nothing it can do, but
::  removing one is a change, so the owner can stop work that holds it.
++  owner-only-revoked
  |=  [before=policy:t after=policy:t actor=@p]
  ^-  ?
  ?:  =(`actor owner.before)  |
  =/  kept  (fall (~(get by trusted.after) actor) ~)
  %+  lien  (fall (~(get by trusted.before) actor) ~)
  |=  grant=tool-grant:h
  &(?=(?(%tlon %code) grant) !(lien kept |=(held=tool-grant:h =(held grant))))
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
  ::  the map by DM partners, pending speakers and the two policy snapshots,
  ::  per-place grants included.
  =/  placed=(list @p)
    %+  turn  ~(tap in (~(uni in (place-keys before)) (place-keys new)))
    |=([who=@p *] who)
  =/  actors=(set @p)
    %-  silt
    ;:  weld
        placed
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
::  +place-cutoffs: a per-place grant change moves only that place's cutoff
::
::    Keys outside both snapshots are dropped: granting that place again
::    establishes a fresh cutoff, and a ship-wide change moves its own.
::
++  place-cutoffs
  |=  $:  before=policy:t
          new=policy:t
          =owners
          prior=(map [@p place:t] @da)
          now=@da
      ==
  ^-  (map [@p place:t] @da)
  %+  roll  ~(tap in (~(uni in (place-keys before)) (place-keys new)))
  |=  [[actor=@p =place:t] cutoffs=(map [@p place:t] @da)]
  =/  cutoff=(unit @da)
    ?:  (place-changed before new owners actor place)  `now
    (~(get by prior) [actor place])
  ?~  cutoff  cutoffs
  (~(put by cutoffs) [actor place] u.cutoff)
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
::  A DM belongs to its partner. A channel is shared, so no one speaker's
::  change resets it; only the channel's rule or the adapter itself does.
::
++  affected
  |=  [before=policy:t after=policy:t lane=lane:t]
  ^-  ?
  ?-  -.to.lane
    %dm  (actor-changed before after who.to.lane)
  ::
      %channel
    ?|  !=(enabled.before enabled.after)
        !=((channel-rule:p before nest.to.lane) (channel-rule:p after nest.to.lane))
    ==
  ==
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
