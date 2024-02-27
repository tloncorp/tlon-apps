::  sigil: @p svg generation
::
::    usage: do a named import, then invoke as a function:
::      (sigil ~zod)
::
::    optionally modify configuration parameters:
::      %.  ~paldev
::      %_  sigil
::        size    25
::        fg      "black"
::        bg      "#2aa779"
::        margin  |
::        icon    &
::      ==
::
::NOTE  svg construction logic is coupled to the symbols definitions.
::      the symbols' elements assume they live in a space of 128x128.
::      what we do here is assume an svg _canvas_ of 128x128, draw the
::      symbols at their original sizes, and then scale them down to fit.
::
/+  sigil-symbols
::
::  config
::
=/  fg=tape   "white"
=/  bg=tape   "black"
=/  size=@ud  128
=/  margin=?  &
=/  icon=?    |
::
::
~%  %sigil  ..part  ~
=/  who=ship  ~zod
=/  syc=@ud   1
|^  |=  =ship
    ^-  manx
    ::
    =.  who  ship
    =/  syz  (simp who)
    =.  syc  (lent syz)
    ::  shift the sigil to account for the margin
    ::  scale the sigil to account for the amount of symbols
    ::
    =/  sire=@rd  (sun:rd size)
    =/  tr=tape
      ::TODO  render transform inside +sigil:svg?
      %+  transform:svg
        ?.  margin  ~
        =+  grid:pos
        `[(gird:pos x) (gird:pos y)]
      `span:pos
    ::
    =/  sw=@rd  ::TODO
      ?:  icon  .~0.8  ::TODO  scale with size?
      (add:rd .~0.33 (div:rd sire .~128))
    ::
    %-  outer:svg
    %+  sigil:svg
      [tr sw]
    (symbols:svg syz)
::
++  pos
  |%
  ++  span  ::  symbol scale (relative to full canvas)
    ^-  @rd
    ::TODO  accounting for margin here feels a bit ugly?
    ?+  (max grid)  !!
      %1  ?:(margin .~0.4 .~1)
      %2  ?:(margin .~0.4 .~0.5)
      %4  ?:(margin .~0.2 .~0.25)
    ==
  ::
  ++  grid  ::  size in symbols
    ^-  [x=@ud y=@ud]
    ?+  syc  !!
      %16  [4 4]
      %8   [4 4]
      %4   [2 2]
      %2   [2 1]
      %1   [1 1]
    ==
  ::
  ++  gird  ::  calculate margin
    |=  n=@ud
    ^-  @rd
    =-  (div:rd - .~2)     ::  / both sides
    %+  sub:rd  .~128      ::  canvas size -
    %+  mul:rd  (sun:rd n) ::  symbols *
    %+  mul:rd  span:pos   ::  symbol scale *
    .~128                  ::  symbol size
  ::
  ++  plan  ::  as position on symbol grid
    |=  i=@ud
    ^-  [x=@ud y=@ud]
    ?+  [syc i]  !!
      [%16 *]  [(mod i 4) (div i 4)]
    ::
      [%8 %0]  [0 0]
      [%8 %1]  [3 0]
      [%8 %2]  [0 3]
      [%8 %3]  [3 3]
      [%8 %4]  [1 1]
      [%8 %5]  [2 1]
      [%8 %6]  [1 2]
      [%8 %7]  [2 2]
    ::
      [%4 *]   [(mod i 2) (div i 2)]
      [%2 *]   [i 0]
      [%1 *]   [0 0]
    ==
  --
::
++  svg
  |%
  ++  outer
    |=  inner=manx
    ^-  manx
    =/  s=tape  ((d-co:co 1) size)
    ;svg
      =style  "display: block; width: {s}px; height: {s}px;"  ::  prevent bottom margin on svg tag
      =width  s
      =height  s
      =viewBox  "0 0 128 128"
      =version  "1.1"
      =xmlns  "http://www.w3.org/2000/svg"
      ::TODO  additional attributes from config arg?
      ;rect
        =fill  bg
        =width  "128"
        =height  "128";
      ;+  inner
    ==
  ::
  ::TODO  should it be possible to get these svg elements out of this lib?
  ++  sigil
    |=  [[tr=tape sw=@rd] symbols=(list manx)]
    ^-  manx
    ;g
      =transform  tr
      =stroke-width  (say-rd sw)
      =stroke-linecap  "square"
      =fill  fg
      =stroke  bg
      ::NOTE  unfortunately, vector-effect cannot be inherited,
      ::      so it gets inlined in the symbol elements instead
      :: =vector-effect  "non-scaling-stroke"
      ;*  symbols
    ==
  ::
  ++  symbols
    |=  noms=(list @t)
    ^-  (list manx)
    =|  i=@ud
    =/  l=@ud  (lent noms)
    |-
    ?~  noms  ~
    :_  $(noms t.noms, i +(i))
    ::TODO  exclude if both 0
    =+  (plan:pos i)
    ;g(transform (transform `[(sun:rd (mul x 128)) (sun:rd (mul y 128))] ~))
      ;*  =+  ((symbol i.noms) fg bg)
          ?.(icon - (scag 1 -))
    ==
  ::
  ++  symbol  ~(got by sigil-symbols)
  ::
  ++  transform  ::TODO  take manx instead so we can omit attr entirely?
    |=  [translate=(unit [x=@rd y=@rd]) scale=(unit @rd)]
    ^-  tape
    %-  zing
    ^-  (list tape)
    ::TODO  make cleaner
    =-  ?:  ?=(?(~ [* ~]) -)  -
        (join " " `(list tape)`-)
    ^-  (list tape)
    :~  ?~  translate  ~
        ?:  =([0 0] u.translate)  ~
        "translate({(say-rd x.u.translate)} {(say-rd y.u.translate)})"
      ::
        ?~  scale  ~
        "scale({(say-rd u.scale)})"
    ==
  --
::
++  simp
  |=  =ship
  ^-  (list @t)
  ::  split into phonemes
  ::
  =/  noms=(list @t)
    =/  nom=@t
      (rsh 3 (scot %p ship))
    |-  ?~  nom  ~
    |-  ?:  =('-' (end 3 nom))
          $(nom (rsh 3 nom))
    :-  (end 3^3 nom)
    ^$(nom (rsh 3^3 nom))
  ::  fill leading empties with 'zod'
  ::
  =/  left=@ud
    =-  (sub - (lent noms))
    %-  bex
    ?-  (clan:title ship)
      %czar  0
      %king  1
      %duke  2
      %earl  3
      %pawn  4
    ==
  |-
  ?:  =(0 left)  noms
  $(noms ['zod' noms], left (dec left))
::
++  rd  ~(. ^rd %n)
++  say-rd
  |=  n=@rd
  ^-  tape
  =/  =dn          (drg:rd n)
  ?>  ?=(%d -.dn)
  =/  [s=? m=@ud]  (old:si e.dn)
  =/  x=@ud        (pow 10 m)
  %+  weld
    %-  (d-co:co 1)
    ?:(s (mul a.dn x) (div a.dn x))
  ?:  s  ~
  ['.' ((d-co:co m) (mod a.dn x))]
--
