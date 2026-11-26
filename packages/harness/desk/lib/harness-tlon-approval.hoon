::  Requests from ships without access, and the card that tells the owner.
::  The card is the OpenClaw plugin's approval card; its buttons send
::  ordinary owner commands and approve nothing themselves.
/-  t=harness-tlon
/+  p=harness-tlon-policy, work-card=harness-tlon-work-card,
    command=harness-command, cj=channel-json
|%
::  $order: an owner command: an answer to a request, typed or sent by a
::  card's button, a listing of the open requests or of the blocked ships,
::  an unblock, or taking back a ship's grant in one place
::
::    A button also sends its request's +button-token, so that a stale
::    card's id, reused by a later request, acts on nothing. An unban holds
::    its ship, and a revoke its ship and the place it names, if it names
::    one; either holds ~ when they cannot be read from the text.
::
+$  answer  [id=(unit @t) token=(unit @uv)]
+$  order
  $%  [%allow answer]
      [%reject answer]
      [%ban answer]
      [%pending ~]
      [%banned ~]
      [%unban who=(unit @p)]
      [%revoke target=(unit [who=@p where=(unit place:t)])]
  ==
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
::  +button-token: what a card's buttons send after the id
::
::    Ids are unique only among open requests, but no two requests have the
::    same ship and opening time: the denial limit lets a ship open at most
::    one request per five minutes.
::
++  button-token
  |=  [id=@t =approval:t]
  ^-  @uv
  (sham id approval)
::  +keep: only the requests .keep accepts
::
++  keep
  |=  [=approvals:t keep=$-(approval:t ?)]
  ^-  approvals:t
  %+  roll  ~(tap by by-id.approvals)
  |=  [[id=@t =approval:t] kept=_approvals]
  ?:  (keep approval)  kept
  (close kept id)
