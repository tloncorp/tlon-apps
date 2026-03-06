/-  a=activity, c=channels, ch=chat, s=story, t=talon
/+  default-agent, verb, dbug, agentio, channel-utils
|%
+$  card  card:agent:gall
--
::
=|  state=state:t
%-  agent:dbug
|_  =bowl:gall
+*  this  .
    io    ~(. agentio bowl)
    def   ~(. (default-agent this %|) bowl)
    cor   ~(. +> [bowl ~])
++  on-init
  ^-  (quip card _this)
  =^  cards  this  ensure-config
  =/  watch-card=card
    [%pass /activity %agent [our.bowl %activity] %watch /v4]
  :_  this
  (weld cards ~[watch-card])
++  on-save  !>(state)
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  =/  old-state=state:t  !<(state:t old)
  `this(state old-state)
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:def mark vase)
      %noun
    =+  !<([m=@ n=*] vase)
    $(mark m, vase (need (slew 3 vase)))
  ::
      %talon-command
    =+  !<(cmd=command:t vase)
    `this(state (apply-command cmd state))
  ==
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?+  -.sign  (on-agent:def wire sign)
      %fact
    =/  cage=cage  +.sign
    ?:  ?=(%activity-event p.cage)
      =+  !<(te=time-event:a q.cage)
      =/  ev=event:a  event.te
      =/  inc=incoming-event:a  -.ev
      =^  cards  this  (handle-event inc)
      [cards this]
    ?.  ?=(%activity-update-4 p.cage)
      `this
    =+  !<(up=update:a q.cage)
    ?-  -.up
      %add
        =/  [src=source:a tev=time-event:a]  +.up
        =/  ev=event:a  event.tev
        =/  inc=incoming-event:a  -.ev
        =^  cards  this  (handle-event inc)
        [cards this]
      *  `this
    ==
  ==
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _this)
  ?+  wire  (on-arvo:def wire sign)
      [%llm @ ~]
    ?>  ?=(%iris -.sign)
    ?>  ?=(%http-response +<.sign)
    =/  id=@ud  (need (slaw %ud i.t.wire))
    =/  infl=(unit inflight:t)  (~(get by inflight.state) id)
    ?~  infl  `this
    =/  res=client-response:iris  client-response.sign
    ?:  ?=(%cancel -.res)
      =.  state  state(inflight (~(del by inflight.state) id))
      `this
    ?>  ?=(%finished -.res)
    =/  body=@t
      ?~  full-file.res  ''
      q.data.u.full-file.res
    =^  cards  this
      (handle-llm-response id u.infl body)
    [cards this]
  ::
      [%tool-http @ ~]
    ?>  ?=(%iris -.sign)
    ?>  ?=(%http-response +<.sign)
    =/  key=@t  i.t.wire
    =/  pending=(unit pending-http:t)  (~(get by pending-http.state) key)
    ?~  pending  `this
    =/  res=client-response:iris  client-response.sign
    ?:  ?=(%cancel -.res)
      =.  state  state(pending-http (~(del by pending-http.state) key))
      `this
    ?>  ?=(%finished -.res)
    =/  body=@t
      ?~  full-file.res  ''
      q.data.u.full-file.res
    =^  cards  this
      (handle-http-result key u.pending body)
    [cards this]
  ==
++  on-watch  on-watch:def
++  on-leave  on-leave:def
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %-  (slog 'talon on-fail' term tang)
  [~ this]
