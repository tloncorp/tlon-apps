/-  c=chat, ch=channels, chv=channels-ver, co=contacts, l=logs
/+  *test-agent
/=  agent  /app/steward
|%
++  dap  %steward
++  owner  ~dev
++  bot  ^-  ship  (add owner (bex 32))
++  when  ~2024.1.1
::
++  bot-contact
  ^-  contact:co
  (malt [%bot-info [%text '{"v":1,"harness":"openclaw","version":"0.25.0"}']] ~)
::
++  missing-version-contact
  ^-  contact:co
  (malt [%bot-info [%text '{"v":1,"harness":"openclaw"}']] ~)
::
++  stale-contact
  ^-  contact:co
  (malt [%bot-info [%text '{"v":2,"harness":"openclaw","version":"0.25.0"}']] ~)
::
++  malformed-harness-version-contact
  ^-  contact:co
  (malt [%bot-info [%text '{"v":1,"harness":"openclaw","version":"0.25.0","harnessVersion":42}']] ~)
::
++  human-contact
  ^-  contact:co
  (malt [%nickname [%text 'Human']] ~)
::
++  scry-owner-contact
  |=  con=(unit contact:co)
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %activity @ %$ ~]  `!>(&)
    [%j @ %sein @ @ ~]  `!>(owner)
    [%gu @ %contacts @ %v1 %contact @ ~]  `!>(?=(^ con))
    [%gx @ %contacts @ %v1 %contact @ %contact-1 ~]
      ?~(con ~ `!>(u.con))
  ==
::
++  scry-moon
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %activity @ %$ ~]  `!>(&)
    [%j @ %sein @ @ ~]  `!>(owner)
    [%gx @ %contacts @ %v1 %self %contact-1 ~]  `!>(bot-contact)
  ==
::
++  scry-human-moon
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %activity @ %$ ~]  `!>(&)
    [%j @ %sein @ @ ~]  `!>(owner)
    [%gx @ %contacts @ %v1 %self %contact-1 ~]  `!>(human-contact)
  ==
::
++  make-fact
  |=  [local=ship peer=ship author=author:c =id:c]
  ^-  [wire gill:gall sign:agent:gall]
  =/  =verse:ch  [%inline ~['not included in telemetry']]
  =/  =essay:c  [[~[verse] author when] chat+/ ~ ~]
  =/  response=response:writs:c  [id %add essay 1 when]
  [/journey/chat [local %chat] %fact writ-response-4+!>([`whom:c`[%ship peer] response])]
::
++  make-channel-post-fact
  |=  [local=ship host=ship author=author:ch =id-post:ch]
  ^-  [wire gill:gall sign:agent:gall]
  =/  =verse:ch  [%inline ~['not included in telemetry']]
  =/  =post:v10:chv  *post:v10:chv
  =.  content.post  ~[verse]
  =.  author.post   author
  =.  sent.post     when
  =/  response=r-channels:v10:chv
    [[%chat host %general] [%post id-post [%set [%& post]]]]
  [/journey/channels [local %channels] %fact channel-response-5+!>(response)]
::
++  make-channel-reply-fact
  |=  [local=ship host=ship author=author:ch parent=id-post:ch reply=id-reply:ch]
  ^-  [wire gill:gall sign:agent:gall]
  =/  =verse:ch  [%inline ~['not included in telemetry']]
  =/  stored-reply=reply:v10:chv  *reply:v10:chv
  =.  content.stored-reply  ~[verse]
  =.  author.stored-reply   author
  =.  sent.stored-reply     when
  =/  response=r-channels:v10:chv
    :*  [%chat host %general]
        [%post parent [%reply reply *reply-meta:ch [%set [%& stored-reply]]]]
    ==
  [/journey/channels [local %channels] %fact channel-response-5+!>(response)]
::
++  expected
  |=  [local=ship stage=@t =id:c owner-ship=ship bot-ship=ship]
  ^-  card
  =/  message-id=@t
    (rap 3 (scot %p p.id) '/' (scot %ud q.id) ~)
  =/  id-key=@t
    ?:  ?|(=(stage 'moon_reply_persisted') =(stage 'owner_reply_persisted'))
      'tlon.message_journey.output_message_id'
    'tlon.message_journey.input_message_id'
  =/  body=@t  (cat 3 'tlon.message_journey.' stage)
  =/  echo=echo:l  ~[`tank`body]
  =/  event=log-event:l  [%tell %info echo]
  =/  data=log-data:l
    :~  `(pair @t json)`['tlon.message_journey.schema_version' [%n '1']]
        'tlon.message_journey.event'^s+stage
        'tlon.message_journey.message_id'^s+message-id
        id-key^s+message-id
        'tlon.message_journey.owner_ship'^s+(scot %p owner-ship)
        'tlon.message_journey.bot_ship'^s+(scot %p bot-ship)
        'tlon.message_journey.destination_kind'^s+'dm'
        'tlon.message_journey.source'^s+'steward/journey'
    ==
  [%pass /journey/logs %agent [local %logs] %poke log-action-1+!>(`a-log:l`[%log event data])]
