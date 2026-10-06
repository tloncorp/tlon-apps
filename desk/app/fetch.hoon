::  fetch: retrieve third-party web content on the client's behalf
::
::    serves an api endpoint at /apps/groups/~/fetch, with the mode in the
::    path, and the target as an @uw-encoded url string:
::
::      /apps/groups/~/fetch/meta/[@uw-url]  metadata parsed from the page
::      /apps/groups/~/fetch/raw/[@uw-url]   the response, mostly as-is
::
::    both modes exist for the same reason: a browser cannot make these
::    requests itself, because the target does not send CORS headers. the
::    ship fetches on the client's behalf and hands back either distilled
::    metadata or the raw response.
::
::    %meta issues its own HEAD (escalating to GET for html) and parses the
::    body; see /lib/metagrab for what it pulls out of it. results are
::    cached, and redirects are resolved here rather than by iris, so that
::    we can detect loops -- see the proof above +on-poke.
::
::    %raw forwards the inbound request's method, headers (minus cookies)
::    and body to the target, and relays the response back. it is not
::    cached: callers get exactly one upstream request per inbound one.
::
::    this agent is NOT the outbound half of the hook layer, and the two
::    should not be merged later. that path talks to *our own* services,
::    authenticates with a per-ship credential, and needs a retry queue and
::    idempotency keys. this one talks to arbitrary untrusted urls, carries
::    no credential, and needs an address guard instead. opposite problems.
::
::    supersedes %metagrab and %dumb-proxy. their old endpoints are still
::    bound here so that clients which have not moved over keep working;
::    those two bindings can go once no client uses them.
::
/+  de-html, mg=metagrab, hutils=http-utils,
    logs, dbug, verb
::
|%
+$  card  card:agent:gall
::
::  $mode: what the caller wants back
::
::    .meta: metadata parsed out of the page
::    .raw:  the upstream response, relayed
::
+$  mode  ?(%meta %raw)
::
::  $target: a mode and the url it applies to
::
::    the same url means different things in different modes, so the cache
::    and the pending-request map are keyed by both.
::
+$  target  [=mode url=@t]
::
+$  state-0
  $:  %0
      cache=(map target response)  ::  cached results (%meta only)
      await=(jug target @ta)       ::  pending, w/ response targets
      trail=(jug @t @t)            ::  redirection trail for policy
  ==
::
+$  result
  $%  [%200 dat=data]
      [%300 nex=(unit @t)]
      [%400 bod=(unit @t)]
      [%500 bod=(unit @t)]
      [%bad err=@t]  ::  internal error on our end
  ==
::
+$  data
  $%  [%page meta=(jar @t entry:mg)]
      [%file mime=@t size=(unit @ud)]
  ==
::
+$  response
  $:  wen=@da
      wat=result
  ==
::
++  cache-time  ~m5
++  user-agent  'chrome/123.0.0.0'  ::  fallback user-agent string
::  +max-relay: cap on a %raw response body we will relay
::
::    iris hands us the whole body at once, so this cannot stop the ship
::    from *fetching* something huge -- it only stops us relaying it back
::    into eyre. a streaming cap would need runtime support we don't have.
::
++  max-relay  ^~((bex 22))  ::  4MiB
::
::  +private-ip: is this v4 address one we refuse to fetch from?
::
++  private-ip
  |=  ip=@if
  ^-  ?
  =/  a  (cut 3 [3 1] ip)
  =/  b  (cut 3 [2 1] ip)
  ?|  =(0 a)                              ::  0.0.0.0/8
      =(10 a)                             ::  10.0.0.0/8
      =(127 a)                            ::  loopback
      &(=(169 a) =(254 b))                ::  link-local
      &(=(172 a) &((gte b 16) (lte b 31)))  ::  172.16.0.0/12
      &(=(192 a) =(168 b))                ::  192.168.0.0/16
  ==
