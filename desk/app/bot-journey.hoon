::  bot-journey: content-free backend tracing for OpenClaw DMs
::
::    This stateless observer watches the local %chat v4 feed.  A DM is
::    eligible only when the relevant %contacts profile already contains
::    bot-info JSON with harness="openclaw".
::
/-  c=chat, co=contacts
/+  default-agent, logs, utils=channel-utils
|%
+$  card  card:agent:gall
::
++  chat-watch
  |=  =bowl:gall
  ^-  card
  [%pass /chat %agent [our.bowl %chat] %watch /v4]
::
++  contact-for
  |=  [=bowl:gall who=ship]
  ^-  contact:co
  ?:  =(who our.bowl)
    .^(contact:co %gx /(scot %p our.bowl)/contacts/(scot %da now.bowl)/v1/self/contact-1)
  .^(contact:co %gx /(scot %p our.bowl)/contacts/(scot %da now.bowl)/v1/contact/(scot %p who)/contact-1)
::
++  is-openclaw
  |=  [=bowl:gall who=ship]
  ^-  ?
  =/  con=contact:co  (contact-for bowl who)
  ?~  info=(~(get by con) %bot-info)  |
  ?.  ?=([%text *] u.info)  |
  ?~  jon=(de:json:html p.u.info)  |
  ?.  ?=([%o *] u.jon)  |
  ?~  harness=(~(get by p.u.jon) 'harness')  |
  ?.  ?=([%s *] u.harness)  |
  =('openclaw' p.u.harness)
::
++  message
  |=  response=response:writs:c
  ^-  (unit [id=id:c author=author:c])
  ?-  -.response.response
    %add
      `[id.response author.essay.response.response]
    %del  ~
    %reply
      =*  delta  delta.response.response
      ?.  ?=(%add -.delta)  ~
      `[id.response.response author.reply-essay.delta]
    %add-react  ~
    %del-react  ~
  ==
::
++  journey-card
  |=  [=bowl:gall stage=@t =id:c owner=ship bot=ship]
  ^-  card
  =/  message-id=@t
    (rap 3 (scot %p p.id) '/' (scot %ud q.id) ~)
  =/  id-key=@t
    ?:  ?|(=(stage 'moon_reply_persisted') =(stage 'owner_reply_persisted'))
      'tlon.message_journey.output_message_id'
    'tlon.message_journey.input_message_id'
  =/  data=log-data:logs
    :~  `(pair @t json)`['tlon.message_journey.schema_version' [%n '1']]
        'tlon.message_journey.event'^s+stage
        'tlon.message_journey.message_id'^s+message-id
        id-key^s+message-id
        'tlon.message_journey.owner_ship'^s+(scot %p owner)
        'tlon.message_journey.bot_ship'^s+(scot %p bot)
        'tlon.message_journey.destination_kind'^s+'dm'
        'tlon.message_journey.source'^s+'bot-journey'
    ==
  =/  body=@t  (cat 3 'tlon.message_journey.' stage)
  =/  echo=echo:logs  ~[`tank`body]
  (~(tell logs bowl /logs) %info echo data)
::
++  observe
  |=  [=bowl:gall =whom:c response=response:writs:c]
  ^-  (list card)
  ?.  ?=(%ship -.whom)  ~
  =/  peer=ship  p.whom
  ?~  msg=(message response)  ~
  =/  author=author:c  author.u.msg
  =/  author-ship=ship  (get-author-ship:utils author)
  =/  peer-is-child=?
    =(our.bowl (sein:title our.bowl now.bowl peer))
  =/  peer-is-owner=?
    =(peer (sein:title our.bowl now.bowl our.bowl))
  ?:  =(author-ship our.bowl)
    ?:  peer-is-child
      ?.  (is-openclaw bowl peer)  ~
      ~[(journey-card bowl 'owner_input_accepted' id.u.msg our.bowl peer)]
    ?.  peer-is-owner  ~
    ?.  (is-openclaw bowl our.bowl)  ~
    ~[(journey-card bowl 'moon_reply_persisted' id.u.msg peer our.bowl)]
  ?:  peer-is-child
    ?.  (is-openclaw bowl peer)  ~
    ~[(journey-card bowl 'owner_reply_persisted' id.u.msg our.bowl peer)]
  ?.  peer-is-owner  ~
  ?.  (is-openclaw bowl our.bowl)  ~
  ~[(journey-card bowl 'moon_input_persisted' id.u.msg peer our.bowl)]
--
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
::
++  on-init
  ^-  (quip card _this)
  [~[(chat-watch bowl)] this]
::
++  on-save  !>(~)
::
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  ?:  (~(has by wex.bowl) [/chat our.bowl %chat])  [~ this]
  [~[(chat-watch bowl)] this]
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?:  =(/logs wire)  [~ this]
  ?.  =(/chat wire)  (on-agent:def wire sign)
  ?-  -.sign
    %watch-ack  [~ this]
    %kick       [~[(chat-watch bowl)] this]
    %fact
      ?.  =(%writ-response-4 p.cage.sign)  [~ this]
      =/  payload=[whom:c response:writs:c]
        !<([whom:c response:writs:c] q.cage.sign)
      [(observe bowl payload) this]
    %poke-ack  [~ this]
  ==
::
++  on-poke   on-poke:def
++  on-watch  on-watch:def
++  on-leave  on-leave:def
++  on-arvo   on-arvo:def
++  on-peek   on-peek:def
++  on-fail   on-fail:def
--
