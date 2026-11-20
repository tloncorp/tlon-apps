::  Full adapter, synthetic scries only; no emitted cards are executed.
::  -test /=harness=/tests-integration/harness-tlon-authority
/-  t=harness-tlon, c=harness-cron, ad=harness-adapter, h=harness, g=groups-ver,
    a=activity-ver, hh=harness-hand
/+  *test-agent
/=  adapter  /app/harness-tlon
|%
++  fixture
  ^-  state-3:t
  =/  s=state-3:t  *state-3:t
  =.  owner-initialized.s  1
  =.  policy.s  [& `~nec ~ %mentions ~ ~]
  =.  lanes.s  (my ~[['source' [[%dm ~nec ~] 1 ~[%web]]]])
  s(routes (my ~[['source' ['binding' %ready]]]))
++  job
  ^-  schedule:c
  =/  j=schedule:c  *schedule:c
  j(sid 'source', run-sid 'run', binding 'binding', kind %prompt, actor '~nec')
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
  |=  [saved=state-3:t sid=@t job=(unit schedule:c) allowed=? admin=?]
  (read-as saved sid job allowed admin ~)
::  With .speaker, ask for that speaker's authority rather than the lane's.
::
++  read-as
  |=  [saved=state-3:t sid=@t job=(unit schedule:c) allowed=? admin=? speaker=(unit @p)]
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
  =/  ceiling  `hand-authority:ad`[& `~[%web %tlon-read %tlon-write]]
  ;<  ~  bind:m  (equal !>(ceiling) (read-as s 'source' ~ & | `~nec))
  ;<  ~  bind:m  (equal !>(ceiling) (read s 'source' ~ & |))
  ;<  ~  bind:m  (equal !>(|) (read s 'source' ~ & &))
  (equal !>(`hand-authority:ad`[| ~]) (read-as s(trusted.policy ~) 'source' ~ & | `~nec))
::  Scheduling follows the ceiling: the owner's conversations have none, and
::  no other actor's ceiling carries %cron, whatever its policy grants.
::
++  room-group
  ^-  group:v9:g
  =/  group  *group:v9:g
  =.  seats.group  (my ~[[~bus `seat:v9:g`[~ ~2026.9.9]]])
  group(channels (my ~[[[%chat ~lux %test] *channel:v9:g]]))
