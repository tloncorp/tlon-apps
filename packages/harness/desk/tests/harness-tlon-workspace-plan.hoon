/-  t=harness-tlon, g=groups-ver
/+  *test, plan=harness-tlon-workspace-plan, migrate=harness-tlon-migrate, ht=harness-tools
|%
++  channel
  |=  [kind=@t title=@t]
  ^-  json
  (pairs:enjs:format ~[['kind' %s kind] ['title' %s title] ['purpose' %s 'What it holds']])
++  arguments
  |=  channels=(list json)
  ^-  json
  %-  pairs:enjs:format
  :~  ['intro' %s 'Here is a place for it.']
      ['title' %s '  Lisbon   Trip ']
      ['description' %s 'Planning the May trip']
      ['channels' %a channels]
  ==
++  sample
  ^-  workspace-plan:t
  :*  'Lisbon Trip'
      'Planning the May trip'
      ~[[%chat 'Planning' 'Day by day'] [%gallery 'Places' 'Three spots'] [%notebook 'Notes' 'Bookings']]
      `['Fare check' 'Every Monday at 9:00 AM' '0 16 * * 1' 'Check fares to Lisbon.']
  ==
++  proposal
  |=  status=?(%open %approved %superseded %created)
  ^-  workspace-proposal:t
  [~nec 'sid' sample status ~2026.11.19 | | 'The answer' ~]
++  test-plan-needs-a-chat-first-and-distinct-titles
  =/  good  (parse:plan (arguments ~[(channel 'chat' 'Planning') (channel 'gallery' 'Places')]))
  ;:  weld
      %+  expect-eq
        !>(`['Here is a place for it.' 'Lisbon Trip' 2])
      !>  ?~  good  ~
          `[intro.u.good title.plan.u.good (lent channels.plan.u.good)]
      %-  expect
      !>  ?&  =(~ (parse:plan (arguments ~[(channel 'gallery' 'Places')])))
              =(~ (parse:plan (arguments ~)))
              =(~ (parse:plan (arguments ~[(channel 'chat' 'Plan') (channel 'chat' 'plan')])))
              =(~ (parse:plan (arguments ~[(channel 'diary' 'Plan')])))
          ==
  ==
++  test-refused-plan-names-the-field-at-fault
  =/  long  (crip (reap 121 'a'))
  =/  wordy
    %-  pairs:enjs:format
    ~[['kind' %s 'chat'] ['title' %s 'Planning'] ['purpose' %s long]]
  %-  expect
  !>  ?&  (find-sub:ht 'error: channels[0].purpose is missing' (invalid:plan (arguments ~[wordy])))
          (find-sub:ht 'error: channels[1].kind' (invalid:plan (arguments ~[(channel 'chat' 'A') (channel 'diary' 'B')])))
          (find-sub:ht 'error: the channel list' (invalid:plan (arguments ~[(channel 'gallery' 'A')])))
          (find-sub:ht 'error: intro' (invalid:plan (pairs:enjs:format ~[['title' %s 'T']])))
      ==
++  test-task-schedule-must-be-a-utc-cron-expression
  =/  with
    |=  schedule=@t
    =/  args  (arguments ~[(channel 'chat' 'Planning')])
    ?>  ?=(%o -.args)
    =/  task
      %-  pairs:enjs:format
      :~  ['title' %s 'Fare check']
          ['description' %s 'Every Monday at 9:00 AM']
          ['schedule' %s schedule]
          ['prompt' %s 'Check fares.']
      ==
    (parse:plan [%o (~(put by p.args) 'task' task)])
  %-  expect
  !>  ?&  ?=(^ (with '0 16 * * 1'))
          =(~ (with 'every monday'))
          =(~ (with '0 16 * *'))
      ==
++  test-card-lists-the-plan-with-edit-and-create
  =/  card  (blob:plan 'workspace-plan-0123456789ab' sample)
  %-  expect
  !>  ?&  (find-sub:ht '"surfaceId":"workspace-plan-0123456789ab"' card)
          (find-sub:ht '"catalogId":"tlon.a2ui.basic.v1"' card)
          (find-sub:ht '"storyMode":"fallback"' card)
          (find-sub:ht '"text":"New workspace"' card)
          (find-sub:ht '"icon":"ChannelGalleries"' card)
          (find-sub:ht '"icon":"ChannelNotebooks"' card)
          (find-sub:ht '"icon":"Clock"' card)
          (find-sub:ht 'Create the \\"Lisbon Trip\\" workspace' card)
          (find-sub:ht 'Edit the \\"Lisbon Trip\\" workspace' card)
          (find-sub:ht '"id":"create"' card)
          (find-sub:ht '"id":"edit"' card)
      ==
++  receipt
  |=  [surface=@t component=@t]
  ^-  (unit @t)
  :-  ~
  %-  en:json:html
  :-  %a
  :~  %-  pairs:enjs:format
      :~  ['type' %s 'tlon-a2ui-selection']
          ['version' %n '1']
          ['surfaceId' %s surface]
          ['componentId' %s component]
      ==
  ==
++  test-only-a-selection-receipt-on-a-workspace-card-is-a-tap
  ;:  weld
      %+  expect-eq
        !>(`(unit [@t ?])``['workspace-plan-ab' &])
      !>((tap:plan (receipt 'workspace-plan-ab' 'create')))
      %+  expect-eq
        !>(`(unit [@t ?])``['workspace-plan-ab' |])
      !>((tap:plan (receipt 'workspace-plan-ab' 'edit')))
      %-  expect
      !>  ?&  =(~ (tap:plan ~))
              =(~ (tap:plan `'not json'))
              =(~ (tap:plan (receipt 'harness-work-ab' 'create')))
              =(~ (tap:plan (receipt 'workspace-plan-ab' 'action-0')))
          ==
  ==
