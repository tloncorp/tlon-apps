/-  r=reel, spider
/+  *test-agent, reel, strandio, server
/=  bait-agent  /app/bait
|%
++  dap  %bait-test
++  vic  'https://tlon.network/lure/'
++  civ  ~loshut-lonreg
++  eny
  `@uv`0xffff.ffff.ffff.ffff.ffff.ffff.ffff.ffff
++  nonce  `@ta`'~2000.1.1'
++  token  `@t`(scot %uv (end [3 16] eny))
+$  bait-state
  $:  %2
      metadata=(map token:r metadata:r)
  ==
++  test-bait-describe
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap bait-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our civ, src ~dev, eny eny)))
  =/  =metadata:r  [%test (my ['inviter' '~dev'] ['bite-type' '2'] ~)]
  =/  describe  [nonce metadata]
  ;<  caz=(list card)  bind:m  (do-poke %bait-describe !>(describe))
  ;<  *  bind:m
    %+  ex-cards  caz
    ~[(ex-poke /confirm/[nonce] [~dev %reel] reel-confirmation+!>([nonce token]))]
  ;<  state=vase  bind:m  get-save
  =+  !<(bait-state state)
  (ex-equal !>(metadata) !>((my [token ^metadata] ~)))
++  test-bait-who-get
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap bait-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev)))
  =/  simple-payload
    (json-response:gen:server s+(scot %p ~dev))
  ::  request 1: test old style tokens
  =/  eyre-id  %eyre-request-1
  =/  request=[id=@ta inbound-request:eyre]
    [eyre-id (eyre-get-request '/lure/bait/who')]
  ;<  caz=(list card)  bind:m  (do-poke %handle-http-request !>(request))
  %+  ex-cards  caz
  (eyre-request-cards eyre-id simple-payload)
++  test-bait-metadata-get
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap bait-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our civ, src civ, eny eny)))
  =/  =metadata:r  [%test (my ['title' 'test-group'] ~)]
  =/  init-state=bait-state
    :-  %2
    (my ['~zod/test' metadata] [token metadata] ~)
  ;<  *  bind:m  (do-load bait-agent `!>(init-state))
  =/  simple-payload
    (json-response:gen:server (enjs-metadata:reel metadata))
  ::  request 1: test old style tokens
  =/  eyre-id  %eyre-request-1
  =/  request=[id=@ta inbound-request:eyre]
    [eyre-id (eyre-get-request '/lure/~zod/test/metadata')]
  ;<  caz=(list card)  bind:m  (do-poke %handle-http-request !>(request))
  ;<  *  bind:m
    %+  ex-cards  caz
    (eyre-request-cards eyre-id simple-payload)
  ::  request 2: test new style tokens
  =/  eyre-id  %eyre-request-2
  =/  request=[id=@ta inbound-request:eyre]
    [eyre-id (eyre-get-request (crip "/lure/{(trip token)}/metadata"))]
  ;<  caz=(list card)  bind:m  (do-poke %handle-http-request !>(request))
  %+  ex-cards  caz
  (eyre-request-cards eyre-id simple-payload)
::
++  test-bait-bite-post
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap bait-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our civ, src civ, eny eny)))
  =/  m1=metadata:r  [%test (my ['title' 'test-group'] ~)]
  =/  m2=metadata:r
    :-  %test
    %-  my
    :~  ['title' 'test-group']
        ['bite-type' '2']
        ['inviter' '~dev']
    ==
  =/  init-state=bait-state
    :-  %2
    (my ['~zod/test' m1] [token m2] ~)
  ;<  *  bind:m  (do-load bait-agent `!>(init-state))
  =/  payload  (as-octs:mimes:html 'ship=%7Erus')
  =/  simple-payload
    (manx-response:gen:server (sent-page ~rus))
  ::  request 1: test new style tokens
  =/  eyre-id  %eyre-request-1
  =/  request=[id=@ta inbound-request:eyre]
    [eyre-id (eyre-post-request (cat 3 '/lure/' token) payload)]
  ;<  caz=(list card)  bind:m  (do-poke %handle-http-request !>(request))
  ;<  *  bind:m
    %+  ex-cards  caz
    =/  =cage  reel-bite+!>([%bite-2 token ~rus m2])
    %+  welp
      :~  (ex-poke /bite [~dev %reel] cage)
          (ex-poke /bite [civ %reel] cage)
      ==
    (eyre-request-cards eyre-id simple-payload)
  ::  request 2: test old style tokens
  =/  eyre-id  %eyre-request-2
  =/  request=[id=@ta inbound-request:eyre]
    [eyre-id (eyre-post-request '/lure/~zod/test' payload)]
  ;<  caz=(list card)  bind:m  (do-poke %handle-http-request !>(request))
  %+  ex-cards  caz
  =/  =cage  reel-bite+!>([%bite-1 `@ta`'test' ~rus ~zod])
  %+  welp
    :~  (ex-poke /bite [~zod %reel] cage)
        (ex-poke /bite [civ %reel] cage)
    ==
  (eyre-request-cards eyre-id simple-payload)
++  eyre-get-request
  |=  url=@t
  :*  |
      &
      *address:eyre
      :*  %'GET'
          url
          ~
          ~
      ==
  ==
::
++  eyre-post-request
  |=  [url=@t payload=octs]
  :*  |
      &
      *address:eyre
      :*  %'POST'
          url
          ~
          `payload
      ==
  ==
++  eyre-request-cards
  |=  [id=@ta =simple-payload:http]
  ^-  (list $-(card tang))
  =/  paths  ~[/http-response/[id]]
  =/  header-cage
    [%http-response-header !>(response-header.simple-payload)]
  =/  data-cage
    [%http-response-data !>(data.simple-payload)]
  %-  limo
  :~  (ex-fact paths header-cage)
      (ex-fact paths data-cage)
      (ex-card [%give %kick paths ~])
  ==
++  sent-page
  |=  invitee=ship
  ^-  manx
  ;html
    ;head
      ;title:"Lure"
    ==
    ;body
      Your invite has been sent!  Go to your ship to accept it.
      ;script: document.cookie="ship={(trip (scot %p invitee))}"
    ==
  ==
--