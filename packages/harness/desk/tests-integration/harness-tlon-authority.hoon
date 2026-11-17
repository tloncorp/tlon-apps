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
  (read-as saved sid job allowed admin ~)
::  With .speaker, ask for that speaker's authority rather than the lane's.
::
++  read-as
  |=  [saved=state-2:t sid=@t job=(unit schedule:c) allowed=? admin=? speaker=(unit @p)]
  =/  m  (mare ,vase)
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.9.10))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
    ::  ~bus has joined the group of chat/~lux/test and may read it; ~dev
    ::  may not.
    ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([who=@p *] !=(~dev who)))
    ?:  (lien path |=(part=@ta =(%groups part)))  `!>((my ~[[[~lux %test] room-group]]))
    ?:  (lien path |=(part=@ta =(%cron-session part)))  `!>(job)
    ?:  (lien path |=(part=@ta =(%cron-authority part)))  `!>(allowed)
    ?:  =(%$ (rear path))  `!>(&)
    ::  Native Chat is installed and has no pending invitations.
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
    ~
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  head-connected
  =/  peek
    ?:  admin  /x/admin/[sid]
    ?~  speaker  /x/authority/[sid]
    /x/authority/[sid]/(scot %p u.speaker)
  ;<  =cage  bind:m  (got-peek peek)
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
  (ex-ceilings s `~[%admin %tlon-read %tlon-write])
::  %tlon and %code are the owner's alone. Saved grants that list them, as
::  state saved before this rule did, leave every other grant in place.
::
++  test-trusted-ship-ceiling-never-carries-tlon-or-code-whatever-its-grants
  %-  eval-mare
  =/  grants  `(list tool-grant:h)`~[%tlon %code %web %workspace]
  =/  s  (with-lanes fixture ~bus grants)
  =.  trusted.policy.s  (my ~[[~bus grants]])
  (ex-ceilings s `~[%web %workspace %tlon-read %tlon-write])
++  test-replaced-owner-loses-tlon-and-code-on-the-next-check
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  grants  `(list tool-grant:h)`~[%tlon %code %web]
  =/  s  (with-lanes fixture ~bus grants)
  ;<  ~  bind:m  (ex-ceilings s(owner.policy `~bus) ~)
  (ex-ceilings s(trusted.policy (my ~[[~bus grants]])) `~[%web %tlon-read %tlon-write])
++  test-owner-scheduled-run-keeps-tlon
  %-  eval-mare
  =/  s  fixture
  =.  lanes.s  (my ~[['source' [~nec [%dm ~nec ~] 1 ~[%web %tlon %code]]]])
  %+  equal
    !>(`hand-authority:ad`[& `~[%web %tlon %tlon-read %tlon-write]])
  (read s 'run' `job & |)
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
::  One channel lane whose actor is the owner, with the owner's tools. Any
::  member may speak there.
::
++  shared-room
  ^-  state-2:t
  =/  s  fixture
  =.  channels.policy.s  (my ~[[[%chat ~lux %test] [%mentions &]]])
  =.  lanes.s
    (my ~[['source' [~nec [%channel [%chat ~lux %test] ~] 1 ~[%web %tlon %code]]]])
  s
++  test-second-speaker-never-gets-the-owners-tools
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  shared-room
  =/  guest  `hand-authority:ad`[& `~[%web %tlon-read %tlon-write]]
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[& ~]) (read-as s 'source' ~ & | `~nec))
  ;<  ~  bind:m  (equal !>(guest) (read-as s 'source' ~ & | `~bus))
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[| ~]) (read-as s 'source' ~ & | `~dev))
  ::  Asking without a speaker still answers for the lane's actor.
  (equal !>(`hand-authority:ad`[& ~]) (read s 'source' ~ & |))
++  test-scheduled-run-ceiling-follows-the-asked-speaker
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  shared-room
  =/  j  job
  ;<  ~  bind:m
    %+  equal
      !>(`hand-authority:ad`[& `~[%web %tlon %tlon-read %tlon-write]])
    (read-as s 'run' `j & | `~nec)
  ;<  ~  bind:m
    %+  equal
      !>(`hand-authority:ad`[& `~[%web %tlon-read %tlon-write]])
    (read-as s 'run' `j & | `~bus)
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[| ~]) (read-as s 'run' `j & | `~dev))
  (equal !>(`hand-authority:ad`[& `~]) (read-as s 'run' `j(kind %reminder) & | `~bus))
--