++  on-peek  on-peek:def
::
++  ensure-config
  ^-  (quip card _this)
  ?:  =(model.config.state '')
    `this(state (state-with-defaults state))
  [~ this]
::
++  state-with-defaults
  |=  st=state:t
  ^-  state:t
  =/  cfg=config:t
    [ %openai
      'gpt-4.1-mini'
      ''
      ~
      50
      1
      20
      ~
      ~
      ~
      ~
      ~
      ~['SOUL.md' 'USER.md' 'MEMORY.md' 'TOOLS.md' 'IDENTITY.md' 'AGENTS.md' 'HEARTBEAT.md']
    ]
  st(config cfg, next-id 1)
::
++  apply-command
  |=  [cmd=command:t st=state:t]
  ^-  state:t
  ?-  -.cmd
    %set-config  st(config config.cmd)
    %set-api-key
      ?:  =(provider.cmd provider.config.st)
        st(config config.st(api-key key.cmd))
      st
    %set-model
      ?:  =(provider.cmd provider.config.st)
        st(config config.st(model model.cmd, base-url base-url.cmd))
      st
    %set-history
      st(config config.st(history-window window.cmd, max-log max-log.cmd))
    %allow-dm
      st(config config.st(dm-allowlist (~(put in dm-allowlist.config.st) ship.cmd)))
    %remove-dm
      st(config config.st(dm-allowlist (~(del in dm-allowlist.config.st) ship.cmd)))
    %allow-channel
      st(config config.st(group-channels (~(put in group-channels.config.st) nest.cmd)))
    %remove-channel
      st(config config.st(group-channels (~(del in group-channels.config.st) nest.cmd)))
    %authorize-ship
      st(config config.st(default-authorized (~(put in default-authorized.config.st) ship.cmd)))
    %deauthorize-ship
      st(config config.st(default-authorized (~(del in default-authorized.config.st) ship.cmd)))
    %set-channel-rule
      =/  allowed=(set ship)  (~(gas in *(set ship)) allowed.cmd)
      st(config config.st(channel-rules (~(put by channel-rules.config.st) channel.cmd [mode.cmd allowed])))
    %set-prompt-files
      st(config config.st(prompt-files files.cmd))
  ==
::
++  handle-event
  |=  inc=incoming-event:a
  ^-  (quip card _this)
  =/  allowed=?
    (is-allowed inc)
  ?:  !allowed  [~ this]
  =/  thread=@t  (thread-key inc)
  =/  text=@t  (event-text inc)
  =/  ctx=@t  (event-context inc)
  =/  msg=@t
    ?:  =(ctx '')  text
    (rap 3 ~[ctx ': ' text])
  =/  log=log-entry:t  [%user ctx now.bowl msg]
  =/  hist=(list log-entry:t)  (add-log thread log)
  =^  cards  this
    (dispatch-llm thread inc hist)
  [cards this]
::
++  is-allowed
  |=  inc=incoming-event:a
  ^-  ?
  ?-  -.inc
    %dm-post
      (allow-dm whom.inc)
    %dm-reply
      (allow-dm whom.inc)
    %post
      (allow-channel channel.inc who=|)
    %reply
      ?:  mention.inc
        (allow-channel channel.inc who=|)
        ?:  (has-thread inc)
          (allow-channel channel.inc who=|)
        |
    *  |
  ==
::
++  allow-dm
  |=  who=whom:a
  ^-  ?
  ?+  -.who  |
    %ship
      =/  p=ship  p.who
      ?|  (~(has in dm-allowlist.config.state) p)
          (~(has in default-authorized.config.state) p)
      ==
  ==
::
++  allow-channel
  |=  [=nest:c who=?]
  ^-  ?
  ?:  (~(has in group-channels.config.state) nest)
    =/  rule=(unit rule:t)  (~(get by channel-rules.config.state) nest)
    ?~  rule  &
    ?-  mode.u.rule
      %open        &
      %restricted  &
    ==
  |
::
++  has-thread
  |=  inc=incoming-event:a
  ^-  ?
  =/  key=@t  (thread-key inc)
  (~(has by threads.state) key)
::
++  thread-key
  |=  inc=incoming-event:a
  ^-  @t
  ?-  -.inc
    %dm-post
      ?:  ?=(%ship -.whom.inc)
        (rap 3 'dm/' (scot %p p.whom.inc) ~)
      'dm/club'
    %dm-reply
      ?:  ?=(%ship -.whom.inc)
        (rap 3 'dm-thread/' (scot %p p.whom.inc) '/' (scot %da time.parent.inc) ~)
      'dm-thread/club'
    %post
      (rap 3 'chan/' (render-nest channel.inc) ~)
    %reply
      (rap 3 'thread/' (render-nest channel.inc) '/' (scot %da time.parent.inc) ~)
    *  'unknown'
  ==
::
++  render-nest
  |=  =nest:c
  ^-  @t
  (rap 3 kind.nest '/' (scot %p ship.nest) '/' name.nest ~)
::
++  event-text
  |=  inc=incoming-event:a
  ^-  @t
  ?-  -.inc
    %dm-post    (flatten:channel-utils content.inc)
    %dm-reply   (flatten:channel-utils content.inc)
    %post       (flatten:channel-utils content.inc)
    %reply      (flatten:channel-utils content.inc)
    *           ''
  ==
::
++  event-context
  |=  inc=incoming-event:a
  ^-  @t
  ?-  -.inc
    %dm-post
      ?:  ?=(%ship -.whom.inc)
        (cat 3 'dm from ' (scot %p p.whom.inc))
      'dm from club'
    %dm-reply
      ?:  ?=(%ship -.whom.inc)
        (cat 3 'dm reply from ' (scot %p p.whom.inc))
      'dm reply from club'
    %post
      (cat 3 'mention in ' (render-nest channel.inc))
    %reply
      (cat 3 'thread reply in ' (render-nest channel.inc))
    *  ''
  ==
::
++  add-log
  |=  [key=@t entry=log-entry:t]
  ^-  (list log-entry:t)
  =/  prev=(list log-entry:t)
    (~(gut by threads.state) key ~)
  =/  next=(list log-entry:t)
    (weld prev [entry ~])
  =.  state  state(threads (~(put by threads.state) key next))
  next
::
++  dispatch-llm
  |=  [thread=@t inc=incoming-event:a hist=(list log-entry:t)]
  ^-  (quip card _this)
  =/  reply=reply-target:t  (reply-target inc)
  =/  system=@t  build-system-prompt
  =/  messages=(list json)
    (build-messages system hist)
  =/  tools=json
    ?:(?=(%openai provider.config.state) tool-definitions-openai tool-definitions-anthropic)
  =/  id=@ud  next-id.state
  =.  state  state(next-id +(next-id.state))
  =/  infl=inflight:t
    [id thread reply provider.config.state model.config.state system messages tools]
  =.  state  state(inflight (~(put by inflight.state) id infl))
  =/  req=request:http
    (build-request provider.config.state model.config.state system messages tools)
  :_  this
  [(send-llm-request id req)]~
::
++  reply-target
  |=  inc=incoming-event:a
  ^-  reply-target:t
  ?-  -.inc
    %dm-post
      ?:  ?=(%ship -.whom.inc)
        [%dm p.whom.inc]
      [%dm our.bowl]
    %dm-reply
      ?:  ?=(%ship -.whom.inc)
        [%dm p.whom.inc]
      [%dm our.bowl]
    %post      [%channel channel.inc ~]
    %reply     [%channel channel.inc `parent.inc]
    *          [%dm our.bowl]
  ==
