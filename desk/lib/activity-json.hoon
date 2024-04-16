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
  ++  string-index
    |=  i=index:a
    ^-  cord
    ?-  -.i
      %channel  (rap 3 'channel/' (nest:enjs:gj nest.i) ~)
    ::
        %dm
      ?-  -.whom.i
        %ship  (rap 3 'ship/' (scot %p p.whom.i) ~)
        %club  (rap 3 'club/' (scot %uv p.whom.i) ~)
      ==
    ==
  ::
  ++  index
    |=  i=index:a
    %-  pairs
    ?-  -.i
      %channel  ~[channel/s/(nest:enjs:gj nest.i)]
      %dm  ~[dm+(whom whom.i)]
    ==
  ::
  ++  reads
    |=  r=reads:a
    %-  pairs
    :~  floor+(time floor.r)
        posts+(post-reads event-parents.r)
    ==
  ::
  ++  post-reads
    |=  ep=event-parents:a
    %-  pairs
    %+  turn  (tap:on-parent:a ep)
    |=  [id=time-id:a p=event-parent:a]
    [(scot %ud id) (post-read p)]
  ::
  ++  post-read
    |=  p=event-parent:a
    %-  pairs
    :~  seen/b+seen.p
        floor+(time reply-floor.p)
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
        ?(%kick %join)
      %-  pairs
      :~  group+s+(flag:enjs:gj group.e)
          ship+(ship ship.e)
      ==
    ::
        %flag-post
      %-  pairs
      :~  key+(msg-key message-key.e)
          channel/s+(nest:enjs:gj nest.e)
      ==
    ::
        %flag-reply
      %-  pairs
      :~  parent+(msg-key parent.e)
          key+(msg-key message-key.e)
          channel/s+(nest:enjs:gj nest.e)
      ==
    ::
        %dm-post
      %-  pairs
      :~  key+(msg-key message-key.e)
          whom+(whom whom.e)
          content+(story:enjs:cj content.e)
          mention/b+mention.e
      ==
    ::
        %dm-reply
      %-  pairs
      :~  parent+(msg-key parent.e)
          key+(msg-key message-key.e)
          whom+(whom whom.e)
          content+(story:enjs:cj content.e)
          mention/b+mention.e
      ==
    ::
        %post
      %-  pairs
      :~  key+(msg-key message-key.e)
          channel/s+(nest:enjs:gj nest.e)
          content+(story:enjs:cj content.e)
          mention/b+mention.e
      ==
    ::
        %reply
      %-  pairs
      :~  parent+(msg-key parent.e)
          key+(msg-key message-key.e)
          channel/s+(nest:enjs:gj nest.e)
          content+(story:enjs:cj content.e)
          mention/b+mention.e
      ==
    ::
        %ask
      %-  pairs
      :~  group/s+(flag:enjs:gj group.e)
          ship+(ship ship.e)
      ==
    ::
        %role
      %-  pairs
      :~  group/s+(flag:enjs:gj group.e)
          ship+(ship ship.e)
          roles+a+(turn ~(tap in roles.e) |=(role=sect:g s+role))
      ==
    ::
        %group-invite
      %-  pairs
      :~  group/s+(flag:enjs:gj group.e)
          ship+(ship ship.e)
      ==
    ==
  ::
  +|  %scry-responses
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
    |=  [i=index:a s=stream:a r=reads:a]
    :-  (string-index i)
    %-  pairs
    :~  stream+(stream s)
        reads+(reads r)
    ==
  ::
  ++  unreads
    |=  us=unreads:a
    %-  pairs
    %+  turn  ~(tap by us)
    |=  [i=index:a sum=unread-summary:a]
    [(string-index i) (unread sum)]
  ::
  ++  full-info
    |=  fi=full-info:a
    %-  pairs
    :~  stream+(stream stream.fi)
        indices+(indices indices.fi)
        unreads+(unreads unreads.fi)
    ==
  ::
  +|  %subscription-facts
  ++  index-unreads
    |=  [i=index:a u=unread-summary:a]
    %-  pairs
    :~  index+(index i)
        unread+(unread u)
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
  ++  index
    %-  of
    :~  channel/nest:dejs:cj
        dm/dm-index
    ==
  ::
  ++  dm-index
    %-  of
    :~  ship/ship
        club/club-id
    ==
  ::
  ++  read-action
    %-  of
    :~  all/ul
        post/id
        thread/id
    ==
  ::
  +|  %updates
  ++  read
    %-  ot
    :~  index/index
        action/read-action
    ==
  ::
  ++  action
    %-  of
    :~  read/read
    ==
  --
--
