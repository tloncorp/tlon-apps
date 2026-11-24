::  Pure social boundary: authentic source nouns -> allowed, addressed input.
::  Nicknames are presentation, never identity or authority. Sessions separate
::  destination and grant epoch; a channel's speakers share its session, and
::  each speaker's authority is decided per turn.
/-  t=harness-tlon, h=harness, a=activity-ver,
    cr=harness-cron, hh=harness-hand, c=channels
/+  ht=harness-tools, hj=harness-json,
    story=harness-tlon-story, input=harness-tlon-input
|%
::
++  cron-clearable
  |=  [job=job:cr hands=state:hh admitting=?]
  ^-  ?
  ?:  admitting  |
  ?.  |(=(%cancelled state.job) &(=(%complete state.job) =(0 remaining.job)))  |
  ?:  %+  lien  ~(val by observations.hands)
      |=  observation=observation:hh
      ?&  =(run-sid.job binding.observation)
          ?=(?(%queued %running) phase.observation)
      ==
    |
  ?:  %+  lien  ~(val by outbox.hands)
      |=  publication=publication:hh
      ?&  =(run-sid.job sid.publication)
          ?=(?(%pending %claimed %uncertain) status.publication)
      ==
    |
  ::  A schedule cancelled before its first admission has no execution receipt.
  ::  Remaining runs are an unused budget, not work that must be performed.
  ?~  last.job  =(%cancelled state.job)
  =/  last  (~(get by observations.hands) u.last.job)
  ?~  last  |
  =(run-sid.job binding.u.last)
::
++  grants
  |=  [policy=policy:t actor=@p owner-tools=(list tool-grant:h)]
  ^-  (unit (list tool-grant:h))
  (grants-owned policy actor owner-tools =(`actor owner.policy))
::
++  grants-owned
  |=  [policy=policy:t actor=@p owner-tools=(list tool-grant:h) owner=?]
  ^-  (unit (list tool-grant:h))
  ?.  enabled.policy  ~
  ?:  owner  `owner-tools
  =/  explicit  (~(get by trusted.policy) actor)
  ?^  explicit  explicit
  ?:  (~(has in allowed.policy) actor)  `~[%web]
  ~
::
++  channel-rule
  |=  [policy=policy:t nest=nest:c]
  ^-  channel-rule:t
  (fall (~(get by channels.policy) nest) [response.policy |])
::
++  place
  |=  to=destination:t
  ^-  place:t
  ?:(?=(%dm -.to) ~ `nest.to)
::  +event-place: the place of a message or DM invitation, if it has one
::
++  event-place
  |=  event=incoming-event:v8:a
  ^-  (unit place:t)
  ?+  -.event  ~
    %dm-post  `~
    %dm-reply  `~
    %dm-invite  `~
    %post  ``channel.event
    %reply  ``channel.event
  ==
::
++  placed
  |=  [policy=policy:t actor=@p =place:t]
  ^-  ?
  ?~  place  (~(has in dm-grants.policy) actor)
  (~(has in (fall (~(get by channel-grants.policy) u.place) ~)) actor)
::  +place-grants: ship-wide grants, or an allowed ship's for a granted place
::
::    A per-place grant never carries named tools.
::
++  place-grants
  |=  $:  policy=policy:t  actor=@p  =place:t
          owner-tools=(list tool-grant:h)  owner=?
      ==
  ^-  (unit (list tool-grant:h))
  =/  grant  (grants-owned policy actor owner-tools owner)
  ?^  grant  grant
  ?.  enabled.policy  ~
  ?:((placed policy actor place) `~[%web] ~)
