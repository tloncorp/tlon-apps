::  Workspace proposals: the plan a card lists, the card, the owner's tap on
::  it and what Create still has to do. Nothing is saved: the owner's DM
::  holds the cards, the taps and the answers, and these arms read them
::  from its posts. Pure; the Tlon hand owns the authority checks and every
::  effect.
/-  g=groups-ver
/+  work-card=harness-tlon-work-card, cron=harness-cron, spec=harness-tlon-tool
|%
+$  nest  [kind=@tas ship=@p name=@tas]
+$  channel  [kind=?(%chat %gallery %notebook) title=@t purpose=@t]
::  The card shows the task's title and description. Its schedule and
::  prompt are in the plan call, which the model keeps in its transcript.
+$  task  [title=@t description=@t]
+$  plan  [title=@t description=@t channels=(list channel) task=(unit task)]
::  A DM post, oldest first, as the hand reads them
+$  post  [at=@da author=@p text=@t blob=(unit @t)]
::  What the DM says about one card
+$  standing
  $:  plan=plan
      at=@da
      latest=?
      approved=?
      edited=?
      created=(unit [@p @tas])
      answer=@t
  ==
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
  ^-  (unit [intro=@t plan=plan])
  %-  mole
  |.
  ?>  ?=(%o -.args)
  =/  channels  (~(got by p.args) 'channels')
  ?>  ?=(%a -.channels)
  ?>  &((gte (lent p.channels) 1) (lte (lent p.channels) 6))
  =/  rows  (turn p.channels row)
  ?>  =(%chat kind:(snag 0 rows))
  =/  titles  (turn rows |=(row=channel (crip (cass (trip title.row)))))
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
++  row
  |=  raw=json
  ^-  channel
  =/  kind  (text raw 'kind' 16)
  ?>  ?=(?(%chat %gallery %notebook) kind)
  [kind (text raw 'title' 40) (text raw 'purpose' 120)]
::
::  +job: a task, its schedule and prompt checked but not shown on the card
++  job
  |=  raw=json
  ^-  task
  =/  pattern  (parse:cron (text raw 'schedule' 100))
  =/  prompt  (text raw 'prompt' 2.000)
  [(text raw 'title' 40) (text raw 'description' 120)]
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
  |=  plan=plan
  ^-  @t
  =/  lines=(list @t)
    %+  turn  channels.plan
    |=(row=channel (rap 3 '- ' title.row ': ' purpose.row ~))
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
  |=(plan=plan (rap 3 'Create the "' title.plan '" workspace' ~))
++  edit-message
  |=(plan=plan (rap 3 'Edit the "' title.plan '" workspace' ~))
::  +blob: the proposal card. Its ids, icons and button texts are the ones
::  the app and the OpenClaw plugin's card already use.
::
++  blob
  |=  [id=@t plan=plan]
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
      'No card for a topic already proposed or declined in this conversation, small talk, '
      'one-off questions, or the owner introducing themselves.]'
  ==
::  +noted: does this message already carry a card note? Then it is a tap,
::  and the note says what to do.
::
++  noted
  |=  message=@t
  ^-  ?
  ?=(^ (find "[Workspace card:" (trip message)))
::  +worded: is this the message a card's Create or Edit button sends?
::
++  worded
  |=  message=@t
  ^-  ?
  =/  text  (trip message)
  =/  ending  "\" workspace"
  ?.  =(ending (slag (sub (max (lent text) (lent ending)) (lent ending)) text))  |
  |(=("Create the \"" (scag 12 text)) =("Edit the \"" (scag 10 text)))
