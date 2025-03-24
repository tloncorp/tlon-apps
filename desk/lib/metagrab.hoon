::  metagrab: parse metadata from html page
::
::    structured primarily for opengraph metadata, but supports arbitrary
::    <meta> tag namespaces and many known <link> relationships.
::
/+  rh=re-html
::
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
    [cur ['_link' (crip u.rel) (crip u.ref)] out]  ::REVIEW  save cur?
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
--
