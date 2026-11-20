::  Workspace proposals: the plan a card lists, the card, the owner's tap on
::  it and what Create still has to do. Pure; the Tlon hand owns the
::  proposals, the authority checks and every effect.
/-  t=harness-tlon, g=groups-ver
/+  work-card=harness-tlon-work-card, cron=harness-cron
|%
+$  nest  [kind=@tas ship=@p name=@tas]
++  prefix  'workspace-plan-'
++  names
  ^-  (list @t)
  ~['tlon_workspace_plan' 'tlon_workspace_create' 'tlon_workspace_link']
::
++  tidy
  |=  raw=@t
  ^-  @t
  =/  chars  (trip raw)
  =/  out=tape  ~
  =/  gap  |
  |-
  ?~  chars  (crip (flop out))
  ?:  (lte i.chars 32)  $(chars t.chars, gap !=(~ out))
  =?  out  gap  [' ' out]
  $(chars t.chars, out [i.chars out], gap |)
::
++  text
  |=  [args=json key=@t cap=@ud]
  ^-  @t
  ?>  ?=(%o -.args)
  =/  value  (~(got by p.args) key)
  ?>  ?=(%s -.value)
  =/  out  (tidy p.value)
  ?>  &(!=('' out) (lte (met 3 out) cap))
  out
::
::  +invalid: why a plan was refused, naming the first field at fault
::
++  invalid
  |=  args=json
  ^-  @t
  =/  bad
    |=  [from=json key=@t cap=@ud]
    =(~ (mole |.((text from key cap))))
  =/  field=@t
    ?.  ?=(%o -.args)  'the arguments object'
    ?:  (bad args 'intro' 300)  'intro'
    ?:  (bad args 'title' 60)  'title'
    ?:  (bad args 'description' 200)  'description'
    =/  channels  (~(get by p.args) 'channels')
    ?.  ?=([~ %a *] channels)  'channels'
    =/  rows  p.u.channels
    =/  index=@ud  0
    |-  ^-  @t
    ?~  rows  'the channel list (its count, first kind or a repeated title) or the task'
    =/  at  (rap 3 'channels[' (crip (a-co:co index)) '].' ~)
    =/  kind  (mole |.((text i.rows 'kind' 16)))
    ?.  ?=([~ ?(%chat %gallery %notebook)] kind)  (cat 3 at 'kind')
    ?:  (bad i.rows 'title' 40)  (cat 3 at 'title')
    ?:  (bad i.rows 'purpose' 120)  (cat 3 at 'purpose')
    $(rows t.rows, index +(index))
  %+  rap  3
  :~  'error: '
      field
      ' is missing, too long or not allowed. The plan needs intro (one sentence, at most 300 bytes), title (at most 60), '
      'description (at most 200) and channels: 1 to 6 objects with kind (chat, gallery or '
      'notebook), title (at most 40, all different) and purpose (at most 120), the first a chat. '
      'An optional task needs title (at most 40), description (at most 120), schedule (a '
      'five-field cron expression in UTC, such as "0 16 * * 1") and prompt (at most 2000).'
  ==
