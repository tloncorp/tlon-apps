/-  u=ui, gv=groups-ver, c=chat, cv=chat-ver, d=channels, dv=channels-ver,
    a=activity, av=activity-ver, gs=global-search
/+  default-agent, dbug, verb, vita-client
/+  sidx=search-index, utils=channel-utils
::  performance, keep warm
/+  mark-warmer
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %3
        hidden-contact-suggestions=(set ship)
        manual-contact-suggestions=(set ship)
        pins=(list whom:u)
        first-load=?
        search-index=index:sidx
        search-job=(unit search-work)
        search-since=(unit time)
    ==
  +$  search-source
    $%  [%channel =nest:d]
        [%dm =ship]
        [%club id=@uv]
    ==
  +$  search-position
    $%  [%message before=(unit time)]
        [%reply top=time before=(unit time)]
    ==
  +$  search-work
    $:  sources=(list search-source)
        position=search-position
        remaining=(unit @ud)
    ==
  +$  search-batch
    $:  index=index:sidx
        position=search-position
        done=?
    ==
  +$  search-sync-result
    [index=index:sidx sources=(list search-source)]
  --
=|  current-state
=*  state  -
=<
  %^  verb  |  %warn
  %-  agent:dbug
  %-  (agent:vita-client [| ~sogryp-dister-dozzod-dozzod])
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state
      abet:init:cor
    [cards this]
  ::
  ++  on-save   !>(state)
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =^  cards  state
      abet:(load:cor vase)
    [cards this]
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch  on-watch:def
  ++  on-leave  on-leave:def
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      abet:(arvo:cor wire sign)
    [cards this]
  ++  on-fail   on-fail:def
  ++  on-peek   peek:cor
  --
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  scry
  |=  [care=@tas =dude:gall =path]
  ^+  path
  :*  care
      (scot %p our.bowl)
      dude
      (scot %da now.bowl)
      path
  ==
::
++  init
  ^+  cor
  =/  =cage  settings-event+!>([%put-entry %groups %groups %'showActivityMessage' [%b &]])
  =?  cor  first-load  (emit %pass /set-activity %agent [our.bowl %settings] %poke cage)
  =.  first-load  |
  ?:  ?=(^ search-job)  schedule-search
  ?~  built-at.search-index  schedule-search-bootstrap
  schedule-search-sync
::
::  Start a resumable rebuild.  Only source identities are retained from the
::  canonical states; message content is revisited one source at a time by
::  subsequent Gall events.
::
++  rebuild-search
  |=  max=(unit @ud)
  ^+  cor
  =.  search-since  `now.bowl
  =/  channels=v-channels:d
    .^(v-channels:d (scry %gx %channels /v5/v-channels/noun))
  =/  chat-state=[dms=(map ship dm:c) clubs=(map id:club:c club:c)]
    .^([dms=(map ship dm:c) clubs=(map id:club:c club:c)] (scry %gx %chat /full/noun))
  =/  sources=(list search-source)
    %+  weld
      %+  turn  ~(tap in ~(key by channels))
      |=  =nest:d
      ^-  search-source
      [%channel nest]
    %+  weld
      %+  turn  ~(tap in ~(key by dms.chat-state))
      |=  =ship
      ^-  search-source
      [%dm ship]
    %+  turn  ~(tap in ~(key by clubs.chat-state))
    |=  id=@uv
    ^-  search-source
    [%club id]
  =.  search-index  *index:sidx
  =.  search-job  `[sources [%message ~] max]
  wake-search
::
++  schedule-search
  ^+  cor
  ?~  search-job  cor
  (emit [%pass /search-index %arvo %b %wait now.bowl])
::
++  schedule-search-bootstrap
  ^+  cor
  (emit [%pass /search-bootstrap %arvo %b %wait (add now.bowl ~s1)])
::
++  schedule-search-sync
  ^+  cor
  ?:  ?=(^ search-job)  cor
  (emit [%pass /search-sync %arvo %b %wait (add now.bowl ~s5)])