::
::  +hop-by-hop: headers that describe a single connection, not the payload
::
::    these must not be forwarded in either direction. relaying upstream's
::    transfer-encoding or content-length in particular breaks the response:
::    eyre frames the body itself from the octs we hand it, so an inherited
::    framing header makes the client wait for data that never arrives in
::    that shape, and the body is dropped. (%dumb-proxy relayed headers
::    verbatim and had this bug; nothing ever called it, so nobody saw it.)
::
++  hop-by-hop
  ^~
  %-  ~(gas in *(set @t))
  :~  'connection'
      'keep-alive'
      'transfer-encoding'
      'te'
      'trailer'
      'upgrade'
      'proxy-authenticate'
      'proxy-authorization'
      'content-length'
  ==
::
::  +strip-hops: drop hop-by-hop headers, case-insensitively
::
::    besides the fixed set, any header a connection header names is
::    connection-scoped too, and must not be relayed (rfc 9110, 7.6.1).
::
++  strip-hops
  |=  hes=header-list:http
  ^-  header-list:http
  =/  drop=(set @t)
    %-  ~(gas in hop-by-hop)
    %-  zing
    %+  turn  hes
    |=  [key=@t val=@t]
    ?.  =('connection' (crip (cass (trip key))))  ~
    (connection-names val)
  %+  skip  hes
  |=  [key=@t val=@t]
  (~(has in drop) (crip (cass (trip key))))
::
::  +origin-scoped: response headers that would act on *our* origin
::
::    a relayed response is served from the ship, so the browser applies
::    these to the ship's own origin: an upstream set-cookie could
::    overwrite the session cookie, and clear-site-data could wipe it.
::
++  origin-scoped
  ^~
  (~(gas in *(set @t)) ~['set-cookie' 'set-cookie2' 'clear-site-data'])
::
::  +connection-names: the field names a connection header lists,
::  lowercased, ignoring whitespace and empty entries
::
++  connection-names
  |=  val=@t
  ^-  (list @t)
  =|  [cur=tape out=(list @t)]
  =/  t=tape  (cass (trip val))
  |-
  ?~  t
    (flop ?~(cur out [(crip (flop cur)) out]))
  ?:  =(',' i.t)
    $(t t.t, cur ~, out ?~(cur out [(crip (flop cur)) out]))
  ?:  |(=(' ' i.t) =('\09' i.t))
    $(t t.t)
  $(t t.t, cur [i.t cur])
::
::  +unsafe-target: why we refuse to fetch this url, if we do
::
::    this blocks the obvious server-side request forgery shapes: an ip
::    literal in private space, and a hostname in a local-only tld. it
::    cannot stop a public hostname that *resolves* to a private address,
::    because resolution happens in the runtime and we never see the
::    result. treat this as raising the floor, not as a boundary.
::
++  unsafe-target
  |=  url=@t
  ^-  (unit @t)
  ?~  pur=(de-purl:html url)
    `'target not parseable'
  =/  hos  r.p.u.pur
  ?-  -.hos
      %|
    ?.  (private-ip p.hos)  ~
    `'target resolves to a private address'
  ::
      %&
    ?~  dom=p.hos  `'target has no host'
    ::  a $turf is stored tld-first, so the head is the tld
    ::
    ?.  ?|  =('localhost' i.dom)
            =('internal' i.dom)
            =('local' i.dom)
        ==
      ~
    `'target is a local-only host'
  ==
::
++  give-response
  |=  [ids=(set @ta) response]
  ^-  (list card)
  %-  zing
  %+  turn  ~(tap in ids)
  |=  id=@ta
  %+  spout:hutils  id
  :-  [?:(?=(%bad -.wat) 500 200) ['content-type' 'application/json']~]
  %-  some
  %-  as-octs:mimes:html
  %-  en:json:html
  =,  enjs:format
  ?:  ?=(%bad -.wat)
    (pairs 'error'^s+err.wat ~)
  %-  pairs
  ^-  (list [@t json])
  :~  'fetched_at'^(time wen)
      'status'^(numb -.wat)
    ::
      :-  'result'
      ?-  -.wat
        %300  ?~(nex.wat ~ s+u.nex.wat)
        %400  ?~(bod.wat ~ s+u.bod.wat)
        %500  ?~(bod.wat ~ s+u.bod.wat)
      ::
          %200
        %-  pairs
        ?-  -.dat.wat
            %file
          :~  'type'^s+'file'
              'mime'^s+mime.dat.wat
              'size'^?~(size.dat.wat ~ (numb u.size.dat.wat))
          ==
        ::
            %page
          :-  'type'^s+'page'
          %+  turn  ~(tap by meta.dat.wat)
          |=  [buc=@t tos=(list entry:mg)]
          ^-  [@t json]
          :-  buc
          :-  %a
          %+  turn  tos
          |=  entry:mg
          %-  pairs
          :*  'namespace'^s+ns
              'key'^s+key
              'value'^s+?@(val val top.val)
            ::
              ?@  val  ~
              |-  ^-  (list [@t json])
              :_  ~
              :-  'attributes'
              %-  pairs
              %+  turn  ~(tap by met.val)
              |=  [key=@t val=value:mg]
              :-  key
              ?@  val  s+val
              (pairs 'value'^s+top.val ^$(val val))
          ==
        ==
      ==
  ==