::
++  parse
  |=  args=json
  ^-  (unit [intro=@t plan=workspace-plan:t])
  %-  mole
  |.
  ?>  ?=(%o -.args)
  =/  channels  (~(got by p.args) 'channels')
  ?>  ?=(%a -.channels)
  ?>  &((gte (lent p.channels) 1) (lte (lent p.channels) 6))
  =/  rows  (turn p.channels channel)
  ?>  =(%chat kind:(snag 0 rows))
  =/  titles  (turn rows |=(row=workspace-channel:t (crip (cass (trip title.row)))))
  ?>  =((lent titles) ~(wyt in (silt titles)))
  =/  task  (~(get by p.args) 'task')
  :*  (text args 'intro' 300)
      (text args 'title' 60)
      (text args 'description' 200)
      rows
      ?:  |(?=(~ task) ?=(~ u.task))  ~
      `(job u.task)
  ==
::
++  channel
  |=  raw=json
  ^-  workspace-channel:t
  =/  kind  (text raw 'kind' 16)
  ?>  ?=(?(%chat %gallery %notebook) kind)
  [kind (text raw 'title' 40) (text raw 'purpose' 120)]
::
++  job
  |=  raw=json
  ^-  workspace-task:t
  =/  schedule  (text raw 'schedule' 100)
  =/  pattern  (parse:cron schedule)
  [(text raw 'title' 40) (text raw 'description' 120) schedule (text raw 'prompt' 2.000)]
::
++  native-kind
  |=  kind=?(%chat %gallery %notebook)
  ^-  @tas
  ?-  kind
    %chat  %chat
    %gallery  %heap
    %notebook  %notes
  ==
::  +fallback: the card's text, for apps that cannot draw it
::
++  fallback
  |=  plan=workspace-plan:t
  ^-  @t
  =/  lines=(list @t)
    %+  turn  channels.plan
    |=(row=workspace-channel:t (rap 3 '- ' title.row ': ' purpose.row ~))
  =?  lines  ?=(^ task.plan)
    (snoc lines (rap 3 '- ' title.u.task.plan ': ' description.u.task.plan ~))
  %+  roll
    ;:  weld
        ~[(cat 3 'New workspace: ' title.plan) description.plan]
        lines
        ~['Update Tlon to create it from this card.']
    ==
  |=([line=@t out=@t] ?:(=('' out) line (rap 3 out '\0a' line ~)))
::
++  create-message
  |=(plan=workspace-plan:t (rap 3 'Create the "' title.plan '" workspace' ~))
++  edit-message
  |=(plan=workspace-plan:t (rap 3 'Edit the "' title.plan '" workspace' ~))
::  +blob: the proposal card. Its ids, icons and button texts are the ones
::  the app and the OpenClaw plugin's card already use.
::
++  blob
  |=  [id=@t plan=workspace-plan:t]
  ^-  @t
  =/  words
    |=  [id=@t body=@t extra=(list [@t json])]
    ^-  json
    =/  base=(list [@t json])  ~[['id' %s id] ['component' %s 'Text'] ['text' %s body]]
    (pairs:enjs:format (weld base extra))
  =/  item
    |=  [id=@t title=@t caption=@t icon=@t]
    ^-  (list json)
    :~  (words id title ~[['icon' %s icon]])
        (words (cat 3 id '-purpose') caption ~[['variant' %s 'caption']])
    ==
  =/  index=@ud  0
  =/  items=(list json)
    |-  ^-  (list json)
    ?:  =(index (lent channels.plan))  ~
    =/  row  (snag index channels.plan)
    =/  icon
      ?-  kind.row
        %chat  'ChannelTalk'
        %gallery  'ChannelGalleries'
        %notebook  'ChannelNotebooks'
      ==
    %+  weld
      (item (cat 3 'channel-' (crip (a-co:co index))) title.row purpose.row icon)
    $(index +(index))
  =?  items  ?=(^ task.plan)
    %+  weld  items
    :~  (words 'task' title.u.task.plan ~[['icon' %s 'Clock']])
        (words 'task-description' description.u.task.plan ~[['variant' %s 'caption']])
    ==
  =/  ids
    |=  rows=(list json)
    ^-  (list json)
    %+  turn  rows
    |=  row=json
    ?>  ?=(%o -.row)
    (~(got by p.row) 'id')
  =/  button
    |=  [id=@t label=@t variant=@t result=@t message=@t]
    ^-  (list json)
    :~  %-  pairs:enjs:format
        :~  ['id' %s id]
            ['component' %s 'Button']
            ['child' %s (cat 3 id '-label')]
            ['variant' %s variant]
            ['resultLabel' %s result]
            ['action' (send-action:work-card message)]
        ==
        (words (cat 3 id '-label') label ~)
    ==
  =/  components=(list json)
    ;:  weld
        :~  (pairs:enjs:format ~[['id' %s 'root'] ['component' %s 'Card'] ['child' %s 'body']])
            %-  pairs:enjs:format
            :~  ['id' %s 'body']
                ['component' %s 'Column']
                :-  'children'
                :-  %a
                ;:  weld
                    `(list json)`~[[%s 'header'] [%s 'title'] [%s 'description']]
                    (ids items)
                    `(list json)`~[[%s 'actions']]
                ==
            ==
            %-  pairs:enjs:format
            :~  ['id' %s 'header']
                ['component' %s 'Row']
                ['justify' %s 'spaceBetween']
                ['children' %a ~[[%s 'kicker'] [%s 'privacy']]]
            ==
            (words 'kicker' 'New workspace' ~[['role' %s 'kicker'] ['icon' %s 'Lock']])
            (words 'privacy' 'Only you' ~[['role' %s 'status']])
            (words 'title' title.plan ~[['variant' %s 'h3']])
            (words 'description' description.plan ~)
        ==
        items
        :~  %-  pairs:enjs:format
            :~  ['id' %s 'actions']
                ['component' %s 'Row']
                ['children' %a ~[[%s 'edit'] [%s 'create']]]
            ==
        ==
        (button 'edit' 'Edit' 'secondary' 'You asked for changes.' (edit-message plan))
        %:  button
          'create'
          'Create'
          'primary'
          (rap 3 'You asked to create ' title.plan '.' ~)
          (create-message plan)
        ==
    ==
  (surface:work-card id components &)
::  +rule: the hand's context for an owner DM message, which the head
::  records beside the message and never as part of it. The same rule in the
::  instructions alone lost to the message at hand: asked a quick question
::  about a trip that had a workspace, the model answered and linked nothing.
::
++  rule
  ^-  @t
  %+  rap  3
  :~  '[Workspace rule, from your Tlon hand, not your owner: if the next message starts or returns to a topic that will outlast one reply '
      '(a project, trip, course, renovation or routine), run the tlon tool\'s list_groups first. '
      'If a workspace already covers it, link it with tlon_workspace_link, once per conversation, '
      'then answer as usual. Otherwise propose one with tlon_workspace_plan and answer in your reply. '
      'Small talk and one-off questions get no card, and neither does the owner introducing themselves.]'
  ==
::  +noted: does this message already carry a card note? Then it is a tap,
::  and the note says what to do.
::
++  noted
  |=  message=@t
  ^-  ?
  ?=(^ (find "[Workspace card:" (trip message)))
::  +worded: is this the message one of the owner's cards' buttons sends?
::
++  worded
  |=  [proposals=(map @t workspace-proposal:t) owner=@p message=@t]
  ^-  ?
  %+  lien  ~(val by proposals)
  |=  proposal=workspace-proposal:t
  ?&  =(owner owner.proposal)
      |(=(message (create-message plan.proposal)) =(message (edit-message plan.proposal)))
  ==
::  +tap: the owner's Create (&) or Edit (|) on a proposal card, from the
::  selection receipt the app puts in the message's blob
::
++  tap
  |=  blob=(unit @t)
  ^-  (unit [id=@t create=?])
  ?~  blob  ~
  ?:  (gth (met 3 u.blob) 8.192)  ~
  %-  mole
  |.
  =/  entries  (need (de:json:html u.blob))
  ?>  ?=(%a -.entries)
  =/  found  (murn p.entries selection)
  ?>  ?=([* ~] found)
  i.found
::
++  selection
  |=  entry=json
  ^-  (unit [id=@t create=?])
  ?.  ?=(%o -.entry)  ~
  ?.  =(`[%s 'tlon-a2ui-selection'] (~(get by p.entry) 'type'))  ~
  =/  surface  (~(get by p.entry) 'surfaceId')
  =/  component  (~(get by p.entry) 'componentId')
  ?.  &(?=([~ %s *] surface) ?=([~ %s *] component))  ~
  ?.  =(prefix (end [3 (met 3 prefix)] p.u.surface))  ~
  ?:  (gth (met 3 p.u.surface) 64)  ~
  ?:  =('create' p.u.component)  `[p.u.surface &]
  ?:  =('edit' p.u.component)  `[p.u.surface |]
  ~
