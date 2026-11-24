::  Execute a real local tool through the full head using fixture provider
::  responses. Inspect outbound cards; never send them to a provider.
/-  h=harness, *harness-store, renew=harness-oauth
/+  *test-agent, policy=harness-defaults, hl=harness, j=harness-workspace-json, auth=harness-auth
/=  head  /app/harness
|%
++  test-api-and-subscription-preserve-reasoning-through-a-tool-and-reload
  %-  zing
  %+  turn  `(list @t)`~['https://api.openai.com/v1/responses' device-url:auth]
  |=  url=@t
  (eval-mare (exchange url))
++  requests
  |=  cards=(list card)
  ^-  (list http-card:renew)
  %+  murn
    cards
  |=  c=card
  ^-((unit http-card:renew) ?:(?=([%pass [%llm *] %arvo %i %request *] c) `c ~))
++  body
  |=  c=http-card:renew
  (need (de:json:html q:(need body.request.c)))
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
++  exchange
  |=  url=@t
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved=state-0  *state-0
  =/  cfg  builtin-config:policy
  =.  cfg  cfg(url url, model 'gpt-6-luna', tools ~)
  =.  saved
    %=  saved  defaults  cfg  local-mcp-seen  1  provider-keys
        (my ~[['openai' 'fixture-api-key'] ['openai-device' 'fixture-device-token']])  sessions
        (my ~[['fixture' [~[[%config-replaced cfg]] 0]]])
    ==
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now ~2026.9.24)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  ;<  sent=(list card)  bind:m
    (do-poke %harness-action !>(`action:h`[%send 'fixture' 'What time is it?']))
  =/  first  (snag 0 (requests sent))
  =/  response=client-response:iris
    :*  %finished  [200 ~]
        :-  ~
        :*  'text/event-stream'
            %-  as-octs:mimes:html
            'data: {"type":"response.output_item.done","item":{"id":"rs_time","type":"reasoning","summary":[],"encrypted_content":"ENCRYPTED_TIME"}}\0a\0adata: {"type":"response.output_item.done","item":{"type":"function_call","id":"fc_time","call_id":"call_time","name":"current_time","arguments":"{}"}}\0a\0adata: {"type":"response.completed","response":{"usage":{"input_tokens":10,"output_tokens":20}}}\0a\0a'
        ==
    ==
  ;<  executed=(list card)  bind:m
    (do-arvo wire.first [%iris %http-response response])
  =/  next  (snag 0 (requests executed))
  =/  input  (need (get:j (body next) 'input'))
  ?>  ?=(%a -.input)
  ::  Reload a fresh core from the saved state before the final response.
  ;<  state=vase  bind:m  get-save
  ;<  *           bind:m  (do-load head `state)
  =/  final=client-response:iris
    :*  %finished  [200 ~]
        :-  ~
        :*  'text/event-stream'
            %-  as-octs:mimes:html
            'data: {"type":"response.output_item.done","item":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"It is midnight UTC."}]}}\0a\0adata: {"type":"response.completed","response":{"usage":{"input_tokens":30,"output_tokens":5}}}\0a\0a'
        ==
    ==
  ;<  *                 bind:m  (do-arvo wire.next [%iris %http-response final])
  ;<  retained=state-0  bind:m  get-state
  =/  v  (play:hl log:(~(got by sessions.retained) 'fixture'))
  =/  authorization
    (skim header-list.request.first |=([name=@t value=@t] =('authorization' name)))
  ;<  ~  bind:m  (ex-equal !>(url.request.first) !>(url))
  ;<  ~  bind:m  (ex-equal !>(url.request.next) !>(url))
  ;<  ~  bind:m
    %+  ex-equal
      !>(authorization)
    !>  :~  :*  'authorization'
                ?:  =(url device-url:auth)
                  'Bearer fixture-device-token'
                'Bearer fixture-api-key'
            ==
        ==
  ;<  ~  bind:m
    (ex-equal !>((string:j (snag 1 p.input) 'encrypted_content')) !>('ENCRYPTED_TIME'))
  ;<  ~  bind:m  (ex-equal !>((string:j (snag 2 p.input) 'type')) !>('function_call'))
  ;<  ~  bind:m
    (ex-equal !>((string:j (snag 3 p.input) 'type')) !>('function_call_output'))
  ;<  ~  bind:m  (ex-equal !>((string:j (snag 3 p.input) 'call_id')) !>('call_time'))
  ;<  ~  bind:m  (ex-equal !>(!=('' (string:j (snag 3 p.input) 'output'))) !>(&))
  ;<  ~  bind:m  (ex-equal !>((rear items.v)) !>(`item:h`[%assistant 'It is midnight UTC.' ~]))
  ;<  ~  bind:m  (ex-equal !>(pending.v) !>(~))
  (ex-equal !>(total.v) !>([40 25]))
--
