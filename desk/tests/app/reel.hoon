/-  r=reel
/+  *test-agent
/=  reel-agent  /app/reel
|%
++  dap  %reel-test
++  vic  'https://tlon.network/lure/'
++  civ  ~loshut-lonreg
++  token  '~bus/reel-test'
+$  reel-state
  $:  %4
      vic=@t
      civ=ship
      our-metadata=(map token:r metadata:r)
      open-link-requests=(set (pair ship cord))
      open-describes=(set token:r)
      stable-id=(map cord token:r)
  ==
++  test-reel-describe
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap reel-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev, now *@da)))
  =/  =metadata:r  [%test (my ['inviter' '~dev'] ['group' '~bus/reel-test'] ~)]
  =/  describe  [token metadata]
  ;<  caz=(list card)  bind:m  (do-poke %reel-describe !>(describe))
  ;<  bw=bowl  bind:m  get-bowl
  =/  nonce  (scot %da now.bw)
  =/  edited-md  [%test (~(put by fields.metadata) 'bite-type' '2')]
  ::  make sure we're sending a describe request to the bait provider
  ;<  *  bind:m
    %+  ex-cards  caz
    =/  request  [nonce edited-md]
    ~[(ex-poke /describe [civ %bait] bait-describe+!>(request))]
  ;<  state=vase  bind:m  get-save
  =+  !<(reel-state state)
  ::  ensure link metadata added to our state and has bite-type field
  ;<  *  bind:m  (ex-equal !>(our-metadata) !>((my [nonce edited-md] ~)))
  ::  ensure nonce is added to open-describes set
  ;<  *  bind:m  (ex-equal !>(open-describes) !>((sy [nonce] ~)))
  ::  ensure stable-id has an entry for the token
  ;<  *  bind:m  (ex-equal !>(stable-id) !>((my [token nonce] ~)))
  ::  simulate the bait provider returning the new metadata
  ;<  bw=bowl  bind:m  get-bowl
  =/  real-token  (shax (jam [dap eny.bw]))
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(src civ)))
  ;<  *  bind:m  (do-poke %reel-confirmation !>([nonce real-token]))
  ;<  state=vase  bind:m  get-save
  =+  !<(reel-state state)
  ;<  *  bind:m  (ex-equal !>(open-describes) !>(~))
  ;<  *  bind:m  (ex-equal !>(stable-id) !>((sy [token real-token] ~)))
  (ex-equal !>(our-metadata) !>((my [real-token edited-md] ~)))
::
::  testing old way of distributing links from requester side
++  test-reel-token-link-requester
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap reel-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev, now *@da)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  request-path  /token-link/(scot %p ~bus)/[dap]
  ::  simulate subscription from frontend for link
  ;<  caz=(list card)  bind:m
    (do-watch request-path)
  =/  next  (add now.bw ~h1)
  =/  expire=wire  /expire/(scot %p ~bus)/[dap]
  ;<  *  bind:m
    %+  ex-cards  caz
    =/  =cage  reel-want-token-link+!>(dap)
    :~  (ex-poke request-path [~bus dap] cage)
        (ex-arvo expire %b %wait next)
    ==
  ;<  state=vase  bind:m  get-save
  =+  !<(reel-state state)
  =/  new-requests  (sy [~bus dap] ~)
  ::  ensure that the request is in the open-link-requests set
  ;<  *  bind:m  (ex-equal !>(open-link-requests) !>(new-requests))
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(now next)))
  ;<  bw=bowl  bind:m  get-bowl
  ::  simulate link request expiring
  ;<  *  bind:m  (do-arvo expire %behn %wake ~)
  ;<  state=vase  bind:m  get-save
  =+  !<(reel-state state)
  ::  make sure the request is removed from the open-link-requests set
  ;<  *  bind:m  (ex-equal !>(open-link-requests) !>(~))
  ::  try to get the link again, but this time not expiring
  ;<  *  bind:m  (do-watch request-path)
  =/  url  (cat 3 vic '~bus/reel-test')
  =/  response  `[dap url]
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(src ~bus)))
  ;<  caz=(list card)  bind:m  (do-poke %reel-give-token-link !>(response))
  %+  ex-cards  caz
  ~[(ex-fact ~[request-path] %json !>(s+url))]
::
::  testing old way of distributing links from dispenser side
++  test-reel-token-link-dispenser
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap reel-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~bus, src ~bus)))
  ::  build state for link
  =/  fields=(map cord cord)  (my ['inviter' '~zod'] ~)
  =/  init-state=vase
    !>
    :*  %4
        vic
        civ
        (my [token %meta fields] ~)
        ~
        ~
        (my [token token] ~)
    ==
  ;<  *  bind:m  (do-load reel-agent `init-state)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(src ~zod)))
  ::  simulate link request
  ;<  caz=(list card)  bind:m  (do-poke %reel-want-token-link !>(token))
  %+  ex-cards  caz
  =/  url  (cat 3 vic '~bus/reel-test')
  =/  =cage  reel-give-token-link+!>(`[token url])
  ~[(ex-poke /token-link-want/[token] [~zod dap] cage)]
--