++  with-lanes
  |=  [s=state-3:t actor=@p tools=(list tool-grant:h)]
  ^-  state-3:t
  =/  lanes=(list [@t lane:t])
    :~  ['dm' [[%dm actor ~] 1 tools]]
        ['room' [[%channel [%chat ~lux %test] ~] 1 tools]]
        ['thread' [[%channel [%chat ~lux %test] `~2026.9.9] 1 tools]]
    ==
  %=  s
    lanes   (~(gas by lanes.s) lanes)
    routes  (~(gas by routes.s) (turn lanes |=([sid=@t *] [sid ['binding' %ready]])))
  ==
::  Each lane is read as its own actor, the speaker a turn would carry.
::
++  ex-ceilings
  |=  [s=state-3:t actor=@p ceiling=(unit (list tool-grant:h))]
  =/  m  (mare ,~)
  ^-  form:m
  =/  expected  `hand-authority:ad`[& ceiling]
  ;<  ~  bind:m  (equal !>(expected) (read-as s 'dm' ~ & | `actor))
  ;<  ~  bind:m  (equal !>(expected) (read-as s 'room' ~ & | `actor))
  (equal !>(expected) (read-as s 'thread' ~ & | `actor))
++  test-owner-conversations-have-no-ceiling
  %-  eval-mare
  (ex-ceilings (with-lanes fixture ~nec ~[%web]) ~nec ~)
++  test-trusted-ship-ceiling-never-carries-cron-whatever-its-grants
  %-  eval-mare
  =/  grants  `(list tool-grant:h)`~[%cron %admin %tlon]
  =/  s  (with-lanes fixture ~bus grants)
  =.  trusted.policy.s  (my ~[[~bus grants]])
  (ex-ceilings s ~bus `~[%admin %tlon-read %tlon-write])
::  %tlon and %code are the owner's alone. Saved grants that list them, as
::  state saved before this rule did, leave every other grant in place.
::
++  test-trusted-ship-ceiling-never-carries-tlon-or-code-whatever-its-grants
  %-  eval-mare
  =/  grants  `(list tool-grant:h)`~[%tlon %code %web %workspace]
  =/  s  (with-lanes fixture ~bus grants)
  =.  trusted.policy.s  (my ~[[~bus grants]])
  (ex-ceilings s ~bus `~[%web %workspace %tlon-read %tlon-write])
++  test-replaced-owner-loses-tlon-and-code-on-the-next-check
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  grants  `(list tool-grant:h)`~[%tlon %code %web]
  =/  s  (with-lanes fixture ~bus grants)
  ;<  ~  bind:m  (ex-ceilings s(owner.policy `~bus) ~bus ~)
  (ex-ceilings s(trusted.policy (my ~[[~bus grants]])) ~bus `~[%web %tlon-read %tlon-write])
++  test-owner-scheduled-run-keeps-tlon
  %-  eval-mare
  =/  s  fixture
  =.  lanes.s  (my ~[['source' [[%dm ~nec ~] 1 ~[%web %tlon %code]]]])
  %+  equal
    !>(`hand-authority:ad`[& `~[%web %tlon %tlon-read %tlon-write]])
  (read s 'run' `job & |)
++  test-allowed-ship-ceiling-never-carries-cron
  %-  eval-mare
  =/  s  (with-lanes fixture ~bus ~[%web])
  =.  allowed.policy.s  (silt ~[~bus])
  (ex-ceilings s ~bus `~[%web %tlon-read %tlon-write])
++  test-channel-open-to-everyone-gives-a-ceiling-without-cron
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  (with-lanes fixture ~bus ~[%web])
  =.  channels.policy.s  (my ~[[[%chat ~lux %test] [%mentions &]]])
  =/  expected  `hand-authority:ad`[& `~[%web %tlon-read %tlon-write]]
  ;<  ~  bind:m  (equal !>(expected) (read-as s 'room' ~ & | `~bus))
  (equal !>(expected) (read-as s 'thread' ~ & | `~bus))
::  One channel lane saved with the owner's tools. Any member may speak there.
::
++  shared-room
  ^-  state-3:t
  =/  s  fixture
  =.  channels.policy.s  (my ~[[[%chat ~lux %test] [%mentions &]]])
  =.  lanes.s
    (my ~[['source' [[%channel [%chat ~lux %test] ~] 1 ~[%web %tlon %code]]]])
  s
++  test-second-speaker-never-gets-the-owners-tools
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  shared-room
  =/  guest  `hand-authority:ad`[& `~[%web %tlon-read %tlon-write]]
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[& ~]) (read-as s 'source' ~ & | `~nec))
  ;<  ~  bind:m  (equal !>(guest) (read-as s 'source' ~ & | `~bus))
  (equal !>(`hand-authority:ad`[| ~]) (read-as s 'source' ~ & | `~dev))
::  The Tlon floor: read and write in this conversation, nothing else.
::
++  floor
  ^-  hand-authority:ad
  [& `~[%tlon-read %tlon-write]]
++  test-shared-session-without-a-speaker-never-answers-as-the-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  shared-room
  ;<  ~  bind:m  (equal !>(floor) (read s 'source' ~ & |))
  ::  Still the floor once the channel is closed to everyone but the owner.
  =.  channels.policy.s  (my ~[[[%chat ~lux %test] [%mentions |]]])
  (equal !>(floor) (read s 'source' ~ & |))
++  test-operators-local-prompt-in-a-channel-gets-owner-authority
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[& ~]) (read-as shared-room 'source' ~ & | `~zod))
  ::  Whoever else spoke there first.
  =/  s  (with-lanes fixture ~bus ~[%web])
  =.  trusted.policy.s  (my ~[[~bus ~[%web]]])
  (equal !>(`hand-authority:ad`[& ~]) (read-as s 'room' ~ & | `~zod))
++  test-operators-local-prompt-in-a-dm-gets-the-partners-authority
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  (with-lanes fixture ~bus ~[%web])
  =.  trusted.policy.s  (my ~[[~bus ~[%web]]])
  =/  partner  `hand-authority:ad`[& `~[%web %tlon-read %tlon-write]]
  ;<  ~  bind:m  (equal !>(partner) (read-as s 'dm' ~ & | `~zod))
  ;<  ~  bind:m  (equal !>(partner) (read-as s 'dm' ~ & | `~bus))
  (equal !>(partner) (read s 'dm' ~ & |))
++  test-dm-authority-refuses-a-speaker-who-is-not-its-partner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  (with-lanes fixture ~bus ~[%web])
  =.  trusted.policy.s  (my ~[[~bus ~[%web]] [~dev ~[%web]]])
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[| ~]) (read-as s 'dm' ~ & | `~nec))
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[| ~]) (read-as s 'dm' ~ & | `~dev))
  (equal !>(`hand-authority:ad`[| ~]) (read-as fixture 'source' ~ & | `~bus))
++  test-shared-channel-never-administers
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  (with-lanes fixture ~nec ~[%web])
  ;<  ~  bind:m  (equal !>(|) (read shared-room 'source' ~ & &))
  ;<  ~  bind:m  (equal !>(|) (read s 'room' ~ & &))
  ;<  ~  bind:m  (equal !>(|) (read s 'thread' ~ & &))
  (equal !>(&) (read s 'dm' ~ & &))
::  Context and lens sync ask whether the conversation runs, not whether the
::  actor that opened it is still granted.
::
++  test-lane-stays-live-for-context-and-lens-when-no-speaker-is-known
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ::  ~dev opened the room and has since lost access to it.
  =/  s  (with-lanes fixture ~dev ~[%web])
  ;<  ~  bind:m  (equal !>(floor) (read s 'room' ~ & |))
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[| ~]) (read-as s 'room' ~ & | `~dev))
  =/  closed  s(channels.policy (my ~[[[%chat ~lux %test] [%off |]]]))
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[| ~]) (read closed 'room' ~ & |))
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[| ~]) (read s(enabled.policy |) 'room' ~ & |))
  (equal !>(`hand-authority:ad`[| ~]) (read s(routes ~) 'room' ~ & |))
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
++  test-scheduled-run-without-a-speaker-answers-for-its-actor
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  shared-room
  =/  j  job
  ;<  ~  bind:m
    %+  equal
      !>(`hand-authority:ad`[& `~[%web %tlon-read %tlon-write]])
    (read s 'run' `j(actor '~bus') & |)
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[| ~]) (read s 'run' `j(actor '~dev') & |))
  (equal !>(`hand-authority:ad`[| ~]) (read s 'run' `j(actor 'nobody') & |))
