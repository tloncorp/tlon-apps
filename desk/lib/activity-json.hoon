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
      %channel  (rap 3 'channel/' (nest:enjs:gj nest.s) ~)
    ::
        %dm
      ?-  -.whom.s
        %ship  (rap 3 'ship/' (scot %p p.whom.s) ~)
        %club  (rap 3 'club/' (scot %uv p.whom.s) ~)
      ==
    ==
  ::
  ++  source
    |=  s=source:a
    %-  pairs
    ?-  -.s
      %channel  ~[channel/s/(nest:enjs:gj nest.s)]
      %dm  ~[dm+(whom whom.s)]
    ==
  ::
  ++  reads
    |=  r=reads:a
    %-  pairs
    :~  floor+(time floor.r)
        posts+(post-reads posts.r)
    ==
  ::
  ++  post-reads
    |=  pr=post-reads:a
    %-  pairs
    %+  turn  (tap:on-post-reads:a pr)
    |=  [id=time-id:a p=post-read:a]
    [(scot %ud id) (post-read p)]
  ::
  ++  post-read
    |=  p=post-read:a
    %-  pairs
    :~  seen/b+seen.p
        floor+(time floor.p)
    ==
  ::
  ++  unread
    |=  sum=unread-summary:a
    %-  pairs
    :~  recency+(time newest.sum)
        count+(numb count.sum)
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
      ==
    ::
        %flag-reply
      %-  pairs
      :~  parent+(msg-key parent.e)
          key+(msg-key key.e)
          channel/s+(nest:enjs:gj channel.e)
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
          content+(story:enjs:cj content.e)
          mention/b+mention.e
      ==
    ::
        %reply
      %-  pairs
      :~  parent+(msg-key parent.e)
          key+(msg-key key.e)
          channel/s+(nest:enjs:gj channel.e)
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
    :~  stream+(stream stream.fi)
        indices+(indices indices.fi)
        unreads+(unreads unreads.fi)
    ==
  ::
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
    |=  [s=source:a v=volume:a]
    %-  pairs
    :~  source+(source s)
        volume+s+v
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
  +|  %basics
  ++  source
    %-  of
    :~  channel/nest:dejs:cj
        dm/dm-source
    ==
  ::
  ++  dm-source
    %-  of
    :~  ship/ship
        club/club-id
    ==
  ::
  +|  %action
  ++  action
    %-  of
    :~  read/read
    ==
  ::
  ++  read
    %-  ot
    :~  source/source
        action/read-action
    ==
  ::
  ++  read-action
    %-  of
    :~  all/ul
        post/id
        thread/id
    ==
  ::
  --
--