++  test-workspace-rule-stands-aside-for-a-tap-note
  %-  expect
  !>  ?&  !(noted:plan 'Back to our Japan trip')
          (noted:plan (cat 3 'Create it' (note:plan 'workspace-plan-ab' & `(proposal %open))))
          (find-sub:ht 'tlon_workspace_link' rule:plan)
      ==
++  test-only-a-cards-own-button-message-is-looked-up
  =/  all=(map @t workspace-proposal:t)  (my ~[['a' (proposal %open)]])
  %-  expect
  !>  ?&  (worded:plan all ~nec 'Create the "Lisbon Trip" workspace')
          (worded:plan all ~nec 'Edit the "Lisbon Trip" workspace')
          !(worded:plan all ~bud 'Create the "Lisbon Trip" workspace')
          !(worded:plan all ~nec 'Create the "Porto Trip" workspace')
          !(worded:plan ~ ~nec 'Create the "Lisbon Trip" workspace')
      ==
++  test-tap-note-names-the-proposal-only-for-a-live-card
  =/  create  (note:plan 'workspace-plan-ab' & `(proposal %open))
  =/  stale  (note:plan 'workspace-plan-ab' & `(proposal %superseded))
  =/  edit  (note:plan 'workspace-plan-ab' | `(proposal %open))
  %-  expect
  !>  ?&  (find-sub:ht 'tlon_workspace_create with proposal_id "workspace-plan-ab"' create)
          !(find-sub:ht 'tlon_workspace_create' stale)
          (find-sub:ht 'Create nothing' stale)
          (find-sub:ht 'Ask in one short line what to change' edit)
          (find-sub:ht 'no longer known' (note:plan 'workspace-plan-ab' & ~))
      ==
++  test-new-card-supersedes-open-cards-but-not-started-or-foreign-ones
  =/  started  (proposal %approved)
  =/  all=(map @t workspace-proposal:t)
    %-  my
    :~  ['old' (proposal %open)]
        ['tapped' (proposal %approved)]
        ['started' started(group `[~nec %trip])]
        ['done' (proposal %created)]
        ['other' =+((proposal %open) -(owner ~bud))]
        ['new' (proposal %open)]
    ==
  =/  after  (supersede:plan all ~nec 'new')
  %+  expect-eq
    !>(~[%superseded %superseded %approved %created %open %open])
  !>  %+  turn  `(list @t)`~['old' 'tapped' 'started' 'done' 'other' 'new']
      |=(key=@t status:(~(got by after) key))
++  test-revised-card-keeps-the-edited-cards-answer
  =/  edited  (proposal %open)
  =/  all=(map @t workspace-proposal:t)
    (my ~[['a' edited(editing &, answer 'First answer')] ['b' (proposal %created)]])
  ;:  weld
      (expect-eq !>('First answer') !>((inherited:plan all ~nec)))
      (expect-eq !>('') !>((inherited:plan all ~bud)))
      (expect-eq !>('') !>((inherited:plan (my ~[['b' (proposal %open)]]) ~nec)))
  ==
++  test-first-chat-stands-in-for-the-plans-first-channel
  =/  listed=(list [nest:plan @t])
    :~  [[%chat ~nec %general] 'General']
        [[%heap ~nec %places] 'places']
        [[%notes ~nec %notes] 'Notes']
    ==
  ;:  weld
      %+  expect-eq
        !>  ^-  (list (unit nest:plan))
        ~[`[%chat ~nec %general] `[%heap ~nec %places] `[%notes ~nec %notes]]
      !>((assign:plan sample listed))
      %+  expect-eq
        !>(`(list (unit nest:plan))`~[`[%chat ~nec %general] ~ ~])
      !>((assign:plan sample (scag 1 listed)))
      %+  expect-eq
        !>(`(list (unit nest:plan))`~[~ `[%heap ~nec %places] ~])
      !>((assign:plan sample ~[[[%heap ~nec %places] 'Places']]))
  ==
++  group
  ^-  group:v9:g
  =/  channel
    |=  title=@t
    ^-  channel:v9:g
    [[title '' '' ''] ~2026.11.19 %default ~ &]
  =/  out  *group:v9:g
  =.  privacy.admissions.out  %public
  %=  out
    channels
      %-  my
      :~  [[%chat ~nec %general] (channel 'General')]
          [[%heap ~nec %places] (channel 'Places')]
          [[%notes ~nec %notes] (channel 'Notes')]
      ==
    sections
      %-  my
      :~  :-  %default
          [['' '' '' ''] ~[[%notes ~nec %notes] [%heap ~nec %places] [%chat ~nec %general]]]
      ==
  ==
++  test-arrange-renames-the-chat-hides-the-group-and-orders-channels
  =/  nests=(list nest:plan)  ~[[%chat ~nec %general] [%heap ~nec %places] [%notes ~nec %notes]]
  =/  commands  (arrange:plan sample group nests)
  =/  settled  group
  =.  privacy.admissions.settled  %secret
  =.  channels.settled
    %+  ~(jab by channels.settled)  [%chat ~nec %general]
    |=(channel=channel:v9:g channel(title.meta 'Planning'))
  =.  sections.settled  (my ~[[%default [['' '' '' ''] nests]]])
  ;:  weld
      %+  expect-eq
        !>(~[%channel %entry %section %section %section])
      !>((turn commands |=(command=a-group:v8:g -.command)))
      (expect-eq !>(~) !>((arrange:plan sample settled nests)))
  ==
++  test-brief-and-result-carry-the-card-not-the-models-memory
  =/  approved  (proposal %approved)
  =/  brief  (brief:plan 'workspace-plan-ab' approved)
  =/  nests=(list nest:plan)  ~[[%chat ~zod %trip] [%heap ~zod %places] [%notes ~zod %notes]]
  =/  result  (created:plan approved [~zod %trip] nests &)
  %-  expect
  !>  ?&  (find-sub:ht 'create_group with title "Lisbon Trip"' brief)
          (find-sub:ht 'title "Places", kind heap, description "Three spots"' brief)
          (find-sub:ht 'title "Notes", kind notes, and no description' brief)
          (find-sub:ht 'proposal_id "workspace-plan-ab" and group' brief)
          (find-sub:ht 'Created "Lisbon Trip" as ~zod/trip' result)
          (find-sub:ht 'chat/~zod/trip already opens with your answer' result)
          (find-sub:ht 'Notes (notebook) notebook ~zod/notes: Bookings' result)
          (find-sub:ht 'cron_add: schedule "0 16 * * 1", timezone "UTC", runs "100"' result)
          !(find-sub:ht 'already opens' (created:plan approved [~zod %trip] nests |))
      ==
++  test-group-id-accepts-a-citation-path-only-for-a-real-flag
  ;:  weld
      (expect-eq !>(`(unit [@p @tas])``[~nec %lisbon-trip]) !>((flag:plan '~nec/lisbon-trip')))
      %+  expect-eq
        !>(`(unit [@p @tas])``[~nec %lisbon-trip])
      !>((flag:plan ' /1/group/~nec/lisbon-trip '))
      (expect !>(&(=(~ (flag:plan 'nec/lisbon-trip')) =(~ (flag:plan '~nec/Lisbon Trip')))))
  ==
++  test-workspace-tools-ride-the-owner-only-tlon-grant
  =/  defs  (en:json:html (tool-defs:ht ~[%tlon]))
  %-  expect
  !>  ?&  =(`%tlon (tool-family:ht 'tlon_workspace_plan'))
          =(`%harness-tlon (tool-hand:ht 'tlon_workspace_create'))
          (tool-granted:ht 'tlon_workspace_link' ~[%tlon])
          !(tool-granted:ht 'tlon_workspace_plan' ~[%tlon-read %tlon-write])
          (find-sub:ht '"tlon_workspace_plan"' defs)
          (find-sub:ht '"tlon_workspace_create"' defs)
          (find-sub:ht '"tlon_workspace_link"' defs)
      ==
++  test-state-two-loads-with-no-proposals
  =/  old  *state-2:migrate
  =.  old  old(epoch 17, next-notice 9)
  =/  current  (load:migrate !>(old))
  ;:  weld
      (expect-eq !>([17 9 0]) !>([epoch.current next-notice.current ~(wyt by proposals.current)]))
      (expect-eq !>(current) !>((load:migrate !>(current))))
  ==
--