::
++  destination-grants
  |=  [policy=policy:t actor=@p to=destination:t owner-tools=(list tool-grant:h) owner=?]
  ^-  (unit (list tool-grant:h))
  ?.  enabled.policy  ~
  =/  grant  (place-grants policy actor (place to) owner-tools owner)
  ?:  ?=(%dm -.to)  grant
  =/  rule  (channel-rule policy nest.to)
  ?:  =(%off response.rule)  ~
  ?^  grant  grant
  ?:(everyone.rule `~[%web] ~)
::
++  peer-grants
  |=  policy=policy:t
  ^-  (map @p peer-grant:h)
  ::  Disabling Tlon replies does not remove trust. No token cap or shared
  ::  skills are inherited; resource grants remain sender-specific.
  =/  peers=(map @p peer-grant:h)
    %-  malt
    %+  turn  ~(tap by trusted.policy)
    |=  [ship=@p tools=(list tool-grant:h)]
    [ship tools ~ 0 ~]
  ?~  owner.policy  peers
  ::  The peer binding replaces this membership placeholder with the owner's
  ::  default resources; administrative authority is checked from live origin.
  (~(put by peers) u.owner.policy [~ ~ 0 ~])
::
++  address
  |=  to=destination:t
  ^-  @t
  ?-  -.to
      %dm
    %+  rap  3
    :~  'dm/'
        (scot %p who.to)
        ?~  parent.to  ''
        (rap 3 '/' (scot %p p.u.parent.to) '/' (scot %da q.u.parent.to) ~)
    ==
      %channel
    %+  rap  3
    :~  kind.nest.to
        '/'
        (scot %p ship.nest.to)
        '/'
        name.nest.to
        ?~(parent.to '' (cat 3 '/' (scot %da u.parent.to)))
    ==
  ==
::
++  session-id
  |=  [epoch=@ud to=destination:t]
  ^-  @t
  ::  Human-readable identity with a 128-bit scope suffix. Stable for this
  ::  destination and epoch, so later messages continue the same session. A
  ::  DM's hash keeps its partner, as before, so its id is unchanged; a
  ::  channel's omits any speaker, so it never equals an earlier per-speaker
  ::  channel id.
  ?-  -.to
      %dm
    =/  surface=@t  ?~(parent.to 'dm' 'dm-thread')
    =/  scope  (scot %uv (end 7^1 (sham [epoch who.to to])))
    (rap 3 (rsh 3^1 (scot %p who.to)) '-' surface '-' scope ~)
  ::
      %channel
    =/  surface=@t  (cat 3 (end 3^24 name.nest.to) ?~(parent.to '' '-thread'))
    =/  scope  (scot %uv (end 7^1 (sham [epoch to])))
    (rap 3 (rsh 3^1 (scot %p ship.nest.to)) '-' surface '-' scope ~)
  ==
::
++  normalize
  |=  [our=@p policy=policy:t event=incoming-event:v8:a]
  ^-  (unit input:t)
  (normalize-owned our policy event |=(actor=@p =(`actor owner.policy)))