::
++  search-batch-size  256
::
++  finish-search
  ^+  cor
  =.  search-index  search-index(built-at `now.bowl)
  =.  search-job  ~
  schedule-search-sync
::
++  bootstrap-search
  ^+  cor
  =/  channels-running=?  .^(? (scry %gu %channels /$))
  =/  chat-running=?  .^(? (scry %gu %chat /$))
  ?.  &(channels-running chat-running)  schedule-search-bootstrap
  (rebuild-search ~)
::
++  sync-search
  ^+  cor
  =/  busy=?  ?=(^ search-job)
  ?:  busy  cor
  ?~  search-since  schedule-search-bootstrap
  =/  channels-running=?  .^(? (scry %gu %channels /$))
  =/  chat-running=?  .^(? (scry %gu %chat /$))
  ?.  &(channels-running chat-running)  schedule-search-sync
  =/  compact-at=@ud
    (add live-count.search-index (div live-count.search-index 4))
  ?:  (gth count.search-index compact-at)  (rebuild-search ~)
  =/  since=time  u.search-since
  =/  through=time  now.bowl
  =/  channel-changes=(map nest:d (unit posts:d))
    .^((map nest:d (unit posts:d)) (scry %gx %channels /v6/changes/(scot %da since)/noun))
  =/  chat-changes=(map whom:c (unit writs:c))
    .^((map whom:c (unit writs:c)) (scry %gx %chat /v4/changes/(scot %da since)/noun))
  ?:  ?&(=(~ channel-changes) =(~ chat-changes))
    =.  search-since  `through
    schedule-search-sync
  =/  channels=v-channels:d
    .^(v-channels:d (scry %gx %channels /v5/v-channels/noun))
  =/  chat-state=[dms=(map ship dm:c) clubs=(map id:club:c club:c)]
    .^([dms=(map ship dm:c) clubs=(map id:club:c club:c)] (scry %gx %chat /full/noun))
  =/  result=search-sync-result
    (apply-channel-changes search-index channel-changes channels)
  =/  chat-result=search-sync-result
    (apply-chat-changes index.result chat-changes chat-state)
  =.  search-index  index.chat-result
  =.  search-since  `through
  =/  sources=(list search-source)
    (weld sources.result sources.chat-result)
  ?~  sources  schedule-search-sync
  =.  search-job  `[sources [%message ~] ~]
  wake-search
::
++  apply-channel-changes
  |=  $:  idx=index:sidx
          changes=(map nest:d (unit posts:d))
          channels=v-channels:d
      ==
  ^-  search-sync-result
  =/  result=search-sync-result  [idx ~]
  %+  roll  ~(tap by changes)
  |=  [[nest=nest:d changed=(unit posts:d)] out=_result]
  ?~  changed
    ?:  (~(has by channels) nest)
      [index.out [[%channel nest] sources.out]]
    [(remove-source:sidx index.out [%channel nest]) sources.out]
  =/  idx=index:sidx  index.out
  =.  idx
    %+  roll  (tap:on-posts:d u.changed)
    |=  [[top=time post=(may:d post:d)] idx=_idx]
    =.  idx  (remove-thread:sidx idx [[%channel nest] top])
    ?:  ?=(%| -.post)  idx
    (index-channel-post idx nest top +.post)
  [idx sources.out]
::
++  apply-chat-changes
  |=  $:  idx=index:sidx
          changes=(map whom:c (unit writs:c))
          chat-state=[dms=(map ship dm:c) clubs=(map id:club:c club:c)]
      ==
  ^-  search-sync-result
  =/  result=search-sync-result  [idx ~]
  %+  roll  ~(tap by changes)
  |=  [[whom=whom:c changed=(unit writs:c)] out=_result]
  =/  source=source:gs
    ?-  -.whom
      %ship  [%dm p.whom]
      %club  [%club p.whom]
    ==
  ?~  changed
    =/  exists=?
      ?-  -.whom
        %ship  (~(has by dms.chat-state) p.whom)
        %club  (~(has by clubs.chat-state) p.whom)
      ==
    ?:(exists [index.out [source sources.out]] [(remove-source:sidx index.out source) sources.out])
  =/  idx=index:sidx  index.out
  =.  idx
    %+  roll  (tap:on:writs:c u.changed)
    |=  [[top=time writ=(may:c writ:c)] idx=_idx]
    =.  idx  (remove-thread:sidx idx [source top])
    ?:  ?=(%| -.writ)  idx
    (index-chat-writ idx source top +.writ)
  [idx sources.out]
::
++  index-channel-post
  |=  [idx=index:sidx nest=nest:d top=time post=post:d]
  ^-  index:sidx
  =.  idx
    ?:  ?=([%chat %notice ~] kind.post)  idx
    =/  texts=(list @t)  (story-texts content.post)
    =?  texts  ?=(^ meta.post)
      [title.u.meta.post description.u.meta.post texts]
    (put-document:sidx idx [[%channel nest] top ~] top (get-author-ship:utils author.post) texts)
  %+  roll  (tap:on-replies:d replies.post)
  |=  [[sent=time reply=(may:d reply:d)] idx=_idx]
  ?:  ?=(%| -.reply)  idx
  (put-document:sidx idx [[%channel nest] top `sent] sent (get-author-ship:utils author.+.reply) (story-texts content.+.reply))
::
++  index-chat-writ
  |=  [idx=index:sidx source=source:gs top=time writ=writ:c]
  ^-  index:sidx
  =.  idx
    ?:  ?=([%chat %notice ~] kind.writ)  idx
    (put-document:sidx idx [source top ~] top (get-author-ship:utils author.writ) (story-texts content.writ))
  %+  roll  (tap:on:replies:c replies.writ)
  |=  [[sent=time reply=(may:c reply:c)] idx=_idx]
  ?:  ?=(%| -.reply)  idx
  (put-document:sidx idx [source top `sent] sent (get-author-ship:utils author.+.reply) (story-texts content.+.reply))
::
++  wake-search
  ^+  cor
  ?~  search-job  cor
  =/  work=search-work  u.search-job
  ?~  sources.work  finish-search
  ?:  ?&  ?=(^ remaining.work)
          =(0 u.remaining.work)
      ==
    finish-search
  =/  quota=@ud
    ?~(remaining.work search-batch-size (min search-batch-size u.remaining.work))
  =/  source=search-source  i.sources.work
  =/  before=@ud  count.search-index
  =/  batch=search-batch
    ?-  -.source
      %channel
        =/  channels=v-channels:d
          .^(v-channels:d (scry %gx %channels /v5/v-channels/noun))
        =/  channel=(unit v-channel:d)  (~(get by channels) nest.source)
        ?~  channel  [search-index position.work &]
        (index-channel-batch search-index nest.source u.channel position.work quota)
      %dm
        =/  chat-state=[dms=(map ship dm:c) clubs=(map id:club:c club:c)]
          .^([dms=(map ship dm:c) clubs=(map id:club:c club:c)] (scry %gx %chat /full/noun))
        =/  dm=(unit dm:c)  (~(get by dms.chat-state) ship.source)
        ?~  dm  [search-index position.work &]
        (index-chat-batch search-index [%dm ship.source] pact.u.dm position.work quota)
      %club
        =/  chat-state=[dms=(map ship dm:c) clubs=(map id:club:c club:c)]
          .^([dms=(map ship dm:c) clubs=(map id:club:c club:c)] (scry %gx %chat /full/noun))
        =/  club=(unit club:c)  (~(get by clubs.chat-state) id.source)
        ?~  club  [search-index position.work &]
        (index-chat-batch search-index [%club id.source] pact.u.club position.work quota)
    ==
  =.  search-index  index.batch
  =/  added=@ud  (sub count.search-index before)
  =/  remaining=(unit @ud)  remaining.work
  ?:  ?&  ?=(^ remaining)
          (lte u.remaining added)
      ==
    finish-search
  =?  remaining  ?=(^ remaining)
    `(sub u.remaining added)
  =/  sources=(list search-source)
    ?:(done.batch t.sources.work sources.work)
  =/  position=search-position
    ?:(done.batch [%message ~] position.batch)
  =.  search-job  `[sources position remaining]
  schedule-search
::
++  index-channel-batch
  |=  $:  idx=index:sidx
          nest=nest:d
          channel=v-channel:d
          position=search-position
          quota=@ud
      ==
  ^-  search-batch
  =/  left=@ud  quota
  |-  ^-  search-batch
  ?:  =(0 left)  [idx position |]
  ?-  -.position
      %message
    =/  candidates=v-posts:d
      ?~  before.position  posts.channel
      (lot:on-v-posts:d posts.channel ~ before.position)
    =/  item=(unit [time (may:d v-post:d)])  (ram:on-v-posts:d candidates)
    ?~  item  [idx position &]
    =/  top=time  -.u.item
    =/  next=search-position  [%message `top]
    ?:  ?=(%| -.+.u.item)
      $(position next, left (dec left))
    =*  post  +.+.u.item
    =.  idx
      ?:  ?=([%chat %notice ~] kind.post)  idx
      =/  texts=(list @t)  (story-texts content.post)
      =?  texts  ?=(^ meta.post)
        [title.u.meta.post description.u.meta.post texts]
      =/  ref=ref:gs  [[%channel nest] top ~]
      (put-document:sidx idx ref top (get-author-ship:utils author.post) texts)
    =/  next=search-position
      ?:(=(~ replies.post) next [%reply top ~])
    $(position next, left (dec left))
  ::
      %reply
    =/  parent=(unit (may:d v-post:d))
      (get:on-v-posts:d posts.channel top.position)
    ?~  parent  $(position [%message `top.position])
    ?:  ?=(%| -.u.parent)  $(position [%message `top.position])
    =/  replies=v-replies:d  replies.+.u.parent
    =/  candidates=v-replies:d
      ?~  before.position  replies
      (lot:on-v-replies:d replies ~ before.position)
    =/  item=(unit [time (may:d v-reply:d)])
      (ram:on-v-replies:d candidates)
    ?~  item  $(position [%message `top.position])
    =/  sent=time  -.u.item
    =/  next=search-position  [%reply top.position `sent]
    ?:  ?=(%| -.+.u.item)
      $(position next, left (dec left))
    =*  reply  +.+.u.item
    =/  ref=ref:gs  [[%channel nest] top.position `sent]
    =.  idx
      (put-document:sidx idx ref sent (get-author-ship:utils author.reply) (story-texts content.reply))
    $(position next, left (dec left))
  ==
