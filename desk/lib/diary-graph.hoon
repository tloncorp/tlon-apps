/-  d=diary
/-  graph=graph-store
=<  migrate
=|  [=flag:d time=@ud]
|%
+$  errata  (each tape block:d)
+$  erratum
  $%  [%prose =tape]
      [%line =tape]
      [%code =tape]
      [%block =block:d]
  ==
+$  lang    (each tape tape)
++  trace
  |*  [tag=@t sef=rule]
  |=  tub=nail
  ?.  dbug
    (sef tub)
  ~|  [tag tub]
  (sef tub)
::
++  dbug  &
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
    (more ret (star ;~(less ret next)))
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
      ~
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
      ~|  should-never-crash-fallback-parsing/nail
      ?>(o draw)
    ++  raw-line
      (cook (cork crip (late ~)) (star next))
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
  |=  [f=flag:d atom=@ud ls=(list content:post:gra:d)]
  ^-  (list verse:d)
  =:  flag  f
      time  atom
    ==
  %-  squeeze
  %-  zing
  %+  turn  ls
  |=  con=content:post:gra:d
  ^-  (list verse:d)
  ?-    -.con
      %text       (ring (trip text.con))
      %mention    [%inline ~[`@t`(scot %p ship.con)]]~  :: TODO: i swear I PR'd ships
      %code       [%inline ~[code/expression.con]]~
      %reference  ~  :: TODO: think about?
  ::
      %url        
    =/  def=(list verse:d)
      [%inline ~[link/[url.con '']]]~
    ?~  ext=(rush url.con (cook rear (most dot (cook crip (plus ;~(less dot prn))))))
      def
    ?:  ?=(?(%png %jpeg %jpeg) u.ext)
      [%block %image url.con 0 0 '']~
    def
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
::
++  word
  (cook crip (plus ;~(less cab ret tar tic sel next)))
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
    (parse-wrapped %italics cab)
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
:::
++  lin
  |=  txt=@t
  ((plus ;~(less ret next)) [1 1] (trip txt))
::
++  by-line
  |=  txt=tape
  (split-rule txt ret)
::
++  log-fall
  |*  [tag=@ta str=tape a=(unit) b=*]
  ?~  a
    b
  u.a
::
++  infix
  |*  [delim=rule inner=rule]
  |=  tub=nail
  =+  vex=(delim tub)
  ?~  q.vex
    (fail tub)
  =/  but=nail  tub
  =+  outer=(;~(sfix (plus ;~(less delim next)) delim) q.u.q.vex)
  ?~  q.outer
    (fail tub)
  =+  in=(inner [1 1] p.u.q.outer)
  ?~  q.in
    (fail tub)
  outer(p.u.q p.u.q.in) ::
::
++  split-rule
  |*  [txt=tape delim=rule]
  ^-  (list tape)
  =-  (log-fall %split-rule tape - [txt ~])
  (rust txt (more delim (star ;~(less delim next))))
::
++  by-code
  |=  txt=tape
  ^-  (list lang)
  =<  +
  %+  reel  (split-rule txt ;~(plug tic tic tic))
  |=  [tap=tape count=@ud ls=(list lang)]
  :-  +(count)
  ?:  =(0 (mod count 2))
    [[%& tap] ls]
  [[%| tap] ls]
::
++  elem
  |%
  ++  head
    %+  cook
      |=  [a=(list) b=(list inline:d)]
      ^-  verse:d
      =/  len  (lent a)
      =-  [%block %header - b]
      ?+  len  !! :: forbidden by +stun
        %1  %h1
        %2  %h2
        %3  %h3
        %4  %h4
        %5  %h5
        %6  %h6
      ==
    ;~(plug (stun [1 6] hax) inline)
  ++  blockquote  (stag %inline (listify (stag %blockquote ;~(pfix gar inline))))
  ++  hr          (stag %block (cold `block:d`rule/~ (jest '---')))
  ++  str         (tie (plus ;~(less cab tar tic next)))
  ++  inline-verse  (stag %inline inline)
  ++  inline
    %+  knee  *(list inline:d)
    |.  ~+
    %+  trace  %inline
    %-  plus
    ;~  pose
      (stag %bold (infix ;~(plug cab cab) inline))
      (stag %bold (infix ;~(plug tar tar) inline))
      (stag %inline-code (infix tic code))
      (stag %italics (infix cab inline))
      (stag %italics (infix tar inline))
      str
      next
    ==
  ::
  ++  line-start
    ^-  (edict verse:d)
    :: =-  ;~(pfix (star whit) -)
    ;~  pose
      head
      blockquote
      hr
      inline-verse
    ==
  --
::
++  code
  (tie (star next))
++  tie
  |*  rul=rule
  (cook crip rul)
::
++  whit  ;~(pose (jest '\09') ace)
::
++  lift-blocks
  |=  txt=tape
  ^-  (list erratum)
  =-  (log-fall %lift-blocks txt - ~[prose/txt])
  %+  rust  txt
  %+  sear
    |=  ls=(list erratum)
    ^-  (unit (list erratum))
    ?~  ls   ~
    ?.  ?=(%prose -.i.ls)
      `ls
    `[[%line tape.i.ls] t.ls]
  %-  plus
  ;~  pose
    %+  cook
      |=  [alt=tape src=tape]
      ^-  erratum
      [%block [%image (crip src) 0 0 (crip alt)]]
    =-  ;~(pfix zap -)
    ;~  plug 
      (ifix [sel ser] (star ;~(less ser prn)))
      (ifix [pal par] (plus ;~(less par prn)))
    ==
  ::
    (stag %prose (plus ;~(less ;~(plug zap sel) prn)))
  ==
::
++  ring
  |=  txt=tape
  ^-  (list verse:d)
  =/  langs  (by-code txt)
  =/  lines=(list lang)
    %-  zing
    %+  turn  langs
    |=  =lang
    ^-  (list _lang)
    ?.  ?=(%& -.lang)
      ~[lang]
    (turn (by-line p.lang) (lead %&))
  =/  err=(list erratum)
    %-  zing
    %+  turn  lines
    |=  =lang
    ^-  (list erratum)
    ?:  ?=(%| -.lang)
      [%code p.lang]~
    (lift-blocks p.lang)
  =/  blocks=(list verse:d)
    %+  turn  err
    |=  e=erratum
    ^-  verse:d
    ?-  -.e
    ::
        %code   [%inline ~[code/(crip tape.e)]]
        %block  [%block block.e]
    ::
        %prose
      =/  def=verse:d  [%inline ~[(crip tape.e)]]
      =-  (log-fall %prose-verse tape.e - def)
      (rust tape.e inline-verse:elem)
    ::
        %line
      =/  def=verse:d  [%inline ~[(crip tape.e)]]
      =;  =verse:d
        ?:  ?=(%inline -.verse)
           [%inline break/~ p.verse]
        verse
      =-  (log-fall %line-verse tape.e - def)
      (rust tape.e line-start:elem)
    ==
  (squeeze blocks)
--
