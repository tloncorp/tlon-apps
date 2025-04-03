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
    dbug, verb
::
|%
+$  card  card:agent:gall
::
+$  state-0
  $:  %0
      cache=(map @t [wen=@da wat=result])  ::  cached results
      await=(jug @t @ta)                   ::  pending, w/ response targets
      tmpca=(map @t @t)  ::TMP  head section cache
  ==
::
+$  result
  $%  [%200 dat=data]
      [%300 nex=@t]
      [%400 bod=(unit @t)]
      [%500 bod=(unit @t)]
  ==
::
+$  data  (list tope:mg)
::
+$  response
  $:  wen=@da
      wat=$<(%300 result)
  ==
::
++  cache-time  ~m5
::
++  give-response
  |=  [id=@ta response]
  ^-  (list card)
  ~&  %todo-give-response  ::TODO
  ~
  :: %+  spout  id
  :: :-  [200 ['content-type' 'application/json']~]
::
++  fetch
  |=  url=@t
  ^-  card
  =/  =request:http
    [%'GET' url ~ ~]
  ::NOTE  outbound-config is actually meaningless,
  ::      iris doesn't do anything with it at present...
  [%pass /fetch/(scot %t url) %arvo %i %request request *outbound-config:iris]
--
::
=|  state-0
=*  state  -
::
%+  verb  |
%-  agent:dbug
::
^-  agent:gall
|_  =bowl:gall
+*  this  .
++  on-save  !>(state)
::
++  on-init
  ^-  (quip card _this)
  :_  this
  [%pass /eyre/bind %arvo %e %connect [~ /apps/groups/~/metagrab] dap.bowl]~