::
++  index-chat-batch
  |=  $:  idx=index:sidx
          source=source:gs
          pact=pact:c
          position=search-position
          quota=@ud
      ==
  ^-  search-batch
  =/  left=@ud  quota
  |-  ^-  search-batch
  ?:  =(0 left)  [idx position |]
  ?-  -.position
      %message
    =/  candidates=writs:c
      ?~  before.position  wit.pact
      (lot:on:writs:c wit.pact ~ before.position)
    =/  item=(unit [time (may:c writ:c)])  (ram:on:writs:c candidates)
    ?~  item  [idx position &]
    =/  top=time  -.u.item
    =/  next=search-position  [%message `top]
    ?:  ?=(%| -.+.u.item)
      $(position next, left (dec left))
    =*  writ  +.+.u.item
    =.  idx
      ?:  ?=([%chat %notice ~] kind.writ)  idx
      =/  ref=ref:gs  [source top ~]
      (put-document:sidx idx ref top (get-author-ship:utils author.writ) (story-texts content.writ))
    =/  next=search-position
      ?:(=(~ replies.writ) next [%reply top ~])
    $(position next, left (dec left))
  ::
      %reply
    =/  parent=(unit (may:c writ:c))
      (get:on:writs:c wit.pact top.position)
    ?~  parent  $(position [%message `top.position])
    ?:  ?=(%| -.u.parent)  $(position [%message `top.position])
    =/  replies=replies:c  replies.+.u.parent
    =/  candidates=replies:c
      ?~  before.position  replies
      (lot:on:replies:c replies ~ before.position)
    =/  item=(unit [time (may:c reply:c)])  (ram:on:replies:c candidates)
    ?~  item  $(position [%message `top.position])
    =/  sent=time  -.u.item
    =/  next=search-position  [%reply top.position `sent]
    ?:  ?=(%| -.+.u.item)
      $(position next, left (dec left))
    =*  reply  +.+.u.item
    =/  ref=ref:gs  [source top.position `sent]
    =.  idx
      (put-document:sidx idx ref sent (get-author-ship:utils author.reply) (story-texts content.reply))
    $(position next, left (dec left))
  ==
