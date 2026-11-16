::  Full adapter, synthetic scries only; no emitted cards are executed.
::  -test /=harness=/tests-integration/harness-tlon-authority
/-  t=harness-tlon, c=harness-cron, ad=harness-adapter, h=harness, g=groups-ver
/+  *test-agent
/=  adapter  /app/harness-tlon
|%
++  fixture
  ^-  state-2:t
  =/  s=state-2:t  *state-2:t
  =.  owner-initialized.s  1
  =.  policy.s  [& `~nec ~ %mentions ~ ~]
  =.  lanes.s  (my ~[['source' [~nec [%dm ~nec ~] 1 ~[%web]]]])
  s(routes (my ~[['source' ['binding' %ready]]]))
++  job
  ^-  schedule:c
  =/  j=schedule:c  *schedule:c
  j(sid 'source', run-sid 'run', binding 'binding', kind %prompt)
::  Gall holds an acknowledged head subscription. Loading leaves and
::  re-watches it; the fixture keeps it acknowledged, as Gall would once the
::  head answers, so authority reads see a live head.
::
++  head-connected
  %-  jab-bowl
  |=  b=bowl
  b(wex (~(put by wex.b) [/head ~zod %harness] [& /hand-events]))
::  Each read starts from a fresh bowl and a fresh load of .saved.
::
++  read
  |=  [saved=state-2:t sid=@t job=(unit schedule:c) allowed=? admin=?]
  =/  m  (mare ,vase)
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.9.10))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
    ::  ~bus has joined the group of chat/~lux/test and may read it.
    ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([@p *] &))
    ?:  (lien path |=(part=@ta =(%groups part)))  `!>((my ~[[[~lux %test] room-group]]))
    ?:  (lien path |=(part=@ta =(%cron-session part)))  `!>(job)
    ?:  (lien path |=(part=@ta =(%cron-authority part)))  `!>(allowed)
    ?:  =(%$ (rear path))  `!>(&)
    ::  Native Chat is installed and has no pending invitations.
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
    ~
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  head-connected
  ;<  =cage  bind:m  (got-peek ?:(admin /x/admin/[sid] /x/authority/[sid]))
  (pure:m q.cage)
::  Compare nouns only, as before: the peeked vase carries the agent's type.
::
++  equal
  |=  [expected=vase actual=(form-raw vase)]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  =vase  bind:m  actual
  (ex-equal !>(q.vase) !>(q.expected))
++  test-owner-is-unlimited-but-reminders-and-schedules-are-bounded
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =/  j  job
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[& ~]) (read s 'source' ~ & |))
  ;<  ~  bind:m
    (equal !>(`hand-authority:ad`[& `~[%web %tlon-read %tlon-write]]) (read s 'run' `j & |))
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[& `~]) (read s 'run' `j(kind %reminder) & |))
  ;<  ~  bind:m  (equal !>(&) (read s 'source' ~ & &))
  (equal !>(|) (read s 'run' `j & &))
++  test-revocation-and-source-binding-changes-are-fresh-on-each-check
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =/  j  job
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[| ~]) (read s 'run' `j | |))
  ;<  ~  bind:m
    (equal !>(`hand-authority:ad`[& `~[%web %tlon-read %tlon-write]]) (read s 'run' `j & |))
  ;<  ~  bind:m
    (equal !>(`hand-authority:ad`[| ~]) (read s 'run' `j(binding 'replaced') & |))
  ;<  ~  bind:m
    (equal !>(`hand-authority:ad`[| ~]) (read s(enabled.policy |) 'run' `j & |))
  %+  equal
    !>(`hand-authority:ad`[| ~])
  (read s(routes (my ~[['source' ['binding' %config]]])) 'run' `j & |)
++  test-trusted-lanes-keep-tool-ceilings
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  =.  policy.s  [& ~ (my ~[[~nec ~[%web]]]) %mentions ~ ~]
  ;<  ~  bind:m
    (equal !>(`hand-authority:ad`[& `~[%web %tlon-read %tlon-write]]) (read s 'source' ~ & |))
  ;<  ~  bind:m  (equal !>(|) (read s 'source' ~ & &))
  (equal !>(`hand-authority:ad`[| ~]) (read s(trusted.policy ~) 'source' ~ & |))
::  Scheduling follows the ceiling: the owner's conversations have none, and
::  no other actor's ceiling carries %cron, whatever its policy grants.
::
++  room-group
  ^-  group:v9:g
  =/  group  *group:v9:g
  =.  seats.group  (my ~[[~bus `seat:v9:g`[~ ~2026.9.9]]])
  group(channels (my ~[[[%chat ~lux %test] *channel:v9:g]]))
++  with-lanes
  |=  [s=state-2:t actor=@p tools=(list tool-grant:h)]
  ^-  state-2:t
  =/  lanes=(list [@t lane:t])
    :~  ['dm' [actor [%dm actor ~] 1 tools]]
        ['room' [actor [%channel [%chat ~lux %test] ~] 1 tools]]
        ['thread' [actor [%channel [%chat ~lux %test] `~2026.9.9] 1 tools]]
    ==
  %=  s
    lanes   (~(gas by lanes.s) lanes)
    routes  (~(gas by routes.s) (turn lanes |=([sid=@t *] [sid ['binding' %ready]])))
  ==
++  ex-ceilings
  |=  [s=state-2:t ceiling=(unit (list tool-grant:h))]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[& ceiling]) (read s 'dm' ~ & |))
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[& ceiling]) (read s 'room' ~ & |))
  (equal !>(`hand-authority:ad`[& ceiling]) (read s 'thread' ~ & |))
++  test-owner-conversations-have-no-ceiling
  %-  eval-mare
  (ex-ceilings (with-lanes fixture ~nec ~[%web]) ~)
++  test-trusted-ship-ceiling-never-carries-cron-whatever-its-grants
  %-  eval-mare
  =/  grants  `(list tool-grant:h)`~[%cron %admin %tlon]
  =/  s  (with-lanes fixture ~bus grants)
  =.  trusted.policy.s  (my ~[[~bus grants]])
  (ex-ceilings s `~[%admin %tlon %tlon-read %tlon-write])
++  test-allowed-ship-ceiling-never-carries-cron
  %-  eval-mare
  =/  s  (with-lanes fixture ~bus ~[%web])
  =.  allowed.policy.s  (silt ~[~bus])
  (ex-ceilings s `~[%web %tlon-read %tlon-write])
++  test-channel-open-to-everyone-gives-a-ceiling-without-cron
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  (with-lanes fixture ~bus ~[%web])
  =.  channels.policy.s  (my ~[[[%chat ~lux %test] [%mentions &]]])
  =/  expected  `hand-authority:ad`[& `~[%web %tlon-read %tlon-write]]
  ;<  ~  bind:m  (equal !>(expected) (read s 'room' ~ & |))
  (equal !>(expected) (read s 'thread' ~ & |))
--