::
++  on-load
  |=  ole=vase
  ^-  (quip card _this)
  =+  old=!<(state-0 ole)
  =.  state  old
  [~ this]
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  ~|([%strange-mark mark=mark] !!)
      %noun
    =+  url=!<(@t vase)
    ?>  ?=(^ (de-purl:html url))
    ::  if we already started a fetch, simply await the result
    ::
    ?:  (~(has by await) url)
      ~&  %already-waiting
      [~ this]
    ::  we aren't currently fetching it, but maybe we have a cache entry
    ::
    =/  entry  (~(get by cache) url)
    |-
    ?:  ?&  ?=(^ entry)
            (gth cache-time (sub now.bowl wen.u.entry))
        ==
      ?.  ?=(%300 -.wat.u.entry)
        ~&  >  response=u.entry
        [~ this]
      $(entry (~(get by cache) nex.wat.u.entry))
    [[(fetch url) ~] this]
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
        [%demo ~]
      :_  this
      %^  spout:hutils  id  [200 ~]
      %-  some
      %-  as-octt:mimes:html
      %-  en-xml:html
      ^-  manx
      ;html
        ;head
          ;title:"demo page"
          ;meta(charset "utf-8");
          ;style:"""
                 *\{font-family:monospace;}
                 table td, table td * \{vertical-align:top; padding:0.2em;}
                 td:first-child\{max-width:20em;}
                 tr:nth-child(even)\{background-color: rgba(0,0,0,0.05);}
                 """
        ==
        ;body
          ;table
            ;tr
              ;td:"url"
              ;td:"parse <head>"
              ;td:"titles"
              ;td:"descriptions"
              ;td:"images"
              ;td:"site names"
              ;td:"site icons"
              ;td:"full result"
            ==
            ;*  ~>  %bout.[0 'processing all heads']
            %+  turn  (sort ~(tap by tmpca) aor)
            :: %+  turn  ['https://www.wrecka.ge/bad-shape/?utm_source=Robin_Sloan_sent_me' (~(got by tmpca) 'https://www.wrecka.ge/bad-shape/?utm_source=Robin_Sloan_sent_me')]~
            |=  [url=@t hed=@t]
            ~>  %bout.[0 url]
            =/  hex=(unit manx)
              ~>  %bout.[0 (rap 3 '- parsing ' (crip ((d-co:co 6) (met 3 hed))) ' bytes' ~)]
              (de-html hed)
            =/  res=(unit (list tope:mg))
              ~>  %bout.[0 '- reparsing']
              ?~  hex  ~
              (search-head:mg(base-url `url) u.hex)
            =.  res  (bind res (cury expand-urls:mg url))
            ~?  >>>  ?=(~ hex)  [%miss url]
            =?  res  ?=(~ res)
              ~&  [%grabbing-title-anyway url]
              =/  hat=tape  (trip hed)
              ::NOTE  we must account for <title prefix="etc"> cases
              =/  hin=(unit @ud)   (find "<title>" hat)
              ::TODO  search only past u.hin
              =/  tin=(unit @ud)   (find "</title>" hat)  ::TODO  less strict?
              ?.  &(?=(^ hin) ?=(^ tin))
                ~
              ?:  (gte u.hin u.tin)
                ~
              =/  title=@t
                =.  u.hin  (add u.hin ^~((lent "<title>")))
                (crip (swag [u.hin (sub u.tin u.hin)] hat))
              `['_title' 'title' title]~
            =/  buckets=(jar @t tope:mg)
              ?~  res  ~
              %.  u.res
              %-  bucketize:mg
              %-  ~(gas ju *(jug @t path))
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
            =/  titles=(list @t)
              (turn (~(get ja buckets) 'title') value:mg)
            =/  descrs=(list @t)
              (turn (~(get ja buckets) 'description') value:mg)
            =/  images=(list @t)
              (turn (~(get ja buckets) 'image') value:mg)
            =/  sinams=(list @t)
              ::TODO  domain name fallback
              (turn (~(get ja buckets) 'site_name') value:mg)
            =/  sicons=(list @t)
              (turn (~(get ja buckets) 'site_icon') value:mg)
            ~>  %bout.[0 '- rendering']
            ;tr(valign "top")
              ;td:"{(trip url)}"
              ;td:"{?~(hex "no" "yes")}"
              ;td
                ;*  %+  join  `manx`;br;
                %+  turn  titles
                |=  t=@t  ^-  manx
                ;span:"{(trip t)}"
              ==
              ;td
                ;*  %+  join  `manx`;br;
                %+  turn  descrs
                |=  t=@t  ^-  manx
                ;span:"{(trip t)}"
              ==
              ;td
                ;*  %+  turn  images
                |=  t=@t  ^-  manx
                ;img(style "max-width: 100px; max-height: 100px; border: 1px solid black; margin-right: 2px;", src "{(trip t)}");
              ==
              ;td
                ;*  %+  join  `manx`;br;
                %+  turn  sinams
                |=  t=@t  ^-  manx
                ;span:"{(trip t)}"
              ==
              ;td
                ;*  %+  turn  sicons
                |=  t=@t  ^-  manx
                ;img(style "max-width: 50px; max-height: 50px; border: 1px solid black; margin-right: 2px;", src "{(trip t)}");
              ==
              ;td
                ;+  ?~  res  ;span:"failed"
                ;details
                  ;summary:"{(a-co:co (lent u.res))} properties"
                  ;*  %+  turn
                    ~(tap by buckets)
                  |=  [buc=@t toz=(list tope:mg)]
                  =;  xx=marl
                    ;details
                      ;summary:"<< {(trip buc)} >>"
                      ;*  xx
                    ==
                  %+  turn  toz
                  |=  tope:mg
                  ^-  manx
                  ;p
                    ;span:"- {(trip ns)}:{(trip key)}"
                    ;*  =+  dep=""
                    |-  ^-  marl
                    ?@  val  ~[;span:" = {(trip val)}"]
                    :-  ;span:" = {(trip top.val)}"
                    %+  turn  (sort ~(tap in met.val) aor)
                    |=  [key=@t val=veal:mg]
                    ;p(style "padding-left: 2em; margin: 0; border-left: 1px solid black;")
                      ;span:"{dep}{(trip key)}"
                      ;*  ^$(val val, dep ['-' ' ' dep])
                    ==
                  ==
                ==
              ==
            ==
          ==
        ==
      ==
    ::
        [@ ~]
      =|  msg=@t
      =*  bad-req
        [(spout:hutils id [400 ~] `(as-octs:mimes:html msg)) this]
      ?~  target=(slaw %uw i.site)
        =.  msg  'target not @uw'
        bad-req
      ?~  (de-purl:html u.target)
        ::TODO  if parser fails, just dumb find <title> and extract
        =.  msg  'target not parseable'
        bad-req
      ::TODO  should go into same pipeway that recurrent 300 processing does
      ::TODO  special-case x.com/twitter.com links
      ::  if we already started a fetch, simply await the result
      ::
      ?:  (~(has by await) u.target)
        =.  await  (~(put ju await) u.target id)
        [~ this]
      ::  we aren't currently fetching it, but maybe we have a cache entry
      ::
      =/  entry  (~(get by cache) u.target)
      |-
      ?:  ?&  ?=(^ entry)
              (gth cache-time (sub now.bowl wen.u.entry))
          ==
        ?.  ?=(%300 -.wat.u.entry)
          [(give-response id u.entry) this]
        $(entry (~(get by cache) nex.wat.u.entry))
      =.  await  (~(put ju await) u.target id)
      [[(fetch u.target) ~] this]
    ==
  ==
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _this)
  ~|  [%on-arvo wire=wire sign=+<.sign]
  ?+  wire  ~|(%strange-sign-arvo !!)
      [%eyre %bind ~]
    ?>  ?=(%bound +<.sign)
    ?:  accepted.sign  [~ this]
    %-  (slog dap.bowl 'failed to eyre-bind' ~)
    [~ this]
  ::
      [%fetch @ ~]
    =/  url=@t  (slav %t i.t.wire)
    ?>  ?=([%iris %http-response *] sign)
    =*  res  client-response.sign
    ~&  [-.res url]
    ::  %progress responses are unexpected, the runtime doesn't support them
    ::  right now. if they occur, just treat them as cancels and retry.
    ::
    =?  res  ?=(%progress -.res)
      ~&  [dap.bowl %strange-iris-progress-response]  ::TODO  log properly
      [%cancel ~]
    ::  we might get a %cancel if the runtime was restarted during our
    ::  request. simply retry.
    ::
    ?:  ?=(%cancel -.res)
      [[(fetch url) ~] this]
    ::
    ?>  ?=(%finished -.res)
    =*  cod  status-code.response-header.res
    ~&  cod=cod
    ?:  &((gte cod 300) (lth cod 400))
      ?~  nex=(get-header:http 'location' headers.response-header.res)
        ~&  >>>  %redirect-no-target
        [~ this]
      ~&  [%want-redirect u.nex]
      =.  cache  (~(put by cache) url now.bowl %300 u.nex)
      (on-poke %noun !>(u.nex))  ::TODO  tidier
    ::TODO  put cache, give eyre responses etc
    ?~  full-file.res
      ~&  %no-body
      [~ this]
    =,  u.full-file.res
    ~&  mime=type
    ?.  =('text/html' (end 3^9 type))
      ::TODO  handle other mime types, like application/pdf, images etc
      ~&  %not-html-nop
      [~ this]
    =/  hat=tape  (trip q.data)
    ::NOTE  we must account for <head prefix="etc"> cases
    =/  hin=(unit @ud)   (find "<head" hat)
    ::TODO  search only past u.hin
    =/  tin=(unit @ud)   (find "</head>" hat)  ::TODO  less strict?
    ?.  &(?=(^ hin) ?=(^ tin))
      ~&  [%no-head-nop would-have-spaced=?=(^ (find "</ head>" hat))]
      [~ this]
    ?:  (gte u.hin u.tin)
      ~&  [%strange-head-nop hin=u.hin tin=u.tin]
      [~ this]
    =/  head=@t
      (crip (weld (swag [u.hin (sub u.tin u.hin)] hat) "</head>"))
    =.  tmpca  (~(put by tmpca) url head)
    ~&  [%saving url]
    [~ this]
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
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
  ~&  [dap.bowl %unexpected-on-agent wire=wire]
  [~ this]
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ::TODO  support scrying out results
  ?.  ?=([%x %tmpca @ ~] path)  ~
  ``noun+!>((~(got by tmpca) (slav %t i.t.t.path)))
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %-  (slog dap.bowl '+on-fail' term tang)
  [~ this]
--