::
++  build-system-prompt
  ^-  @t
  =/  files=(list @t)  prompt-files.config.state
  =/  parts=(list @t)
    %+  turn  files
    |=  f=@t
    =/  content=(unit @t)  (read-prompt-file f)
    ?~  content  ''
    =/  text=@t  (need content)
    (rap 3 ~['## ' f ': ' text ' '])
  (rap 3 parts)
::
++  read-prompt-file
  |=  f=@t
  ^-  (unit @t)
  =/  path=path
    /talon/(scot %t f)
  =/  scry-path=path
    (scry:io dap.bowl path)
  =/  res=(unit cage)
    .^((unit cage) %cx scry-path)
  ?~  res  ~
  =/  cag=cage  u.res
  ?+  p.cag  ~
      %txt  `q.cag
      %md   `q.cag
    ==
::
++  build-messages
  |=  [system=@t hist=(list log-entry:t)]
  ^-  (list json)
  =,  enjs:format
  =/  sys=json
    %-  pairs
    :~  role+s+'system'
        content+s+system
    ==
  =/  logs=(list json)
    %+  turn  (trim-history hist)
    |=  entry=log-entry:t
    %-  pairs
    :~  role+s+(role-text role.entry)
        content+s+content.entry
    ==
  (weld [sys ~] logs)
