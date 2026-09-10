/-  *logs
=<
  |_  [=bowl:gall =wire]
  ::
  ++  fail
    |=  [vol=volume =echo =tang =log-data]
    ~>  %spin.['logs-fail']
    ^-  card:agent:gall
    =/  event=$>(%fail log-event)
      [%fail vol echo tang]
    (pass event log-data)
  ::
  ++  on-fail
    |=  [=term =tang]
    ~>  %spin.['logs-on-fail']
    ^-  card:agent:gall
    (fail %error ~[(cat 3 dap.bowl ' failed')] [leaf+"{<term>}" tang] ~)
  ::
  ++  tell
    |=  [vol=volume =echo =log-data]
    ~>  %spin.['logs-tell']
    ^-  card:agent:gall
    =/  event=$>(%tell log-event)
      [%tell vol echo]
    (pass event log-data)
  ::
  ++  pass
    |=  [event=log-event data=log-data]
    ^-  card:agent:gall
    [%pass wire %agent [our.bowl %logs] %poke log-action-1+!>(`a-log`[%log event data])]
  --
|%
::
++  volume-val
  |=  =volume
  ^-  @ud
  ?-  volume
    %trace  0
    %dbug   1
    %info   2
    %warn   3
    %error  4
    %fatal  5
  ==
::
++  volume-pri
  |=  =volume
  ^-  @ud
  ?-  volume
    %trace  0
    %dbug   0
    %info   1
    %warn   2
    %error  3
    %fatal  3
  ==
::  +fingerprint: stable identity for a %fail, independent of line numbers
::
::    signature is human-readable, built from parts that survive a recompile:
::      "/gall/groups | group join failed | se-c-join-access-denied | app/groups>sys/vane/gall"
::    origin, the developer's message (first line of the echo), the first
::    error tag in the tang, and the chain of source files in the stack
::    trace with line numbers stripped. fingerprint is eight hex digits of
::    its +mug. %tell events have no fingerprint.
::
++  fingerprint
  |=  [origin=path event=log-event]
  ^-  (unit [fp=@t sig=@t])
  ?.  ?=(%fail -.event)  ~
  =/  message=tape  (head-line echo.event)
  =/  lines=(list tape)  (tang-lines tang.event)
  =/  reason=(unit tape)  (find-reason lines)
  =/  chain=tape  (file-chain lines)
  =/  sig=tape
    ;:  welp
      (spud origin)
      " | "  message
      ?~(reason "" (welp " | " u.reason))
      ?:(=("" chain) "" (welp " | " chain))
    ==
  :-  ~
  :-  (crip ((x-co:co 8) (mug sig)))
  (crip (scag 240 sig))
::  +tang-lines: wash a tang into lines, wide enough that spans don't wrap
::
++  tang-lines
  |=  t=tang
  ^-  (list tape)
  (zing (turn t (cury wash [0 200])))
::  +head-line: first line of a tang, trimmed
::
++  head-line
  |=  t=tang
  ^-  tape
  =/  lines  (tang-lines t)
  ?~  lines  ""
  (trim-line i.lines)
::  +trim-line: drop leading spaces and the "! " that gall prefixes
::
++  trim-line
  |=  l=tape
  ^-  tape
  =.  l  |-(?:(&(?=(^ l) =(32 i.l)) $(l t.l) l))
  ?:(&(?=([@ @ *] l) =(33 i.l) =(32 i.t.l)) t.t.l l)
::  +span-line: "/app/groups/hoon:<[2.150 5].[2.152 41]>"
::
++  span-line
  |=  l=tape
  ^-  ?
  ?&  ?=(^ l)
      =(47 i.l)
      ?=(^ (find ":<[" l))
  ==
