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
        time+s+(scot %ud time.k)
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
      %group  (rap 3 'group/' (flag:enjs:gj flag.s) ~)
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
          (scot %ud time.key.s)
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
    |=  [id=time-id:a *]
    [(scot %ud id) ~]
  ::
  ++  unread-point
    |=  up=unread-point:a
    %-  pairs
    :~  id/s+(msg-id id.up)
        time+(time-id time.up)
        count/(numb count.up)
        notify/b/notify.up
    ==
  ++  activity-summary
    |=  sum=activity-summary:a
    %-  pairs
    :~  recency+(time newest.sum)
        count+(numb count.sum)
        notify-count+(numb notify-count.sum)
        notify+b+notify.sum
        unread/?~(unread.sum ~ (unread-point u.unread.sum))
    ==
  ::
  ++  activity-summary-full
    |=  sum=activity-summary:a
    %-  pairs
    :~  recency+(time newest.sum)
        count+(numb count.sum)
        notify-count+(numb notify-count.sum)
        notify+b+notify.sum
        unread/?~(unread.sum ~ (unread-point u.unread.sum))
      ::
        :-  %children
        a+(turn ~(tap in children.sum) (cork string-source (lead %s)))
    ==
  ::
  ++  activity-bundle
    |=  ab=activity-bundle:a
    %-  pairs
    :~  source+(source source.ab)
        source-key+s+(string-source source.ab)
        latest+s+(scot %ud latest.ab)
        events+a+(turn events.ab time-event)
    ==
  ++  event
    |=  e=event:a
    %-  pairs
    :_  [notified+b+notified.e]~
      :-  -<.e
    ?-  -<.e
      %dm-invite  (whom whom.e)
    ::
        %chan-init
      %-  pairs
      :~  channel/s+(nest:enjs:gj channel.e)
          group/s+(flag:enjs:gj group.e)
      ==
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
  ++  time-event
    |=  te=time-event:a
    %-  pairs
    :~  time+s+(scot %ud time.te)
        event+(event event.te)
    ==
  ::
  ++  allowed  (lead %s)
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
    |=  [sc=source:a st=stream:a r=reads:a bump=^time]
    :-  (string-source sc)
    %-  pairs
    :~  stream+(stream st)
        reads+(reads r)
        last-self-activity+(time bump)
    ==
  ::
  ++  activity
    |=  [ac=activity:a full=?]
    %-  pairs
    %+  turn  ~(tap by ac)
    |=  [s=source:a sum=activity-summary:a]
    :-  (string-source s)
    ?.  full  (activity-summary sum)
    (activity-summary-full sum)
  ::
  ++  activity-pairs
    |=  activity=(list [source:a activity-summary:a])
    :-  %a
    %+  turn
      activity
    |=  [s=source:a as=activity-summary:a]
    %-  pairs
    :~  source+(source s)
        activity+(activity-summary as)
    ==
  ::
  ++  full-info
    |=  fi=full-info:a
    %-  pairs
    :~  indices+(indices indices.fi)
        activity+(activity activity.fi &)
        settings+(volume-settings volume-settings.fi)
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
  ++  feed
    |=  f=feed:a
    %-  pairs
    :~  feed+a+(turn feed.f activity-bundle)
        summaries+(activity summaries.f |)
    ==
  ::
  +|  %updates
  ++  update
    |=  u=update:a
    %+  frond  -.u
    ?-  -.u
      %add  (added +.u)
      %del  (source +.u)
      %read  (read +.u)
      %activity  (activity +.u |)
      %adjust  (adjusted +.u)
      %allow-notifications  (allowed +.u)
    ==
  ::
  ++  added
    |=  [src=source:a te=time-event:a]
    %-  pairs
    :~  source+(source src)
        source-key+s+(string-source src)
        time+(time time.te)
        event+(event event.te)
    ==
  ::
  ++  read
    |=  [s=source:a as=activity-summary:a]
    %-  pairs
    :~  source+(source s)
        activity+(activity-summary as)
    ==
  ::
  ++  adjusted
    |=  [s=source:a v=(unit volume-map:a)]
    %-  pairs
    :~  source+(source s)
        volume+?~(v ~ (volume-map u.v))
    ==
  +|  %old-types
  ++  v2
    |%
    ++  update
      |=  u=update:v2:old:a
      ?+  -.u  (^update u)
        %read  (frond -.u (read +.u))
      ==
    ++  read
      |=  [s=source:a as=activity-summary:v2:old:a]
      %-  pairs
      :~  source+(source s)
          activity+(activity-summary as)
      ==
    ++  full-info
      |=  fi=full-info:v2:old:a
      %-  pairs
      :~  indices+(indices:v3 indices.fi)
          activity+(activity activity.fi)
          settings+(volume-settings volume-settings.fi)
      ==
    ++  activity
      |=  ac=activity:v2:old:a
      %-  pairs
      %+  turn  ~(tap by ac)
      |=  [s=source:a sum=activity-summary:v2:old:a]
      [(string-source s) (activity-summary sum)]
    ++  activity-summary
      |=  sum=activity-summary:v2:old:a
      %-  pairs
      :~  recency+(time newest.sum)
          count+(numb count.sum)
          notify+b+notify.sum
          unread/?~(unread.sum ~ (unread-point u.unread.sum))
          children+?~(children.sum ~ (activity u.children.sum))
      ==
    ::
    --
  ++  v3
    |%
    ++  update
      |=  u=update:v3:old:a
      ?+  -.u  (^update u)
        %read  (frond -.u (read +.u))
      ==
    ++  read
      |=  [s=source:a as=activity-summary:v3:old:a]
      %-  pairs
      :~  source+(source s)
          activity+(activity-summary as)
      ==
    ++  full-info
      |=  fi=full-info:v3:old:a
      %-  pairs
      :~  indices+(indices indices.fi)
          activity+(activity activity.fi)
          settings+(volume-settings volume-settings.fi)
      ==
    ++  indices
      |=  ind=indices:v3:old:a
      %-  pairs
      %+  turn  ~(tap by ind)
      |=  [sc=source:a st=stream:a r=reads:a]
      :-  (string-source sc)
      %-  pairs
      :~  stream+(stream st)
          reads+(reads r)
      ==
    ++  activity
      |=  ac=activity:v3:old:a
      %-  pairs
      %+  turn  ~(tap by ac)
      |=  [s=source:a sum=activity-summary:v3:old:a]
      [(string-source s) (activity-summary sum)]
    ++  activity-summary
      |=  sum=activity-summary:v3:old:a
      %-  pairs
      :~  recency+(time newest.sum)
          count+(numb count.sum)
          notify+b+notify.sum
          notify-count+(numb notify-count.sum)
          unread/?~(unread.sum ~ (unread-point u.unread.sum))
          children+?~(children.sum ~ (activity u.children.sum))
          reads+?:(=(reads.sum *reads:a) ~ (reads reads.sum))
      ==
    ::
    --
  ++  v4
    |%
    ++  feed
      |=  f=feed:v4:old:a
      a+(turn f activity-bundle)
    --
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
        del/source
        read/read
        adjust/adjust
        allow-notifications/(su (perk %all %some %none ~))
    ==
  ::
  ++  add  incoming-event
  ::
  ++  adjust
    %-  ot
    :~  source/source
        volume/(mu volume-map)
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
    :~  item/id
        all/all-read
        event/incoming-event
    ==
  ++  all-read
    %-  ou
    :~  time/(un (mu (se %ud)))
        deep/(uf | bo)
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
  ++  volume-map  (op event-type volume)
  ++  volume
    %-  ot
    :~  unreads/bo
        notify/bo
    ==
  ::
  ++  incoming-event
    ^-  $-(json incoming-event:a)
    %-  of
    :~  post/post-event
        reply/reply-event
        chan-init/chan-init-event
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
  ++  chan-init-event
    %-  ot
    :~  channel/nest:dejs:cj
        group/flag:dejs:gj
    ==
  ::
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