::
++  trim-history
  |=  hist=(list log-entry:t)
  ^-  (list log-entry:t)
  =/  n=@ud  history-window.config.state
  =/  len=@ud  (lent hist)
  ?:  (lth len n)  hist
  (flop (scag n (flop hist)))
::
++  role-text
  |=  r=?(%system %user %assistant %tool)
  ^-  @t
  ?:  =(r %system)  'system'
  ?:  =(r %user)  'user'
  ?:  =(r %assistant)  'assistant'
  'tool'
::
++  tool-definitions-openai
  ^-  json
  =,  enjs:format
  a+~
::
++  tool-definitions-anthropic
  ^-  json
  =,  enjs:format
  a+~
::
++  build-request
  |=  [prov=provider:t model=@t system=@t messages=(list json) tools=json]
  ^-  request:http
  ?:  ?=(%openai prov)
    (build-openai-request model messages tools)
  (build-anthropic-request model system messages tools)
::
++  build-openai-request
  |=  [model=@t messages=(list json) tools=json]
  ^-  request:http
  =,  enjs:format
  =/  cfg=config:t  config.state
  =/  body=json
    %-  pairs
    :~  model+s+model
        messages+a+messages
        tools+tools
    ==
  =/  url=@t
    ?~  base-url.cfg
      'https://api.openai.com/v1/chat/completions'
    (cat 3 u.base-url.cfg '/v1/chat/completions')
  =/  headers=(list (pair @t @t))
    :~  ['content-type' 'application/json']
        ['accept' 'application/json']
        ['authorization' (cat 3 'Bearer ' api-key.config.state)]
    ==
  [%'POST' url headers `(as-octs:mimes:html (en:json:html body))]
::
++  build-anthropic-request
  |=  [model=@t system=@t messages=(list json) tools=json]
  ^-  request:http
  =,  enjs:format
  =/  body=json
    %-  pairs
    :~  model+s+model
        system+s+system
        messages+a+(strip-system messages)
        tools+tools
    ==
  =/  headers=(list (pair @t @t))
    :~  ['content-type' 'application/json']
        ['accept' 'application/json']
        ['x-api-key' api-key.config.state]
        ['anthropic-version' '2023-06-01']
    ==
  [%'POST' 'https://api.anthropic.com/v1/messages' headers `(as-octs:mimes:html (en:json:html body))]
::
++  strip-system
  |=  msgs=(list json)
  ^-  (list json)
  ?~  msgs  msgs
  t.msgs
::
++  send-llm-request
  |=  [id=@ud req=request:http]
  ^-  card
  [%pass /llm/(scot %ud id) %arvo %i %request req *outbound-config:iris]
