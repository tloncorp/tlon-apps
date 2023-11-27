::  sparse sets: sets of numbers, minimally specified
::
::    provides types & utilities for working with sparse sets of numbers,
::    implemented as ordered lists ($sass) of number ranges ($span).
::
::    TODO  path to full genericity:
::    1. use a single comparator everywhere (lte?)
::    2. don't assume we're working on numbers
::    3. type constructors, wet gates, comparator arg
::    4. rewrite in terms of trees for performance
::    5. jet it
::
|%
+$  span  [fro=@ til=@]                                 ::  range (inclusive)
+$  sass  (list span)                                   ::  sparse set
::
++  fat                                                 ::  inside or next to?
  |=  [span a=@]
  &((lte (dec fro) a) (lte a +(til)))
::
::TODO  optimize, can we do just three of these?
++  lap                                                 ::  have overlap?
  |=  [a=span b=span]
  ?|  (fat a fro.b)
      (fat a til.b)
      (fat b fro.a)
      (fat b til.a)
  ==
::
++  wed                                                 ::  merge
  |=  [a=span b=span]
  ^-  span
  [(min fro.a fro.b) (max til.a til.b)]
::
++  cut                                                 ::  remove b from a
  |=  [a=span b=span]
  ^-  sass
  ?:  =(a b)  ~
  ?:  (lth til.b fro.a)
    [a]~                     ::  no overlap (early)
  ?:  (lte fro.b fro.a)
    ?:  (lth til.b til.a)
      [+(til.b) til.a]~      ::  head overlap
    ~                        ::  full overlap
  ?:  (lth til.b til.a)
    :~  [fro.a (dec fro.b)]  ::  middle overlap
        [+(til.b) til.a]
    ==
  ?:  (lte fro.b til.a)
    [fro.a (dec fro.b)]~     ::  tail overlap
  [a]~                       ::  no overlap (late)
::
++  as                                                  ::  sass engine
  |_  a=sass
  ++  put                                               ::  insert
    |=  b=$@(@ span)
    =?  b  ?=(@ b)  [b b]
    ?>  ?=(^ b)
    |-  ^+  a
    ?>  (lte fro.b til.b)
    ?~  a  [b]~
    ?:  (gth fro.i.a til.b)
      [b a]
    ?:  (lap i.a b)
      $(b (wed i.a b), a t.a)
    [i.a $(a t.a)]
  ::
  ++  has                                               ::  existence check
    |=  b=@
    ^-  ?
    ?~  a  |
    ?:  (lth b fro.i.a)  |
    ?:  (lte b til.i.a)  &
    $(a t.a)
  ::
  ++  del                                               ::  remove
    |=  b=$@(@ span)
    =?  b  ?=(@ b)  [b b]
    ?>  ?=(^ b)
    |-  ^+  a
    ?>  (lte fro.b til.b)
    ?~  a  ~
    ?:  (gth fro.i.a til.b)
      a
    ?:  (lap i.a b)
      (welp (cut i.a b) $(a t.a))
    [i.a $(a t.a)]
  --
--