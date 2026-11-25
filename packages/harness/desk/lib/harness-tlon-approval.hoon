::  Requests from ships without access, and the card that tells the owner.
::  The card is the OpenClaw plugin's approval card; its buttons send
::  ordinary owner commands and approve nothing themselves.
/-  t=harness-tlon
/+  p=harness-tlon-policy, work-card=harness-tlon-work-card,
    command=harness-command
|%
::  $order: the owner's answer to a request, typed or sent by a card's button
::
::    A button also names the request's ship, so that a stale card's id,
::    reused by a later request, acts on nothing.
::
+$  order  [action=?(%allow %reject %ban) id=(unit @t) ship=(unit @p)]
::  +find: the id of the request open for a ship in a place
::
++  find
  |=  [=approvals:t who=@p =place:t]
  ^-  (unit @t)
  (~(get by by-place.approvals) [who place])
::
++  open
  |=  [=approvals:t id=@t =approval:t]
  ^-  approvals:t
  :-  (~(put by by-id.approvals) id approval)
  (~(put by by-place.approvals) [who place]:approval id)
::
++  close
  |=  [=approvals:t id=@t]
  ^-  approvals:t
  =/  found  (~(get by by-id.approvals) id)
  ?~  found  approvals
  :-  (~(del by by-id.approvals) id)
  (~(del by by-place.approvals) [who place]:u.found)
::  +keep: only the requests .keep accepts
::
++  keep
  |=  [=approvals:t keep=$-(approval:t ?)]
  ^-  approvals:t
  %+  roll  ~(tap by by-id.approvals)
  |=  [[id=@t =approval:t] kept=_approvals]
  ?:  (keep approval)  kept
  (close kept id)
::  +read-order: the approval command .text is, if it is one
::
::    As OpenClaw reads it: the id is the rest of the text, trimmed, and
::    none when nothing follows the command; but a ship after the id and one
::    space, as the card's buttons send, is the request's ship.
::
++  read-order
  |=  text=@t
  ^-  (unit order)
  =/  parsed  (parse:command text)
  ?~  parsed  ~
  =/  arg  (trip arg.u.parsed)
  =/  gap  (^find " " arg)
  =/  ship=(unit @p)  ?~(gap ~ (slaw %p (crip (slag +(u.gap) arg))))
  =/  id=(unit @t)
    ?:  =('' arg.u.parsed)  ~
    ?~  gap  `arg.u.parsed
    ?~  ship  `arg.u.parsed
    `(crip (scag u.gap arg))
  ?+  name.u.parsed  ~
    %allow  `[%allow id ship]
    %reject  `[%reject id ship]
    %ban  `[%ban id ship]
  ==
::  +pick: the request an order names
::
::    As OpenClaw finds it, the exact id, else the one id it begins. With no
::    id, the only open request; unlike OpenClaw, never one of several. With
::    a ship, only the exact id, and only if the request is that ship's.
::
++  pick
  |=  [=approvals:t id=(unit @t) ship=(unit @p)]
  ^-  (unit [id=@t =approval:t])
  =/  all  ~(tap by by-id.approvals)
  ?~  id
    ?.  ?=([* ~] all)  ~
    `i.all
  =/  exact  (~(get by by-id.approvals) u.id)
  ?^  ship
    ?.  &(?=(^ exact) =(u.ship who.u.exact))  ~
    `[u.id u.exact]
  ?^  exact  `[u.id u.exact]
  =/  begun
    (skim all |=([key=@t *] =(u.id (end [3 (met 3 u.id)] key))))
  ?.  ?=([* ~] begun)  ~
  `i.begun
::  +confirmation: OpenClaw's reply to the owner once an order is carried out
::
::    .where names the request's channel, or is ~ for a DM.
::
++  confirmation
  |=  [action=?(%allow %reject %ban) who=@p where=(unit @t)]
  ^-  @t
  =/  ship  (scot %p who)
  ?-  action
    %ban  (rap 3 'Blocked ' ship '. They will no longer be able to contact the bot.' ~)
  ::
      %allow
    ?~  where
      (rap 3 'Approved DM access for ' ship '. They will be able to message the bot.' ~)
    (rap 3 'Approved ' ship ' for ' u.where '. They will be able to interact in this channel.' ~)
  ::
      %reject
    ?~  where  (rap 3 'Denied DM request from ' ship '.' ~)
    (rap 3 'Denied ' ship ' for ' u.where '.' ~)
  ==
