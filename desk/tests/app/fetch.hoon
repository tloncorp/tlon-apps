/+  *test-agent, test
/=  fetch-agent  /app/fetch
|%
++  dap  %fetch-test
++  safe  'https://example.com/'
++  lan   'http://192.168.1.1/'
::  +get: an inbound request for one of our endpoints
::
++  get
  |=  [id=@ta mode=@ta url=@t hes=header-list:http]
  ^-  cage
  =/  =request:http
    [%'GET' (rap 3 '/apps/groups/~/fetch/' mode '/' (scot %uw url) ~) hes ~]
  handle-http-request+!>([id `inbound-request:eyre`[& & ipv4+.127.0.0.1 request]])
::  +request-card: the one outbound request among a poke's cards
::
::    /lib/verb adds its own facts, so pick the request out by shape.
::
++  request-card
  |=  caz=(list card)
  ^-  [=wire =request:http]
  =/  reqs
    %+  murn  caz
    |=  car=card
    ?.  ?=([%pass * %arvo %i %request *] car)  ~
    `[p.car request.q.car]
  ?>  ?=([* ~] reqs)
  i.reqs
::  +finished: an iris response with no body
::
++  finished
  |=  [status=@ud hes=header-list:http]
  ^-  sign-arvo
  [%iris %http-response %finished [status hes] ~]
::  +status: the status code a response card sequence gives
::
++  status
  |=  caz=(list card)
  ^-  (unit @ud)
  |-
  ?~  caz  ~
  ?.  ?=([%give %fact * %http-response-header *] i.caz)  $(caz t.caz)
  `status-code:!<(response-header:http q.cage.p.i.caz)
::  +body: the response body a response card sequence gives, as text
::
++  body
  |=  caz=(list card)
  ^-  tape
  |-
  ?~  caz  ~
  ?.  ?=([%give %fact * %http-response-data *] i.caz)  $(caz t.caz)
  =+  !<(dat=(unit octs) q.cage.p.i.caz)
  ?~(dat ~ (trip q.u.dat))
::  +response-headers: the headers a response card sequence gives
::
++  response-headers
  |=  caz=(list card)
  ^-  header-list:http
  |-
  ?~  caz  ~
  ?.  ?=([%give %fact * %http-response-header *] i.caz)  $(caz t.caz)
  headers:!<(response-header:http q.cage.p.i.caz)
::  +test-unsafe-redirect-not-cached: a refused redirect stays refused
::
::  a safe target that redirects into private space is answered with a
::  500 result, and is not cached: asking again fetches the safe target anew
::  rather than following a cached redirect to the private one.
::
++  test-unsafe-redirect-not-cached
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~zod, src ~zod)))
  ;<  *  bind:m  (do-init dap fetch-agent)
  ;<  caz=(list card)  bind:m  (do-poke (get ~.e1 %meta safe ~))
  =/  out  (request-card caz)
  ;<  ~  bind:m  (ex-equal !>(url.request.out) !>(safe))
  ;<  caz=(list card)  bind:m  (do-arvo wire.out (finished 302 ['location' lan]~))
  ::  %meta reports the upstream outcome in the body, over a 200
  ::
  ;<  ~  bind:m  (ex-equal !>(?=(^ (find "\"status\":500" (body caz)))) !>(&))
  ;<  caz=(list card)  bind:m  (do-poke (get ~.e2 %meta safe ~))
  ;<  ~  bind:m  (ex-equal !>(url.request:(request-card caz)) !>(safe))
  ::  and a private target asked for directly is refused outright
  ::
  ;<  caz=(list card)  bind:m  (do-poke (get ~.e3 %meta lan ~))
  (ex-equal !>((status caz)) !>(`400))
::  +test-raw-strips-connection-names: connection-scoped headers stay put
::
::  headers a connection header names are hop-by-hop, in both directions,
::  along with the fixed set.
::
++  test-raw-strips-connection-names
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~zod, src ~zod)))
  ;<  *  bind:m  (do-init dap fetch-agent)
  =/  out=header-list:http
    :~  ['Connection' 'Keep-Alive, X-Hop']
        ['X-Hop' 'out']
        ['X-Keep' 'out']
    ==
  ;<  caz=(list card)  bind:m  (do-poke (get ~.e1 %raw safe out))
  =/  req  (request-card caz)
  =/  sent  (turn header-list.request.req head)
  ;<  ~  bind:m  (ex-equal !>((lien sent |=(k=@t =('X-Hop' k)))) !>(|))
  ;<  ~  bind:m  (ex-equal !>((lien sent |=(k=@t =('X-Keep' k)))) !>(&))
  =/  back=header-list:http
    :~  ['connection' 'x-upstream-hop']
        ['x-upstream-hop' 'in']
        ['content-length' '0']
        ['x-upstream-keep' 'in']
    ==
  ;<  caz=(list card)  bind:m  (do-arvo wire.req (finished 200 back))
  =/  got  (turn (response-headers caz) head)
  ;<  ~  bind:m  (ex-equal !>((lien got |=(k=@t =('x-upstream-hop' k)))) !>(|))
  ;<  ~  bind:m  (ex-equal !>((lien got |=(k=@t =('content-length' k)))) !>(|))
  (ex-equal !>((lien got |=(k=@t =('x-upstream-keep' k)))) !>(&))
--