::  +read-order: the owner command .text is, if it is one
::
::    A listing takes nothing after its name; text with more is not one.
::
++  read-order
  |=  text=@t
  ^-  (unit order)
  =/  parsed  (parse:command text)
  ?~  parsed  ~
  =*  arg  arg.u.parsed
  ?+  name.u.parsed  ~
    %allow  `[%allow (read-answer arg)]
    %reject  `[%reject (read-answer arg)]
    %ban  `[%ban (read-answer arg)]
    %pending  ?.(=('' arg) ~ `[%pending ~])
    %banned  ?.(=('' arg) ~ `[%banned ~])
    %unban  `[%unban (read-ship arg)]
    %revoke  `[%revoke (read-revoke arg)]
  ==
::  +read-answer: the request an answer's .arg names
::
::    As OpenClaw reads it: the id is the rest of the text, trimmed, and
::    none when nothing follows the command; but a token after the id and
::    one space, as the card's buttons send, is the request's token.
::
++  read-answer
  |=  arg=@t
  ^-  answer
  =/  chars  (trip arg)
  =/  gap  (^find " " chars)
  =/  token=(unit @uv)  ?~(gap ~ (slaw %uv (crip (slag +(u.gap) chars))))
  :_  token
  ?:  =('' arg)  ~
  ?~  gap  `arg
  ?~  token  `arg
  `(crip (scag u.gap chars))
::  +read-ship: the ship an unban or a revoke names, with or without its sig
::  and in any case, as OpenClaw reads it
::
++  read-ship
  |=  arg=@t
  ^-  (unit @p)
  =/  chars  (cass (trip arg))
  (slaw %p (crip ?:(=("~" (scag 1 chars)) chars ['~' chars])))
::  +read-revoke: the ship a revoke names, and the place after it and one
::  space, if any, as +place-text prints it
::
++  read-revoke
  |=  arg=@t
  ^-  (unit [who=@p where=(unit place:t)])
  =/  chars  (trip arg)
  =/  gap  (^find " " chars)
  ?~  gap
    =/  who  (read-ship arg)
    ?~(who ~ `[u.who ~])
  =/  who  (read-ship (crip (scag u.gap chars)))
  ?~  who  ~
  =/  where  (read-place (crip (slag +(u.gap) chars)))
  ?~  where  ~
  `[u.who where]
::  +read-place: the place .text names, as +place-text prints it
::
++  read-place
  |=  text=@t
  ^-  (unit place:t)
  ?:  =('dm' text)  `~
  =/  parsed  (rush text nest-rule:dejs:cj)
  ?~  parsed  ~
  =/  [kind=@tas host=@p name=@tas]  u.parsed
  ?.  ?=(?(%chat %diary %heap) kind)  ~
  ``[kind host name]
::  +place-text: a grant's place as /revoke takes it, `dm` or the channel's
::  nest
::
++  place-text
  |=  =place:t
  ^-  @t
  ?~  place  'dm'
  (address:p [%channel u.place ~])
::  +pick: the request an order names
::
::    As OpenClaw finds it, the exact id, else the one id it begins. With no
::    id, the only open request; unlike OpenClaw, never one of several. With
::    a token, only the exact id, and only if the token is that request's.
::
++  pick
  |=  [=approvals:t id=(unit @t) token=(unit @uv)]
  ^-  (unit [id=@t =approval:t])
  =/  all  ~(tap by by-id.approvals)
  ?~  id
    ?.  ?=([* ~] all)  ~
    `i.all
  =/  exact  (~(get by by-id.approvals) u.id)
  ?^  token
    ?.  &(?=(^ exact) =(u.token (button-token u.id u.exact)))  ~
    `[u.id u.exact]
  ?^  exact  `[u.id u.exact]
  =/  begun
    (skim all |=([key=@t *] =(u.id (end [3 (met 3 u.id)] key))))
  ?.  ?=([* ~] begun)  ~
  `i.begun
::  +confirmation: OpenClaw's reply to the owner once an order is carried out
::
::    .where names the request's channel, or is ~ for a DM. OpenClaw has no
::    revoke; its reply is worded as an allow's.
::
++  confirmation
  |=  [action=?(%allow %reject %ban %revoke) who=@p where=(unit @t)]
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
  ::
      %revoke
    ?~  where
      (rap 3 'Revoked DM access for ' ship '. They will no longer be able to message the bot.' ~)
    %+  rap  3
    :~  'Revoked '  ship  ' for '  u.where
        '. They will no longer be able to interact in this channel.'
    ==
  ==
::  +choices: the reply to an order without an id while several requests
::  are open, oldest first
::
++  choices
  |=  =approvals:t
  ^-  @t
  %+  rap  3
  :-  'More than one approval is pending. Send the command again with an ID:'
  %+  turn  (oldest approvals)
  |=  [id=@t =approval:t]
  %+  rap  3
  :~  '\0a'  id  ' '  (scot %p who.approval)  ' '
      (address:p (place-to:p [who place]:approval))
  ==
::  +oldest: the open requests, oldest first
::
++  oldest
  |=  =approvals:t
  ^-  (list [id=@t =approval:t])
  %+  sort  ~(tap by by-id.approvals)
  |=([a=[@t =approval:t] b=[@t =approval:t]] (lth at.approval.a at.approval.b))
::  +listed: the most requests /pending names, past which it counts the rest
::
++  listed  25
::  +carded: the most requests /pending also shows as a card, as OpenClaw's
::
++  carded  4
::  +pending-text: OpenClaw's reply to /pending, naming .shown, the oldest
::  requests with the channel each is for (~ for a DM), of .total open
::
++  pending-text
  |=  [shown=(list [id=@t =approval:t where=(unit @t)]) total=@ud]
  ^-  @t
  ?:  =(0 total)  'No pending approval requests.'
  =/  more  (sub total (lent shown))
  %+  rap  3
  ;:  weld
    `(list @t)`~['Pending requests (' (crip (a-co:co total)) '):\0a']
  ::
    %+  turn  shown
    |=  [id=@t =approval:t where=(unit @t)]
    ^-  @t
    =/  ship  (scot %p who.approval)
    ?~  where  (rap 3 '\0a  #' id ' - DM from ' ship ~)
    (rap 3 '\0a  #' id ' - Mention in ' u.where ' by ' ship ~)
  ::
    ?:  =(0 more)  ~
    `(list @t)`~['\0a  and ' (crip (a-co:co more)) ' more.']
  ::
    `(list @t)`~['\0a\0aUse /allow, /reject, or /ban with the ID.']
  ==
::  +divider: a card's Divider component
::
++  divider
  |=  id=@t
  ^-  json
  (pairs:enjs:format ~[['id' %s id] ['component' %s 'Divider']])
::  +column: a card's container .component, a Column or a Row, of .children
::
++  column
  |=  [id=@t component=@t children=(list @t)]
  ^-  json
  %-  pairs:enjs:format
  :~  ['id' %s id]
      ['component' %s component]
      ['children' %a (turn children |=(c=@t [%s c]))]
  ==
::  +pending-card: OpenClaw's card for /pending, a row with Allow, Reject
::  and Block buttons for each of .shown
::
::    The buttons send each request's token, as its own card's do. The
::    labels are shared, which keeps four rows within the app's limit on a
::    card's components.
::
++  pending-card
  |=  shown=(list [id=@t =approval:t where=(unit @t)])
  ^-  @t
  =*  words  text:work-card
  =/  count  (lent shown)
  =/  button
    |=  [id=@t label=@t variant=(unit @t) command=@t]
    ^-  json
    (snag 0 (labelled:work-card id label '' command variant))
  =/  rows=(list [prefix=@t id=@t =approval:t where=(unit @t)])
    %+  turn  (gulf 1 count)
    |=  n=@ud
    [(cat 3 'item' (crip (a-co:co (dec n)))) (snag (dec n) shown)]
  =/  children=(list @t)
    :+  'eyebrow'  'title'
    :-  'titleDivider'
    %+  roll  (flop rows)
    |=  [[prefix=@t *] kids=(list @t)]
    ?:  =('item0' prefix)  [prefix kids]
    [(cat 3 prefix 'Divider') prefix kids]
  =/  head-parts=(list json)
    :~  (pairs:enjs:format ~[['id' %s 'root'] ['component' %s 'Card'] ['child' %s 'body']])
        (column 'body' 'Column' children)
        (words 'eyebrow' 'Pending requests' `'caption')
        %^  words  'title'
          (cat 3 (crip (a-co:co count)) ?:(=(1 count) ' approval request' ' approval requests'))
        `'h3'
        (divider 'titleDivider')
        (words 'allowLabel' 'Allow' ~)
        (words 'rejectLabel' 'Reject' ~)
        (words 'blockLabel' 'Block' ~)
    ==
  =/  row-parts=(list json)
    %+  roll  (flop rows)
    |=  [[prefix=@t id=@t =approval:t where=(unit @t)] parts=(list json)]
    ^-  (list json)
    =/  ship  (scot %p who.approval)
    =/  token  (scot %uv (button-token id approval))
    =/  part  |=(name=@t (cat 3 prefix name))
    =/  own=(list json)
      :~  (column prefix 'Column' (turn `(list @t)`~['Title' 'Context' 'Actions'] part))
          %^  words  (part 'Title')
            ?~(where (cat 3 'DM from ' ship) (cat 3 'Channel access for ' ship))
          `'h4'
          %^  words  (part 'Context')
            ?~(where (cat 3 'Sender: ' ship) (cat 3 'Channel: ' u.where))
          `'caption'
          (column (part 'Actions') 'Row' (turn `(list @t)`~['Allow' 'Reject' 'Block'] part))
          (button (part 'Allow') 'allowLabel' `'primary' (rap 3 '/allow ' id ' ' token ~))
          (button (part 'Reject') 'rejectLabel' ~ (rap 3 '/reject ' id ' ' token ~))
          (button (part 'Block') 'blockLabel' `'borderless' (rap 3 '/ban ' id ' ' token ~))
      ==
    =.  parts  (weld own parts)
    ?:  =('item0' prefix)  parts
    [(divider (part 'Divider')) parts]
  (surface:work-card 'pending-approvals' (weld head-parts row-parts) |)
::  +blocked-text: OpenClaw's reply to /banned
::
++  blocked-text
  |=  ships=(set @p)
  ^-  @t
  ?:  =(~ ships)  'No users are currently blocked.'
  %+  rap  3
  ;:  weld
    `(list @t)`~['Blocked users (' (crip (a-co:co ~(wyt in ships))) '):']
    (turn (sort ~(tap in ships) lth) |=(who=@p (cat 3 '\0a  ' (scot %p who))))
    `(list @t)`~['\0a\0aTo unban: `/unban ~sampel-palnet`']
  ==
::  +unban-usage: OpenClaw's reply to /unban without a ship
::
++  unban-usage  'Usage: /unban ~ship-name'
::  +revoke-usage: the reply to /revoke without a ship, or with text after
::  it that names no place, as /unban's
::
++  revoke-usage  'Usage: /revoke ~ship-name'
::  +unrevoked: the reply to /revoke of .who that takes nothing back, as
::  .who has access everywhere from settings, no grant in .where (~ for a
::  DM), or no grant anywhere
::
++  unrevoked
  |=  [who=@p where=(unit @t) why=?(%everywhere %ungranted %nowhere)]
  ^-  @t
  =/  ship  (scot %p who)
  ?-  why
    %everywhere  (cat 3 ship ' has access everywhere from settings; change it there.')
    %nowhere  (cat 3 ship ' has no access to revoke.')
  ::
      %ungranted
    ?~  where  (cat 3 ship ' has no DM access to revoke.')
    (rap 3 ship ' has no access to revoke in ' u.where '.' ~)
  ==
::  +revoke-choices: the reply to /revoke of .who without a place while it
::  holds a grant in each of .places, as a bare answer's among several
::  requests
::
++  revoke-choices
  |=  [who=@p places=(list place:t)]
  ^-  @t
  =/  ship  (scot %p who)
  %+  rap  3
  :-  (cat 3 ship ' has access in more than one place. Send the command again with one:')
  %+  turn  places
  |=(=place:t (rap 3 '\0a/revoke ' ship ' ' (place-text place) ~))
::  +still-answered: the reply to /revoke of .who in channel .where once its
::  grant is gone, when the channel's settings still answer it there
::
++  still-answered
  |=  [who=@p where=@t]
  ^-  @t
  %+  rap  3
  :~  'Removed '  (scot %p who)  '\'s grant for '  where
      ', but they still have access there from settings; change it there.'
  ==
::  +unbanned: OpenClaw's replies to /unban of .who: once %chat has the
::  unblock, when .who was not blocked, and when %chat refuses the unblock
::
++  unbanned
  |=  [who=@p outcome=?(%unblocked %free %failed)]
  ^-  @t
  =/  ship  (scot %p who)
  ?-  outcome
    %unblocked  (rap 3 'Unblocked ' ship '.' ~)
    %free  (cat 3 ship ' is not blocked.')
    %failed  (rap 3 'Failed to unblock ' ship '.' ~)
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
::  +waiting-text: OpenClaw's reply in a channel to the mention that opened
::  a request, after the ship's mention; .sent is whether the owner's card
::  went out
::
++  waiting-text
  |=  [owner=@p sent=?]
  ^-  @t
  =/  lead
    (rap 3 ': I need approval from my owner, ' (scot %p owner) ', before I can respond in this channel' ~)
  ?.  sent  (cat 3 lead '. I couldn\'t reach them just now — please mention me again later.')
  (cat 3 lead ' — I\'ve sent them the request.')
::  +channel-label: a channel as OpenClaw names it in a reply
::
::    .named is the channel's title, or its .name when untitled, and its
::    group's title, as the adapter's +approval-channel reads them. The nest
::    is cut as a title is, for a host names the channel.
::
++  channel-label
  |=  [nest=@t name=@t named=(unit [channel=@t group=(unit @t)])]
  ^-  @t
  =/  shown  (bounded nest)
  ?~  named  shown
  =/  titled  !=((bounded name) channel.u.named)
  ?~  group.u.named
    ?.  titled  shown
    (rap 3 channel.u.named ' (' shown ')' ~)
  ?.  titled  (rap 3 u.group.u.named ' (' shown ')' ~)
  (rap 3 channel.u.named ' in ' u.group.u.named ' (' shown ')' ~)
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
::  +live: the requests open for less than .lifetime at .now
::
++  live
  |=  [=approvals:t now=@da]
  ^-  approvals:t
  (keep approvals |=(=approval:t (gth (add at.approval lifetime) now)))
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
  (fall (clip text 100) text)
::  +bounded: a channel's or a group's title, or a nest, cut to eighty
::  characters, the last three an ellipsis, as OpenClaw bounds a group's
::  title
::
::    A host sets them, and they go into cards and replies whose text
::    Messenger limits.
::
++  bounded
  |=  text=@t
  ^-  @t
  ?~  (clip text 80)  text
  (cat 3 (need (clip text 77)) '...')
::  +clip: .text cut to its first .max characters, or ~ when it has no more
::
::    Counted on the bytes, as the UTF-8 decoder crashes on a tab, another
::    control character or a malformed sequence, which another ship may
::    send: every byte but a continuation byte begins a character, so the
::    cut falls on a character boundary.
::
++  clip
  |=  [text=@t max=@ud]
  ^-  (unit @t)
  =/  len  (met 3 text)
  =|  [at=@ud count=@ud]
  |-  ^-  (unit @t)
  ?:  =(at len)  ~
  ?:  =(2 (rsh [0 6] (cut 3 [at 1] text)))  $(at +(at))
  ?:  =(count max)  `(end [3 at] text)
  $(at +(at), count +(count))
::  +card: the notice text and the card for a request
::
::    .where is the channel's name and group, or ~ for a DM.
::
++  card
  |=  $:  id=@t  =approval:t
          where=(unit [channel=@t group=(unit @t)])
          preview=(unit @t)
      ==
  ^-  [text=@t blob=@t]
  =/  ship  (scot %p who.approval)
  =/  token  (scot %uv (button-token id approval))
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
      (button 'allow' 'Allow' `'primary' (rap 3 '/allow ' id ' ' token ~))
      (button 'reject' 'Reject' ~ (rap 3 '/reject ' id ' ' token ~))
      (button 'ban' 'Block' `'borderless' (rap 3 '/ban ' id ' ' token ~))
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