::
++  story-texts
  |=  story=story:d
  ^-  (list @t)
  %-  zing
  %+  turn  story
  |=  verse=verse:d
  ?.  ?=(%inline -.verse)  ~
  (inline-texts p.verse)
::
++  inline-texts
  |=  inlines=(list inline:d)
  ^-  (list @t)
  %-  zing
  %+  turn  inlines
  |=  inline=inline:d
  ?@  inline  [inline ~]
  ?+  -.inline  ~
    ?(%bold %italics %strike %blockquote)  (inline-texts p.inline)
    ?(%code %inline-code)                  [p.inline ~]
    %ship                                  [(scot %p p.inline) ~]
    %sect                                  [?~(p.inline '@all' (cat 3 '@' p.inline)) ~]
    %link
      ?:  =(p.inline q.inline)  [p.inline ~]
      [p.inline q.inline ~]
  ==
::
++  hydrate-search-page
  |=  page=page:gs
  ^-  page:gs
  ?~  hits.page  page
  =/  channels=v-channels:d
    .^(v-channels:d (scry %gx %channels /v5/v-channels/noun))
  =/  chat-state=[dms=(map ship dm:c) clubs=(map id:club:c club:c)]
    .^([dms=(map ship dm:c) clubs=(map id:club:c club:c)] (scry %gx %chat /full/noun))
  page(hits (turn hits.page |=(hit=hit:gs (hydrate-search-hit hit channels chat-state))))