::  +choices: the reply to an order without an id while several requests
::  are open, oldest first
::
++  choices
  |=  =approvals:t
  ^-  @t
  =/  open
    %+  sort  ~(tap by by-id.approvals)
    |=([a=[@t =approval:t] b=[@t =approval:t]] (lth at.approval.a at.approval.b))
  %+  rap  3
  :-  'More than one approval is pending. Send the command again with an ID:'
  %+  turn  open
  |=  [id=@t =approval:t]
  %+  rap  3
  :~  '\0a'  id  ' '  (scot %p who.approval)  ' '
      (address:p (place-to:p [who place]:approval))
  ==
::  +unknown: OpenClaw's reply to an order that names no open request
::
++  unknown
  |=  id=(unit @t)
  ^-  @t
  ?~  id  'No pending approval found.'
  (cat 3 'No pending approval found for ID: #' u.id)
::  +block-failed: OpenClaw's reply when the block a ban needs is refused
::
++  block-failed
  |=  who=@p
  ^-  @t
  (rap 3 'Could not block ' (scot %p who) ': block failed. Request stays pending, try again.' ~)
::  +channel-label: a channel as OpenClaw names it in a reply
::
::    .named is the channel's title, or its .name when untitled, and its
::    group's title, as the adapter's +approval-channel reads them.
::
++  channel-label
  |=  [nest=@t name=@t named=(unit [channel=@t group=(unit @t)])]
  ^-  @t
  ?~  named  nest
  =/  titled  !=(name channel.u.named)
  ?~  group.u.named
    ?.  titled  nest
    (rap 3 channel.u.named ' (' nest ')' ~)
  ?.  titled  (rap 3 u.group.u.named ' (' nest ')' ~)
  (rap 3 channel.u.named ' in ' u.group.u.named ' (' nest ')' ~)
::  +lifetime: how long a request stays open unanswered, as OpenClaw's
::
++  lifetime  ~h48
::  +limit: the most requests open at once, as OpenClaw's
::
++  limit  100
::  +ship-limit: the most requests one ship has open, across its places
::
++  ship-limit  5
::  +held: how many requests .who has open
::
++  held
  |=  [=approvals:t who=@p]
  ^-  @ud
  (lent (skim ~(val by by-id.approvals) |=(=approval:t =(who who.approval))))
::  +expired: the requests open for .lifetime or longer at .now
::
++  expired
  |=  [=approvals:t now=@da]
  ^-  (list [id=@t =approval:t])
  %+  skim  ~(tap by by-id.approvals)
  |=  [id=@t =approval:t]
  (lte (add at.approval lifetime) now)
::  +next-expiry: when the oldest open request expires
::
++  next-expiry
  |=  =approvals:t
  ^-  (unit @da)
  %+  roll  ~(val by by-id.approvals)
  |=  [=approval:t next=(unit @da)]
  =/  at  (add at.approval lifetime)
  ?~(next `at `(min at u.next))
::  +full-text: the owner's notice that no more requests open, as OpenClaw's
::
++  full-text
  |=  open=@ud
  ^-  @t
  %+  rap  3
  :~  'Pending approval queue is full ('
      (crip (a-co:co open))
      '). New requests are dropped until existing ones are approved, denied, or blocked.'
  ==
::  +full-allowed: one notice of a full queue per ten minutes, as OpenClaw's,
::  for as long as the feed keeps the earlier one
::
++  full-allowed
  |=  [now=@da notices=(list notice:t)]
  ^-  ?
  !(lien notices |=(n=notice:t &(=('approval-cap' kind.n) (gth (add at.n ~m10) now))))
::  +fresh-id: a short id unique among open requests
::
::    As OpenClaw's: the place's initial and four hex digits, or eight after
::    ten collisions, since the owner may type it.
::
++  fresh-id
  |=  [=approvals:t =place:t eny=@uvJ]
  ^-  @t
  =/  prefix  ?~(place 'd' 'c')
  =/  attempt=@ud  0
  |-
  =/  digits  ?:((lth attempt 10) 4 8)
  =/  id
    (cat 3 prefix (crip ((x-co:co digits) (end [2 digits] (sham eny attempt)))))
  ?.  (~(has by by-id.approvals) id)  id
  $(attempt +(attempt))