::
++  normalize-owned
  |=  [our=@p policy=policy:t event=incoming-event:v8:a owner-test=$-(@p ?)]
  ^-  (unit input:t)
  =/  item=(unit [actor=@p key=message-key:a to=destination:t text=@t addressed=?])
    ?+  -.event  ~
        %dm-post
      ?.  ?=(%ship -.whom.event)  ~
      `[p.id.key.event key.event [%dm p.whom.event ~] (story-to-text:story content.event) &]
        %dm-reply
      ?.  ?=(%ship -.whom.event)  ~
      :-  ~
      :*  p.id.key.event  key.event  [%dm p.whom.event `id.parent.event]
          (story-to-text:story content.event)  &
      ==
        %post
      :-  ~
      :*  p.id.key.event  key.event  [%channel channel.event ~]  (text:input our content.event)
          mention.event
      ==
        %reply
      :-  ~
      :*  p.id.key.event  key.event  [%channel channel.event `time.parent.event]
          (text:input our content.event)  |(mention.event =(our p.id.parent.event))
      ==
    ==
  ?~  item  ~
  ?:  =(actor.u.item our)  ~
  ?~  (destination-grants policy actor.u.item to.u.item ~ (owner-test actor.u.item))  ~
  ?:  ?&  ?=(%channel -.to.u.item)
          =(%mentions response:(channel-rule policy nest.to.u.item))
          !addressed.u.item
      ==
    ~
  ::  A DM's partner must be its source author, not an asserted third party.
  ?:  &(?=(%dm -.to.u.item) !=(who.to.u.item actor.u.item))  ~
  ::  A channel message is observed with its speaker's prefix, which must
  ::  still fit the hand's limit.
  =/  limit
    ?:(?=(%dm -.to.u.item) 65.536 (sub 65.536 attribution-limit:input))
  ?:  |(=('' text.u.item) (gth (met 3 text.u.item) limit))  ~
  =/  id=@t  (scot %uv (sham [to.u.item key.u.item]))
  `[actor.u.item id to.u.item text.u.item]
::
++  policy-json
  |=  policy=policy:t
  ^-  json
  %-  pairs:enjs:format
  :~  ['enabled' %b enabled.policy]
      ['owner' ?~(owner.policy ~ [%s (scot %p u.owner.policy)])]
      ['response' %s response.policy]
      ['allowed' (ships-json allowed.policy)]
      ['channels' (channels-json channels.policy)]
      ['dmGrants' (ships-json dm-grants.policy)]
      :-  'channelGrants'
      :-  %a
      %+  turn  ~(tap by channel-grants.policy)
      |=  [nest=nest:c ships=(set @p)]
      %-  pairs:enjs:format
      :~  ['channel' %s (address [%channel nest ~])]
          ['ships' (ships-json ships)]
      ==
      :-  'trusted'
      :-  %a
      %+  turn  ~(tap by trusted.policy)
      |=  [who=@p tools=(list tool-grant:h)]
      %-  pairs:enjs:format
      :~  ['ship' %s (scot %p who)]
          ['tools' %a (turn tools grant-json:hj)]
      ==
  ==
::
++  ships-json
  |=  ships=(set @p)
  ^-  json
  [%a (turn ~(tap in ships) |=(who=@p [%s (scot %p who)]))]
::
++  channels-json
  |=  channels=(map nest:c channel-rule:t)
  ^-  json
  :-  %a
  %+  turn  ~(tap by channels)
  |=  [nest=nest:c rule=channel-rule:t]
  %-  pairs:enjs:format
  :~  ['channel' %s (address [%channel nest ~])]
      ['response' %s response.rule]
      ['everyone' %b everyone.rule]
  ==
::
++  json-channels
  |=  encoded=json
  ^-  (map nest:c channel-rule:t)
  =,  dejs:format
  =/  rows=(list [channel=@t mode=@t everyone=?])
    ((ar (ot ~[channel+so response+so everyone+bo])) encoded)
  ?>  (lte (lent rows) 256)
  =/  channels=(map nest:c channel-rule:t)
    %-  my
    %+  turn  rows
    |=  [channel=@t mode=@t everyone=?]
    ^-  [p=nest:c q=channel-rule:t]
    ?>  ?=(?(%off %mentions %all) mode)
    [(json-nest channel) [mode everyone]]
  ?>  =(~(wyt by channels) (lent rows))
  channels
::
++  json-nest
  |=  channel=@t
  ^-  nest:c
  =/  path  (need (rush (cat 3 '/' channel) stap))
  ?>  ?=([@ @ @ ~] path)
  ?>  ?=(?(%chat %diary %heap) i.path)
  [i.path (slav %p i.t.path) i.t.t.path]
::
++  json-ships
  |=  encoded=json
  ^-  (set @p)
  =/  ships  ((ar:dejs:format (se:dejs:format %p)) encoded)
  ?>  =(~(wyt in (silt ships)) (lent ships))
  (silt ships)
::  +json-channel-grants: per-channel ship sets; a channel with none is omitted
::
++  json-channel-grants
  |=  encoded=json
  ^-  (map nest:c (set @p))
  =,  dejs:format
  =/  rows=(list [channel=@t ships=(set @p)])
    ((ar (ot ~[channel+so ships+json-ships])) encoded)
  =/  grants=(map nest:c (set @p))
    (malt (turn rows |=([channel=@t ships=(set @p)] [(json-nest channel) ships])))
  ?>  =(~(wyt by grants) (lent rows))
  %-  ~(gas by *(map nest:c (set @p)))
  %+  murn  ~(tap by grants)
  |=  [nest=nest:c ships=(set @p)]
  ?:(=(~ ships) ~ `[nest ships])
::
::  +json-policy: a saved policy; omitted per-place grants keep their prior value
::
++  json-policy
  |=  [prior=policy:t encoded=json]
  ^-  policy:t
  =,  dejs:format
  =/  fields
    :~  ['enabled' bo]
        ['owner' (mu (se %p))]
        ['response' so]
        ['allowed' (ar (se %p))]
        ['channels' json-channels]
        ['trusted' (ar (ot ~[ship+(se %p) tools+(ar json-grant:hj)]))]
    ==
  =/  parsed
    ^-  $:  enabled=?
            owner=(unit @p)
            response=@t
            allowed=(list @p)
            channels=(map nest:c channel-rule:t)
            trusted=(list [p=@p q=(list tool-grant:h)])
        ==
    ((ot fields) encoded)
  ?>  ?=(?(%off %mentions %all) response.parsed)
  ?>  =(~(wyt in (silt allowed.parsed)) (lent allowed.parsed))
  ?>  ?=(%o -.encoded)
  =/  dm-grants  (~(get by p.encoded) 'dmGrants')
  =/  channel-grants  (~(get by p.encoded) 'channelGrants')
  =/  =policy:t
    :*  enabled.parsed
        owner.parsed
        (my trusted.parsed)
        response.parsed
        (silt allowed.parsed)
        channels.parsed
        ?~(dm-grants dm-grants.prior (json-ships u.dm-grants))
        ?~(channel-grants channel-grants.prior (json-channel-grants u.channel-grants))
    ==
  ?>  (lte ~(wyt by trusted.policy) 64)
  ?>  =(~(wyt by trusted.policy) (lent trusted.parsed))
  ?>  %+  levy  ~(val by trusted.policy)
      |=  tools=(list tool-grant:h)
      %+  levy  tools
      |=  grant=tool-grant:h
      ?:  ?=(^ grant)  &
      (lien all-tools:ht |=(known=term =(grant known)))
  policy
::
++  next-message-stamp
  |=  [now=@da previous=@da]
  ^-  @da
  ::  Native Gall cascades can share one +now. Distinct publications must
  ::  still have distinct Messenger identities; this schedules no wake.
  (max now +(previous))
--
