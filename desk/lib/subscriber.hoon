=<  subscriber
|%
+$  sub
  $:  =dock
      =path
  ==
::
+$  subs  (map wire sub)
::
++  subscriber
  |_  [=subs bowl:gall]
  ++  interval  ~s30
  ++  handle-wakeup
    |=  =wire
    ^-  [(unit card:agent:gall) _subs]
    ?>  ?=([%~.~ %retry *] wire)
    =/  sub  (~(get by subs) t.t.wire)
    ?~  sub  [~ subs]
    :-  `[%pass t.wire %agent dock.u.sub %watch path.u.sub]
    (~(del by subs) t.t.wire)
  ++  subscribe
    |=  [=wire =dock =path delay=?]
    ^-  [(unit card:agent:gall) _subs]
    ?:  (~(has by subs) wire)
      ((slog 'Duplicate subscription' >[wire dock]< ~) [~ subs])
    ?.  delay  [`[%pass wire %agent dock %watch path] subs]
    :_  (~(put by subs) wire [dock path])
    `[%pass (weld /~/retry wire) %arvo %b %wait (add now interval)]
  --
--