::
::  +fetch: issue a %meta request
::
++  fetch
  |=  [met=?(%head %get) url=@t hes=header-list:http]
  ^-  card
  =.  hes  [['accept' '*/*'] hes]
  =/  =request:http
    [?-(met %head %'HEAD', %get %'GET') url hes ~]
  ::TODO  would we be fine with iris handling redirects for us?
  [%pass /meta/(scot %t url)/(crip ~(rend co %blob hes))/[met] %arvo %i %request request redirects=0 retries=3]
::
::  +relay: issue a %raw request, forwarding the caller's own request
::
++  relay
  |=  [for=@ta secure=? url=@t =request:http]
  ^-  card
  =.  url.request  url
  =.  header-list.request
    ::  drop cookies from the original request, don't want to leak these,
    ::  and drop the caller's host header -- it names *us*, not the target.
    ::
    %+  skip  header-list.request
    |=  [key=@t @t]
    =/  key  (crip (cass (trip key)))
    |(=('cookie' key) =('host' key))
  =.  header-list.request  (strip-hops header-list.request)
  =.  header-list.request
    =-  (set-header:http 'forwarded' - header-list.request)
    ::NOTE  we intentionally don't include the originating ip address
    %+  rap  3
    :~  'for="tm-fetch";'
        'proto='  ?:(secure 'https' 'http')
    ==
  ::  iris follows 301/303/307 itself while redirects remain, without our
  ::  +unsafe-target check, so a public url could redirect us into private
  ::  space. relay the redirect to the caller instead. outbound-config has
  ::  no timeout, so we cannot set one.
  [%pass /raw/[for]/(scot %t url) %arvo %i %request request redirects=0 retries=3]
