/-  a=activity, g=groups, c=chat
/+  gj=groups-json, cj=channel-json
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
  ::
  +|  %primitives
  ++  ship
    |=  s=ship:z
    s+(scot %p s)
  ++  club-id
    |=  c=id:club:c
    s+(scot %uv c)
  ++  whom
    |=  w=whom:a
    %+  frond  -.w
    ?-  -.w
      %ship  (ship p.w)
      %club  (club-id p.w)
    ==
  ::
  ++  msg-key
    |=  k=message-key:a
    %-  pairs
    :~  id/s+(msg-id id.k)
        time+(time time.k)
    ==
  ::
  ++  msg-id
    |=  id=message-id:a
    (rap 3 (scot %p p.id) '/' (scot %ud q.id) ~)
  ::
  ++  time-id
    |=  =@da
    s+`@t`(rsh 4 (scot %ui da))
  ::
  +|  %basics
  ::
  ++  string-source
    |=  s=source:a
    ^-  cord
    ?-  -.s
      %base  'base'
      %group  (flag:enjs:gj flag.s)
      %channel  (rap 3 'channel/' (nest:enjs:gj nest.s) ~)
    ::
        %dm
      ?-  -.whom.s
        %ship  (rap 3 'ship/' (scot %p p.whom.s) ~)
        %club  (rap 3 'club/' (scot %uv p.whom.s) ~)
      ==
    ::
        %thread
      %+  rap  3
      :~  'thread/'
          (nest:enjs:gj channel.s)
          '/'
          (msg-id id.key.s)
      ==
    ::
        %dm-thread
      %+  rap  3
      :~  'dm-thread/'
          ?-  -.whom.s
            %ship  (scot %p p.whom.s)
            %club  (scot %uv p.whom.s)
          ==
          '/'
          (msg-id id.key.s)
      ==
    ==
  ::
  ++  source
    |=  s=source:a
    %-  pairs
    ?-  -.s
      %base  ~[base/~]
      %group  ~[group/s/(flag:enjs:gj flag.s)]
      %dm  ~[dm+(whom whom.s)]
    ::
        %channel
      :~  :-  %channel
          %-  pairs
          :~  nest/s/(nest:enjs:gj nest.s)
              group/s/(flag:enjs:gj group.s)
          ==
      ==
    ::
        %thread
      :~  :-  %thread
          %-  pairs
          :~  channel/s/(nest:enjs:gj channel.s)
              group/s/(flag:enjs:gj group.s)
              key+(msg-key key.s)
          ==
      ==
    ::
        %dm-thread
      :~  :-  %dm-thread
          %-  pairs
          :~  whom+(whom whom.s)
              key+(msg-key key.s)
          ==
      ==
    ==
  ::
  ++  volume
    |=  v=volume:a
    %-  pairs
    :~  unreads/b/unreads.v
        notify/b/notify.v
    ==
  ++  reads
    |=  r=reads:a
    %-  pairs
    :~  floor+(time floor.r)
        items+(read-items items.r)
    ==
  ::
  ++  read-items
    |=  ri=read-items:a
    %-  pairs
    %+  turn  (tap:on-read-items:a ri)
    |=  [id=time-id:a seen=?]
    [(scot %ud id) b/seen]
  ::
  ++  unread
    |=  sum=unread-summary:a
    %-  pairs
    :~  recency+(time newest.sum)
        count+(numb count.sum)
        notify+b+notify.sum
        :-  %unread
        ?~  unread.sum  ~
        %-  pairs
        :~  id/s+(msg-id id.u.unread.sum)
            time+(time-id time.u.unread.sum)
            count/(numb count.u.unread.sum)
        ==
        :-  %threads
        %-  pairs
        %+  turn
          ~(tap by threads.sum)
        |=  [top=message-key:a last=message-key:a count=@ud]
        :-  (msg-id id.top)
        %-  pairs
        :~  parent-time/(time-id time.top)
            id/s/(msg-id id.last)
            time/(time-id time.last)
            count+(numb count)
        ==
    ==
  ::
  ++  event
    |=  e=event:a
    %+  frond  -.e
    ?-  -.e
      %dm-invite  (whom whom.e)
    ::
        ?(%group-kick %group-join %group-ask %group-invite)
      %-  pairs
      :~  group+s+(flag:enjs:gj group.e)
          ship+(ship ship.e)
      ==
    ::
        %flag-post
      %-  pairs
      :~  key+(msg-key key.e)
          channel/s+(nest:enjs:gj channel.e)
          group/s+(flag:enjs:gj group.e)
      ==
    ::
        %flag-reply
      %-  pairs
      :~  parent+(msg-key parent.e)
          key+(msg-key key.e)
          channel/s+(nest:enjs:gj channel.e)
          group/s+(flag:enjs:gj group.e)
      ==
    ::
        %dm-post
      %-  pairs
      :~  key+(msg-key key.e)
          whom+(whom whom.e)
          content+(story:enjs:cj content.e)
          mention/b+mention.e
      ==
    ::
        %dm-reply
      %-  pairs
      :~  parent+(msg-key parent.e)
          key+(msg-key key.e)
          whom+(whom whom.e)
          content+(story:enjs:cj content.e)
          mention/b+mention.e
      ==
    ::
        %post
      %-  pairs
      :~  key+(msg-key key.e)
          channel/s+(nest:enjs:gj channel.e)
          group/s+(flag:enjs:gj group.e)
          content+(story:enjs:cj content.e)
          mention/b+mention.e
      ==
    ::
        %reply
      %-  pairs
      :~  parent+(msg-key parent.e)
          key+(msg-key key.e)
          channel/s+(nest:enjs:gj channel.e)
          group/s+(flag:enjs:gj group.e)
          content+(story:enjs:cj content.e)
          mention/b+mention.e
      ==
    ::
        %group-role
      %-  pairs
      :~  group/s+(flag:enjs:gj group.e)
          ship+(ship ship.e)
          roles+a+(turn ~(tap in roles.e) |=(role=sect:g s+role))
      ==
    ==
  ::
  +|  %collections
  ::
  ++  stream
    |=  s=stream:a
    %-  pairs
    %+  turn  (tap:on-event:a s)
    |=  [=time:z e=event:a]
    [(scot %ud time) (event e)]
  ::
  ++  indices
    |=  ind=indices:a
    %-  pairs
    %+  turn  ~(tap by ind)
    |=  [sc=source:a st=stream:a r=reads:a]
    :-  (string-source sc)
    %-  pairs
    :~  stream+(stream st)
        reads+(reads r)
    ==
  ::
  ++  unreads
    |=  us=unreads:a
    %-  pairs
    %+  turn  ~(tap by us)
    |=  [s=source:a sum=unread-summary:a]
    [(string-source s) (unread sum)]
  ::
  ++  full-info
    |=  fi=full-info:a
    %-  pairs
    :~  indices+(indices indices.fi)
        unreads+(unreads unreads.fi)
    ==
  ++  volume-settings
    |=  vs=volume-settings:a
    %-  pairs
    %+  turn  ~(tap by vs)
    |=  [s=source:a v=volume-map:a]
    [(string-source s) (volume-map v)]
  ::
  ++  volume-map
    |=  vm=volume-map:a
    %-  pairs
    %+  turn  ~(tap by vm)
    |=  [e=event-type:a v=volume:a]
    [e (volume v)]
  +|  %updates
  ++  update
    |=  u=update:a
    %+  frond  -.u
    ?-  -.u
      %add  (added +.u)
      %read  (read +.u)
      %adjust  (adjusted +.u)
    ==
  ::
  ++  added
    |=  ad=time-event:a
    %-  pairs
    :~  time+(time time.ad)
        event+(event event.ad)
    ==
  ++  read
    |=  [s=source:a u=unread-summary:a]
    %-  pairs
    :~  source+(source s)
        unread+(unread u)
    ==
  ::
  ++  adjusted
    |=  [s=source:a v=volume-map:a]
    %-  pairs
    :~  source+(source s)
        volume+(volume-map v)
    ==
  --
