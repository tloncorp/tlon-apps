/-  a=activity, av=activity-ver, gv=groups-ver, c=chat
/+  gj=groups-json, cj=channel-json, dj=contacts-json-1,
    sj=story-json
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
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
  ::
  ++  allowed  (lead %s)
  ::
  ++  v9
    =,  v8
    |%
    ++  activity-bundle
      |=  ab=activity-bundle:v9:av
      %-  pairs
      :~  source+(source source.ab)
          source-key+s+(string-source source.ab)
          latest+s+(scot %ud latest.ab)
          events+a+(turn events.ab time-event)
      ==
    ++  event
      |=  e=event:v9:av
      %-  pairs
      :_  [notified+b+notified.e]~
        :-  -<.e
      ?-  -<.e
        %dm-invite  (whom whom.e)
      ::
          %chan-init
        %-  pairs
        :~  channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
        ==
      ::
          ?(%group-kick %group-join %group-ask %group-invite)
        %-  pairs
        :~  group+(flag:enjs:gj group.e)
            ship+(ship ship.e)
        ==
      ::
          %flag-post
        %-  pairs
        :~  key+(msg-key key.e)
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
        ==
      ::
          %flag-reply
        %-  pairs
        :~  parent+(msg-key parent.e)
            key+(msg-key key.e)
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
        ==
      ::
          %dm-post
        %-  pairs
        :~  key+(msg-key key.e)
            whom+(whom whom.e)
            content+(story:enjs:sj content.e)
            mention/b+mention.e
        ==
      ::
          %dm-reply
        %-  pairs
        :~  parent+(msg-key parent.e)
            key+(msg-key key.e)
            whom+(whom whom.e)
            content+(story:enjs:sj content.e)
            mention/b+mention.e
        ==
      ::
          %dm-react
        %-  pairs
        :~  key+(msg-key key.e)
            parent+?~(parent.e ~ (msg-key u.parent.e))
            whom+(whom whom.e)
            react+(react:v8:enjs:cj react.e)
        ==
      ::
          %post
        %-  pairs
        :~  key+(msg-key key.e)
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
            content+(story:enjs:sj content.e)
            mention/b+mention.e
        ==
      ::
          %reply
        %-  pairs
        :~  parent+(msg-key parent.e)
            key+(msg-key key.e)
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
            content+(story:enjs:sj content.e)
            mention/b+mention.e
        ==
      ::
          %react
        %-  pairs
        :~  key+(msg-key key.e)
            parent+?~(parent.e ~ (msg-key u.parent.e))
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
            author+(author:v8:enjs:cj author.e)
            react+(react:v8:enjs:cj react.e)
        ==
      ::
          %group-role
        %-  pairs
        :~  group/(flag:enjs:gj group.e)
            ship+(ship ship.e)
            roles+a+(turn ~(tap in roles.e) |=(role=sect:v0:gv s+role))
        ==
      ::
          %contact
        %-  pairs
        :~  who+(ship who.e)
            update+(contact:enjs:dj [update.e ~ ~])
        ==
      ==
    ++  stream
      |=  s=stream:v9:av
      %-  pairs
      %+  turn  (tap:on-event:v9:av s)
      |=  [=time:z e=event:v9:av]
      [(scot %ud time) (event e)]
    ::
    ++  indices
      |=  ind=indices:v9:av
      %-  pairs
      %+  turn  ~(tap by ind)
      |=  [sc=source:v9:av st=stream:v9:av r=reads:v9:av bump=^time]
      :-  (string-source sc)
      %-  pairs
      :~  stream+(stream st)
          reads+(reads r)
          last-self-activity+(time bump)
      ==
    ::
    ++  activity
      |=  [ac=activity:v9:av full=?]
      %-  pairs
      %+  turn  ~(tap by ac)
      |=  [s=source:v9:av sum=activity-summary:v9:av]
      :-  (string-source s)
      ?.  full  (activity-summary sum)
      (activity-summary-full sum)
    ::
    ++  activity-pairs
      |=  activity=(list [source:v9:av activity-summary:v9:av])
      :-  %a
      %+  turn
        activity
      |=  [s=source:v9:av as=activity-summary:v9:av]
      %-  pairs
      :~  source+(source s)
          activity+(activity-summary as)
      ==
    ::
    ++  full-info
      |=  fi=full-info:v9:av
      %-  pairs
      :~  indices+(indices indices.fi)
          activity+(activity activity.fi &)
          settings+(volume-settings volume-settings.fi)
      ==
    ++  volume-settings
      |=  vs=volume-settings:v9:av
      %-  pairs
      %+  turn  ~(tap by vs)
      |=  [s=source:v9:av v=volume-map:v9:av]
      [(string-source s) (volume-map v)]
    ::
    ++  volume-map
      |=  vm=volume-map:v9:av
      %-  pairs
      %+  turn  ~(tap by vm)
      |=  [e=event-type:v9:av v=volume:v9:av]
      [e (volume v)]
    ++  feed
      |=  f=feed:v9:av
      %-  pairs
      :~  feed+a+(turn feed.f activity-bundle)
          summaries+(activity summaries.f |)
      ==
    ::
    ++  feed-init
      |=  fi=feed-init:v9:av
      %-  pairs
      :~  all+a+(turn all.fi activity-bundle)
          mentions+a+(turn mentions.fi activity-bundle)
          replies+a+(turn replies.fi activity-bundle)
          summaries+(activity summaries.fi |)
      ==
    ++  time-event
      |=  te=time-event:v9:av
      %-  pairs
      :~  time+s+(scot %ud time.te)
          event+(event event.te)
      ==
    --
  ::
  ++  v8
    |%
    ++  string-source
      |=  s=source:v8:av
      ^-  cord
      ?-  -.s
        %base  'base'
        %group  (rap 3 'group/' (print-flag:enjs:gj flag.s) ~)
        %channel  (rap 3 'channel/' (print-nest:enjs:gj nest.s) ~)
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
            (print-nest:enjs:gj channel.s)
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
      ::
          %contact
        (cat 3 'contact/' (scot %p who.s))
      ==
    ::
    ++  source
      |=  s=source:v8:av
      %-  pairs
      ?-  -.s
        %base  ~[base+~]
        %group  ~[group+(flag:enjs:gj flag.s)]
        %dm  ~[dm+(whom whom.s)]
        %contact  ~[contact+(ship who.s)]
      ::
          %channel
        :~  :-  %channel
            %-  pairs
            ::XX we should use channel-json for encoding
            ::   nests.
            :~  nest+(nest:enjs:gj nest.s)
                group+(flag:enjs:gj group.s)
            ==
        ==
      ::
          %thread
        :~  :-  %thread
            %-  pairs
            :~  channel/(nest:enjs:gj channel.s)
                group/(flag:enjs:gj group.s)
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
    ++  activity-summary
      |=  sum=activity-summary:v8:av
      %-  pairs
      :~  recency+(time newest.sum)
          recency-uv+s+(scot %uv newest.sum)
          count+(numb count.sum)
          notify-count+(numb notify-count.sum)
          notify+b+notify.sum
          unread/?~(unread.sum ~ (unread-point u.unread.sum))
      ==
    ::
    ++  activity-summary-full
      |=  sum=activity-summary:v8:av
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
      |=  ab=activity-bundle:v8:av
      %-  pairs
      :~  source+(source source.ab)
          source-key+s+(string-source source.ab)
          latest+s+(scot %ud latest.ab)
          events+a+(turn events.ab time-event)
      ==
    ++  event
      |=  e=event:v8:av
      %-  pairs
      :_  [notified+b+notified.e]~
        :-  -<.e
      ?-  -<.e
        %dm-invite  (whom whom.e)
      ::
          %chan-init
        %-  pairs
        :~  channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
        ==
      ::
          ?(%group-kick %group-join %group-ask %group-invite)
        %-  pairs
        :~  group+(flag:enjs:gj group.e)
            ship+(ship ship.e)
        ==
      ::
          %flag-post
        %-  pairs
        :~  key+(msg-key key.e)
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
        ==
      ::
          %flag-reply
        %-  pairs
        :~  parent+(msg-key parent.e)
            key+(msg-key key.e)
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
        ==
      ::
          %dm-post
        %-  pairs
        :~  key+(msg-key key.e)
            whom+(whom whom.e)
            content+(story:enjs:sj content.e)
            mention/b+mention.e
        ==
      ::
          %dm-reply
        %-  pairs
        :~  parent+(msg-key parent.e)
            key+(msg-key key.e)
            whom+(whom whom.e)
            content+(story:enjs:sj content.e)
            mention/b+mention.e
        ==
      ::
          %post
        %-  pairs
        :~  key+(msg-key key.e)
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
            content+(story:enjs:sj content.e)
            mention/b+mention.e
        ==
      ::
          %reply
        %-  pairs
        :~  parent+(msg-key parent.e)
            key+(msg-key key.e)
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
            content+(story:enjs:sj content.e)
            mention/b+mention.e
        ==
      ::
          %group-role
        %-  pairs
        :~  group/(flag:enjs:gj group.e)
            ship+(ship ship.e)
            roles+a+(turn ~(tap in roles.e) |=(role=sect:v0:gv s+role))
        ==
      ::
          %contact
        %-  pairs
        :~  who+(ship who.e)
            update+(contact:enjs:dj [update.e ~ ~])
        ==
      ==
    ++  stream
      |=  s=stream:v8:av
      %-  pairs
      %+  turn  (tap:on-event:v8:av s)
      |=  [=time:z e=event:v8:av]
      [(scot %ud time) (event e)]
    ::
    ++  indices
      |=  ind=indices:v8:av
      %-  pairs
      %+  turn  ~(tap by ind)
      |=  [sc=source:v8:av st=stream:v8:av r=reads:v8:av bump=^time]
      :-  (string-source sc)
      %-  pairs
      :~  stream+(stream st)
          reads+(reads r)
          last-self-activity+(time bump)
      ==
    ::
    ++  activity
      |=  [ac=activity:v8:av full=?]
      %-  pairs
      %+  turn  ~(tap by ac)
      |=  [s=source:v8:av sum=activity-summary:v8:av]
      :-  (string-source s)
      ?.  full  (activity-summary sum)
      (activity-summary-full sum)
    ::
    ++  activity-pairs
      |=  activity=(list [source:v8:av activity-summary:v8:av])
      :-  %a
      %+  turn
        activity
      |=  [s=source:v8:av as=activity-summary:v8:av]
      %-  pairs
      :~  source+(source s)
          activity+(activity-summary as)
      ==
    ::
    ++  full-info
      |=  fi=full-info:v8:av
      %-  pairs
      :~  indices+(indices indices.fi)
          activity+(activity activity.fi &)
          settings+(volume-settings volume-settings.fi)
      ==
    ++  volume-settings
      |=  vs=volume-settings:v8:av
      %-  pairs
      %+  turn  ~(tap by vs)
      |=  [s=source:v8:av v=volume-map:v8:av]
      [(string-source s) (volume-map v)]
    ::
    ++  volume-map
      |=  vm=volume-map:v8:av
      %-  pairs
      %+  turn  ~(tap by vm)
      |=  [e=event-type:v8:av v=volume:v8:av]
      [e (volume v)]
    ++  feed
      |=  f=feed:v8:av
      %-  pairs
      :~  feed+a+(turn feed.f activity-bundle)
          summaries+(activity summaries.f |)
      ==
    ::
    ++  time-event
      |=  te=time-event:v8:av
      %-  pairs
      :~  time+s+(scot %ud time.te)
          event+(event event.te)
      ==
    ++  update
      |=  u=update:v8:av
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
      |=  [src=source:v8:av te=time-event:v8:av]
      %-  pairs
      :~  source+(source src)
          source-key+s+(string-source src)
          time+(time time.te)
          event+(event event.te)
      ==
    ::
    ++  read
      |=  [s=source:v8:av as=activity-summary:v8:av]
      %-  pairs
      :~  source+(source s)
          activity+(activity-summary as)
      ==
    ::
    ++  adjusted
      |=  [s=source:v8:av v=(unit volume-map:v8:av)]
      %-  pairs
      :~  source+(source s)
          volume+?~(v ~ (volume-map u.v))
      ==
    --
  ++  v4
    =,  v3
    |%
    ++  feed
      |=  f=feed:v4:av
      a+(turn f activity-bundle)
    ++  activity-bundle
      |=  ab=activity-bundle:v4:av
      %-  pairs
      :~  source+(source source.ab)
          source-key+s+(string-source source.ab)
          latest+s+(scot %ud latest.ab)
          events+a+(turn events.ab time-event)
      ==
    ++  time-event
      |=  te=time-event:v4:av
      %-  pairs
      :~  time+s+(scot %ud time.te)
          event+(event event.te)
      ==
    --
  ++  v3
    =,  v2
    |%
    ++  update
      |=  u=update:v3:av
      %+  frond  -.u
      ?-  -.u
        %add  (added +.u)
        %del  (source +.u)
        %read  (read +.u)
        %adjust  (adjusted +.u)
        %allow-notifications  (allowed +.u)
      ==
    ++  read
      |=  [s=source:v3:av as=activity-summary:v3:av]
      %-  pairs
      :~  source+(source s)
          activity+(activity-summary as)
      ==
    ++  full-info
      |=  fi=full-info:v3:av
      %-  pairs
      :~  indices+(indices indices.fi)
          activity+(activity activity.fi)
          settings+(volume-settings volume-settings.fi)
      ==
    ++  indices
      |=  ind=indices:v3:av
      %-  pairs
      %+  turn  ~(tap by ind)
      |=  [sc=source:v3:av st=stream:v3:av r=reads:v3:av]
      :-  (string-source sc)
      %-  pairs
      :~  stream+(stream st)
          reads+(reads r)
      ==
    ::
    ++  activity
      |=  ac=activity:v3:av
      %-  pairs
      %+  turn  ~(tap by ac)
      |=  [s=source:v3:av sum=activity-summary:v3:av]
      [(string-source s) (activity-summary sum)]
    ::
    ++  activity-summary
      |=  sum=activity-summary:v3:av
      %-  pairs
      :~  recency+(time newest.sum)
          count+(numb count.sum)
          notify+b+notify.sum
          notify-count+(numb notify-count.sum)
          unread/?~(unread.sum ~ (unread-point u.unread.sum))
          children+?~(children.sum ~ (activity u.children.sum))
          reads+?:(=(reads.sum *reads:v3:av) ~ (reads reads.sum))
      ==
    --
  ++  v2
    |%
    ++  string-source
      |=  s=source:v2:av
      ^-  cord
      ?-  -.s
        %base  'base'
        %group  (rap 3 'group/' (print-flag:enjs:gj flag.s) ~)
        %channel  (rap 3 'channel/' (print-nest:enjs:gj nest.s) ~)
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
            (print-nest:enjs:gj channel.s)
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
    ++  source
      |=  s=source:v2:av
      %-  pairs
      ?-  -.s
        %base  ~[base+~]
        %group  ~[group+(flag:enjs:gj flag.s)]
        %dm  ~[dm+(whom whom.s)]
      ::
          %channel
        :~  :-  %channel
            %-  pairs
            ::XX we should use channel-json for encoding
            ::   nests.
            :~  nest+(nest:enjs:gj nest.s)
                group+(flag:enjs:gj group.s)
            ==
        ==
      ::
          %thread
        :~  :-  %thread
            %-  pairs
            :~  channel/(nest:enjs:gj channel.s)
                group/(flag:enjs:gj group.s)
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
    ++  update
      |=  u=update:v2:av
      %+  frond  -.u
      ?-  -.u
        %add  (added +.u)
        %del  (source +.u)
        %read  (read +.u)
        %adjust  (adjusted +.u)
        %allow-notifications  (allowed +.u)
      ==
    ++  adjusted
      |=  [s=source:v2:av v=(unit volume-map:v2:av)]
      %-  pairs
      :~  source+(source s)
          volume+?~(v ~ (volume-map u.v))
      ==
    ++  added
      |=  [src=source:v2:av te=time-event:v2:av]
      %-  pairs
      :~  source+(source src)
          source-key+s+(string-source src)
          time+(time time.te)
          event+(event event.te)
      ==
    ++  read
      |=  [s=source:v2:av as=activity-summary:v2:av]
      %-  pairs
      :~  source+(source s)
          activity+(activity-summary as)
      ==
    ++  full-info
      |=  fi=full-info:v2:av
      %-  pairs
      :~  indices+(indices:v3 indices.fi)
          activity+(activity activity.fi)
          settings+(volume-settings volume-settings.fi)
      ==
    ++  activity
      |=  ac=activity:v2:av
      %-  pairs
      %+  turn  ~(tap by ac)
      |=  [s=source:v2:av sum=activity-summary:v2:av]
      [(string-source s) (activity-summary sum)]
    ++  activity-summary
      |=  sum=activity-summary:v2:av
      %-  pairs
      :~  recency+(time newest.sum)
          count+(numb count.sum)
          notify+b+notify.sum
          unread/?~(unread.sum ~ (unread-point u.unread.sum))
          children+?~(children.sum ~ (activity u.children.sum))
      ==
    ++  volume-settings
      |=  vs=volume-settings:v2:av
      %-  pairs
      %+  turn  ~(tap by vs)
      |=  [s=source:v2:av v=volume-map:v2:av]
      [(string-source s) (volume-map v)]
    ++  volume-map
      |=  vm=volume-map:v2:av
      %-  pairs
      %+  turn  ~(tap by vm)
      |=  [e=event-type:v2:av v=volume:v2:av]
      [e (volume v)]
    ++  event
      |=  e=event:v2:av
      %-  pairs
      :_  [notified+b+notified.e]~
        :-  -<.e
      ?-  -<.e
        %dm-invite  (whom whom.e)
      ::
          %chan-init
        %-  pairs
        :~  channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
        ==
      ::
          ?(%group-kick %group-join %group-ask %group-invite)
        %-  pairs
        :~  group+(flag:enjs:gj group.e)
            ship+(ship ship.e)
        ==
      ::
          %flag-post
        %-  pairs
        :~  key+(msg-key key.e)
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
        ==
      ::
          %flag-reply
        %-  pairs
        :~  parent+(msg-key parent.e)
            key+(msg-key key.e)
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
        ==
      ::
          %dm-post
        %-  pairs
        :~  key+(msg-key key.e)
            whom+(whom whom.e)
            content+(story:enjs:sj content.e)
            mention/b+mention.e
        ==
      ::
          %dm-reply
        %-  pairs
        :~  parent+(msg-key parent.e)
            key+(msg-key key.e)
            whom+(whom whom.e)
            content+(story:enjs:sj content.e)
            mention/b+mention.e
        ==
      ::
          %post
        %-  pairs
        :~  key+(msg-key key.e)
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
            content+(story:enjs:sj content.e)
            mention/b+mention.e
        ==
      ::
          %reply
        %-  pairs
        :~  parent+(msg-key parent.e)
            key+(msg-key key.e)
            channel/(nest:enjs:gj channel.e)
            group/(flag:enjs:gj group.e)
            content+(story:enjs:sj content.e)
            mention/b+mention.e
        ==
      ::
          %group-role
        %-  pairs
        :~  group/(flag:enjs:gj group.e)
            ship+(ship ship.e)
            roles+a+(turn ~(tap in roles.e) |=(role=sect:v0:gv s+role))
        ==
      ==
    ++  stream
      |=  s=stream:v2:av
      %-  pairs
      %+  turn  (tap:on-event:v2:av s)
      |=  [=time:z e=event:v2:av]
      [(scot %ud time) (event e)]
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
  ++  v8
    |%
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
    ++  action
      ^-  $-(json action:a)
      %-  of
      :~  add/add
          clear-group-invites/ul
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
    ++  source
      ^-  $-(json source:a)
      %-  of
      :~  base/ul
          group/flag:dejs:gj
          dm/whom
          channel/channel-source
          thread/thread-source
          dm-thread/dm-thread-source
          ::TODO contact
      ==
    ::
    ++  channel-source
      %-  ot
      :~  nest+nest:dejs:cj
          group+flag:dejs:gj
      ==
    ++  thread-source
      %-  ot
      :~  key+msg-key
          channel+nest:dejs:cj
          group+flag:dejs:gj
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
          ::TODO contact
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
          content/story:dejs:sj
          mention/bo
      ==
    ::
    ++  reply-event
      %-  ot
      :~  key/msg-key
          parent/msg-key
          channel/nest:dejs:cj
          group/flag:dejs:gj
          content/story:dejs:sj
          mention/bo
      ==
    ::
    ++  dm-post-event
      %-  ot
      :~  key/msg-key
          whom/whom
          content/story:dejs:sj
          mention/bo
      ==
    ::
    ++  dm-reply-event
      %-  ot
      :~  key/msg-key
          parent/msg-key
          whom/whom
          content/story:dejs:sj
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
--
