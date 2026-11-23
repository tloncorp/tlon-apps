/-  verifier
/+  *test-agent
/=  agent  /app/lanyard
|%
++  v  (verifier)
++  dap  %lanyard
++  host  ~patpet-dopped
::
++  phones
  |=  l=(list @t)
  ^-  (set identifier:v)
  (~(gas in *(set identifier:v)) (turn l |=(p=@t [%phone p])))
::
++  faux-scry
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %contacts @ %$ ~]  `!>(|)
  ==
::
++  do-setup
  =/  m  (mare ,~)
  ;<  ~  bind:m  (set-scry-gate faux-scry)
  ;<  *  bind:m  (do-init dap agent)
  (pure:m ~)
::
++  ask
  |=  [nonce=@ ids=(set identifier:v)]
  (do-poke %lanyard-query-2 !>(`query:l:v`[~ `nonce %whose-set ids]))
::
++  expect-bulk
  |=  $:  caz=(list card)
          nonce=@
          salt=@ux
          last=(set identifier:v)
          add=(set identifier:v)
          del=(set identifier:v)
      ==
  =/  qer=user-query:v  [[dap nonce] %whose-bulk salt last add del]
  =;  ex
    (ex-cards caz ex ~)
  %:  ex-poke
    /query/(scot %uv nonce)
    [host %verifier]
    %verifier-user-query
    !>(qer)
  ==
::
++  answer
  |=  [from=@p nonce=@ res=result:query-result:v]
  %-  (do-as from)
  (do-poke %verifier-result !>(`query-result:v`[nonce res]))
--
::
|%
++  test-whose-set-continues-from-accepted-set
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
  ;<  caz=(list card)  bind:m  (ask 1 (phones 'a' 'b' ~))
  ;<  ~  bind:m  (expect-bulk caz 1 0x0 ~ (phones 'a' 'b' ~) ~)
  ;<  *  bind:m  (answer host 1 %whose-bulk 0xabc ~)
  ;<  caz=(list card)  bind:m  (ask 2 (phones 'a' 'c' ~))
  (expect-bulk caz 2 0xabc (phones 'a' 'b' ~) (phones 'c' ~) (phones 'b' ~))
::
++  test-whose-set-keeps-cursor-on-refusal
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
  ;<  *  bind:m  (ask 1 (phones 'a' 'b' ~))
  ;<  *  bind:m  (answer host 1 %rate-limit ~)
  ;<  caz=(list card)  bind:m  (ask 2 (phones 'a' 'b' ~))
  (expect-bulk caz 2 0x0 ~ (phones 'a' 'b' ~) ~)
::
++  test-whose-set-refuses-other-answerers
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
  ;<  *  bind:m  (ask 1 (phones 'a' 'b' ~))
  ;<  ~  bind:m  (ex-fail (answer ~bud 1 %whose-bulk 0xbad ~))
  ;<  *  bind:m  (answer host 1 %whose-bulk 0xabc ~)
  ;<  caz=(list card)  bind:m  (ask 2 (phones 'a' 'b' ~))
  (expect-bulk caz 2 0xabc (phones 'a' 'b' ~) ~ ~)
::
++  test-whose-set-only-from-our
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
  (ex-fail ((do-as ~bud) (ask 1 (phones 'a' ~))))
::
++  test-v1-bulk-advances-cursor
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  ~  bind:m  do-setup
  =/  qer=query:v1:l:v
    [~ `1 %whose-bulk 0x0 ~ (phones 'a' 'b' ~) ~]
  ;<  *  bind:m  (do-poke %lanyard-query-1 !>(qer))
  ;<  *  bind:m  (answer host 1 %whose-bulk 0xabc ~)
  ;<  caz=(list card)  bind:m  (ask 2 (phones 'a' 'b' ~))
  (expect-bulk caz 2 0xabc (phones 'a' 'b' ~) ~ ~)
--