::
++  handle-llm-response
  |=  [id=@ud infl=inflight:t body=@t]
  ^-  (quip card _this)
  =/  j=(unit json)
    (de:json:html body)
  ?~  j
    =.  state  state(inflight (~(del by inflight.state) id))
    `this
  =/  resp=json  u.j
  ?-  provider.infl
    %openai  (handle-openai-response id infl resp)
    %anthropic  (handle-anthropic-response id infl resp)
  ==
::
++  handle-openai-response
  |=  [id=@ud infl=inflight:t resp=json]
  ^-  (quip card _this)
  =/  msg=(unit json)  (json-get 'message' (openai-first-choice resp))
  ?~  msg
    =.  state  state(inflight (~(del by inflight.state) id))
    `this
  =/  content=(unit @t)  (json-str (need (json-get 'content' u.msg)))
  =/  calls=(list tool-call:t)  (openai-tool-calls u.msg)
  ?~  calls
    =^  cards  this
      (emit-reply infl (fall content ''))
    [cards this]
  =/  call=tool-call:t  i.calls
  =^  cards  this
    (handle-tool-call infl call)
  [cards this]
::
++  handle-anthropic-response
  |=  [id=@ud infl=inflight:t resp=json]
  ^-  (quip card _this)
  =/  content=(unit json)  (json-get 'content' resp)
  ?~  content
    =.  state  state(inflight (~(del by inflight.state) id))
    `this
  =/  text=@t  (anthropic-text u.content)
  =/  calls=(list tool-call:t)  (anthropic-tool-calls u.content)
  ?:  =(~ calls)
    =^  cards  this  (emit-reply infl text)
    [cards this]
  =/  call=tool-call:t  i.calls
  =^  cards  this  (handle-tool-call infl call)
  [cards this]
::
++  handle-tool-call
  |=  [infl=inflight:t call=tool-call:t]
  ^-  (quip card _this)
  ?:  =(name.call 'talon.ignore')
    =.  state  state(inflight (~(del by inflight.state) id.infl))
    [~ this]
  ?:  =(name.call 'chat.reply')
    =/  text=@t  (arg-text call)
    =^  cards  this  (emit-reply infl text)
    [cards this]
  ?:  =(name.call 'chat.send')
    =/  dm=(unit ship)  (arg-ship call 'dm')
    =/  text=@t  (arg-text call)
    ?~  dm  [~ this]
    =^  cards  this  (send-dm u.dm text)
    [cards this]
  ?:  =(name.call 'channel.send')
    =/  nest=(unit nest:c)  (arg-nest call)
    =/  text=@t  (arg-text call)
    =/  reply=(unit message-key:a)  (arg-reply-time call)
    ?~  nest  [~ this]
    =^  cards  this  (send-channel u.nest reply text)
    [cards this]
  ?:  =(name.call 'scry')
    =/  result=@t  (perform-scry call)
    =^  cards  this  (send-tool-result infl call result)
    [cards this]
  ?:  =(name.call 'http.request')
    =^  cards  this  (send-http-tool infl call)
    [cards this]
  =.  state  state(inflight (~(del by inflight.state) id.infl))
  [~ this]
::
++  emit-reply
  |=  [infl=inflight:t text=@t]
  ^-  (quip card _this)
  =.  state  state(inflight (~(del by inflight.state) id.infl))
  =^  cards  this
    =+  reply=reply.infl
    ?-  -.reply
      %dm
        (send-dm +.reply text)
      %channel
        =+  [nest reply]=+.reply
        (send-channel nest reply text)
    ==
  [cards this]
::
++  send-dm
  |=  [who=ship text=@t]
  ^-  (quip card _this)
  =/  story=story:c  [[%inline [text]~]~]
  =/  =essay:c  [[story our.bowl now.bowl] [%chat /] ~ ~]
  =/  =id:ch  [our.bowl now.bowl]
  =/  =diff:dm:ch  [id %add essay ~]
  =/  =action:dm:ch
    [who diff]
  :_  this
  :~  [%pass /dm/(scot %p who) %agent [our.bowl %chat] %poke %chat-dm-action-1 !>(action)]
  ==
::
++  send-channel
  |=  [=nest:c reply=(unit message-key:a) text=@t]
  ^-  (quip card _this)
  =/  story=story:c  [[%inline [text]~]~]
  =/  =memo:c  [story our.bowl now.bowl]
  =/  =essay:c  [memo /chat ~ ~]
  =/  post=c-post:c
    ?~  reply
      [%add essay]
    [%reply time.u.reply [%add memo]]
  =/  action=a-channels:c
    [%channel nest [%post post]]
  :_  this
  :~  [%pass /channel/(render-nest nest) %agent [our.bowl %channels] %poke %channel-action-1 !>(action)]
  ==
::
++  send-tool-result
  |=  [infl=inflight:t call=tool-call:t result=@t]
  ^-  (quip card _this)
  =/  follow=(list json)  (tool-followup infl call result)
  =/  req=request:http
    (build-request provider.infl model.infl system.infl follow tools.infl)
  :_  this
  :~  (send-llm-request id.infl req)
  ==
::
++  send-http-tool
  |=  [infl=inflight:t call=tool-call:t]
  ^-  (quip card _this)
  =/  req=request:http  (http-request-from call)
  =/  key=@t  (scot %ud id.infl)
  =.  state
    state(pending-http (~(put by pending-http.state) key [id.infl id.call]))
  :_  this
  :~  [%pass /tool-http/(scot %t key) %arvo %i %request req *outbound-config:iris]
  ==
::
++  handle-http-result
  |=  [key=@t pend=pending-http:t body=@t]
  ^-  (quip card _this)
  =/  infl=(unit inflight:t)  (~(get by inflight.state) inflight-id.pend)
  ?~  infl  `this
  =/  call=tool-call:t  [tool-id.pend 'http.request' [%s body]]
  =.  state  state(pending-http (~(del by pending-http.state) key))
  =^  cards  this
    (send-tool-result u.infl call body)
  [cards this]
