::  Requests from ships without access, and the card that tells the owner.
::  The card is the OpenClaw plugin's approval card; its buttons send
::  ordinary owner commands and approve nothing themselves.
/-  t=harness-tlon
/+  p=harness-tlon-policy, work-card=harness-tlon-work-card
|%
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
      (button 'allow' 'Allow' `'primary' (cat 3 '/allow ' id))
      (button 'reject' 'Reject' ~ (cat 3 '/reject ' id))
      (button 'ban' 'Block' `'borderless' (cat 3 '/ban ' id))
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