::  +note: what the model is told about a tap, appended to the owner's
::  message. The proposal is as it was before the tap.
::
++  note
  |=  [id=@t create=? proposal=(unit workspace-proposal:t)]
  ^-  @t
  ?~  proposal
    '\0a[Workspace card: this card is no longer known to you, so nothing will be created from it. Say so in one line and offer to propose it again.]'
  =/  title  (rap 3 '"' title.plan.u.proposal '"' ~)
  ?:  =(%superseded status.u.proposal)
    %+  rap  3
    :~  '\0a[Workspace card: the owner tapped '
        ?:(create 'Create' 'Edit')
        ' on the '
        title
        ' card, which a newer card replaced. Create nothing; say in one line to use the latest card.]'
    ==
  ?:  create
    %+  rap  3
    :~  '\0a[Workspace card: the owner tapped Create on '
        title
        '. Call tlon_workspace_create with proposal_id "'
        id
        '" now and follow its result. Create nothing before that call.]'
    ==
  ?:  =(%created status.u.proposal)
    %+  rap  3
    :~  '\0a[Workspace card: the owner tapped Edit on '
        title
        ', which is already created. Ask what to change and change the workspace itself with the tlon tool.]'
    ==
  %+  rap  3
  :~  '\0a[Workspace card: the owner tapped Edit on '
      title
      '. Ask in one short line what to change. Once they answer, post the revised card with tlon_workspace_plan; it replaces this one. Create nothing yet.]'
  ==