::
++  hydrate-search-hit
  |=  $:  hit=hit:gs
          channels=v-channels:d
          chat-state=[dms=(map ship dm:c) clubs=(map id:club:c club:c)]
      ==
  ^-  hit:gs
  =/  ref=ref:gs  ref.hit
  ?-  -.source.ref
    %channel
      =/  channel=(unit v-channel:d)
        (~(get by channels) nest.source.ref)
      ?~  channel  hit
      =/  parent=(unit (may:d v-post:d))
        (get:on-v-posts:d posts.u.channel top.ref)
      ?~  parent  hit
      ?:  ?=(%| -.u.parent)  hit
      =*  post  +.u.parent
      ?~  reply.ref
        =/  texts=(list @t)  (story-texts content.post)
        =?  texts  ?=(^ meta.post)
          [title.u.meta.post description.u.meta.post texts]
        hit(snippet (make-snippet:sidx texts))
      =/  reply=(unit (may:d v-reply:d))
        (get:on-v-replies:d replies.post u.reply.ref)
      ?~  reply  hit
      ?:  ?=(%| -.u.reply)  hit
      hit(snippet (make-snippet:sidx (story-texts content.+.u.reply)))
    %dm
      =/  dm=(unit dm:c)  (~(get by dms.chat-state) ship.source.ref)
      ?~  dm  hit
      (hydrate-chat-hit hit pact.u.dm)
    %club
      =/  club=(unit club:c)  (~(get by clubs.chat-state) id.source.ref)
      ?~  club  hit
      (hydrate-chat-hit hit pact.u.club)
  ==
::
++  hydrate-chat-hit
  |=  [hit=hit:gs pact=pact:c]
  ^-  hit:gs
  =/  ref=ref:gs  ref.hit
  =/  parent=(unit (may:c writ:c))
    (get:on:writs:c wit.pact top.ref)
  ?~  parent  hit
  ?:  ?=(%| -.u.parent)  hit
  =*  writ  +.u.parent
  ?~  reply.ref
    hit(snippet (make-snippet:sidx (story-texts content.writ)))
  =/  reply=(unit (may:c reply:c))
    (get:on:replies:c replies.writ u.reply.ref)
  ?~  reply  hit
  ?:  ?=(%| -.u.reply)  hit
  hit(snippet (make-snippet:sidx (story-texts content.+.u.reply)))