::
++  tool-followup
  |=  [infl=inflight:t call=tool-call:t result=@t]
  ^-  (list json)
  messages.infl
::
++  openai-first-choice
  |=  resp=json
  ^-  json
  =/  choices=(unit json)  (json-get 'choices' resp)
  ?~  choices  resp
  ?+  -.u.choices  resp
      %a
    ?~  p.u.choices  resp
    i.p.u.choices
  ==
::
++  openai-tool-calls
  |=  msg=json
  ^-  (list tool-call:t)
  =/  tc=(unit json)  (json-get 'tool_calls' msg)
  ?~  tc  ~
  ?+  -.u.tc  ~
      %a
    %+  turn  p.u.tc
    |=  j=json
    ^-  tool-call:t
    =/  id=@t  (need (json-str (need (json-get 'id' j))))
    =/  fn=(unit json)  (json-get 'function' j)
    =/  name=@t  (need (json-str (need (json-get 'name' (need fn)))))
    =/  arg-str=@t  (need (json-str (need (json-get 'arguments' (need fn)))))
    =/  args-json=json  (need (de:json:html arg-str))
    [id name args-json]
  ==
::
++  anthropic-text
  |=  content=json
  ^-  @t
  ?+  -.content  ''
      %a
    =/  parts=(list @t)
      %+  murn  p.content
      |=  j=json
      =/  typ=(unit @t)  (json-str (need (json-get 'type' j)))
      ?~  typ  ~
      ?:  =(u.typ 'text')
        `(need (json-str (need (json-get 'text' j))))
      ~
    (rap 3 parts)
  ==
::
++  anthropic-tool-calls
  |=  content=json
  ^-  (list tool-call:t)
  ?+  -.content  ~
      %a
    %+  murn  p.content
    |=  j=json
    =/  typ=(unit @t)  (json-str (need (json-get 'type' j)))
    ?~  typ  ~
    ?:  =(u.typ 'tool_use')
      =/  id=@t  (need (json-str (need (json-get 'id' j))))
      =/  name=@t  (need (json-str (need (json-get 'name' j))))
      =/  args=json  (need (json-get 'input' j))
      [~ `tool-call:t`[id name args]]
    ~
  ==
::
++  json-get
  |=  [key=@t j=json]
  ^-  (unit json)
  ?+  -.j  ~
      %o  (~(get by p.j) key)
  ==
++  json-str
  |=  j=json
  ^-  (unit @t)
  ?+  -.j  ~
      %s  `p.j
  ==
