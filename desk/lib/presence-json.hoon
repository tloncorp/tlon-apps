::  presence-json: short-lived personal activity json conversions
::
/-  *presence
::
|%
++  dejs
  =,  dejs:format
  |%
  ++  key      (ot 'context'^pa 'ship'^(se %p) 'topic'^topic ~)
  ++  topic    (su (perk %typing %computing %other ~))
  ++  display  (ot 'icon'^(mu so) 'text'^(mu so) 'blob'^(mu so) ~)
  ::
  ++  action-1
    ^-  $-(json ^action-1)
    ::REVIEW  could flatten, could take 'type'
    %-  of
    :~  :-  %set
        %-  ot
        :~  :-  'disclose'  (as (se %p))
            :-  'key'       key
            :-  'timeout'   (mu (se %dr))
            :-  'display'   display
        ==
      ::
        [%clear key]
        [%nuke pa]
    ==
  --
::
++  enjs
  =,  enjs:format
  |%
  ++  key
    |=  ^key
    %-  pairs
    :~  :-  'context'  (path context)
        :-  'ship'     s+(scot %p ship)
        :-  'topic'    s+topic
    ==
  ++  timing
    |=  ^timing
    %-  pairs
    :~  :-  'since'    s+(scot %da since)
        :-  'timeout'  ?~(timeout ~ s+(scot %dr u.timeout))
    ==
  ++  display
    |=  ^display
    %-  pairs
    :~  :-  'icon'  ?~(icon ~ s+u.icon)
        :-  'text'  ?~(text ~ s+u.text)
        :-  'blob'  ?~(blob ~ s+u.blob)
    ==
  ::
  ++  response-1
    |=  res=^response-1
    %+  frond  -.res
    ?-  -.res
        %init
      :-  %o
      ::REVIEW  could flatten
      %-  ~(rep by places.res)
      |=  [[=context =topics] o=(map @t json)]
      %+  ~(put by o)  (spat context)
      :-  %o
      %-  ~(rep by topics)
      |=  [[=topic =people] o=(map @t json)]
      %+  ~(put by o)  topic
      :-  %o
      %-  ~(rep by people)
      |=  [[ship=@p t=^timing d=^display] o=(map @t json)]
      %+  ~(put by o)  (scot %p ship)
      ::REVIEW  could flatten
      (pairs 'timing'^(timing t) 'display'^(display d) ~)
    ::
        %here
      %-  pairs
      ::REVIEW  could flatten
      :~  :-  'key'      (key key.res)
          :-  'timing'   (timing timing.res)
          :-  'display'  (display display.res)
      ==
    ::
      %gone  (key key.res)
    ==
  --
--