::  +find-reason: the first error tag in a tang
::
::    a tag is a single token like "se-c-join-access-denied", or a
::    %-prefixed one anywhere in the line like "[%bad-agent-take ~.contact ~]".
::    spans, commit markers, key=value dumps and gall's own wire names
::    ("watch-ack", "poke-fail") are skipped so they don't stand in for
::    the actual cause.
::
++  find-reason
  |=  lines=(list tape)
  ^-  (unit tape)
  |-
  ?~  lines  ~
  =/  l=tape  (trim-line i.lines)
  ?:  ?|  =(~ l)
          (span-line l)
          ?=(^ (find "commit " l))
      ==
    $(lines t.lines)
  =?  l  &(?=(^ l) =(91 i.l))  t.l
  =/  tok=tape  (scag (fall (find " " l) (lent l)) l)
  =/  single=?  =((lent tok) (lent l))
  ?:  ?=(^ (find "=" tok))  $(lines t.lines)
  =.  tok  (skip tok |=(c=@tD |(=(c 93) =(c 39))))  ::  drop ']' and quotes
  =?  tok  &(?=(^ tok) =(37 i.tok))  t.tok
  ?:  (gall-wire tok)  $(lines t.lines)
  ?:  ?&  ?=(^ tok)
          (gte i.tok 'a')
          (lte i.tok 'z')
          |(single (tagged (trim-line i.lines)))
      ==
    `tok
  $(lines t.lines)
::  +tagged: line starts with a %tag, bare or in brackets
::
++  tagged
  |=  l=tape
  ^-  ?
  ?|  &(?=(^ l) =(37 i.l))
      &(?=([@ @ *] l) =(91 i.l) =(37 i.t.l))
  ==
::  +gall-wire: gall's own labels for where a crash happened, not why
::
++  gall-wire
  |=  tok=tape
  ^-  ?
  %-  ~(has in gall-wires)
  (crip tok)
::
++  gall-wires
  ^-  (set @t)
  %-  sy
  :~  'poke-ack'  'watch-ack'  'poke-fail'  'watch-fail'  'fact'  'kick'
      'agent'  'arvo'  'on-poke'  'on-watch'  'on-agent'  'on-arvo'
      'on-init'  'on-load'  'on-leave'  'on-save'  'on-peek'  'on-fail'
  ==
::  +file-chain: source files in the stack, deduplicated, no line numbers
::
::    "/app/groups/hoon:<..>" lines become "app/groups"; consecutive repeats
::    collapse; capped at six entries: "app/groups>lib/negotiate>sys/vane/gall"
::
++  file-chain
  |=  lines=(list tape)
  ^-  tape
  =/  files=(list tape)
    %+  murn  lines
    |=  l=tape
    ^-  (unit tape)
    =.  l  (trim-line l)
    ?.  (span-line l)  ~
    =/  file=tape  (scag (need (find ":<[" l)) l)
    =?  file  &(?=(^ file) =(47 i.file))  t.file
    =/  suf=tape  "/hoon"
    =?  file  ?&  (gte (lent file) (lent suf))
                  =(suf (slag (sub (lent file) (lent suf)) file))
              ==
      (scag (sub (lent file) (lent suf)) file)
    `file
  =/  chain=(list tape)
    %-  flop
    %+  roll  files
    |=  [f=tape acc=(list tape)]
    ?:  &(?=(^ acc) =(f i.acc))  acc
    [f acc]
  (zing (join ">" (scag 6 chain)))
::
++  enjs
  =,  format
  |%
  ++  tang
    |=  t=^tang
    ^-  $>(%a json)
    ?~  t  a+~
    =/  tame=(list tape)
      %-  zing
      %+  turn  t
      (cury wash [0 80])
    a+(turn tame tape:enjs)
  ::
  ++  log-event
    |=  e=^log-event
    ^-  $>(%o json)
    =*  event-type  -.e
    ?-    -.e
        %fail
      =-  ?>(?=(%o -.-) -)
      %-  pairs:enjs
      :~  type/s+event-type
          volume/s+vol.e
          message/(tang echo.e)
          stacktrace/(tang tang.e)
      ==
    ::
        %tell
      =-  ?>(?=(%o -.-) -)
      %-  pairs:enjs
      :~  type/s+event-type
          volume/s+vol.e
          message/(tang echo.e)
      ==
    ==
  --
++  dejs
  =,  dejs:format
  |%
  ++  a-log
    ^-  $-(json a-log:v1)
    ::  %log variant unsupported
    %-  of
    :~  set-volume+(mu volume)
        set-otel+(mu so)
    ==
  ++  volume
    ^-  $-(json volume:v1)
    %-  su
    (perk %trace %dbug %info %warn %error %fatal ~)
  --
--