::
++  dejs
  =,  dejs:format
  |%
  +|  %primitives
  ++  id    (se %ud)
  ++  club-id  (se %uv)
  ++  ship  `$-(json ship:z)`(su ship-rule)
  ++  ship-rule  ;~(pfix sig fed:ag)
  ++  whom
    %-  of
    :~  ship/ship
        club/club-id
    ==
  ::
  ++  msg-id
    ^-  $-(json message-id:a)
    %-  su
    %+  cook  |=([p=@p q=@] `id:c`[p `@da`q])
    ;~((glue fas) ;~(pfix sig fed:ag) dem:ag)
  ++  msg-key
    %-  ot
    :~  id/msg-id
        time/(se %ud)
    ==
  ++  event-type
    %-  perk
    :~  %post-mention
        %reply-mention
        %dm-post-mention
        %dm-reply-mention
        %post
        %reply
        %dm-invite
        %dm-post
        %dm-reply
        %flag-post
        %flag-reply
        %group-ask
        %group-join
        %group-kick
        %group-role
        %group-invite
    ==
  +|  %action
  ++  action
    ^-  $-(json action:a)
    %-  of
    :~  add/add
        read/read
        adjust/adjust
    ==
  ::
  ++  add
    ^-  $-(json event:a)
    %-  of
    :~  post/post-event
        reply/reply-event
        dm-invite/whom
        dm-post/dm-post-event
        dm-reply/dm-reply-event
        flag-post/flag-post-event
        flag-reply/flag-reply-event
        group-ask/group-event
        group-join/group-event
        group-kick/group-event
        group-invite/group-event
        group-role/group-role-event
    ==
  ::
  ++  adjust
    %-  ot
    :~  source/source
        volume/volume-map
    ==
  ::
  ++  read
    ^-  $-(json [source:a read-action:a])
    %-  ot
    :~  source/source
        action/read-action
    ==
  ::
  ++  read-action
    %-  of
    :~  all/ul
        item/id
    ==
  ::
  +|  %basics
  ++  source
    ^-  $-(json source:a)
    %-  of
    :~  base/ul
        group/flag:dejs:gj
        dm/whom
        channel/channel-source
        thread/thread-source
        dm-thread/dm-thread-source
    ==
  ::
  ++  channel-source
    %-  ot
    :~  nest/nest:dejs:cj
        group/flag:dejs:gj
    ==
  ++  thread-source
    %-  ot
    :~  key/msg-key
        channel/nest:dejs:cj
        group/flag:dejs:gj
    ==
  ::
  ++  dm-thread-source
    %-  ot
    :~  key/msg-key
        whom/whom
    ==
  ::
  ++  volume-map
    |=  jon=^json
    :: ^-  $-(json volume-map:a)
    =/  jom  ((om volume) jon)
    ~&  jom
    ~&
      %-  malt
      %+  turn  ~(tap by jom)
      |*  [a=cord b=*]
      =>  .(+< [a b]=+<)
      ~&  a
      [(rash a event-type) b]
    ((op event-type volume) jon)
  ++  volume
    %-  ot
    :~  unreads/bo
        notify/bo
    ==
  ++  post-event
    %-  ot
    :~  key/msg-key
        channel/nest:dejs:cj
        group/flag:dejs:gj
        content/story:dejs:cj
        mention/bo
    ==
  ::
  ++  reply-event
    %-  ot
    :~  key/msg-key
        parent/msg-key
        channel/nest:dejs:cj
        group/flag:dejs:gj
        content/story:dejs:cj
        mention/bo
    ==
  ::
  ++  dm-post-event
    %-  ot
    :~  key/msg-key
        whom/whom
        content/story:dejs:cj
        mention/bo
    ==
  ::
  ++  dm-reply-event
    %-  ot
    :~  key/msg-key
        parent/msg-key
        whom/whom
        content/story:dejs:cj
        mention/bo
    ==
  ::
  ++  flag-post-event
    %-  ot
    :~  key/msg-key
        channel/nest:dejs:cj
        group/flag:dejs:gj
    ==
  ::
  ++  flag-reply-event
    %-  ot
    :~  key/msg-key
        parent/msg-key
        channel/nest:dejs:cj
        group/flag:dejs:gj
    ==
  ::
  ++  group-event
    %-  ot
    :~  group/flag:dejs:gj
        ship/ship
    ==
  ::
  ++  group-role-event
    %-  ot
    :~  group/flag:dejs:gj
        ship/ship
        roles/(as (se %tas))
    ==
  --
--