::  +tap: the owner's Create (&) or Edit (|) on a proposal card, from the
::  selection receipt the app puts in the message's blob
::
++  tap
  |=  blob=(unit @t)
  ^-  (unit [id=@t create=?])
  ?~  blob  ~
  ?:  (gth (met 3 u.blob) 8.192)  ~
  =/  found  (mole |.((murn (entries u.blob) selection)))
  ?.  ?=([~ [* ~]] found)  ~
  `i.u.found
::
++  entries
  |=  blob=@t
  ^-  (list json)
  =/  parsed  (need (de:json:html blob))
  ?>  ?=(%a -.parsed)
  p.parsed
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
::  +card: the workspace card a bot post carries, read back from its blob
::
++  card
  |=  blob=(unit @t)
  ^-  (unit [id=@t =plan])
  ?~  blob  ~
  %-  mole
  |.
  =/  entry
    %+  skip  (entries u.blob)
    |=(e=json !=(`[%s 'a2ui'] ?>(?=(%o -.e) (~(get by p.e) 'type'))))
  ?>  ?=([* ~] entry)
  ?>  ?=(%o -.i.entry)
  =/  messages  (~(got by p.i.entry) 'messages')
  ?>  ?=([%a * * ~] messages)
  =/  update  i.t.p.messages
  ?>  ?=(%o -.update)
  =/  body  (~(got by p.update) 'updateComponents')
  ?>  ?=(%o -.body)
  =/  id  (~(got by p.body) 'surfaceId')
  ?>  ?=(%s -.id)
  ?>  =(prefix (end [3 (met 3 prefix)] p.id))
  =/  components  (~(got by p.body) 'components')
  ?>  ?=(%a -.components)
  =/  by-id
    %-  malt
    %+  turn  p.components
    |=  c=json
    ?>  ?=(%o -.c)
    =/  key  (~(got by p.c) 'id')
    ?>  ?=(%s -.key)
    [p.key p.c]
  =/  field
    |=  [key=@t name=@t]
    ^-  @t
    =/  found  (~(got by by-id) key)
    =/  value  (~(got by found) name)
    ?>  ?=(%s -.value)
    p.value
  =/  index=@ud  0
  =/  channels=(list channel)
    |-  ^-  (list channel)
    =/  key  (cat 3 'channel-' (crip (a-co:co index)))
    ?.  (~(has by by-id) key)  ~
    =/  icon  (field key 'icon')
    =/  kind=?(%chat %gallery %notebook)
      ?:  =('ChannelGalleries' icon)  %gallery
      ?:  =('ChannelNotebooks' icon)  %notebook
      %chat
    :-  [kind (field key 'text') (field (cat 3 key '-purpose') 'text')]
    $(index +(index))
  ?>  ?=(^ channels)
  :-  p.id
  :^  (field 'title' 'text')  (field 'description' 'text')  channels
  ?.  (~(has by by-id) 'task')  ~
  `[(field 'task' 'text') (field 'task-description' 'text')]
::  +marker: the blob that marks a post as one Create made, by key
::
++  marker
  |=  key=@t
  ^-  @t
  %-  en:json:html
  :-  %a
  :~  %-  pairs:enjs:format
      :~  ['type' %s 'tlon-agent-post-marker']
          ['version' %n '1']
          ['key' %s key]
      ==
  ==
++  created-key
  |=  [id=@t flag=[@p @tas]]
  (rap 3 'workspace-created:' id ':' (flag-id:spec flag) ~)
::  +settled: the card and group a marker key names
::
++  settled
  |=  blob=(unit @t)
  ^-  (unit [id=@t flag=[@p @tas]])
  ?~  blob  ~
  %-  mole
  |.
  =/  found
    %+  murn  (entries u.blob)
    |=  e=json
    ?.  ?=(%o -.e)  ~
    ?.  =(`[%s 'tlon-agent-post-marker'] (~(get by p.e) 'type'))  ~
    =/  key  (~(get by p.e) 'key')
    ?.  ?=([~ %s *] key)  ~
    `p.u.key
  ?>  ?=([@ ~] found)
  =/  head  'workspace-created:'
  ?>  =(head (end [3 (met 3 head)] i.found))
  =/  rest  (trip (rsh [3 (met 3 head)] i.found))
  =/  split  (need (find ":" rest))
  :-  (crip (scag split rest))
  (need (flag (crip (slag +(split) rest))))
::  +review: everything the DM says about card .id. Posts are oldest first;
::  .our wrote the cards and the answers, .owner the taps.
::
++  review
  |=  [posts=(list post) our=@p owner=@p id=@t]
  ^-  (unit standing)
  =/  cards=(list [at=@da id=@t =plan])
    %+  murn  posts
    |=  =post
    ?.  =(our author.post)  ~
    =/  found  (card blob.post)
    ?~(found ~ `[at.post u.found])
  =/  index  (find ~[id] (turn cards |=([* id=@t *] id)))
  ?~  index  ~
  =/  this  (snag u.index cards)
  =/  taps=(list [at=@da id=@t create=?])
    %+  murn  posts
    |=  =post
    ?.  =(owner author.post)  ~
    =/  found  (tap blob.post)
    ?~(found ~ `[at.post u.found])
  =/  tapped
    |=  [card=@t create=?]
    (lien taps |=([* id=@t c=?] &(=(card id) =(create c))))
  =/  marks=(list [id=@t flag=[@p @tas]])
    (murn posts |=(=post ?.(=(our author.post) ~ (settled blob.post))))
  =/  made  (skim marks |=([card=@t *] =(card id)))
  :-  ~
  :*  plan.this
      at.this
      =(+(u.index) (lent cards))
      (tapped id &)
      (tapped id |)
      ?~(made ~ `flag.i.made)
      (answer posts our owner cards u.index tapped)
  ==
