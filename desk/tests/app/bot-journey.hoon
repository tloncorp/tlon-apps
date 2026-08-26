/-  c=chat, ch=channels, co=contacts, l=logs
/+  *test-agent
/=  agent  /app/bot-journey
|%
++  dap  %bot-journey-test
++  owner  ~dev
++  bot  ^-  ship  (add owner (bex 32))
++  when  ~2024.1.1
::
++  bot-contact
  ^-  contact:co
  (malt [%bot-info [%text '{"v":1,"harness":"openclaw"}']] ~)
::
++  human-contact
  ^-  contact:co
  (malt [%nickname [%text 'Human']] ~)
::
++  scry-owner-bot
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%j @ %sein @ @ ~]  `!>(owner)
    [%gx @ %contacts @ %v1 %contact @ %contact-1 ~]  `!>(bot-contact)
  ==
::
++  scry-owner-human
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%j @ %sein @ @ ~]  `!>(owner)
    [%gx @ %contacts @ %v1 %contact @ %contact-1 ~]  `!>(human-contact)
  ==
::
++  scry-moon
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%j @ %sein @ @ ~]  `!>(owner)
    [%gx @ %contacts @ %v1 %self %contact-1 ~]  `!>(bot-contact)
  ==
::
++  scry-human-moon
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
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
  [/chat [local %chat] %fact writ-response-4+!>([`whom:c`[%ship peer] response])]
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
        'tlon.message_journey.source'^s+'bot-journey'
    ==
  [%pass /logs %agent [local %logs] %poke log-action-1+!>(`a-log:l`[%log event data])]
::
++  setup
  |=  [local=ship scry=scry]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate scry)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our local, src local, now when)))
  ;<  *  bind:m  (do-init dap agent)
  (pure:m ~)
::
++  test-owner-input-for-openclaw-bot
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup owner scry-owner-bot)
  =/  =id:c  [owner when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact owner bot owner id))
  (ex-equal !>(caz) !>([(expected owner 'owner_input_accepted' id owner bot)]~))
::
++  test-owner-reply-for-openclaw-bot
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup owner scry-owner-bot)
  =/  =id:c  [bot when]
  =/  bot-author=author:c  [bot ~ ~]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact owner bot bot-author id))
  (ex-equal !>(caz) !>([(expected owner 'owner_reply_persisted' id owner bot)]~))
::
++  test-moon-input-from-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup bot scry-moon)
  =/  =id:c  [owner when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact bot owner owner id))
  (ex-equal !>(caz) !>([(expected bot 'moon_input_persisted' id owner bot)]~))
::
++  test-moon-reply-to-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  (setup bot scry-moon)
  =/  =id:c  [bot when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact bot owner bot id))
  (ex-equal !>(caz) !>([(expected bot 'moon_reply_persisted' id owner bot)]~))
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
  ;<  ~  bind:m  (setup owner scry-owner-human)
  =/  =id:c  [owner when]
  ;<  caz=(list card)  bind:m  (do-agent (make-fact owner bot owner id))
  (ex-cards caz ~)
--
