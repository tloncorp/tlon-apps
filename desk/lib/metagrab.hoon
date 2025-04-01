::  metagrab: parse metadata from html page
::
::    structured primarily for opengraph metadata, but supports arbitrary
::    <meta> tag namespaces and many known <link> relationships.
::
/+  rh=re-html
::
=|  base-url=(unit @t)
|%
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
::
++  search-head
  |=  nod=manx
  ^-  (unit (list tope))
  %+  bind
    ((dig:rh %head) nod)
  search-marl
::
++  search-marl
  |=  nos=marl
  ^-  (list tope)
  =/  patch-href
    ?~  base-url  same
    |=  href=@t
    (expand-url u.base-url href)
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
    ::TODO  be more selective: image_src, icon (w/ opt attrs), apple-touch-icon etc
    [cur ['_link' (crip u.rel) (patch-href (crip u.ref))] out]  ::REVIEW  save cur?
  ::
      %meta
    ::TODO  patch-href known properties?
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
--
