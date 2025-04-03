::  metagrab: parse metadata from html page
::
::    structured primarily for opengraph metadata, but supports arbitrary
::    <meta> tag namespaces and many known <link> relationships.
::
/+  rh=re-html
::
=|  base-url=(unit @t)
|%
::  searching for metadata
::
+$  tope
  $:  ns=@t     ::  property namespace, if any
      key=@t    ::  property key
      val=veal  ::  property value
  ==
::
+$  veal
  $@  @t                 ::  flat property, or:
  $:  top=@t             ::  property value
      met=(map @t veal)  ::  w/ metadata
  ==
::
++  search-head
  |=  nod=manx
  ^-  (unit (list tope))
  %+  bind
    ((dig:rh %head) nod)
  search-marl
::  +search-marl: extract <meta>, <link> and <title> tag contents
::
::    primary extraction logic, gets $topes from a $marl.
::    <meta> tags have their name:spacing reflected in the resulting $tope,
::           with '' .ns if the property isn't namespaced.
::           (note: for "image:height", 'image' would become the namespace...)
::    <link> tags gets a '_link' .ns, always a flat $veal.
::    <title> tags get a '_title' .ns, always a flat $veal.
::
++  search-marl
  |=  nos=marl
  ^-  (list tope)
  %-  flop
  =<  ?~(cur out [u.cur out])
  %+  roll  nos
  |=  [nod=manx cur=(unit tope) out=(list tope)]
  =*  skip  [cur out]
  =+  rat=(~(gas by *(map mane tape)) a.g.nod)
  ?+  n.g.nod  skip
      %title
    =-  [cur - out]  ::REVIEW  save cur?
    ['_title' 'title' (crip (zing (join " " (tez:rh nod))))]
  ::
      %link
    ?~  rel=(~(get by rat) %rel)  skip
    ?~  ref=(~(get by rat) %href)  skip
    =;  val=veal
      [cur ['_link' (crip u.rel) val] out]  ::REVIEW  save cur?
    =.  rat  (~(del by rat) %rel)
    =.  rat  (~(del by rat) %href)
    ?:  =(~ rat)  (crip u.ref)
    :-  (crip u.ref)
    %-  ~(gas by *(map @t veal))
    %+  turn  ~(tap by rat)
    |=  [m=mane t=tape]
    ^-  [@t veal]
    ?@  m  [m (crip t)]
    [-.m '' [+.m (crip t)] ~ ~]
  ::
      %meta
    ?~  con=(~(get by rat) %content)
      skip
    =+  val=(crip u.con)
    ?~  key=(hunt |=(* &) (~(get by rat) %property) (~(get by rat) %name))
      skip
    =/  pax=(list @t)
      (scan u.key (most col (cook crip (star ;~(less col next)))))
    |-
    ?-  pax
      ~  skip
    ::
        [%article *]
      ::  very common for article metadata to not have
      ::  the og: prefix. just pretend it always does,
      ::  making properties more likely to be together.
      ::
      $(pax [%og pax])
    ::
        [@ ~]
      ::  flat key, make as-is
      ::
      ::dbg  ~?  ?=(^ cur)  [%saving cur]
      =-  [~ - ?~(cur out [u.cur out])]
      ::dbg  =-  ~&         [%puting -]  -
      [%$ i.pax val]
    ::
        [@ @ *]
      =/  make-veal
        |=  [pax=(list @t) val=@t]
        ^-  veal
        ?~  pax  val
        [top='' met=[i.pax^$(pax t.pax) ~ ~]]
      ::  namespaced. if it's a child of .cur, we must inject it.
      ::
      ?.  ?&  ?=(^ cur)             ::  have previous tope
              =(i.pax ns.u.cur)     ::  in the same namespace
              =(i.t.pax key.u.cur)  ::  with the same key
              ?=(^ t.t.pax)         ::  and this is a meta property
          ==
        ::  not a child of .cur, so we start a new tope
        ::
        ::dbg  ~?  ?=(^ cur)  [%saving cur]
        =-  [`- ?~(cur out [u.cur out])]
        ::dbg  =-  ~&         [%parent -]  -
        :+  ns=i.pax
          key=i.t.pax
        (make-veal t.t.pax val)
      ::  this property belongs inside of .cur
      ::
      ::dbg  ~&  [%enters pax cur]
      :_  out
      =-  `[ns.u.cur key.u.cur -]
      =/  cal=veal  val.u.cur
      =*  koy  i.t.t.pax
      =*  toy  t.t.t.pax
      |-  ^-  veal
      ?@  cal
        ::  was flat, deepen to where we belong and insert
        ::
        ::dbg  ~&  [%deepen koy toy]
        :-  top=cal
        %+  ~(put by *(map @tas veal))
          koy
        (make-veal toy val)
      ?~  toy
        ::  we're at the depth of this property,
        ::  insert it into the local value
        ::
        ::dbg  ~&  [%target koy]
        [top.cal (~(put by met.cal) koy val)]
      ?^  nex=(~(get by met.cal) koy)
        ::  we can still go deeper into the existing structure
        ::
        ::dbg  ~&  [%diggin top.cal koy toy]
        :-  top.cal
        %+  ~(put by met.cal)
          koy
        $(koy i.toy, toy t.toy, cal u.nex)
      ::  next step doesn't match, so insert here
      ::
      ::dbg  ~&  [%insert koy toy]
      :-  top.cal
      %+  ~(put by met.cal)
        koy
      (make-veal toy val)
    ==
  ==
::
::  post-processing metadata
::
++  value
  |=  tope
  ?@  val  val
  top.val
::
++  bucketize
  |=  buckets=(jug @t path)
  =/  lookup=(map path @t)
    %-  ~(rep by buckets)
    |=  [[buc=@t paz=(set path)] lok=(map path @t)]
    %-  ~(rep in paz)
    |=  [pax=path =_lok]
    (~(put by lok) pax buc)
  |=  topes=(list tope)
  %+  roll  topes
  |=  [=tope out=(jar @t tope)]
  =/  kay=path  ~[ns key]:tope
  |-  ^+  out
  ?:  (~(has by lookup) kay)
    (~(add ja out) (~(got by lookup) kay) tope)
  (~(add ja out) '' tope)  ::TODO  traverse?
::
++  transform
  |=  fun=$-([kay=path val=@t] @t)
  |=  tope
  =/  kay=path  ~[ns key]
  :+  ns  key
  |-  ^-  veal
  ?@  val  (fun kay val)
  :-  (fun kay top.val)
  %-  ~(urn by met.val)
  |=  [k=@t v=veal]
  ^$(kay (snoc kay k), val v)
::
++  expand-urls
  =/  spaces=(list @t)  ::  namespaces with urls at top level
    ~['_link']
  =/  keys=(list @t)  ::  keys at any level with urls
    ~['image' 'url' 'secure_url']
  |=  [base=@t toz=(list tope)]
  %+  turn  toz
  %-  transform
  |=  [kay=(list @t) val=@t]
  =+  nas=(head kay)
  =+  key=(rear kay)
  =;  is-href=?
    ?.  is-href  val
    (expand-url base val)
  ?|  &((lien spaces (cury test nas)) ?=([@ @ ~] kay))
      (lien keys (cury test key))
  ==
::
++  expand-url
  |=  [base=@t url=@t]
  ^-  @t
  ::TODO  or split url by / ? but that might break on query params...
  =+  b=(need (de-purl:html base))
  =+  u=(trip url)
  =.  p.q.b  ~  ::  never preserve file extension
  =.    r.b  ~  ::  never preserve query params
  ::  arbitrary protocol
  ::
  ?:  =+  p=(find "://" u)
      &(?=(^ p) (gth u.p 0))
    url
  =/  rel=?  |
  |-
  ?-  u
    ::  protocol-relative
    ::
      [%'/' %'/' *]
    (cat 3 ?:(p.p.b 'https:' 'http:') (crip u))
  ::
    ::  host-relative
    ::
      [%'/' *]
    (cat 3 (crip (head:en-purl:html p.b)) (crip u))
  ::
    ::  parent directory
    ::
      [%'.' %'.' %'/' *]
    =?  q.q.b  &(!rel !=(~ q.q.b))
      (snip q.q.b)
    =.  rel  &
    ::  no need to drop trailing %$ element, semantically equivalent
    ::
    ?:  =(~ q.q.b)  $(u t.t.t.u)
    $(u t.t.t.u, q.q.b (snip q.q.b))
  ::
    ::  current directory
    ::
      [%'.' %'/' *]
    =?  q.q.b  &(!rel !=(~ q.q.b))
      (snip q.q.b)
    =.  rel  &
    $(u t.t.u)
  ::
    ::  query params
    ::
      [%'?' *]
    (cat 3 (crip (en-purl:html b)) (crip u))
  ::
    ::  generic relative
    ::
      *
    =?  q.q.b  &(!rel !=(~ q.q.b) !=(%$ (rear q.q.b)))
      (snip q.q.b)  ::  snip for plain relative path
    =?  q.q.b  |(rel =(~ q.q.b) !=(%$ (rear q.q.b)))
      (snoc q.q.b %$)  ::  ensure trailing / on base url
    (cat 3 (crip (en-purl:html b)) (crip u))
  ==
--