::  +supersede: one open card per owner. A new card replaces every card of
::  theirs that has not started creating.
::
++  supersede
  |=  [proposals=(map @t workspace-proposal:t) owner=@p keep=@t]
  ^+  proposals
  %-  ~(urn by proposals)
  |=  [id=@t proposal=workspace-proposal:t]
  ?.  ?&  !=(id keep)
          =(owner owner.proposal)
          ?=(?(%open %approved) status.proposal)
          ?=(~ group.proposal)
      ==
    proposal
  proposal(status %superseded, awaiting |)
::  +inherited: the answer a revised card keeps: that of the card the owner
::  tapped Edit on
::
++  inherited
  |=  [proposals=(map @t workspace-proposal:t) owner=@p]
  ^-  @t
  =/  editing
    %+  sort
      %+  skim  ~(val by proposals)
      |=  proposal=workspace-proposal:t
      &(=(owner owner.proposal) =(%open status.proposal) editing.proposal)
    |=([a=workspace-proposal:t b=workspace-proposal:t] (gth at.a at.b))
  ?~(editing '' answer.i.editing)
::  +prune: settled cards beyond the newest sixteen are forgotten
::
++  prune
  |=  proposals=(map @t workspace-proposal:t)
  ^+  proposals
  =/  rows
    %+  sort  ~(tap by proposals)
    |=  [a=[@t workspace-proposal:t] b=[@t workspace-proposal:t]]
    (gth at.a at.b)
  (malt (scag 16 rows))
::  +assign: the group's channel for each planned one, in the plan's order.
::  A title names it; the group's first chat, whatever it is called, is the
::  plan's first channel.
::
++  assign
  |=  [plan=workspace-plan:t channels=(list [=nest title=@t])]
  ^-  (list (unit nest))
  =/  lower  |=(value=@t (crip (cass (trip value))))
  =/  named=(list (unit nest))
    %+  turn  channels.plan
    |=  row=workspace-channel:t
    =/  found
      %+  skim  channels
      |=  [=nest title=@t]
      &(=(kind.nest (native-kind kind.row)) =((lower title) (lower title.row)))
    ?~(found ~ `nest.i.found)
  ?:  =(~ named)  ~
  ?.  =(~ (snag 0 named))  named
  =/  taken  (silt (murn named |=(found=(unit nest) found)))
  =/  spare
    %+  skim  channels
    |=([=nest title=@t] &(=(%chat kind.nest) !(~(has in taken) nest)))
  ?~  spare  named
  [`nest.i.spare (slag 1 named)]
::  +arrange: what makes the group match its card once its channels exist:
::  the first chat's name, the privacy and the channel order
::
++  arrange
  |=  [plan=workspace-plan:t group=group:v9:g nests=(list nest)]
  ^-  (list a-group:v8:g)
  =/  chat  (snag 0 nests)
  =/  named  (snag 0 channels.plan)
  =/  first  (~(got by channels.group) chat)
  =/  wanted  meta.first(title title.named, description purpose.named)
  =/  rename=(list a-group:v8:g)
    ?:  =(title.meta.first title.wanted)  ~
    ~[[%channel chat %edit first(meta wanted)]]
  =/  privacy=(list a-group:v8:g)
    ?:  =(%secret privacy.admissions.group)  ~
    ~[[%entry %privacy %secret]]
  =/  section  (~(get by sections.group) %default)
  =/  movable
    ?&  ?=(^ section)
        !=(nests (scag (lent nests) order.u.section))
        %+  levy  nests
        |=  =nest
        =/  listed  (~(get by channels.group) nest)
        &(?=(^ listed) =(%default section.u.listed))
    ==
  =/  index=@ud  0
  =/  moves=(list a-group:v8:g)
    ?.  movable  ~
    |-  ^-  (list a-group:v8:g)
    ?~  nests  ~
    [[%section %default %move-nest i.nests index] $(nests t.nests, index +(index))]
  :(weld rename privacy moves)