::
++  extract-data
  |=  $:  url=@t
          [response-header:http dat=(unit mime-data:iris)]
      ==
  ^-  [report=? result]
  =*  cod  status-code
  ::  redirects
  ::
  ?:  &((gte cod 300) (lth cod 400))
    [| %300 (get-header:http 'location' headers)]
  ::  error responses
  ::
  ?:  &((gte cod 400) (lth cod 600))
    :-  |
    ::TODO  extract message from response body somehow?
    ?:  (gte cod 500)
      [%500 ?~(dat `(scot %ud cod) `q.data.u.dat)]
    ::  experimental bot-protection detection, which the client may
    ::  want to know about so it can retry in a more advanced way.
    ::
    :-  %400
    ?:  ?|  ::  datadome header
            ::
            =(`'protected' (get-header:http 'x-datadome' headers))
            ::  captcha service in response body
            ::
            &(?=(^ dat) ?=(^ (find "captcha-delivery.com" (trip q.data.u.dat))))
        ==
      `'possibly-blocked'
    `(scot %ud cod)
  ::  miscellaneous
  ::
  ?:  |((lth cod 200) (gte cod 600))
    [& %bad (cat 3 'strange status code ' (scot %ud cod))]
  =/  content-type=@t
    ?^  dat  type.u.dat
    (fall (get-header:http 'content-type' headers) 'unknown')
  ::  non-html
  ::
  ?.  =('text/html' (end 3^9 content-type))
    =;  size=(unit @ud)
      [| %200 %file content-type size]
    %+  biff
      (get-header:http 'content-length' headers)
    (curr rush dum:ag)
  ?~  dat
    [| %bad 'no response body']
  ::  extract the head section
  ::
  =/  head=(unit @t)
    %-  (extract:de-html "head" %outer)
    (trip q.data.u.dat)
  ::  try parsing it into an ast
  ::
  =/  heax=(unit manx)
    (biff head de-html)
  ::  report this url if it failed to parse
  ::
  :-  ?=(~ heax)
  ^-  result
  ::  turn whatever we got into page metadata
  ::
  =/  meta=(jar @t entry:mg)
    =-  (fall - ~)
    %+  bind
      %+  bind
        (biff heax search-head:mg)
      (cury expand-urls:mg url)
    %-  bucketize:mg
    %-  ~(gas ju *(jug @t path))
    ::  the properties that we care about and the buckets that they go into
    ::
    :~  :-  'title'        /'_title'/title
        :-  'title'        /og/title
        :-  'title'        /twitter/title
      ::
        :-  'description'  //description
        :-  'description'  /og/description
        :-  'description'  /twitter/description
      ::
        :-  'site_name'    //application-name
        :-  'site_name'    /og/'site_name'
      ::
        :-  'image'        /og/image
        :-  'image'        /twitter/image
        :-  'image'        /'_link'/'image_src'
      ::
        :-  'site_icon'    /'_link'/apple-touch-icon
        :-  'site_icon'    /'_link'/apple-touch-icon-precomposed
        :-  'site_icon'    /'_link'/icon
    ==
  ::  drop the "misc" bucket
  ::
  =.  meta  (~(del by meta) %$)
  ::  if we're lacking title or site_name,
  ::  best-effort get them from the raw response,
  ::  or the url if we really must
  ::
  =?  meta  ?=(~ (~(get ja meta) 'title'))
    %+  ~(add ja meta)  'title'
    =;  title=(unit @t)
      ?~  title  ['_' 'title' url]
      ['_title' 'title' u.title]
    %-  (extract:de-html "title" %inner)
    (trip ?^(head u.head q.data.u.dat))
  =?  meta  ?=(~ (~(get ja meta) 'site_name'))
    %+  ~(add ja meta)  'site_name'
    =;  site-name=@t
      ['_' 'site_name' site-name]
    =+  pur=(need (de-purl:html url))
    ?-  -.r.p.pur
      %&  (en-turf:html p.r.p.pur)
      %|  (rsh 3^1 (scot %if p.r.p.pur))
    ==
  ::
  [%200 %page meta]
::
++  l
  |_  [=bowl:gall url=(unit @t)]
  ++  fail
    |=  [vol=volume:logs =echo:logs =tang]
    %-  link
    (~(fail logs bowl /logs) vol echo tang deez)
  ::
  ++  tell
    |=  [=volume:logs =echo:logs]
    %-  link
    (~(tell logs bowl /logs) volume echo deez)
  ::
  ++  deez
    ^-  (list [@t json])
    :-  %flow^s+'web fetch'
    =;  l=(list (unit [@t json]))
      (murn l same)
    :~  ?~(url ~ `[%url s+u.url])
    ==
  ::
  ++  link
    |=  cad=card
    |*  [caz=(list card) etc=*]
    [[cad caz] etc]
  --
--
::
=|  state-0
=*  state  -
::
=+  log=l
::
%^  verb  |  %warn
%-  agent:dbug
::
^-  agent:gall
|_  =bowl:gall
+*  this  .
    l     log(bowl bowl)
::
++  on-save  !>(state)
::
++  on-init
  ^-  (quip card _this)
  :_  this
  ::  the two legacy bindings keep %metagrab's and %dumb-proxy's endpoints
  ::  working for clients that have not moved to /fetch yet.
  ::
  :~  [%pass /eyre/bind/fetch %arvo %e %connect [~ /apps/groups/~/fetch] dap.bowl]
      [%pass /eyre/bind/metagrab %arvo %e %connect [~ /apps/groups/~/metagrab] dap.bowl]
      [%pass /eyre/bind/proxy %arvo %e %connect [~ /apps/groups/~/proxy] dap.bowl]
  ==