::  +answer: the bot's reply after a card, up to the owner's next message.
::  A Create tap is not a message: the owner can tap it before the reply
::  lands. An Edit tap starts the conversation about changing the card.
::  A card revised after Edit keeps the answer of the card it revises,
::  unless that card was already created.
::
++  answer
  |=  $:  posts=(list post)  our=@p  owner=@p
          cards=(list [at=@da id=@t =plan])
          index=@ud
          tapped=$-([@t ?] ?)
      ==
  ^-  @t
  =/  this  (snag index cards)
  ?:  ?&  (gth index 0)
          =/  before  id:(snag (dec index) cards)
          &((tapped before |) !(made posts our before))
      ==
    $(index (dec index))
  =/  after  (skim posts |=(=post (gth at.post at.this)))
  =/  until
    |-  ^-  (list post)
    ?~  after  ~
    ?:  =(owner author.i.after)
      ?.  ?=([~ * %&] (tap blob.i.after))  ~
      $(after t.after)
    [i.after $(after t.after)]
  ::  A reply can carry a blob (a Context Lens pointer, a work card); only
  ::  the cards and markers this library writes are not answers.
  =/  said
    %+  murn  until
    |=  =post
    ?.  =(our author.post)  ~
    ?:  |(?=(^ (card blob.post)) ?=(^ (settled blob.post)))  ~
    `text.post
  %+  roll  said
  |=([line=@t out=@t] ?:(=('' out) line (rap 3 out '\0a\0a' line ~)))
::  +note: what the model is told about a tap, appended to the owner's
::  message
::
++  note
  |=  [id=@t create=? card=(unit standing)]
  ^-  @t
  ?~  card
    '\0a[Workspace card: this card is no longer known to you, so nothing will be created from it. Say so in one line and offer to propose it again.]'
  =/  title  (rap 3 '"' title.plan.u.card '"' ~)
  ?:  &(!latest.u.card ?=(~ created.u.card))
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
  ?^  created.u.card
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
::  +revising: is a new card a revision? The newest card before it was
::  tapped Edit and not created, so the new one keeps that card's answer.
::  Edit on a created card changes the workspace, not the card.
::
++  revising
  |=  [posts=(list post) our=@p owner=@p]
  ^-  ?
  =/  cards
    (murn posts |=(=post ?.(=(our author.post) ~ (card blob.post))))
  ?~  cards  |
  =/  last  (rear cards)
  ?:  (made posts our id.last)  |
  %+  lien  posts
  |=  =post
  ?.  =(owner author.post)  |
  =(`[id.last |] (tap blob.post))
::  +made: does a marker from .our settle card .id?
::
++  made
  |=  [posts=(list post) our=@p id=@t]
  ^-  ?
  %+  lien  posts
  |=  =post
  ?&  =(our author.post)
      =/  marked  (settled blob.post)
      &(?=(^ marked) =(id id.u.marked))
  ==
::  +assign: the group's channel for each planned one, in the plan's order.
::  A title names it; the group's first chat, whatever it is called, is the
::  plan's first channel.
::
++  assign
  |=  [plan=plan channels=(list [=nest title=@t])]
  ^-  (list (unit nest))
  =/  lower  |=(value=@t (crip (cass (trip value))))
  =/  named=(list (unit nest))
    %+  turn  channels.plan
    |=  row=channel
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
::  +owned: is .group the one made for this card? It carries the card's
::  title, and nobody but the owner and this ship has a seat, is pending or
::  invited, or holds a token: anyone else could read the copied answer.
::
++  owned
  |=  [plan=plan owner=@p our=@p group=group:v9:g]
  ^-  ?
  =/  ours  |=(who=@p |(=(who owner) =(who our)))
  =*  ad  admissions.group
  ?&  =(title.meta.group title.plan)
      (~(all in ~(key by seats.group)) ours)
      (~(all in ~(key by pending.ad)) ours)
      (~(all in ~(key by invited.ad)) ours)
      %-  ~(all by tokens.ad)
      |=  meta=token-meta:v9:g
      ?&(?=(%personal -.scheme.meta) (ours ship.scheme.meta))
  ==
::  +arrange: what makes the group match its card once its channels exist:
::  the first chat's name, the privacy and the channel order
::
++  arrange
  |=  [plan=plan group=group:v9:g nests=(list nest)]
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
++  nest-id  nest-id:spec
::  +brief: what the model does between the tap and the second call
::
++  brief
  |=  [id=@t owner=@p =plan]
  ^-  @t
  ?>  ?=(^ channels.plan)
  =/  rest=(list @t)
    %+  turn  t.channels.plan
    |=  row=channel
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
          (scot %p owner)
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
  |=  [=plan flag=[@p @tas] nests=(list nest) answered=?]
  ^-  @t
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
          '" now, once, with cron_add: the schedule and prompt you gave this task in tlon_workspace_plan and timezone "UTC", without runs, so it repeats until cancelled. '
          'Start the prompt with "['
          title.u.task.plan
          ']" and end it with: "Post the result in '
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
  (mole |.((flag:spec value)))
--