::
++  expected-group
  |=  [local=ship stage=@t author=ship id=time owner-ship=ship bot-ship=ship]
  ^-  card
  =/  message-id=@t
    (rap 3 (scot %p author) '/' (scot %ud id) ~)
  =/  body=@t  (cat 3 'tlon.message_journey.' stage)
  =/  echo=echo:l  ~[`tank`body]
  =/  event=log-event:l  [%tell %info echo]
  =/  data=log-data:l
    :~  `(pair @t json)`['tlon.message_journey.schema_version' [%n '1']]
        'tlon.message_journey.event'^s+stage
        'tlon.message_journey.message_id'^s+message-id
        'tlon.message_journey.output_message_id'^s+message-id
        'tlon.message_journey.owner_ship'^s+(scot %p owner-ship)
        'tlon.message_journey.bot_ship'^s+(scot %p bot-ship)
        'tlon.message_journey.destination_kind'^s+'group_channel'
        'tlon.message_journey.source'^s+'steward/journey'
    ==
  [%pass /journey/logs %agent [local %logs] %poke log-action-1+!>(`a-log:l`[%log event data])]
::
++  setup
  |=  [local=ship scry=scry]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate scry)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our local, src local)))
  ;<  *  bind:m  (do-init dap agent)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now when)))
  (pure:m ~)
::
++  test-owner-input-for-openclaw-bot
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup owner (scry-owner-contact `bot-contact))
  =/  =id:c  [owner when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact owner bot owner id))
  (ex-cards caz ~[(ex-card (expected owner 'owner_input_accepted' id owner bot))])
::
++  test-owner-reply-for-openclaw-bot
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup owner (scry-owner-contact `bot-contact))
  =/  =id:c  [bot when]
  =/  bot-author=author:c  [bot ~ ~]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact owner bot bot-author id))
  (ex-cards caz ~[(ex-card (expected owner 'owner_reply_persisted' id owner bot))])
::
++  test-moon-input-from-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup bot scry-moon)
  =/  =id:c  [owner when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact bot owner owner id))
  (ex-cards caz ~[(ex-card (expected bot 'moon_input_persisted' id owner bot))])
::
++  test-moon-reply-to-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup bot scry-moon)
  =/  =id:c  [bot when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact bot owner bot id))
  (ex-cards caz ~[(ex-card (expected bot 'moon_reply_persisted' id owner bot))])
::
++  test-human-moon-reply-emits-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup bot scry-human-moon)
  =/  =id:c  [bot when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact bot owner bot id))
  (ex-cards caz ~)
::
++  test-human-dm-emits-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup owner (scry-owner-contact `human-contact))
  =/  =id:c  [owner when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact owner bot owner id))
  (ex-cards caz ~)
::
++  test-missing-contact-emits-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup owner (scry-owner-contact ~))
  =/  =id:c  [owner when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact owner bot owner id))
  (ex-cards caz ~)
::
++  test-incomplete-bot-info-emits-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup owner (scry-owner-contact `missing-version-contact))
  =/  =id:c  [owner when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact owner bot owner id))
  (ex-cards caz ~)
::
++  test-stale-bot-info-emits-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup owner (scry-owner-contact `stale-contact))
  =/  =id:c  [owner when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact owner bot owner id))
  (ex-cards caz ~)
::
++  test-malformed-optional-bot-info-emits-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m
    (setup owner (scry-owner-contact `malformed-harness-version-contact))
  =/  =id:c  [owner when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact owner bot owner id))
  (ex-cards caz ~)
::
++  test-group-owner-host-observes-bot-post
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup owner (scry-owner-contact `bot-contact))
  ;<  caz=(list card)  bind:m
    (do-agent (make-channel-post-fact owner owner [bot ~ ~] when))
  =/  expected-host=card
    (expected-group owner 'group_host_reply_persisted' bot when owner bot)
  =/  expected-owner=card
    (expected-group owner 'owner_group_reply_persisted' bot when owner bot)
  (ex-cards caz ~[(ex-card expected-host) (ex-card expected-owner)])
::
++  test-group-remote-host-observes-bot-post
  %-  eval-mare
  =/  m  (mare ,~)
  =/  host=ship  ~zod
  ;<  ~  bind:m  (setup host (scry-owner-contact `bot-contact))
  ;<  caz=(list card)  bind:m
    (do-agent (make-channel-post-fact host host [bot ~ ~] when))
  (ex-cards caz ~[(ex-card (expected-group host 'group_host_reply_persisted' bot when owner bot))])
::
++  test-group-owner-observes-bot-reply
  %-  eval-mare
  =/  m  (mare ,~)
  =/  host=ship  ~zod
  =/  parent=id-post:ch  ~2023.12.31
  ;<  ~  bind:m  (setup owner (scry-owner-contact `bot-contact))
  ;<  caz=(list card)  bind:m
    (do-agent (make-channel-reply-fact owner host [bot ~ ~] parent when))
  (ex-cards caz ~[(ex-card (expected-group owner 'owner_group_reply_persisted' bot when owner bot))])
::
++  test-group-human-post-emits-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup owner (scry-owner-contact `human-contact))
  ;<  caz=(list card)  bind:m
    (do-agent (make-channel-post-fact owner owner [bot ~ ~] when))
  (ex-cards caz ~)
::
++  test-group-missing-contact-emits-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup owner (scry-owner-contact ~))
  ;<  caz=(list card)  bind:m
    (do-agent (make-channel-post-fact owner owner [bot ~ ~] when))
  (ex-cards caz ~)
--