::
++  on-load
  |=  ole=vase
  ^-  (quip card _this)
  =+  old=!<(state-0 ole)
  =.  state  old
  ::  the cache is disposable; drop it rather than reason about staleness
  ::  across an upgrade.
  ::
  =.  cache  ~
  =.  trail  ~
  [~ this]
::  +on-poke
::
::      redirection loop detection
::
::    guarding against infinite loops careful
::    accounting of invariants in two different places:
::    at the request call site in +on-poke, and in resolution
::    handling in +on-arvo. a much better way to structure the code
::    would be no doubt to implement it in io-style available in
::    threads. for other reasons that is not possible presently.
::
::    to keep track of redirection trail, we record the origin url
::    in a header that is then preserved across requests. each time a
::    redirection is resolved, we add the url to the corresponding trail.
::
::    we prove that no loop can occur from a handful of statements
::    which are marked in relevant portions of the code.
::
::    [trail 1]: every request to be resolved is a beginning of a new
::               trail.
::    [trail 2]: when the request is finalized its trail is removed.
::    [trail 3]: when a request resolves back to the trail, forming a
::               loop, we detect it and return an error.
::    [trail 4]: when we exceed maximum number of redirections, we
::               we detect it and return an error.
::    [trail 5]: if a redirection loop occured the last cached url
::               is removed.
::    [trail 6]: if a redirection limit is exceeded the last cached url
::               is removed.
::
::    a loop can occur in three distinct ways:
::    1. in +on-poke cached redirection resolution
::    2. in +on-arvo cached redirection resolution
::    3. asynchronously, by following redirections indefinitely
::
::    we now prove that 1-3 from our statements. suppose we
::    resolved through a -> b -> c ..., with the chain exceeding our
::    maximum redirection limit. by trail (4) we terminate and return an
::    error, ruling out (3).
::
::    supposed we have followed through a cache of a -> b -> c in
::    +on-arvo, while c resolved back to a. by trail (3) we detect this case
::    and return an error. this rules out (2).
::
::    now suppose there is a loop in the cache b ->..-> b. how
::    could we arrive at this state? if we had followed in a single
::    trail, this would be detected and removed from cache. this means a
::    loop must have been constructed from two separate trails. first we
::    had b -> ... -> a in the cache, then a separate trail inserted
::    a -> ... -> b without following through the already cached path, thus
::    evading detection. this would only be possible if the second trail
::    exceeded maximum number of requests while resolving b. however,
::    we protect against this by removing the last cached request when
::    the limit is exceeded.
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?>  =(our src):bowl
  ?+  mark  ~|([%strange-mark mark=mark] !!)
      %noun
    =+  url=!<(@t vase)
    ?>  ?=(^ (de-purl:html url))
    ?^  why=(unsafe-target url)  ~|([%unsafe-target u.why] !!)
    [[(fetch %head url ['user-agent' user-agent]~) ~] this]
  ::
      %handle-http-request
    =+  !<(order:hutils vase)
    =+  (purse:hutils url.request)
    ?.  ?=([%apps %groups %~.~ *] site)
      :_  this
      %^  spout:hutils  id
        [404 ~]
      `(as-octs:mimes:html (cat 3 'bad route into ' dap.bowl))
    =/  site  t.t.t.site  ::  tmi
    ::  resolve the endpoint into a $mode and the raw target string.
    ::  /metagrab and /proxy are the pre-%fetch endpoints, kept alive
    ::  until no client uses them.
    ::
    =/  route=(unit [=mode raw=@ta])
      ?+  site  ~
        [%fetch %meta @ ~]  `[%meta i.t.t.site]
        [%fetch %raw @ ~]   `[%raw i.t.t.site]
        [%metagrab @ ~]     `[%meta i.t.site]
        [%proxy @ ~]        `[%raw i.t.site]
      ==
    ?~  route
      [(spout:hutils id [404 ~] `(as-octs:mimes:html 'bad path')) this]
    =/  mod  mode.u.route
    =|  msg=@t
    =*  bad-req
      %-  (tell:l %warn msg url.request ~)
      [(spout:hutils id [400 ~] `(as-octs:mimes:html msg)) this]
    ?~  target=(slaw %uw raw.u.route)
      =.  msg  'target not @uw'
      bad-req
    ::  refuse targets we should not be reaching at all, in either mode
    ::
    ?^  why=(unsafe-target u.target)
      =.  msg  u.why
      bad-req
    ?:  ?=(%raw mod)
      [[(relay id secure u.target request)]~ this]
    ::TODO  special-case x.com/twitter.com links
    ::TODO  deduplicate with +on-arvo somehow?
    |-
    ::  a cached redirect must not be a way around the address guard
    ::
    ?^  why=(unsafe-target u.target)
      =.  msg  u.why
      bad-req
    ::  if we already started a fetch, simply await the result
    ::
    ?:  (~(has by await) [%meta u.target])
      =.  await  (~(put ju await) [%meta u.target] id)
      [~ this]
    ::  we aren't currently fetching it, but maybe we have a cache entry
    ::
    =/  entry  (~(get by cache) [%meta u.target])
    ?:  ?|  ?=(~ entry)
            (gth (sub now.bowl wen.u.entry) cache-time)
        ==
      ::  no valid cache entry for this target, start a new fetch
      ::
      =.  await  (~(put ju await) [%meta u.target] id)
      ::  [trail 1] every request to be resolved is a beginning of a
      ::            new trail.
      =.  trail  (~(put ju trail) u.target u.target)
      =;  hes=(list (unit [@t @t]))
        [[(fetch %head u.target (murn hes same)) ~] this]
      =*  hl  header-list.request
      :~  ::  pass on the user-agent string from the original request,
          ::  in an attempt to evade some over-aggresive bot protections
          ::
          %-  some
          :-  'user-agent'
          (fall (get-header:http 'user-agent' hl) user-agent)
        ::
          ::  include the original accept-language header in case the
          ::  target supports translations
          ::
          =-  (bind - (lead 'accept-language'))
          (get-header:http 'accept-language' hl)
      ==
    ::  we have a valid cache entry.
    ::  if it's a redirect where we know the next target,
    ::  and can make a request to that,
    ::  retry with that url as the target.
    ::
    ?:  ?&  ?=([%300 ~ @] wat.u.entry)
            ?=(^ (de-purl:html u.nex.wat.u.entry))
        ==
      $(u.target u.nex.wat.u.entry)
    ::  otherwise, simply serve the response from cache
    ::
    [(give-response [id ~ ~] u.entry) this]
  ==
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  =-  -(log ^l)  ::  reset any .log deets we might've set
  ^-  (quip card _this)
  ~|  [%on-arvo wire=wire sign=+<.sign]
  ?+  wire  ~|(%strange-sign-arvo !!)
      [%eyre %bind @ ~]
    ?>  ?=(%bound +<.sign)
    ?:  accepted.sign  [~ this]
    %-  (tell:l %error 'failed to eyre-bind' i.t.t.wire ~)
    %-  (slog dap.bowl 'failed to eyre-bind' ~)
    [~ this]
  ::
  ::  %raw: relay the upstream response straight back to the caller
  ::
      [%raw @ @ ~]
    =/  eid=@ta  i.t.wire
    =/  url=@t   (slav %t i.t.t.wire)
    =.  url.log  `url
    ?>  ?=([%iris %http-response *] sign)
    =*  res  client-response.sign
    ::  %progress responses are unexpected, the runtime doesn't support them
    ::  right now. if they occur, just treat them as cancels.
    ::
    %-  ?.  ?=(%progress -.res)  same
        (tell:l %warn 'strange iris %progress response' ~)
    =?  res  ?=(%progress -.res)
      ~&  [dap.bowl %strange-iris-progress-response]
      [%cancel ~]
    ::  we might get a %cancel if the runtime was restarted during our
    ::  request.
    ::
    ?:  ?=(%cancel -.res)
      :_  this
      %+  spout:hutils  eid
      :-  [502 'x-tlon-fetch'^'cancelled' ~]
      ~
    ::
    ?>  ?=(%finished -.res)
    ::  refuse to relay a body larger than we are willing to buffer
    ::
    ?:  ?&  ?=(^ full-file.res)
            (gth p.data.u.full-file.res max-relay)
        ==
      %-  (tell:l %warn 'oversized raw response' url ~)
      :_  this
      %+  spout:hutils  eid
      :-  [502 'x-tlon-fetch'^'too-large' ~]
      ~
    :_  this
    %+  spout:hutils  eid
    :-  =,  response-header.res
        :-  status-code
        %+  snoc
          %+  skip  (strip-hops headers)
          |=([key=@t @t] (~(has in origin-scoped) (crip (cass (trip key)))))
        'x-tlon-fetch'^'finished'
    ?~  full-file.res  ~
    `data.u.full-file.res
  ::
  ::  %meta: resolve redirects ourselves, then parse
  ::
      [%meta @ @ ?(%head %get) ~]
    =/  url=@t   (slav %t i.t.wire)
    =.  url.log  `url
    =/  hes=header-list:http
      ?~  coin=(rush i.t.t.wire nuck:so)  ~
      ?:  ?=([%$ %t @] u.coin)  ['user-agent' q.p.u.coin]~  ::  legacy
      ?.  ?=(%blob -.u.coin)    ~
      (fall ((soft header-list:http) p.u.coin) ~)
    =/  met      i.t.t.t.wire
    ?>  ?=([%iris %http-response *] sign)
    =*  res  client-response.sign
    ::  if we have followed url from a redirection, the original url
    ::  had been preserved in headers. otherwise we need to set it.
    ::
    =^  orig-url=@t  hes
      ?~  hel=(get-header:http 'original-url' hes)
        :-  url
        [['original-url' url] hes]
      [u.hel hes]
    ::  [trail 2] when the request is finalized its trail is removed.
    ::
    =*  finalize
      %=  this
        await  (~(del by await) [%meta url])
        trail  (~(del by trail) orig-url)
      ==
    ::  %progress responses are unexpected, the runtime doesn't support them
    ::  right now. if they occur, just treat them as cancels and retry.
    ::
    %-  ?.  ?=(%progress -.res)  same
        (tell:l %warn 'strange iris %progress response' ~)
    =?  res  ?=(%progress -.res)
      ~&  [dap.bowl %strange-iris-progress-response]
      [%cancel ~]
    ::  we might get a %cancel if the runtime was restarted during our
    ::  request. it's unlikely but possible that we are somehow the cause
    ::  of the runtime restart. in an abundance of caution, drop the request.
    ::  (inbound requests _should_ have gotten closed during restart, anyway.)
    ::
    ?:  ?=(%cancel -.res)
      :-  (give-response (~(get ju await) [%meta url]) now.bowl %bad 'cancelled')
      finalize
    ::
    ?>  ?=(%finished -.res)
    =*  cod  status-code.response-header.res
    ?.  &((gte cod 300) (lth cod 400))
      ::  if this was a head request,
      ::  and the response would be an html page,
      ::  fetch it in full
      ::
      ?:  ?&  ?=(%head met)
            ::
              .=  `'text/html'
              %+  bind
                (get-header:http 'content-type' headers.response-header.res)
              (cury end 3^9)
          ==
        [[(fetch %get url hes) ~] this]
      ::  otherwise, this is the most we'll fetch, now process the data
      ::
      =/  [report=? =result]
        (extract-data url [response-header full-file]:res)
      %-  ?.  report  same
          (tell:l %warn 'failed to parse' url ~)
      =.  cache  (~(put by cache) [%meta url] now.bowl result)
      :-  (give-response (~(get ju await) [%meta url]) now.bowl result)
      finalize
    ::  handle redirects specially
    ::
    =/  nex=(unit @t)
      (get-header:http 'location' headers.response-header.res)
    ::  the location value could be relative, make sure to resolve it first
    ::
    =?  nex    ?=(^ nex)  `(expand-url:mg url u.nex)
    ::  a redirect must not be a way around the address guard. check before
    ::  caching it: a cached redirect is followed without a new request.
    ::
    =/  bad=(unit [to=@t why=@t])
      ?~  nex  ~
      (bind (unsafe-target u.nex) (lead u.nex))
    ?^  bad
      %-  (tell:l %warn 'unsafe redirect' to.u.bad ~)
      :-  (give-response (~(get ju await) [%meta url]) now.bowl %500 `why.u.bad)
      finalize
    =.  cache  (~(put by cache) [%meta url] now.bowl %300 nex)
    ?~  nex
      :-  (give-response (~(get ju await) [%meta url]) now.bowl %300 ~)
      finalize
    ?~  (de-purl:html u.nex)
      %-  (tell:l %warn 'unparsable redirect' u.nex ~)
      :-  (give-response (~(get ju await) [%meta url]) now.bowl %300 nex)
      finalize
    ::TODO  deduplicate with %handle-http-request somehow?
    ::
    ::  in the loop .url points to the redirection source url.
    ::
    =*  max-redir  10
    |-  ^-  (quip card _this)
    ::  cached hops are followed without a request, so guard each one, and
    ::  drop the cache entry that pointed at a refused target.
    ::
    ?^  why=(unsafe-target u.nex)
      %-  (tell:l %warn 'unsafe redirect' u.nex ~)
      :-  (give-response (~(get ju await) [%meta url]) now.bowl %500 `u.why)
      =.  this  finalize
      this(cache (~(del by cache) [%meta url]))
    ?:  (~(has ju trail) orig-url u.nex)
      ::  [trail 3]: when a request resolves back to the trail, forming a
      ::             loop, we detect it and return an error.
      ::
      %-  (tell:l %warn 'redirection loop' orig-url u.nex ~)
      :-  (give-response (~(get ju await) [%meta url]) now.bowl %500 `'redirection loop')
      =.  this  finalize
      this(cache (~(del by cache) [%meta url]))
    ?:  (gth ~(wyt in (~(get ju trail) orig-url)) max-redir)
      %-  (tell:l %warn 'max redirections exceeded' orig-url u.nex ~)
      :-  (give-response (~(get ju await) [%meta url]) now.bowl %500 `'max redirections exceeded')
      =.  this  finalize
      ::  important: protect against cache poisoning due to
      ::  two separate trails forming a loop.
      ::
      this(cache (~(del by cache) [%meta url]))
    ::  move awaiters over to the next target
    ::
    =.  await
      %-  ~(gas ju await)
      (turn ~(tap in (~(get ju await) [%meta url])) (lead [%meta u.nex]))
    =?  await  !=(u.nex url)  (~(del by await) [%meta url])
    ::  check the cache for the target
    ::
    =/  entry  (~(get by cache) [%meta u.nex])
    ?:  ?|  ?=(~ entry)
            (gth (sub now.bowl wen.u.entry) cache-time)
        ==
      ::  no valid cache entry, start a new fetch
      ::
      =.  trail  (~(put ju trail) orig-url u.nex)
      [[(fetch %head u.nex hes)]~ this]
    ::  we have a valid cache entry.
    ::  if it's a redirect where we know the next target,
    ::  and can make a request to that,
    ::  retry with that url as the target.
    ::
    ?:  ?&  ?=([%300 ~ @] wat.u.entry)
            ?=(^ (de-purl:html u.nex.wat.u.entry))
        ==
      %=  $
        url    u.nex
        u.nex  u.nex.wat.u.entry
        trail  (~(put ju trail) orig-url u.nex)
      ==
    ::  otherwise, serve the response from cache
    ::
    :-  (give-response (~(get ju await) [%meta u.nex]) u.entry)
    %=  this
      await  (~(del by await) [%meta u.nex])
      trail  (~(del by trail) orig-url)  ::  [trail 2]
    ==
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?>  =(our src):bowl
  ?>  ?=([%http-response @ ~] path)
  [~ this]
::
++  on-leave
  |=  =path
  ^-  (quip card _this)
  [~ this]
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ?:  =(/logs wire)  [~ this]
  %-  (tell:l %error 'unexpected on-agent' (spat wire) -.sign ~)
  [~ this]
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ::TODO  support scrying out results
  ~
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  :_  this
  [(~(on-fail logs bowl /logs) term tang)]~
--
