::  metagrab: fetch opengraph and other metadata from url
::
::    serves an api endpoint at /apps/groups/~/metagrab,
::    to which you can make requests at /[@uw-encoded-url-string],
::    which will trigger this agent to fetch that target url,
::    and respond with the metadata it parses from it.
::
::    for details on what it parses out of url response bodies,
::    see /lib/metagrab.
::
/+  de-html, mg=metagrab, hutils=http-utils,
    logs, dbug, verb
::
|%
+$  card  card:agent:gall
::
+$  state-1
  $:  %1
      cache=(map @t response)  ::  cached results
      await=(jug @t @ta)       ::  pending, w/ response targets
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
++  fetch
  |=  [met=?(%head %get) url=@t hes=header-list:http]
  ^-  card
  =.  hes  [['accept' '*/*'] hes]
  =/  =request:http
    [?-(met %head %'HEAD', %get %'GET') url hes ~]
  ::TODO  would we be fine with iris handling redirects for us?
  [%pass /fetch/(scot %t url)/(crip ~(rend co %blob hes))/[met] %arvo %i %request request redirects=0 retries=3]
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
  |_  [our=@p url=(unit @t)]
  ++  fail
    ::TODO  maybe always slog the trace?
    |=  [desc=term trace=tang]
    %-  link
    (~(fail logs our /logs) desc trace deez)
  ::
  ++  tell
    |=  [=volume:logs =echo:logs]
    %-  link
    (~(tell logs our /logs) volume echo deez)
  ::
  ++  deez
    ^-  (list [@t json])
    :-  %flow^s+'link preview'
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
=|  state-1
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
    l     log(our our.bowl)
::
++  on-save  !>(state)
::
++  on-init
  ^-  (quip card _this)
  :_  this
  [%pass /eyre/bind %arvo %e %connect [~ /apps/groups/~/metagrab] dap.bowl]~
::
++  on-load
  |=  ole=vase
  |^  ^-  (quip card _this)
      =+  old=!<(state-any ole)
      =?  old  ?=(%0 -.old)  *state-1
      ?>  ?=(%1 -.old)
      =.  state  old
      =.  cache  ~
      [~ this]
  +$  state-any  $%([%0 *] state-1)
  --
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?>  =(our src):bowl
  ?+  mark  ~|([%strange-mark mark=mark] !!)
      %noun
    =+  url=!<(@t vase)
    ?>  ?=(^ (de-purl:html url))
    [[(fetch %head url ['user-agent' user-agent]~) ~] this]
  ::
      %handle-http-request
    =+  !<(order:hutils vase)
    =+  (purse:hutils url.request)
    ?.  ?=([%apps %groups %~.~ %metagrab *] site)
      :_  this
      %^  spout:hutils  id
        [404 ~]
      `(as-octs:mimes:html (cat 3 'bad route into ' dap.bowl))
    =/  site  t.t.t.t.site  ::  tmi
    ?+  site
      [(spout:hutils id [404 ~] `(as-octs:mimes:html 'bad path')) this]
    ::
        [@ ~]
      =|  msg=@t
      =*  bad-req
        %-  (tell:l %warn msg url.request ~)
        [(spout:hutils id [400 ~] `(as-octs:mimes:html msg)) this]
      ?~  target=(slaw %uw i.site)
        =.  msg  'target not @uw'
        bad-req
      ?~  (de-purl:html u.target)
        ::TODO  if parser fails, just dumb find <title> and extract
        =.  msg  'target not parseable'
        bad-req
      ::TODO  special-case x.com/twitter.com links
      ::TODO  deduplicate with +on-arvo somehow?
      |-
      ::  if we already started a fetch, simply await the result
      ::
      ?:  (~(has by await) u.target)
        =.  await  (~(put ju await) u.target id)
        [~ this]
      ::  we aren't currently fetching it, but maybe we have a cache entry
      ::
      =/  entry  (~(get by cache) u.target)
      ?:  ?|  ?=(~ entry)
              (gth (sub now.bowl wen.u.entry) cache-time)
          ==
        ::  no valid cache entry for this target, start a new fetch
        ::
        =.  await  (~(put ju await) u.target id)
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
  ==
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  =-  -(log ^l)  ::  reset any .log deets we might've set
  ^-  (quip card _this)
  ~|  [%on-arvo wire=wire sign=+<.sign]
  ?+  wire  ~|(%strange-sign-arvo !!)
      [%eyre %bind ~]
    ?>  ?=(%bound +<.sign)
    ?:  accepted.sign  [~ this]
    %-  (tell:l %crit 'failed to eyre-bind' ~)
    %-  (slog dap.bowl 'failed to eyre-bind' ~)
    [~ this]
  ::
      [%fetch @ @ ?(%head %get) ~]
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
      :-  (give-response (~(get ju await) url) now.bowl %bad 'cancelled')
      this(await (~(del by await) url))
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
      =.  cache  (~(put by cache) url now.bowl result)
      :-  (give-response (~(get ju await) url) now.bowl result)
      this(await (~(del by await) url))
    ::  handle redirects specially
    ::
    =/  nex=(unit @t)
      (get-header:http 'location' headers.response-header.res)
    ::  the location value could be relative, make sure to resolve it first
    ::
    =?  nex    ?=(^ nex)  `(expand-url:mg url u.nex)
    =.  cache  (~(put by cache) url now.bowl %300 nex)
    ?~  nex
      :-  (give-response (~(get ju await) url) now.bowl %300 ~)
      this(await (~(del by await) url))
    ?~  (de-purl:html u.nex)
      %-  (tell:l %warn 'unparsable redirect' u.nex ~)
      :-  (give-response (~(get ju await) url) now.bowl %300 nex)
      this(await (~(del by await) url))
    ::TODO  deduplicate with %handle-http-request somehow?
    |-  ^-  (quip card _this)
    ::  move awaiters over to the next target
    ::
    =.  await
      %-  ~(gas ju await)
      (turn ~(tap in (~(get ju await) url)) (lead u.nex))
    =.  await  (~(del by await) url)
    ::  check the cache for the target
    ::
    =/  entry  (~(get by cache) u.nex)
    ?:  ?|  ?=(~ entry)
            (gth (sub now.bowl wen.u.entry) cache-time)
        ==
      ::  no valid cache entry, start a new fetch
      ::
      [[(fetch %head u.nex hes)]~ this]
    ::TODO  detect redirect loops
    ::  we have a valid cache entry.
    ::  if it's a redirect where we know the next target,
    ::  and can make a request to that,
    ::  retry with that url as the target.
    ?:  ?&  ?=([%300 ~ @] wat.u.entry)
            ?=(^ (de-purl:html u.nex.wat.u.entry))
        ==
      $(u.nex u.nex.wat.u.entry)
    ::  otherwise, serve the response from cache
    ::
    [(give-response (~(get ju await) u.nex) u.entry) this]
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
  %-  (tell:l %crit 'unexpected on-agent' (spat wire) -.sign ~)
  ~&  [dap.bowl %unexpected-on-agent wire=wire]
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
  %-  (fail:l term tang)
  %-  (slog dap.bowl '+on-fail' term tang)
  [~ this]
--