::
++  nest-id
  |=  =nest
  ^-  @t
  (rap 3 kind.nest '/' (scot %p ship.nest) '/' name.nest ~)
::  +brief: what the model does between the tap and the second call
::
++  brief
  |=  [id=@t proposal=workspace-proposal:t]
  ^-  @t
  =/  plan  plan.proposal
  ?>  ?=(^ channels.plan)
  =/  rest=(list @t)
    %+  turn  t.channels.plan
    |=  row=workspace-channel:t
    ?:  =(%notebook kind.row)
      (rap 3 '\0a   - title "' title.row '", kind notes, and no description' ~)
    %+  rap  3
    :~  '\0a   - title "'  title.row  '", kind '  (native-kind kind.row)
        ', description "'  purpose.row  '"'
    ==
  %+  rap  3
  ;:  weld
      :~  'Approved: the owner tapped Create on "'
          title.plan
          '". Make it now, exactly as the card listed, and nothing else:\0a'
          '1. Run list_mcp_servers. If a server acts on your owner\'s account, call its create_group with title "'
          title.plan
          '" and description "'
          description.plan
          '", so the workspace is on their ship. Only when no such server is granted, use the tlon tool\'s create_group with owner '
          (scot %p owner.proposal)
          '.\0a2. Its first channel is the chat "'
          title.i.channels.plan
          '". A group that server made already has one chat; leave it, it is renamed for you. A group the tlon tool made has none, so create that chat first.'
      ==
      ?~  rest  ~
      :-  ' Then create these with the same server\'s create_channel (or the tlon tool\'s), in this order:'
      rest
      :~  '\0a3. Call tlon_workspace_create again with proposal_id "'
          id
          '" and group set to the new group\'s ID (~host/name). That names and orders the channels, opens the chat with your answer from the DM and posts the workspace\'s card in the DM.\0a'
          'Post nothing in the workspace before step 3. Never make a second group for this card: if a call failed, check list_groups first.'
      ==
  ==
::  +created: the result of the call that settled the workspace
::
++  created
  |=  [proposal=workspace-proposal:t flag=[@p @tas] nests=(list nest) answered=?]
  ^-  @t
  =/  plan  plan.proposal
  ?>  ?=(^ nests)
  =/  chat  (nest-id i.nests)
  =/  rows=(list @t)
    =/  channels  channels.plan
    =/  left=(list nest)  nests
    |-  ^-  (list @t)
    ?:  |(?=(~ channels) ?=(~ left))  ~
    :-  %+  rap  3
        :~  '\0a- '  title.i.channels  ' ('  kind.i.channels  ') '
            ?.  =(%notes kind.i.left)  (nest-id i.left)
            (rap 3 'notebook ' (scot %p ship.i.left) '/' name.i.left ~)
            ': '  purpose.i.channels
        ==
    $(channels t.channels, left t.left)
  %+  rap  3
  ;:  weld
      :~  'Created "'
          title.plan
          '" as '
          (rap 3 (scot %p -.flag) '/' +.flag ~)
          ' (secret: only the owner and you). Channels, each with the starter content its card line promised:'
      ==
      rows
      ?.  answered  ~
      ~[(rap 3 '\0a' chat ' already opens with your answer from the DM; don\'t post it again.' ~)]
      ?~  task.plan  ~
      :~  '\0aSchedule its recurring task "'
          title.u.task.plan
          '" now, once, with cron_add: schedule "'
          schedule.u.task.plan
          '", timezone "UTC", runs "100", and this prompt: "'
          prompt.u.task.plan
          ' Post the result in '
          chat
          ' with the tlon tool\'s send_channel, then reply with one short line."'
      ==
      :~  '\0aNow post that starter content in each channel with the tlon tool (gallery items one per post, notebook content as a note). Then reply here in one line. '
          'The workspace\'s card is already posted in the DM, so don\'t write its link, path or ID.'
      ==
  ==
::  +flag: ~host/name, from an ID or a /1/group/~host/name path
::
++  flag
  |=  raw=@t
  ^-  (unit [@p @tas])
  =/  value  (tidy raw)
  =?  value  =('/1/group/' (end [3 9] value))  (rsh [3 9] value)
  %-  mole
  |.
  =/  parts  (need (rush (cat 3 '/' value) stap))
  ?>  ?=([@ @ ~] parts)
  =/  host  (slav %p i.parts)
  ?>  =(i.parts (scot %p host))
  [host (need (rush i.t.parts sym))]
--
