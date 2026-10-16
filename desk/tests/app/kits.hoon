::  tests for %kits
::
::    the library, install (group, blob, channels, notebook and routine
::    requests), the notebook and routine answers that complete an
::    install, uninstall, and the ship-to-ship fetch.
::
/-  k=kits, g=groups, gv=groups-ver, c=channels, n=notes, sa=steward-automation, meta
/+  *test-agent, j=kits-json, wc=workspace-config
/=  agent  /app/kits
|%
++  dap  %kits
++  our-ship  ~dev
++  bot  ~nec
++  fix-eny  `@uvJ`0xdead.beef
++  now  ~2024.1.1
++  tz  'America/New_York'
::  a fixture kit: a chat place and a notebook place, ambient
::  instructions, one schedule, a setup prompt, and one scaffold
::
++  fix-manifest
  ^-  manifest:k
  :*  %test-kit
      'Test Kit'
      [0 1 0]
      our-ship
      'A test kit'
      ~
      :~  [%discussion %chat 'Discussion' 'Talk about it']
          [%log %notebook 'Reading Log' 'The record']
      ==
      ~['runner.md']
      ~[[%weekly '0 17 * * 5' 'Weekly nudge' 'weekly.md' %discussion]]
      `['setup.md' %discussion]
      ~[['profile.md' 'Profile' %log]]
  ==
++  fix-files
  ^-  (map @t @t)
  %-  malt
  :~  ['runner.md' '# Runner']
      ['weekly.md' 'Nudge the room']
      ['setup.md' 'Say hello']
      ['profile.md' 'About us']
  ==
++  fix-kit  `kit:k`[fix-manifest fix-files]
++  group-meta  `data:meta`['Summer Club' '' '' '']
++  club-flag  `flag:g`[our-ship %summer-club]
++  club-nest  `nest:g`[%chat our-ship %summer-club-discussion]
++  book  `flag:n`[our-ship %reading-log]
++  ref  '~dev/test-kit@0.1.0'
++  rid
  |=  =noun
  ^-  @uv
  (sham fix-eny noun)
++  rid-path
  |=  [base=path =noun]
  ^-  path
  (snoc base (scot %uv (rid noun)))
::  what install writes into the new group's blob
::
++  install-blob
  ^-  (unit @t)
  %-  need
  %+  edit:wc  ~
  (add-kit:wc bot '# Runner' ref (my ~[[%discussion 'chat/~dev/summer-club-discussion']]))
++  fix-install
  ^-  install:k
  [%test-kit [0 1 0] our-ship bot (my ~[[%discussion club-nest]]) ~ now]
++  routine-task
  |=  [name=@t description=@t when=cron-schedule:v1:sa message=@t]
  ^-  task:v1:sa
  :*  ~  `name  `description  `&  `when
      `'session:agent:main:tlon:group:chat/~dev/summer-club-discussion'
      `'now'
      `[`'agentTurn' `(framed message) ~]
      `[`%announce `'tlon' `'chat/~dev/summer-club-discussion' ~ ~]
      ~  ~
  ==
::  every routine's prompt says its reply is the post itself
::
++  framed
  |=  message=@t
  ^-  @t
  %+  rap  3
  :~  'Your reply to this prompt is posted as-is in the Discussion channel. '
      'Write that message itself, not a note about having written it.\0a\0a'
      message
  ==
++  weekly-task
  %:  routine-task
    'Test Kit: Weekly nudge'  'Weekly nudge'
    [%cron `'0 17 * * 5' `tz ~]  'Nudge the room'
  ==
++  setup-task
  %:  routine-task
    'Test Kit: setup'  'Runs once, right after install'
    [%at `(add now ~m1)]  'Say hello'
  ==
++  routine-wire  |=(key=@tas (rid-path /routine/summer-club/~nec %routine key))
::  scries: the bot is trusted, the group holds .blob, and the notebook
::  has a root folder 7
::
++  scries
  |=  blob=(unit @t)
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gx @ %steward @ %v1 %bots *]  `!>(`(set ship)`(sy ~[bot]))
  ::
      [%gx @ %groups @ %v3 %groups *]
    =/  gr  *group:v11:gv
    `!>(gr(blob blob))
  ::
      [%gx @ %notes @ %v0 %folders *]
    :-  ~
    !>  ^-  (list folder:n)
    :~  [8 6 'drafts' `7 our-ship now now our-ship]
        [7 6 '/' ~ our-ship now now our-ship]
    ==
  ==
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our our-ship, src our-ship)))
  ;<  ~  bind:m  (set-scry-gate (scries ~))
  ;<  *  bind:m  (do-init dap agent)
  ::  init resets the bowl's clock and entropy
  ::
  (jab-bowl |=(b=bowl b(now now, eny fix-eny)))