::  One mention in chat/~lux/test from .who, after the room's route is ready.
::  The room's one identity leads to its shared session.
::
++  admit
  |=  who=@p
  =/  m  (mare ,state-3:t)
  ^-  form:m
  =/  s  shared-room
  =/  to=destination:t  [%channel [%chat ~lux %test] ~]
  =.  identities.s  (my ~[[to 'source']])
  =.  activity-through.s  ~2026.9.9
  =/  posted  ~2026.9.9..12.00.00
  =/  event=incoming-event:v8:a
    [%post [[who posted] posted] [%chat ~lux %test] [~lux %test] ~[[%inline ~['hello']]] &]
  =/  stream=stream:v10:a  (put:on-stream:v10:a *stream:v10:a posted [event | |])
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.9.10))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
    ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([who=@p *] !=(~dev who)))
    ?:  (lien path |=(part=@ta =(%groups part)))  `!>((my ~[[[~lux %test] room-group]]))
    ?:  (lien path |=(part=@ta =(%cron-session part)))  `!>(~)
    ::  Local %channels lacks the channel, so no message is read for its author.
    ?:  ?=([%gu @ %channels @ %v4 *] path)  `!>(|)
    ?:  =(%$ (rear path))  `!>(&)
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
    ?:  ?=([%gx @ %activity @ %v6 %all %noun ~] path)  `!>(stream)
    ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(*state:hh)
    ~
  ;<  *  bind:m  (do-load adapter `!>(s))
  ;<  ~  bind:m  head-connected
  ;<  *  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-3:t vase))
