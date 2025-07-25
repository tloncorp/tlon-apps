::  metagrab: parse metadata from html page
::
::    structured primarily for opengraph metadata, but supports arbitrary
::    <meta> tag namespaces and many known <link> relationships.
::
/+  rh=re-html
::
|%
::  searching for metadata
::
+$  entry
  $:  ns=@t      ::  property namespace, if any
      key=@t     ::  property key
      val=value  ::  property value
  ==
::
+$  value
  $@  @t                  ::  flat property, or:
  $:  top=@t              ::  property value
      met=(map @t value)  ::  w/ metadata
  ==
::
++  search-head
  |=  nod=manx
  ^-  (unit (list entry))
  %+  bind
    ((dig:rh %head) nod)
  search-marl
::  +search-marl: extract <meta>, <link> and <title> tag contents
::
::    primary extraction logic, gets $entries from a $marl.
::    <meta> tags have their name:spacing reflected in the resulting $entry,
::           with '' .ns if the property isn't namespaced.
::           (note: for "image:height", 'image' would become the namespace...)
::    <link> tags gets a '_link' .ns, always a flat $value.
::    <title> tags get a '_title' .ns, always a flat $value.
::
++  search-marl
  |=  nos=marl
  ^-  (list entry)
  %-  flop
  =<  ?~(cur out [u.cur out])
  %+  roll  nos
  |=  [nod=manx cur=(unit entry) out=(list entry)]
  =*  skip  [cur out]
  =+  ats=(~(gas by *(map mane tape)) a.g.nod)
  ?+  n.g.nod  skip
      %title
    =-  [cur - out]  ::REVIEW  save cur?
    ['_title' 'title' (crip (zing (join " " (tez:rh nod))))]
  ::
      %link
    ?~  rel=(~(get by ats) %rel)  skip
    ?~  ref=(~(get by ats) %href)  skip
    =;  val=value
      [cur ['_link' (crip u.rel) val] out]  ::REVIEW  save cur?
    =.  ats  (~(del by ats) %rel)
    =.  ats  (~(del by ats) %href)
    ?:  =(~ ats)  (crip u.ref)
    :-  (crip u.ref)
    %-  ~(gas by *(map @t value))
    %+  turn  ~(tap by ats)
    |=  [m=mane t=tape]
    ^-  [@t value]
    ?@  m  [m (crip t)]
    [-.m '' [+.m (crip t)] ~ ~]
  ::
      %meta
    ?~  con=(~(get by ats) %content)
      skip
    =+  val=(crip u.con)
    ?~  key=(hunt |=(* &) (~(get by ats) %property) (~(get by ats) %name))
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
      =/  make-value
        |=  [pax=(list @t) val=@t]
        ^-  value
        ?~  pax  val
        [top='' met=[i.pax^$(pax t.pax) ~ ~]]
      ::  namespaced. if it's a child of .cur, we must inject it.
      ::
      ?.  ?&  ?=(^ cur)             ::  have previous entry
              =(i.pax ns.u.cur)     ::  in the same namespace
              =(i.t.pax key.u.cur)  ::  with the same key
              ?=(^ t.t.pax)         ::  and this is a meta property
          ==
        ::  not a child of .cur, so we start a new entry
        ::
        ::dbg  ~?  ?=(^ cur)  [%saving cur]
        =-  [`- ?~(cur out [u.cur out])]
        ::dbg  =-  ~&         [%parent -]  -
        :+  ns=i.pax
          key=i.t.pax
        (make-value t.t.pax val)
      ::  this property belongs inside of .cur
      ::
      ::dbg  ~&  [%enters pax cur]
      :_  out
      =-  `[ns.u.cur key.u.cur -]
      =/  cal=value  val.u.cur
      =*  koy  i.t.t.pax
      =*  toy  t.t.t.pax
      |-  ^-  value
      ?@  cal
        ::  was flat, deepen to where we belong and insert
        ::
        ::dbg  ~&  [%deepen koy toy]
        :-  top=cal
        %+  ~(put by *(map @tas value))
          koy
        (make-value toy val)
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
      (make-value toy val)
    ==
  ==
::
::  post-processing metadata
::
++  get-value
  |=  entry
  ^-  @t
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
  |=  entries=(list entry)
  %+  roll  entries
  |=  [=entry out=(jar @t entry)]
  =/  =path  ~[ns key]:entry
  |-  ^+  out
  ?^  buck=(~(get by lookup) path)
    (~(add ja out) u.buck entry)
  (~(add ja out) '' entry)  ::TODO  traverse?
::
++  transform
  |=  fun=$-([=path val=@t] @t)
  |=  entry
  =/  =path  ~[ns key]
  :+  ns  key
  |-  ^-  value
  ?@  val  (fun path val)
  :-  (fun path top.val)
  %-  ~(urn by met.val)
  |=  [k=@t v=value]
  ^$(path (snoc path k), val v)
::
++  expand-urls
  =/  spaces=(list @t)  ::  namespaces with urls at top level
    ~['_link']
  =/  keys=(list @t)  ::  keys at any level with urls
    ~['image' 'url' 'secure_url']
  |=  [base=@t toz=(list entry)]
  %+  turn  toz
  %-  transform
  |=  [kay=(list @t) val=@t]
  =+  nas=(head kay)
  =+  key=(rear kay)
  =;  is-href=?
    ?.  is-href  val
    (expand-url base val)
  ?|  &(?=([@ @ ~] kay) (lien spaces (cury test nas)))
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
