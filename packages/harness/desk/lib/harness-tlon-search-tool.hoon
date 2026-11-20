::  Search across every chat this ship is in: DMs, group DMs and joined
::  chat and gallery channels. Each chat gets one native bounded search of
::  its newest messages, replies included, as the production CLI runs it.
/-  cv=chat-ver, dv=channels-ver
/+  hp=harness-tlon-history-page, club=harness-tlon-club-tool
|_  bowl=bowl:gall
+$  target
  $%  [%ship who=@p]
      [%club id=@uvH]
      [%channel nest=[kind=?(%chat %heap) ship=@p name=@tas]]
  ==
+$  hit  [=target parent=(unit @t) =message:hp]
::  +tries: messages each chat's search scans; +chat-limit: chats searched;
::  +per-chat: newest hits kept per chat; +hit-limit: newest hits returned
++  tries  500
++  chat-limit  40
++  per-chat  5
++  hit-limit  20
::
++  run
  |=  args=json
  ^-  json
  ::  +query:hp validates; native search ignores case, so send it as typed.
  ?>  !=('' (query:hp args))
  =/  needle  (argument:hp args 'query')
  =/  all  targets
  =/  searched  (scag chat-limit all)
  =/  hits=(list hit)
    %-  zing
    %+  turn  searched
    |=  =target
    (scag per-chat (sort (search target needle) newer))
  %-  pairs:enjs:format
  :~  ['results' %a (turn (scag hit-limit (sort hits newer)) result)]
      ['chats_searched' (numb:enjs:format (lent searched))]
      ['chats_skipped' (numb:enjs:format (sub (lent all) (lent searched)))]
      ['messages_scanned_per_chat' (numb:enjs:format tries)]
      :*  'note'  %s
          'Newest matches first. Each chat is searched to a fixed depth; use search_history with ship, club or channel to page further back in one chat.'
      ==
  ==
::
++  newer
  |=  [a=hit b=hit]
  (gth sent.message.a sent.message.b)
::
++  targets
  ^-  (list target)
  =/  base  /(scot %p our.bowl)
  =/  chat-up  .^(? %gu (weld base /chat/(scot %da now.bowl)/$))
  =/  dms=(list target)
    ?.  chat-up  ~
    %+  turn  ~(tap in .^((set @p) %gx (weld base /chat/(scot %da now.bowl)/dm/ships)))
    |=(who=@p [%ship who])
  =/  clubs=(list target)
    ?.  chat-up  ~
    %+  murn  ~(tap by clubs:~(. club bowl))
    |=  [id=@uvH crew=crew:club:v7:cv]
    ?.((~(has in team.crew) our.bowl) ~ `[%club id])
  =/  channels=(list target)
    =/  agent  (weld base /channels/(scot %da now.bowl))
    ?.  .^(? %gu (weld agent /$))  ~
    %+  murn  ~(tap in ~(key by .^(channels:v10:dv %gx (weld agent /v5/channels/noun))))
    |=  nest=[kind=?(%chat %diary %heap) ship=@p name=@tas]
    ?.  ?=(?(%chat %heap) kind.nest)  ~
    `[%channel nest]
  :(weld dms clubs channels)
::
++  search
  |=  [=target needle=@t]
  ^-  (list hit)
  =/  query  (scot %t needle)
  =/  tail=path  /search/bounded/text/[%$]/(scot %ud tries)/[query]/noun
  =/  chat  /(scot %p our.bowl)/chat/(scot %da now.bowl)/v4
  ?-  -.target
      %ship
    =/  =scam:v7:cv  .^(scam:v7:cv %gx :(weld chat /dm/(scot %p who.target) tail))
    (chat-hits target scan.scam)
  ::
      %club
    =/  =scam:v7:cv  .^(scam:v7:cv %gx :(weld chat /club/(scot %uv id.target) tail))
    (chat-hits target scan.scam)
  ::
      %channel
    =*  nest  nest.target
    =/  =scam:v10:dv
      .^  scam:v10:dv  %gx
        %+  weld
          /(scot %p our.bowl)/channels/(scot %da now.bowl)/v5/[kind.nest]/(scot %p ship.nest)
        [name.nest tail]
      ==
    %+  murn  scan.scam
    |=  =reference:v10:dv
    ^-  (unit hit)
    ?-  -.reference
        %post
      ?:  ?=(%| -.post.reference)  ~
      =*  post  +.post.reference
      =/  id  (scot %da id:-.post)
      `[target ~ (make-message:hp id author:+.post sent:+.post content:+.post)]
    ::
        %reply
      ?:  ?=(%| -.reply.reference)  ~
      =*  reply  +.reply.reference
      =/  id  (scot %da id:-.reply)
      :-  ~
      :+  target  `(scot %da id-post.reference)
      (make-message:hp id author:+.reply sent:+.reply content:+.reply)
    ==
  ==
::
++  chat-hits
  |=  [=target =scan:v7:cv]
  ^-  (list hit)
  %+  murn  scan
  |=  =reference:v7:cv
  ^-  (unit hit)
  ?-  -.reference
      %writ
    ?:  ?=(%| -.writ.reference)  ~
    `[target ~ (dm-post:hp +.writ.reference)]
  ::
      %reply
    ?:  ?=(%| -.reply.reference)  ~
    =*  parent  id.reference
    :-  ~
    :+  target  `(rap 3 (scot %p p.parent) '/' (scot %da q.parent) ~)
    (dm-reply:hp +.reply.reference)
  ==
::
++  result
  |=  =hit
  ^-  json
  =/  where=(list [@t json])
    ?-  -.target.hit
      %ship  ~[['ship' %s (scot %p who.target.hit)]]
      %club  ~[['club' %s (scot %uv id.target.hit)]]
        %channel
      =*  nest  nest.target.hit
      ~[['channel' %s (rap 3 kind.nest '/' (scot %p ship.nest) '/' name.nest ~)]]
    ==
  =/  row  (message-json:hp message.hit)
  ?>  ?=(%o -.row)
  %-  pairs:enjs:format
  ;:  weld
      where
      ?~(parent.hit ~ ~[['parent' %s u.parent.hit]])
      ~(tap by p.row)
  ==
--
