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
::      "/gall/groups | groups failed | nest-fail | on-agent/contact | -have.@p -need.%full | app/groups>sys/vane/gall"
::    origin; the developer's message (first line of the echo); the first
::    error tag in the tang (why); the last tag, usually a ~| dispatch hint
::    (where); type detail from -have/-need lines and code= tokens; and the
::    chain of source files in the stack with line numbers stripped.
::    fingerprint is eight hex digits of its +mug. exact adds the innermost
::    span with its line numbers, so it distinguishes crash sites within a
::    release while fingerprint stays constant across releases.
::    %tell events have no fingerprint.
::
++  fingerprint
  |=  [origin=path event=log-event]
  ^-  (unit [fp=@t sig=@t exact=@t])
  ?.  ?=(%fail -.event)  ~
  =/  message=tape  (head-line echo.event)
  =/  lines=(list tape)  (tang-lines tang.event)
  =/  tags=(list tape)  (find-tags lines)
  =/  reason=(unit tape)  ?~(tags ~ `i.tags)
  =/  where=(unit tape)
    ?~  tags  ~
    =/  last=tape  (rear tags)
    ?:(=(last i.tags) ~ `last)
  =/  detail=tape  (find-detail lines)
  =/  chain=tape  (file-chain lines)
  =/  sig=tape
    ;:  welp
      (spud origin)
      " | "  message
      ?~(reason "" (welp " | " u.reason))
      ?~(where "" (welp " | " u.where))
      ?:(=("" detail) "" (welp " | " detail))
      ?:(=("" chain) "" (welp " | " chain))
    ==
  =/  site=tape
    =/  spans  (skim lines |=(l=tape (span-line (trim-line l))))
    ?~(spans "" (trim-line i.spans))
  :-  ~
  :+  (crip ((x-co:co 8) (mug sig)))
    (crip (scag 240 sig))
  (crip ((x-co:co 8) (mug (welp sig site))))
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
::  +tokens: split on spaces, dropping brackets and quotes
::
++  tokens
  |=  l=tape
  ^-  (list tape)
  =/  toks=(list tape)
    %+  murn  (split-spaces l)
    |=  t=tape
    =/  clean=tape  (skip t |=(c=@tD |(=(c 91) =(c 93) =(c 39))))
    ?~(clean ~ `clean)
  toks
::
++  split-spaces
  |=  l=tape
  ^-  (list tape)
  =|  cur=tape
  =|  out=(list tape)
  |-
  ?~  l
    (flop ?~(cur out [(flop cur) out]))
  ?:  =(32 i.l)
    $(l t.l, cur ~, out ?~(cur out [(flop cur) out]))
  $(l t.l, cur [i.l cur])
::  +find-tags: every error tag in a tang, in order
::
::    a tag is a single lowercase token like "se-c-join-access-denied", or
::    the %terms and ~.knots of a bracketed line like
::    "[%bad-agent-take ~.contact ~]" joined as "bad-agent-take/contact",
::    which is also how ~| dispatch hints render. spans, commit markers,
::    key=value dumps, -have/-need lines and gall's own wire labels
::    ("watch-ack", "poke-fail") are skipped: they say where, not why.
::
++  find-tags
  |=  lines=(list tape)
  ^-  (list tape)
  %+  murn  lines
  |=  line=tape
  ^-  (unit tape)
  =/  l=tape  (trim-line line)
  ?:  ?|  =(~ l)
          (span-line l)
          ?=(^ (find "commit " l))
          ?=(^ (find "=" l))
          &(?=(^ l) =(45 i.l))
      ==
    ~
  ?:  &(?=(^ l) =(91 i.l))
    =/  parts=(list tape)
      %+  murn  (tokens l)
      |=  t=tape
      ^-  (unit tape)
      ?:  &(?=(^ t) =(37 i.t) ?=(^ t.t) (lower i.t.t))  `t.t
      ?:  &(?=([@ @ *] t) =(126 i.t) =(46 i.t.t) ?=(^ t.t.t))  `t.t.t
      ~
    ?~  parts  ~
    ?:  (gall-wire i.parts)  ~
    `(zing (join "/" parts))
  =/  toks  (tokens l)
  ?.  ?=([* ~] toks)  ~
  =/  t=tape  i.toks
  =?  t  &(?=(^ t) =(37 i.t))  t.t
  ?.  &(?=(^ t) (lower i.t))  ~
  ?:  (gall-wire t)  ~
  `t
::
++  lower
  |=(c=@tD &((gte c 97) (lte c 122)))
::  +find-detail: type and status detail that narrows a generic tag
::
::    "-have.@p -need.%full" for nest-fails, "code=500" for http failures.
::    at most three items; user data never qualifies.
::
++  find-detail
  |=  lines=(list tape)
  ^-  tape
  =/  items=(list tape)
    %-  scag  :-  3
    %+  murn  lines
    |=  line=tape
    ^-  (unit tape)
    =/  l=tape  (trim-line line)
    ?:  |(?=(^ (find "-have." l)) ?=(^ (find "-need." l)))
      `(zing (join " " (tokens l)))
    =/  toks  (tokens l)
    ?.  ?=([* ~] toks)  ~
    ?:  =("code=" (scag 5 i.toks))  `i.toks
    ~
  (zing (join " " items))
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
      'agent'  'arvo'  'on-fail'
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
