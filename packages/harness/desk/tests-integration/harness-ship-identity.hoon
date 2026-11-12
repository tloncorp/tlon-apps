::  The full head names its operating ship in each outbound turn, from the
::  bowl rather than session configuration. Inspect outbound cards only.
/-  h=harness, *harness-store, renew=harness-oauth
/+  *test-agent, policy=harness-defaults, w=harness-provider-wire
/=  head  /app/harness
|%
++  planet  ~sampel-palnet
++  starts
  |=  [prefix=@t text=@t]
  ^-  ?
  =(prefix (end [3 (met 3 prefix)] text))
::  +instructions: system text of the first turn the head sends as .our
::
++  instructions
  |=  our=@p
  =/  m  (mare ,@t)
  ^-  form:m
  =/  cfg  builtin-config:policy
  =.  cfg  cfg(url 'https://openrouter.ai/api/v1/chat/completions', tools ~)
  =/  saved=state-0  *state-0
  =.  saved
    %=  saved  defaults  cfg  local-mcp-seen  1
      provider-keys  (my ~[['openrouter' 'fixture-key']])
      sessions  (my ~[['fixture' [~[[%config-replaced cfg]] 0]]])
    ==
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our our, src our, now ~2026.10.5)))
  ::  Jael answers the sponsor scry; every other scry is refused.
  ;<  ~  bind:m
    (set-scry-gate |=(p=path ?:(?=([%j @ %sein *] p) `!>(planet) `!>(|))))
  ;<  *  bind:m  (do-load head `!>(saved))
  ;<  caz=(list card)  bind:m
    (do-poke %harness-action !>(`action:h`[%send 'fixture' 'Which ship are you?']))
  =/  requests=(list http-card:renew)
    %+  murn  caz
    |=  c=card
    ^-((unit http-card:renew) ?:(?=([%pass [%llm *] %arvo %i %request *] c) `c ~))
  ?>  ?=([* ~] requests)
  =/  body  (need (de:json:html q:(need body.request.i.requests)))
  =/  messages  (need (get:w body 'messages'))
  ?>  ?=([%a ^] messages)
  ?>  =('system' (str:w i.p.messages 'role'))
  (pure:m (str:w i.p.messages 'content'))
::
++  test-a-planet-turn-names-the-ship
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  text=@t  bind:m  (instructions planet)
  ;<  ~  bind:m
    %+  ex-equal
      !>((starts 'Your Urbit ship is ~sampel-palnet. References to ~sampel-palnet ' text))
    !>(&)
  (ex-equal !>(?=(^ (find "You are Harness, an agent" (trip text)))) !>(&))
++  test-a-moon-turn-names-the-ship-and-its-parent
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  moon=@p  (add planet (lsh 5 1))
  =/  lead  (rap 3 ~['Your Urbit ship is ' (scot %p moon) ', a moon of ~sampel-palnet. '])
  ;<  text=@t  bind:m  (instructions moon)
  (ex-equal !>((starts lead text)) !>(&))
--