::
++  load
  |=  =vase
  =.  state  !<(current-state vase)
  init
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+    pole  [~ ~]
      [%x %pins ~]  ``ui-pins+!>(pins)
  ::
      [%x %hidden-contact-suggestions ~]
    ``ships+!>(hidden-contact-suggestions)
  ::
      [%x %suggested-contacts ~]
    ``ships+!>(get-suggested-contacts)
  ::
      [%x %global-search limit=@ cursor=@ query=@ ~]
    =/  after=(unit cursor:gs)
      ?:  =(%all cursor.pole)  ~
      `;;(cursor:gs (cue (slav %uw cursor.pole)))
    =/  query=@t  (fall (slaw %t query.pole) query.pole)
    =/  page=page:gs
      (search:sidx search-index query after (slav %ud limit.pole))
    ``global-search-page+!>((hydrate-search-page page))
  ::
      [%x %v1 %heads since=?(~ [u=@ ~])]
    =+  .^(chan=channel-heads:v7:dv (scry %gx %channels %v2 %heads (snoc since.pole %channel-heads)))
    =+  .^(chat=chat-heads:v3:cv (scry %gx %chat %heads (snoc since.pole %chat-heads)))
    ``ui-heads+!>(`mixed-heads:u`[chan chat])
  ::
      [%x %v2 %heads since=?(~ [u=@ ~])]
    =+  .^(chan=channel-heads:v8:dv (scry %gx %channels %v3 %heads (snoc since.pole %channel-heads-2)))
    =+  .^(chat=chat-heads:v5:cv (scry %gx %chat %v2 %heads (snoc since.pole %chat-heads-2)))
    ``ui-heads-2+!>(`mixed-heads-2:u`[chan chat])
  ::
      [%x %v3 %heads since=?(~ [u=@ ~])]
    =+  .^(chan=channel-heads:v9:dv (scry %gx %channels %v4 %heads (snoc since.pole %channel-heads-3)))
    =+  .^(chat=chat-heads:v6:cv (scry %gx %chat %v3 %heads (snoc since.pole %chat-heads-3)))
    ``ui-heads-3+!>(`mixed-heads-3:u`[chan chat])
  ::
      [%x %v4 %heads since=?(~ [u=@ ~])]
    =+  .^(chan=channel-heads:v10:dv (scry %gx %channels %v5 %heads (snoc since.pole %channel-heads-4)))
    =+  .^(chat=chat-heads:v7:cv (scry %gx %chat %v4 %heads (snoc since.pole %chat-heads-4)))
    ``ui-heads-4+!>(`mixed-heads-4:u`[chan chat])
  ::
      [%x %v4 %init ~]
    =+  .^([=groups-ui:v2:gv =gangs:v2:gv] (scry %gx %groups /init/v1/noun))
    =+  .^(=channel-0:u (scry %gx %channels /v3/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:v8:av (scry %gx %activity /v4/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-4:u
      :*  groups-ui
          gangs
          channel-0
          activity
          pins
          chat
          profile
      ==
    ``ui-init-4+!>(init)
  ::
      [%x %v5 %init ~]
    =+  .^([=groups-ui:v7:gv =foreigns:v8:gv] (scry %gx %groups /v2/init/noun))
    =+  .^(=channel-8:u (scry %gx %channels /v4/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:v8:av (scry %gx %activity /v4/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-5:u
      :*  groups-ui
          foreigns
          channel-8
          activity
          pins
          chat
          profile
      ==
    ``ui-init-5+!>(init)
  ::
      [%x %v6 %init ~]
    =+  .^([=groups-ui:v9:gv =foreigns:v8:gv] (scry %gx %groups /v3/init/noun))
    =+  .^(=channel-8:u (scry %gx %channels /v4/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:v8:av (scry %gx %activity /v4/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-6:u
      :*  groups-ui
          foreigns
          channel-8
          activity
          pins
          chat
          profile
      ==
    ``ui-init-6+!>(init)
  ::
      [%x %v7 %init ~]
    =+  .^([=groups-ui:v9:gv =foreigns:v8:gv] (scry %gx %groups /v3/init/noun))
    =+  .^(channel=channel-10:u (scry %gx %channels /v6/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:v8:av (scry %gx %activity /v4/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-7:u
      :*  groups-ui
          foreigns
          channel
          activity
          pins
          chat
          profile
      ==
    ``ui-init-7+!>(init)
  ::
      [%x %v8 %init ~]
    =+  .^([=groups-ui:v9:gv =foreigns:v8:gv] (scry %gx %groups /v3/init/noun))
    =+  .^(channel=channel-10:u (scry %gx %channels /v6/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:v9:av (scry %gx %activity /v5/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-8:u
      :*  groups-ui
          foreigns
          channel
          activity
          pins
          chat
          profile
      ==
    ``ui-init-8+!>(init)
  ::
  ::  /v9: v10-native activity (carries notebook/note sources)
  ::
      [%x %v9 %init ~]
    =+  .^([=groups-ui:v9:gv =foreigns:v8:gv] (scry %gx %groups /v3/init/noun))
    =+  .^(channel=channel-10:u (scry %gx %channels /v6/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:v10:av (scry %gx %activity /v6/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-9:u
      :*  groups-ui
          foreigns
          channel
          activity
          pins
          chat
          profile
      ==
    ``ui-init-9+!>(init)
  ::
      [%x %v5 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v4/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v5/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v3/changes/[since.pole]/json))
    =+  .^(groups=json (scry %gx %groups /v1/changes/[since.pole]/json))
    =+  .^(contacts=json (scry %gx %contacts /v1/changes/[since.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'activity'^activity
        'channels'^channels
        'chat'^chat
        'groups'^groups
        'contacts'^contacts
    ==
  ::
      [%x %v6 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v4/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v5/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v3/changes/[since.pole]/json))
    =+  .^(groups=json (scry %gx %groups /v1/changes/[since.pole]/json))
    =+  .^(contacts=json (scry %gx %contacts /v2/changes/[since.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'activity'^activity
        'channels'^channels
        'chat'^chat
        'groups'^groups
        'contacts'^contacts
    ==
  ::
      [%x %v7 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v4/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v5/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v3/changes/[since.pole]/json))
    =+  .^(groups=json (scry %gx %groups /v2/changes/[since.pole]/json))
    =+  .^(contacts=json (scry %gx %contacts /v2/changes/[since.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'activity'^activity
        'channels'^channels
        'chat'^chat
        'groups'^groups
        'contacts'^contacts
    ==
  ::
      [%x %v8 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v4/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v6/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v4/changes/[since.pole]/json))
    =+  .^(groups=json (scry %gx %groups /v2/changes/[since.pole]/json))
    =+  .^(contacts=json (scry %gx %contacts /v2/changes/[since.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'activity'^activity
        'channels'^channels
        'chat'^chat
        'groups'^groups
        'contacts'^contacts
    ==
  ::
      [%x %v9 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v5/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v6/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v4/changes/[since.pole]/json))
    =+  .^(groups=json (scry %gx %groups /v2/changes/[since.pole]/json))
    =+  .^(contacts=json (scry %gx %contacts /v2/changes/[since.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'activity'^activity
        'channels'^channels
        'chat'^chat
        'groups'^groups
        'contacts'^contacts
    ==
  ::
  ::  /v10: v10-native activity (carries notebook/note sources)
  ::
      [%x %v10 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v6/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v6/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v4/changes/[since.pole]/json))
    =+  .^(groups=json (scry %gx %groups /v2/changes/[since.pole]/json))
    =+  .^(contacts=json (scry %gx %contacts /v2/changes/[since.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'activity'^activity
        'channels'^channels
        'chat'^chat
        'groups'^groups
        'contacts'^contacts
    ==
  ::
      [%x %v5 %init-posts channels=@ context=@ ~]
    =+  .^(channels=json (scry %gx %channels /v5/init-posts/[channels.pole]/[context.pole]/json))
    ::TODO bump chat
    =+  .^(chat=json (scry %gx %chat /v3/init-posts/[channels.pole]/[context.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'channels'^channels
        'chat'^chat
    ==
  ::
      [%x %v6 %init-posts channels=@ context=@ ~]
    =+  .^(channels=json (scry %gx %channels /v6/init-posts/[channels.pole]/[context.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v4/init-posts/[channels.pole]/[context.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'channels'^channels
        'chat'^chat
    ==
  ==
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-mark/mark !!)
    %ui-vita  (emit (active:vita-client bowl))
    %ui-import-pals  import-pals
  ::
      %noun
    =/  action=[%reindex max=(unit @ud)]
      !<([%reindex max=(unit @ud)] vase)
    (rebuild-search max.action)
  ::
      %ui-show-contact
    =+  !<(=ship vase)
    =.  hidden-contact-suggestions
      (~(del in hidden-contact-suggestions) ship)
    cor
  ::
      %ui-hide-contact
    =+  !<(=ship vase)
    =.  hidden-contact-suggestions
      (~(put in hidden-contact-suggestions) ship)
    cor
  ::
      %ui-add-contact-suggestions
    =+  ship-list=!<((list @p) vase)
    =.  manual-contact-suggestions
      (~(gas in manual-contact-suggestions) ship-list)
    cor
  ::
      %ui-vita-toggle
    =+  !<(=vita-enabled:u vase)
    (emit %pass /vita-toggle %agent [our.bowl dap.bowl] %poke vita-client+!>([%set-enabled vita-enabled]))
  ::
      %ui-action
    =+  !<(=action:u vase)
    ?>  ?=(%pins -.action)
    =.  pins
      ?-  -.a-pins.action
        %del  (skip pins (cury test whom.a-pins.action))
      ::
          %add
        ::  be careful not to insert duplicates
        ::
        |-
        ?~  pins  [whom.a-pins.action]~
        ?:  =(i.pins whom.a-pins.action)  pins
        [i.pins $(pins t.pins)]
      ::
          %set-order
        ::  reorder, in place, only the pins the payload names: build the
        ::  requested sequence (payload that is already pinned, deduped), then
        ::  walk the current order substituting the next requested item at each
        ::  named slot and leaving omitted pins where they are
        ::
        =/  cur=(set whom:u)  (sy pins)
        =/  want=(list whom:u)
          =/  ord=(list whom:u)  order.a-pins.action
          =|  seen=(set whom:u)
          |-  ^-  (list whom:u)
          ?~  ord  ~
          ?:  ?|((~(has in seen) i.ord) !(~(has in cur) i.ord))
            $(ord t.ord)
          [i.ord $(seen (~(put in seen) i.ord), ord t.ord)]
        =/  want-set=(set whom:u)  (sy want)
        |-  ^-  (list whom:u)
        ?~  pins  ~
        ?.  (~(has in want-set) i.pins)
          [i.pins $(pins t.pins)]
        ?~  want  $(pins t.pins)
        [i.want $(pins t.pins, want t.want)]
      ==
    ::TODO  eventually, give %fact if that changed anything
    cor
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-take/pole !!)
    ~  cor
    [%contact ~]  cor
    [%vita-toggle ~]  cor
    [%set-activity ~]  cor
  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ?+  wire  !!
    [%build ~]  cor
    [%search-index ~]
      ?>  ?=(%wake +<.sign)
      wake-search
    [%search-bootstrap ~]
      ?>  ?=(%wake +<.sign)
      bootstrap-search
    [%search-sync ~]
      ?>  ?=(%wake +<.sign)
      sync-search
  ==
++  get-suggested-contacts
  =+  .^(chat-running=? (scry %gu %chat /$))
  =/  suggestions=(set ship)  manual-contact-suggestions
  =?  suggestions  chat-running
    =+  .^  [dms=(map ship dm:c) *]
      (scry %gx %chat /full/noun)
    ==
    %-  ~(uni in suggestions)
    %-  sy
    %+  murn
      ~(tap by dms)
    |=  [=ship =dm:c]
    ?~  latest=(ram:on:writs:c wit.pact.dm)  ~
    =/  count  (wyt:on:writs:c wit.pact.dm)
    =/  cutoff  (sub now.bowl ~d30)
    ?.  &((gth count 10) (gth -.u.latest cutoff))  ~
    `ship
  =+  .^(pals-running=? (scry %gu %pals /$))
  =?  suggestions  pals-running
    =+  .^(targets=(set ship) (scry %gx %pals /targets/noun))
    (~(uni in suggestions) targets)
  (~(dif in suggestions) hidden-contact-suggestions)
++  import-pals
  =+  .^(pals-running=? (scry %gu %pals /$))
  ?.  pals-running  cor
  =+  .^(targets=(set ship) (scry %gx %pals /targets/noun))
  %-  emil
  %+  turn
    ~(tap in targets)
  |=  =ship
  [%pass /contact %agent [our.bowl %contacts] %poke contact-action-1+!>([%page ship ~])]
--
