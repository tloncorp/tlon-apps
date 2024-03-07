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
  ++  msg-id
    |=  id=message-id:a
    (rap 3 (scot %p p.id) '/' (scot %ud q.id) ~)
  +|  %basics
  ::
  ++  index
    |=  i=index:a
    ^-  cord
    ?-  -.i
      %channel  (rap 3 'channel/' (nest:enjs:gj channel.i) ~)
    ::
        %dm
      ?-  -.whom.i
        %ship  (rap 3 'ship/' (scot %p p.whom.i) ~)
        %club  (rap 3 'club/' (scot %uv p.whom.i) ~)
      ==
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
        %flag
      %-  pairs
      :~  key+(msg-key message-key.e)
          channel/s+(nest:enjs:gj channel.e)
          group/s+(flag:enjs:gj group.e)
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
      :~  parent+(msg-key message-key.e)
          key+(msg-key target.e)
          whom+(whom whom.e)
          content+(story:enjs:cj content.e)
          mention/b+mention.e
      ==
    ::
        %post
      %-  pairs
      :~  key+(msg-key message-key.e)
          group/s+(flag:enjs:gj group.e)
          channel/s+(nest:enjs:gj channel.e)
          content+(story:enjs:cj content.e)
          mention/b+mention.e
      ==
    ::
        %reply
      %-  pairs
      :~  parent+(msg-key message-key.e)
          key+(msg-key target.e)
          group/s+(flag:enjs:gj group.e)
          channel/s+(nest:enjs:gj channel.e)
          content+(story:enjs:cj content.e)
          mention/b+mention.e
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
    :-  (index i)
    %-  pairs
    :~  stream+(stream s)
        reads+(reads r)
    ==
  ::
  ++  unreads
    |=  us=(map index:a unread-summary:a)
    %-  pairs
    %+  turn  ~(tap by us)
    |=  [i=index:a sum=unread-summary:a]
    :-  (index i)
    %-  pairs
    :~  newest+(time newest.sum)
        count+(numb count.sum)
        :-  %threads
        :-  %a
        %+  turn
          threads.sum
        |=  [oldest=time:z count=@ud]
        %-  pairs
        :~  oldest+(time oldest)
            count+(numb count)
        ==
    ==
  ::
  ++  full-info
    |=  fi=full-info:a
    %-  pairs
    :~  stream+(stream stream.fi)
        indices+(indices indices.fi)
        unreads+(unreads unreads.fi)
    ==
  ::
  --
::
++  dejs
  =,  dejs:format
  |%
  :: +|  %primitives
  ::
  --
--
