/-  g=groups-ver
/+  *test, wp=harness-tlon-workspace-plan, ht=harness-tools
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
  ^-  plan:wp
  :*  'Lisbon Trip'
      'Planning the May trip'
      ~[[%chat 'Planning' 'Day by day'] [%gallery 'Places' 'Three spots'] [%notebook 'Notes' 'Bookings']]
      `['Fare check' 'Every Monday at 9:00 AM']
  ==
++  key  'workspace-plan-0123456789ab'
::  A DM: the bot is ~zod, the owner ~nec
++  at  |=(n=@ud (add ~2026.11.19 (mul n ~s1)))
++  card-post
  |=  [n=@ud id=@t =plan:wp]
  ^-  post:wp
  [(at n) ~zod 'New workspace' `(blob:wp id plan)]
++  said
  |=  [n=@ud who=@p text=@t]
  ^-  post:wp
  [(at n) who text ~]
++  tapped
  |=  [n=@ud id=@t component=@t]
  ^-  post:wp
  [(at n) ~nec 'Create the "Lisbon Trip" workspace' (receipt id component)]
++  marked
  |=  [n=@ud id=@t]
  ^-  post:wp
  [(at n) ~zod '' `(marker:wp (created-key:wp id [~nec %lisbon-trip]))]
++  standing
  |=  [posts=(list post:wp) id=@t]
  ^-  standing:wp
  (need (review:wp posts ~zod ~nec id))
++  test-plan-needs-a-chat-first-and-distinct-titles
  =/  good  (parse:wp (arguments ~[(channel 'chat' 'Planning') (channel 'gallery' 'Places')]))
  ;:  weld
      %+  expect-eq
        !>(`['Here is a place for it.' 'Lisbon Trip' 2])
      !>  ?~  good  ~
          `[intro.u.good title.plan.u.good (lent channels.plan.u.good)]
      %-  expect
      !>  ?&  =(~ (parse:wp (arguments ~[(channel 'gallery' 'Places')])))
              =(~ (parse:wp (arguments ~)))
              =(~ (parse:wp (arguments ~[(channel 'chat' 'Plan') (channel 'chat' 'plan')])))
              =(~ (parse:wp (arguments ~[(channel 'diary' 'Plan')])))
          ==
  ==
++  test-refused-plan-names-the-field-at-fault
  =/  long  (crip (reap 121 'a'))
  =/  wordy
    %-  pairs:enjs:format
    ~[['kind' %s 'chat'] ['title' %s 'Planning'] ['purpose' %s long]]
  %-  expect
  !>  ?&  (find-sub:ht 'error: channels[0].purpose is missing' (invalid:wp (arguments ~[wordy])))
          (find-sub:ht 'error: channels[1].kind' (invalid:wp (arguments ~[(channel 'chat' 'A') (channel 'diary' 'B')])))
          (find-sub:ht 'error: the channel list' (invalid:wp (arguments ~[(channel 'gallery' 'A')])))
          (find-sub:ht 'error: intro' (invalid:wp (pairs:enjs:format ~[['title' %s 'T']])))
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
    (parse:wp [%o (~(put by p.args) 'task' task)])
  %-  expect
  !>  ?&  ?=(^ (with '0 16 * * 1'))
          =(~ (with 'every monday'))
          =(~ (with '0 16 * *'))
      ==
++  test-card-lists-the-plan-with-edit-and-create
  =/  card  (blob:wp 'workspace-plan-0123456789ab' sample)
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
      !>((tap:wp (receipt 'workspace-plan-ab' 'create')))
      %+  expect-eq
        !>(`(unit [@t ?])``['workspace-plan-ab' |])
      !>((tap:wp (receipt 'workspace-plan-ab' 'edit')))
      %-  expect
      !>  ?&  =(~ (tap:wp ~))
              =(~ (tap:wp `'not json'))
              =(~ (tap:wp (receipt 'harness-work-ab' 'create')))
              =(~ (tap:wp (receipt 'workspace-plan-ab' 'action-0')))
          ==
  ==
++  test-a-cards-own-button-words-are-worded-and-nothing-else
  %-  expect
  !>  ?&  (worded:wp 'Create the "Lisbon Trip" workspace')
          (worded:wp 'Edit the "Lisbon Trip" workspace')
          !(worded:wp 'Create a workspace')
          !(worded:wp 'Back to our Japan trip')
          !(noted:wp 'Back to our Japan trip')
          (find-sub:ht 'tlon_workspace_link' rule:wp)
      ==
++  test-a-card-reads-back-as-the-plan-it-shows
  %+  expect-eq
    !>(`[key sample])
  !>((card:wp `(blob:wp key sample)))
++  test-create-is-approved-only-by-the-owners-tap-on-that-card
  =/  open  (standing ~[(card-post 1 key sample) (said 2 ~zod 'The plan')] key)
  =/  typed  (standing ~[(card-post 1 key sample) [(at 2) ~nec 'Create the "Lisbon Trip" workspace' ~]] key)
  =/  other
    (standing ~[(card-post 1 key sample) (tapped 2 'workspace-plan-ffffffffffff' 'create')] key)
  =/  by-bot
    (standing ~[(card-post 1 key sample) [(at 2) ~zod 'x' (receipt key 'create')]] key)
  =/  done  (standing ~[(card-post 1 key sample) (tapped 2 key 'create')] key)
  %+  expect-eq
    !>(~[| | | | &])
  !>((turn ~[open typed other by-bot done] |=(c=standing:wp approved.c)))
++  test-a-newer-card-replaces-the-older-one
  =/  posts=(list post:wp)  ~[(card-post 1 key sample) (card-post 2 'workspace-plan-ffffffffffff' sample)]
  ;:  weld
      (expect-eq !>(|) !>(latest:(standing posts key)))
      (expect-eq !>(&) !>(latest:(standing posts 'workspace-plan-ffffffffffff')))
      (expect-eq !>(~) !>((review:wp posts ~zod ~nec 'workspace-plan-000000000000')))
  ==
++  test-the-answer-is-the-reply-before-the-owners-next-message
  =/  posts=(list post:wp)
    :~  (said 0 ~zod 'Here is a place for it.')
        (card-post 1 key sample)
        (said 2 ~zod 'Start with flights.')
        (said 3 ~zod 'Then the hotel.')
        (said 4 ~nec 'Thanks, unrelated question')
        (said 5 ~zod 'Unrelated reply')
    ==
  %+  expect-eq
    !>('Start with flights.\0a\0aThen the hotel.')
  !>(answer:(standing posts key))
++  test-a-revised-card-keeps-the-edited-cards-answer
  =/  revised  'workspace-plan-ffffffffffff'
  =/  posts=(list post:wp)
    :~  (card-post 1 key sample)
        (said 2 ~zod 'The full answer')
        (tapped 3 key 'edit')
        (said 4 ~zod 'What should change?')
        (said 5 ~nec 'Call it Lucia')
        (card-post 6 revised sample)
        (said 7 ~zod 'Done.')
    ==
  ;:  weld
      (expect-eq !>('The full answer') !>(answer:(standing posts revised)))
      (expect-eq !>(&) !>((revising:wp (scag 5 posts) ~zod ~nec)))
      (expect-eq !>(|) !>((revising:wp (scag 2 posts) ~zod ~nec)))
  ==
++  test-the-group-card-marker-settles-the-card
  =/  posts=(list post:wp)  ~[(card-post 1 key sample) (tapped 2 key 'create') (marked 3 key)]
  ;:  weld
      (expect-eq !>(`[~nec %lisbon-trip]) !>(created:(standing posts key)))
      (expect-eq !>(~) !>(created:(standing (scag 2 posts) key)))
      %+  expect-eq
        !>(`[key [~nec %lisbon-trip]])
      !>((settled:wp blob:(marked 3 key)))
  ==
++  test-tap-notes-follow-the-dm
  =/  posts=(list post:wp)  ~[(card-post 1 key sample) (tapped 2 key 'create')]
  =/  live  (review:wp posts ~zod ~nec key)
  =/  stale  (review:wp (snoc posts (card-post 3 'workspace-plan-ffffffffffff' sample)) ~zod ~nec key)
  %-  expect
  !>  ?&  (find-sub:ht 'tlon_workspace_create with proposal_id "workspace-plan-0123456789ab"' (note:wp key & live))
          (find-sub:ht 'Create nothing' (note:wp key & stale))
          !(find-sub:ht 'tlon_workspace_create' (note:wp key & stale))
          (find-sub:ht 'Ask in one short line what to change' (note:wp key | live))
          (find-sub:ht 'no longer known' (note:wp key & ~))
          (noted:wp (note:wp key & live))
      ==
++  test-first-chat-stands-in-for-the-plans-first-channel
  =/  listed=(list [nest:wp @t])
    :~  [[%chat ~nec %general] 'General']
        [[%heap ~nec %places] 'places']
        [[%notes ~nec %notes] 'Notes']
    ==
  ;:  weld
      %+  expect-eq
        !>  ^-  (list (unit nest:wp))
        ~[`[%chat ~nec %general] `[%heap ~nec %places] `[%notes ~nec %notes]]
      !>((assign:wp sample listed))
      %+  expect-eq
        !>(`(list (unit nest:wp))`~[`[%chat ~nec %general] ~ ~])
      !>((assign:wp sample (scag 1 listed)))
      %+  expect-eq
        !>(`(list (unit nest:wp))`~[~ `[%heap ~nec %places] ~])
      !>((assign:wp sample ~[[[%heap ~nec %places] 'Places']]))
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
++  test-create-finishes-only-a-group-made-for-the-card
  =/  made  group
  =.  title.meta.made  'Lisbon Trip'
  =.  seats.made  (my ~[[~zod *seat:v9:g] [~nec *seat:v9:g]])
  =/  renamed  made
  =.  title.meta.renamed  'Book Club'
  =/  joined  made
  =.  seats.joined  (~(put by seats.made) ~bud *seat:v9:g)
  %-  expect
  !>  ?&  (owned:wp sample ~nec ~zod made)
          !(owned:wp sample ~nec ~zod renamed)
          !(owned:wp sample ~nec ~zod joined)
      ==
++  test-arrange-renames-the-chat-hides-the-group-and-orders-channels
  =/  nests=(list nest:wp)  ~[[%chat ~nec %general] [%heap ~nec %places] [%notes ~nec %notes]]
  =/  commands  (arrange:wp sample group nests)
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
      (expect-eq !>(~) !>((arrange:wp sample settled nests)))
  ==
++  test-brief-and-result-carry-the-card-not-the-models-memory
  =/  brief  (brief:wp 'workspace-plan-ab' ~nec sample)
  =/  nests=(list nest:wp)  ~[[%chat ~zod %trip] [%heap ~zod %places] [%notes ~zod %notes]]
  =/  result  (created:wp sample [~zod %trip] nests &)
  %-  expect
  !>  ?&  (find-sub:ht 'create_group with title "Lisbon Trip"' brief)
          (find-sub:ht 'title "Places", kind heap, description "Three spots"' brief)
          (find-sub:ht 'title "Notes", kind notes, and no description' brief)
          (find-sub:ht 'proposal_id "workspace-plan-ab" and group' brief)
          (find-sub:ht 'Created "Lisbon Trip" as ~zod/trip' result)
          (find-sub:ht 'chat/~zod/trip already opens with your answer' result)
          (find-sub:ht 'Notes (notebook) notebook ~zod/notes: Bookings' result)
          (find-sub:ht 'cron_add: the schedule and prompt you gave this task' result)
          (find-sub:ht 'Start the prompt with "[Fare check]"' result)
          !(find-sub:ht 'already opens' (created:wp sample [~zod %trip] nests |))
      ==
++  test-group-id-accepts-a-citation-path-only-for-a-real-flag
  ;:  weld
      (expect-eq !>(`(unit [@p @tas])``[~nec %lisbon-trip]) !>((flag:wp '~nec/lisbon-trip')))
      %+  expect-eq
        !>(`(unit [@p @tas])``[~nec %lisbon-trip])
      !>((flag:wp ' /1/group/~nec/lisbon-trip '))
      %-  expect
      !>  ?&  =(~ (flag:wp 'nec/lisbon-trip'))
              =(~ (flag:wp '~nec/Lisbon Trip'))
              ::  The tlon tool's own limit on a group name.
              =(~ (flag:wp (cat 3 '~nec/' (crip (reap 65 'a')))))
          ==
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

--
