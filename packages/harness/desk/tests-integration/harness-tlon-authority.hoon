::  Full adapter, synthetic scries only; no emitted cards are executed.
::  -test /=harness=/tests-integration/harness-tlon-authority
/-  t=harness-tlon, c=harness-cron, ad=harness-adapter
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
--