::  +preview: the first hundred characters of a message, as OpenClaw shows
::
++  preview
  |=  text=@t
  ^-  @t
  (crip (tufa (scag 100 (tuba (trip text)))))
::  +card: the notice text and the card for a request
::
::    .where is the channel's name and group, or ~ for a DM.
::
++  card
  |=  $:  id=@t  who=@p
          where=(unit [channel=@t group=(unit @t)])
          preview=(unit @t)
      ==
  ^-  [text=@t blob=@t]
  =/  ship  (scot %p who)
  =*  words  text:work-card
  =/  lines=(list @t)
    ?~  where  ~[(cat 3 'Sender: ' ship)]
    %+  weld
      ~[(cat 3 'Sender: ' ship) (cat 3 'Channel: ' channel.u.where)]
    ?~(group.u.where ~ ~[(cat 3 'Group: ' u.group.u.where)])
  =/  context-ids=(list @t)
    (turn (gulf 0 (dec (lent lines))) |=(n=@ud (cat 3 'context' (crip (a-co:co n)))))
  =/  copy=(unit @t)
    ?~  preview  ~
    `(rap 3 'Message: "' u.preview '"' ~)
  =/  button
    |=  [id=@t label=@t variant=(unit @t) command=@t]
    (labelled:work-card id (cat 3 id 'Label') label command variant)
  =/  children=(list @t)
    ;:  weld
      `(list @t)`~['eyebrow' 'title' 'titleDivider']
      context-ids
      ?~(copy ~ ~['copy'])
      `(list @t)`~['divider' 'details' 'actions']
    ==
  =/  divider
    |=(id=@t (pairs:enjs:format ~[['id' %s id] ['component' %s 'Divider']]))
  =/  column
    |=  [id=@t component=@t children=(list @t)]
    ^-  json
    %-  pairs:enjs:format
    :~  ['id' %s id]
        ['component' %s component]
        ['children' %a (turn children |=(c=@t [%s c]))]
    ==
  =/  components=(list json)
    ;:  weld
      :~  (pairs:enjs:format ~[['id' %s 'root'] ['component' %s 'Card'] ['child' %s 'body']])
          (column 'body' 'Column' children)
          (words 'eyebrow' ?~(where 'DM access' 'Channel access') `'caption')
          %^  words  'title'
            ?~  where  (rap 3 'Allow ' ship ' to DM the bot?' ~)
            (rap 3 'Let the bot reply to ' ship ' in ' channel.u.where '?' ~)
          `'h3'
          (divider 'titleDivider')
      ==
      %+  turn  (gulf 0 (dec (lent lines)))
      |=(n=@ud (words (snag n context-ids) (snag n lines) `'caption'))
      ?~(copy ~ ~[(words 'copy' u.copy `'caption')])
      :~  (divider 'divider')
          (column 'details' 'Column' ~['allowNote'])
          %^  words  'allowNote'
            ?~  where
              'The bot will be able to read and reply to future DMs from this user.'
            'The bot will be able to read and reply to this user in this channel.'
          `'caption'
          (column 'actions' 'Row' ~['allow' 'reject' 'ban'])
      ==
      (button 'allow' 'Allow' `'primary' (rap 3 '/allow ' id ' ' ship ~))
      (button 'reject' 'Reject' ~ (rap 3 '/reject ' id ' ' ship ~))
      (button 'ban' 'Block' `'borderless' (rap 3 '/ban ' id ' ' ship ~))
    ==
  :_  (surface:work-card (cat 3 'approval-' id) components |)
  ?~  where  (cat 3 'DM request from ' ship)
  (cat 3 'Channel mention request from ' ship)
::
++  approvals-json
  |=  =approvals:t
  ^-  json
  :-  %a
  %+  turn  ~(tap by by-id.approvals)
  |=  [id=@t =approval:t]
  %-  pairs:enjs:format
  :~  ['id' %s id]
      ['ship' %s (scot %p who.approval)]
      ['address' %s (address:p (place-to:p [who place]:approval))]
      ['at' %s (scot %da at.approval)]
  ==
--