::
++  arg-text
  |=  call=tool-call:t
  ^-  @t
  =/  j=(unit json)  (json-get 'text' args.call)
  ?~  j  ''
  (need (json-str u.j))
::
++  arg-ship
  |=  [call=tool-call:t key=@t]
  ^-  (unit ship)
  =/  j=(unit json)  (json-get key args.call)
  ?~  j  ~
  =/  s=@t  (need (json-str u.j))
  (slaw %p s)
::
++  arg-nest
  |=  call=tool-call:t
  ^-  (unit nest:c)
  =/  obj=(unit json)  (json-get 'channel' args.call)
  ?~  obj  ~
  ?+  -.u.obj  ~
      %o
    =/  kind=(unit json)  (json-get 'kind' u.obj)
    =/  ship=(unit json)  (json-get 'ship' u.obj)
    =/  name=(unit json)  (json-get 'name' u.obj)
    ?~  kind  ~
    ?~  ship  ~
    ?~  name  ~
    =/  k=@t  (need (json-str u.kind))
    =/  s=@t  (need (json-str u.ship))
    =/  n=@t  (need (json-str u.name))
    =/  kind-term=(unit @tas)  (slaw %tas k)
    =/  ship-term=(unit ship)  (slaw %p s)
    =/  name-term=(unit @tas)  (slaw %tas n)
    ?~  kind-term  ~
    ?~  ship-term  ~
    ?~  name-term  ~
    `nest:c`[u.kind-term u.ship-term u.name-term]
  ==
::
++  arg-reply-time
  |=  call=tool-call:t
  ^-  (unit message-key:a)
  =/  j=(unit json)  (json-get 'reply_time' args.call)
  ?~  j  ~
  =/  s=@t  (need (json-str u.j))
  =/  t=(unit @da)  (slaw %da s)
  ?~  t  ~
  [~ [[our.bowl u.t] u.t]]
::
++  perform-scry
  |=  call=tool-call:t
  ^-  @t
  'scry not implemented'
::
++  is-app-allowed
  |=  app=@t
  ^-  ?
  ?|  =(app 'chat')
      =(app 'channels')
      =(app 'groups')
      =(app 'contacts')
      =(app 'activity')
  ==
::
++  http-request-from
  |=  call=tool-call:t
  ^-  request:http
  =/  method=(unit json)  (json-get 'method' args.call)
  =/  url=(unit json)  (json-get 'url' args.call)
  =/  headers=(unit json)  (json-get 'headers' args.call)
  =/  body=(unit json)  (json-get 'body' args.call)
  =/  mstr=@t  ?~(method 'GET' (need (json-str u.method)))
  =/  mt=(unit @ta)  (slaw %ta mstr)
  =/  m=method:http
    ?~  mt
      %'GET'
    ?+  u.mt  %'GET'
      %'CONNECT'  %'CONNECT'
      %'DELETE'   %'DELETE'
      %'GET'      %'GET'
      %'HEAD'     %'HEAD'
      %'OPTIONS'  %'OPTIONS'
      %'PATCH'    %'PATCH'
      %'POST'     %'POST'
      %'PUT'      %'PUT'
      %'TRACE'    %'TRACE'
    ==
  =/  u=@t  ?~(url '' (need (json-str u.url)))
  =/  hs=(list (pair @t @t))
    ?~  headers  ~
    ?+  -.u.headers  ~
        %o
      %+  turn  ~(tap by p.u.headers)
      |=  [k=@t v=json]
      [k (need (json-str v))]
    ==
  =/  b=(unit octs)
    ?~  body  ~
    [~ (as-octs:mimes:html (need (json-str u.body)))]
  [m u hs b]
::
--
