::  Durable conversation modification metadata, separate from semantic history.
/-  h=harness
|%
++  seed
  |=  sessions=(map session-id:h session:h)
  ^-  (map session-id:h @da)
  %-  ~(run by sessions)
  |=  ses=session:h
  ^-  @da
  =/  events  log.ses
  |-  ^-  @da
      ?~  events  `@da`0
      ?:  ?=(%input-received -.i.events)  at.input.i.events
      $(events t.events)
++  update
  |=  $:  before=(map session-id:h session:h)  after=(map session-id:h session:h)
          modified=(map session-id:h @da)  at=@da
      ==
  ^-  (map session-id:h @da)
  %+  roll  ~(tap by after)
  |=  [[sid=session-id:h ses=session:h] out=(map session-id:h @da)]
  =/  prior  (~(get by before) sid)
  =/  when
    ?:  &(?=(^ prior) =(u.prior ses))
      (fall (~(get by modified) sid) `@da`0)
    at
  (~(put by out) sid when)
++  list-json
  |=  [sessions=(map session-id:h session:h) modified=(map session-id:h @da)]
  ^-  json
  =/  rows
    %+  turn  ~(tap in ~(key by sessions))
    |=  sid=session-id:h
    [sid (fall (~(get by modified) sid) `@da`0)]
  =.  rows
    %+  sort  rows
    |=  [a=[sid=session-id:h at=@da] b=[sid=session-id:h at=@da]]
    ?:  =(at.a at.b)  (aor sid.a sid.b)
    (gth at.a at.b)
  %-  pairs:enjs:format
  :~  :-  'sessions'
      :-  %a
      %+  turn  rows
      |=  [sid=session-id:h at=@da]
      %-  pairs:enjs:format
      :~  ['sessionId' %s sid]
          ['title' %s sid]
          ['cwd' %s '/']
          :*  'modifiedAt'
              ?:((lth at ~1970.1.1) ~ (numb:enjs:format (div (mul 1.000 (sub at ~1970.1.1)) ~s1)))
          ==
      ==
  ==
--