++  do-add
  =/  m  (mare ,(list card))
  ^-  form:m
  (do-poke %kits-action-1 !>(`action:v1:k`[%add fix-kit]))
++  do-install
  =/  m  (mare ,(list card))
  ^-  form:m
  %+  do-poke  %kits-action-1
  !>(`action:v1:k`[%install %test-kit %summer-club group-meta bot `tz])
++  installed
  |=  =install:k
  (ex-fact ~[/v1/updates] %kits-update-1 !>(`update:v1:k`[%installed club-flag install]))
::  steward's answer for the weekly routine
::
++  weekly-created
  =/  m  (mare ,(list card))
  ^-  form:m
  %^  do-agent  (routine-wire %weekly)  [our-ship %steward]
  :+  %fact  %steward-automation-response-1
  !>(`response:v1:sa`[(rid %routine %weekly) %created 'job-1'])
::
++  test-add-gives-kit-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  do-add
  %+  ex-cards  caz
  ~[(ex-fact ~[/v1/updates] %kits-update-1 !>(`update:v1:k`[%kit fix-kit]))]
::
::  a schedule can only run in a chat place
::
++  test-add-refuses-routine-in-notebook
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  bad  fix-kit
  =.  schedules.manifest.bad
    ~[[%weekly '0 17 * * 5' 'Weekly nudge' 'weekly.md' %log]]
  (ex-fail (do-poke %kits-action-1 !>(`action:v1:k`[%add bad])))
::
::  install creates the group with the bot as a member, writes the
::  workspace config, creates the channels, asks %notes for the notebook
::  and steward for the routines, and records the ledger
::
++  test-install
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  ;<  caz=(list card)  bind:m  do-install
  =/  notebook-wire  /notebook/summer-club/log
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /install/group/summer-club
          [our-ship %groups]
          %group-command
          !>(`c-groups:g`[%create [%summer-club group-meta %private [~ ~] (my ~[[bot ~]])]])
      ==
      %-  ex-poke
      :*  /install/blob/summer-club
          [our-ship %groups]
          %group-action-5
          !>(`a-groups:g`[%group club-flag %blob install-blob])
      ==
      %-  ex-poke
      :*  /install/place/summer-club/discussion
          [our-ship %channels]
          %channel-action-2
          !>  ^-  a-channels:c
          [%create [%chat %summer-club-discussion club-flag 'Discussion' 'Talk about it' ~ ~ ~]]
      ==
      %^  ex-task  notebook-wire  [our-ship %notes]
      [%watch (rid-path /v1/request %notebook %log)]
      %-  ex-poke
      :*  notebook-wire
          [our-ship %notes]
          %notes-action-1
          !>  ^-  action:v1:n
          [(rid %notebook %log) %create-group-notebook 'Reading Log' club-flag ~]
      ==
      %^  ex-task  (routine-wire %weekly)  [our-ship %steward]
      [%watch (rid-path /v1/automation/request %routine %weekly)]
      %-  ex-poke
      :*  (routine-wire %weekly)
          [our-ship %steward]
          %steward-automation-action-1
          !>(`action:v1:sa`[%edit (rid %routine %weekly) bot %create weekly-task])
      ==
      %^  ex-task  (routine-wire %setup)  [our-ship %steward]
      [%watch (rid-path /v1/automation/request %routine %setup)]
      %-  ex-poke
      :*  (routine-wire %setup)
          [our-ship %steward]
          %steward-automation-action-1
          !>(`action:v1:sa`[%edit (rid %routine %setup) bot %create setup-task])
      ==
      (installed fix-install)
  ==
::
::  the bot must be one the owner trusts
::
++  test-install-refuses-untrusted-bot
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  %-  ex-fail
  %+  do-poke  %kits-action-1
  !>(`action:v1:k`[%install %test-kit %summer-club group-meta ~bud ~])
::
::  once %notes reports the notebook, its place lands in the ledger and
::  the blob, and the kit's scaffolds go into its root folder
::
++  test-notebook-created
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  ;<  *  bind:m  do-install
  ;<  ~  bind:m  (set-scry-gate (scries install-blob))
  =/  =wire  /notebook/summer-club/log
  ;<  caz=(list card)  bind:m
    %^  do-agent  wire  [our-ship %notes]
    :+  %fact  %notes-response-1
    !>(`response:v1:n`[(rid %notebook %log) %notebook book *notebook:n *visibility:n])
  =/  filled
    %-  need
    %+  edit:wc  install-blob
    (set-place:wc ref %log 'notes/~dev/reading-log')
  =/  ins  fix-install
  =.  places.ins  (~(put by places.ins) %log [%notes book])
  %+  ex-cards  caz
  :~  (ex-task wire [our-ship %notes] [%leave ~])
      %-  ex-poke
      :*  /install/blob/summer-club
          [our-ship %groups]
          %group-action-5
          !>(`a-groups:g`[%group club-flag %blob filled])
      ==
      %-  ex-poke
      :*  /install/scaffold/summer-club/log
          [our-ship %notes]
          %notes-action-1
          !>  ^-  action:v1:n
          [(rid %scaffold 'profile.md') %notebook book %create-note 7 'Profile' 'About us']
      ==
      (installed ins)
  ==
::
::  steward's answer records the routine's id in the ledger
::
++  test-routine-created
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  ;<  *  bind:m  do-install
  ;<  caz=(list card)  bind:m  weekly-created
  =/  ins  fix-install
  =.  routines.ins  (sy ~['job-1'])
  %+  ex-cards  caz
  :~  (ex-task (routine-wire %weekly) [our-ship %steward] [%leave ~])
      (installed ins)
  ==
::
::  uninstall deletes the recorded routines and the kit's entry in the
::  blob, and leaves the group alone
::
++  test-uninstall
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  ;<  *  bind:m  do-install
  ;<  *  bind:m  weekly-created
  ;<  ~  bind:m  (set-scry-gate (scries install-blob))
  ;<  caz=(list card)  bind:m
    (do-poke %kits-action-1 !>(`action:v1:k`[%uninstall club-flag]))
  =/  cleared  (need (edit:wc install-blob (del-kit:wc ref)))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  (rid-path /uninstall/routine %delete 'job-1')
          [our-ship %steward]
          %steward-automation-action-1
          !>(`action:v1:sa`[%edit (rid %delete 'job-1') bot %delete 'job-1'])
      ==
      %-  ex-poke
      :*  /install/blob/summer-club
          [our-ship %groups]
          %group-action-5
          !>(`a-groups:g`[%group club-flag %blob cleared])
      ==
      (ex-fact ~[/v1/updates] %kits-update-1 !>(`update:v1:k`[%uninstalled club-flag]))
  ==
::
::  a routine steward creates after uninstall is deleted at once
::
++  test-routine-created-after-uninstall
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  ;<  *  bind:m  do-install
  ;<  ~  bind:m  (set-scry-gate (scries install-blob))
  ;<  *  bind:m  (do-poke %kits-action-1 !>(`action:v1:k`[%uninstall club-flag]))
  ;<  caz=(list card)  bind:m  weekly-created
  %+  ex-cards  caz
  :~  (ex-task (routine-wire %weekly) [our-ship %steward] [%leave ~])
      %-  ex-poke
      :*  (rid-path /uninstall/routine %delete 'job-1')
          [our-ship %steward]
          %steward-automation-action-1
          !>(`action:v1:sa`[%edit (rid %delete 'job-1') bot %delete 'job-1'])
      ==
  ==
::
::  %fetch watches the publisher's full-package path, and the arriving
::  kit lands in the library
::
++  test-fetch
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %kits-action-1 !>(`action:v1:k`[%fetch ~bus %test-kit]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    ~[(ex-task /fetch/~bus/test-kit [~bus %kits] [%watch /v1/full/test-kit])]
  ;<  caz=(list card)  bind:m
    %^  do-agent  /fetch/~bus/test-kit  [~bus %kits]
    [%fact %kits-update-1 !>(`update:v1:k`[%kit fix-kit])]
  %+  ex-cards  caz
  ~[(ex-fact ~[/v1/updates] %kits-update-1 !>(`update:v1:k`[%kit fix-kit]))]
--