++  test-speaker-who-cannot-read-the-channel-is-not-admitted-to-a-ready-route
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  member=state-3:t  bind:m  (admit ~bus)
  ;<  outsider=state-3:t  bind:m  (admit ~dev)
  =/  messages
    |=  saved=state-3:t
    (skim notices.saved |=(n=notice:t =('message' kind.n)))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.member)) !>(1))
  ;<  ~  bind:m  (ex-equal !>((lent (messages member))) !>(1))
  ;<  ~  bind:m  (ex-equal !>(jobs.outsider) !>(*(map @uv job:t)))
  (ex-equal !>((messages outsider)) !>(*(list notice:t)))
::  The room's session is saved with the owner's Defaults, %tlon and %code
::  among them. A guest speaking there is offered only its own grants.
::
++  test-guest-turn-in-a-session-saved-with-owner-tools-is-offered-only-guest-tools
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  shared-room
  =.  lanes.s
    (my ~[['source' [[%channel [%chat ~lux %test] ~] 1 ~[%web %workspace %tlon %code]]]])
  =.  trusted.policy.s  (my ~[[~bus ~[%web]]])
  ;<  ~  bind:m
    (equal !>(`hand-authority:ad`[& `~[%web %tlon-read %tlon-write]]) (read-as s 'source' ~ & | `~bus))
  (equal !>(`hand-authority:ad`[& ~]) (read-as s 'source' ~ & | `~nec))
::  Each check reads the owner afresh, so a replaced owner speaking in the
::  shared room is a guest there on its next turn.
::
++  test-ex-owner-loses-owner-tools-in-the-shared-session-on-the-next-check
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ::  ~bus, a member of the room's group, owned the ship and is replaced.
  =/  s  shared-room
  =.  owner.policy.s  `~bus
  =/  guest  `hand-authority:ad`[& `~[%web %tlon-read %tlon-write]]
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[& ~]) (read-as s 'source' ~ & | `~bus))
  =.  owner.policy.s  `~nec
  ;<  ~  bind:m  (equal !>(guest) (read-as s 'source' ~ & | `~bus))
  (equal !>(`hand-authority:ad`[& ~]) (read-as s 'source' ~ & | `~nec))
::  The owner's schedule in the room runs with the owner's ceiling. A guest
::  who spoke there since, with a message still pending, changes nothing.
::
++  test-owner-schedule-in-a-shared-session-runs-with-the-owners-ceiling-not-the-last-speakers
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  shared-room
  =.  trusted.policy.s  (my ~[[~bus ~[%web]]])
  =.  jobs.s
    (my ~[[0v1 [[~bus 'event' [%channel [%chat ~lux %test] ~] 'hi'] 'source' %bind '']]])
  %+  equal
    !>(`hand-authority:ad`[& `~[%web %tlon %tlon-read %tlon-write]])
  (read s 'run' `job & |)
::  Scheduling follows the speaker's ceiling: the owner has none, and a
::  guest's never carries %cron, even one its grants list.
::
++  test-guest-cannot-schedule-in-a-shared-session-the-owner-schedules-in
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  shared-room
  =.  trusted.policy.s  (my ~[[~bus ~[%web %cron]]])
  ;<  ~  bind:m  (equal !>(`hand-authority:ad`[& ~]) (read-as s 'source' ~ & | `~nec))
  %+  equal
    !>(`hand-authority:ad`[& `~[%web %tlon-read %tlon-write]])
  (read-as s 'source' ~ & | `~bus)
--
