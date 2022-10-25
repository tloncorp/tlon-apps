/-  d=diary
/-  graph=graph-store
=<  migrate
|%
+$  errata  (each tape block:d)
++  trace
  |*  [tag=@t sef=rule]
  |=  tub=nail
  ~?  dbug  [tag tub]
  =-  ~?(dbug [tag -] -)  (sef tub)
::
++  dbug  |
++  edict
  |$  [prod]
  $-(nail (like prod))
::
++  rack
  |*  [los=tape sab=rule]
  =+  vex=(sab [1 1] los)
  ?~(q.vex ~ [~ u=p.u.q.vex])
::
++  sing
  |_  $:  =nail
          out=(list verse:d)
      ==
  ++  sing  .
  ++  abet  out
  ++  bite
    |=  [txt=tape rul=(edict (list verse:d))]
    ^-  (unit (list verse:d))
    (rust txt rul)
  ++  chew
    |=  rul=(edict (list verse:d))
    ^-  [? _sing]
    =/  tub  (rul nail)
    ?~  q.tub
      ~?  dbug  failed-parsing/[tub nail]
      [| sing]
    =.  nail  q.u.q.tub
    =.  out   (welp out p.u.q.tub)
    [& sing]
  ++  by-line
    (more ret (star ;~(less ret prn)))
  ::
  ++  lift-blocks
    |=  txt=tape
    ^-  (unit (list errata))
    %+  rust  txt
    %+  sear
      |=  ls=(list errata)
      ^-  (unit (list errata))
      ?:  =(~ ls)  ~  `ls
    %-  plus
    ;~  pose
      %+  cook
        |=  [alt=tape src=tape]
        ^-  errata
        [%| [%image (crip src) 0 0 (crip alt)]]
      =-  ;~(pfix zap -)
      ;~  plug 
        (ifix [sel ser] (star ;~(less ser prn)))
        (ifix [pal par] (plus ;~(less par prn)))
      ==
    ::
      (stag %& (plus ;~(less ;~(plug zap sel) prn)))
    ==
  ++  main
    ^+  sing
    %+  roll  (scan q.nail by-line)
    |=  [txt=tape si=_sing]
    ^+  si
    =/  out  out:si
    ?:  =(~ txt)
      ?^  out  
        ?:  ?=(%block -.i.out)  si(out out) :: don't double space
        =>  .(out `(list verse:d)`out)
        si(out (snoc out inline/~[break/~]))
      =>  .(out `(list verse:d)`out)
      si(out (snoc out inline/~[break/~]))
    ?^  bok=(rack txt hymn)
      ~!  bok
      si(out (snoc out u.bok))
    =/  erratum=(list errata)
      (fall (lift-blocks txt) [%& txt]~)
    |-  ^+  si  
    ?~  erratum  si(out out)
    ?:  ?=(%| -.i.erratum)
      $(erratum t.erratum, out (snoc out block/p.i.erratum))
    =^  inl  si
      abet:main:(abed:draw:si p.p.nail p.i.erratum)
    $(out (snoc out inline/inl), erratum t.erratum)
  ::
  ++  hr  (cold rule/~ (jest '---'))

  ::
  ++  hymn
    ^-  (edict verse:d)
    %+  trace  %hymn
    ::  %+  cook  (late ~)
    %+  stag  %block
    ;~  pose
      header-rul
      hr
      listing
    ==
  ::
  ++  listing
    %+  cook
      |=  [mode=?(%ordered %unordered) ls=(list inline:d)]
      ^-  block:d
      =/  item=listing:d  [%item ls]
      [%listing %list mode ~[item] ~]
    =-  ;~(pfix (star ace) -)
    ;~  plug
      ;~(pose (cold %ordered dem) (cold %unordered ;~(pose tar hep lus)))
    ::
      ^-  (edict (list inline:d))
      |=  n=^nail
      =^  ine=(list inline:d)  sing
        abet:main:(abed:draw [p.p.nail q.n])
      ?:  =(~ ine)
        [p.nail ~]
      [p.nail `[ine nail]]
    ==

  ::
  ++  header-rul
    %+  cook
      |=  [a=(list) b=(list inline:d)]
      ^-  block:d
      =/  len  (lent a)
      =-  [%header - b]
      ?+  len  !! :: forbidden by +stun
        %1  %h1
        %2  %h2
        %3  %h3
        %4  %h4
        %5  %h5
        %6  %h6
      ==
    =-  ;~(plug (stun [1 6] hax) -)
    ^-  (edict (list inline:d))
    |=  n=_nail
    =^  ine=(list inline:d)  sing
      abet:main:(abed:draw [p.p.nail q.n])
    ?:  =(~ ine)
      [p.nail ~]
    [p.nail `[ine nail]]
  ++  draw
    |_  [mode=?(%normal %quote) inl=(list inline:d) nail=^nail]
    ++  draw  .
    ++  abet  
      ?~  q.nail
        [inl sing]
      ~?  dbug  incomplete-parsing/nail
      [inl sing]
    ++  abed
      |=  [lin=@ud =tape]
      draw(nail [[lin 1] tape])
    ++  peek
      |=  rul=(edict (list inline:d))
      ^-  ?
      =(~ q:(rul nail))
    ++  chew
      |=  rul=(edict (list inline:d))
      ^-  [? _draw]
      =/  tub  (rul nail)
      ?~  q.tub
        ~?  dbug  failed-parsing/[tub nail]
        [| draw]
      =.  nail  q.u.q.tub
      =.  inl  (welp inl p.u.q.tub)
      [& draw]
    ++  is-quote  (peek (cold *(list inline:d) gar))
    ++  main
      ^+  draw
      =^  ok=?  draw
        (chew line)
      ?:  ok  draw
      =^  o=?  draw
        (chew raw-line)
      ~|  %should-never-crash-fallback-parsing
      ?<(o draw)
    ++  raw-line
      (cook (cork crip (late ~)) (star prn))
    ::
    ++  line
      %+  knee  *(list inline:d)
      |^
      |.  ~+
      %-  plus
      ;~  pose
        link
        (stag %blockquote ;~(pfix gar line))
        :: (ifix [;~(plug tar tar) ;~(plug tar tar)] (stag %italics line))
        (parse-wrapped %italics ;~(plug tar tar))
        (parse-wrapped %bold tar)
        code
        ::(sear (ifix [tar tar] (stag %bold line))) 
        :: (parse-wrapped tar (stag %bold line))
        word
      ==
      ::
      ++  link
        %+  cook
          |=  [con=tape src=tape]
          ^-  inline:d
          [%link (crip src) (crip con)]
        ;~  plug 
          (ifix [sel ser] (star ;~(less ser prn)))
          (ifix [pal par] (star ;~(less par prn)))
        ==
      ++  parse-wrapped
        |*  [tag=* delim=rule]
        %+  stag  tag
        %+  sear  fail-if-empty
        (ifix [delim delim] line)
      ::
      ++  code
        %+  stag  %inline-code
        %+  ifix  [tic tic]
        %+  cook  crip
        %-  star
        ;~(less tic prn)
      --
    --
  --
::
++  ran-hymn
  |=  str=tape
  ^-  verse:d
  (scan str hymn:sing)
++  ran
  |=  str=@t
  ^-  (list verse:d)
  %-  squeeze
  abet:~(main sing [[1 1] (trip str)] ~)
::  TODO: squeeze after parsing?
++  migrate
  |=  ls=(list content:post:gra:d)
  ^-  (list verse:d)
  %-  zing
  %+  turn  ls
  |=  con=content:post:gra:d
  ^-  (list verse:d)
  ?-  -.con
    %text       (ran text.con)
    %mention    [%inline ~[`@t`(scot %p ship.con)]]~  :: TODO: i swear I PR'd ships
    %url        [%inline ~[link/[url.con '']]]~
    %code       [%inline ~[code/expression.con]]~
    %reference  ~  :: TODO: think about?
  ==
::
++  squeeze
  |=  ls=(list verse:d)
  %-  flop
  %+  roll  ls
  |=  [=verse:d out=(list verse:d)]
  ^+  out
  ?~  out  [verse out]
  ?-     -.i.out
     %inline
    ?.  ?=(%inline -.verse)  [verse out]
    :_(t.out [%inline (welp p.i.out p.verse)])
  ::
      %block
    ?.  ?=(%block -.verse)  [verse out]
    (welp (flop (squeeze-lists verse i.out)) t.out)
  ==
::
++  squeeze-lists
  |=  [a=verse:d b=verse:d]
  ^-  (list verse:d)
  ?.  &(?=(%block -.a) ?=(%block -.b))          ~[a b]
  ?.  &(?=(%listing -.p.a) ?=(%listing -.p.b))  ~[a b]
  ?.  &(?=(%list -.p.p.a) ?=(%list -.p.p.b))    ~[a b]
  ~!  p.p.a
  ?.  =(p.p.p.a p.p.p.b)                        ~[a b]
  =;  =verse:d
    ~[verse]
  :-  %block
  :^  %listing  %list
    p.p.p.a 
  [(welp q.p.p.a q.p.p.a) (welp r.p.p.a r.p.p.b)]

::
++  run
  |=  str=@t
  ^-  (list verse:d)
  (rash str apex)
++  run-line
  |=  str=@t
  ^-  (list inline:d)
  ~
++  apex  (most (plus ret) para)
++  ret
  (jest '\0a')
++  para
  ;~  pose
    block
    (stag %inline quote)
    (stag %inline line)
  ==
++  quote
  (stag %blockquote (fzing (plus ;~(pfix gar line))))
++  block
  %+  stag  %block
  ;~  pose
    header
  ==
::
++  header
  %+  cook
    |=  [a=(list) b=(list inline:d)]
    ^-  block:d
    =/  len  (lent a)
    =-  [%header - b]
    ?+  len  !! :: forbidden by +stun
      %1  %h1
      %2  %h2
      %3  %h3
      %4  %h4
      %5  %h5
      %6  %h6
    ==
  ;~(plug (stun [1 6] hax) line)
::
++  hr
  (jest '----')

++  word
  (cook crip (plus ;~(less ret tar tic sel prn)))
++  fzing
  |*  rul=rule
  (cook |*(a=(list) (zing a)) rul)
++  listify
  |*  rul=rule
  (cook |*(* ~[+<]) rul)
++  fail-if-empty  |=(a=(list inline:d) `(unit (list inline:d))`?:(=(~ a) ~ `a))
::
++  line
  %+  knee  *(list inline:d)
  |^
  |.  ~+
  %-  plus
  ;~  pose
    :: (ifix [;~(plug tar tar) ;~(plug tar tar)] (stag %italics line))
    (parse-wrapped %italics ;~(plug tar tar))
    (parse-wrapped %bold tar)
    code
    ::(sear (ifix [tar tar] (stag %bold line))) 
    :: (parse-wrapped tar (stag %bold line))
    word
  ==
  ++  parse-wrapped
    |*  [tag=* delim=rule]
    %+  stag  tag
    %+  sear  fail-if-empty
    (ifix [delim delim] line)
  ::
  ++  code
    %+  stag  %inline-code
    %+  ifix  [tic tic]
    %+  cook  crip
    %-  star
    ;~(less tic prn)
  --
--
