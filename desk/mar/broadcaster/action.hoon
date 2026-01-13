::  broadcaster-action
::
/-  c=chat
/+  sj=story-json
::
=>  |%
    +$  action
      $%  [%add-cohort cohort=@t targets=(set ship)]
          [%del-cohort cohort=@t targets=(set ship)]  ::  ~ for full deletion
          [%broadcast cohort=@t =story:s:d:c]
      ==
    --
|_  =action
++  grad  %noun
++  grow
  |%
  ++  noun  action
  --
++  grab
  |%
  ++  noun  ^action
  ++  json
    =,  dejs:format
    %-  of
    :~  add-cohort+(ot 'cohort'^(se %t) 'targets'^(cu sy (ar (se %p))) ~)
        del-cohort+(ot 'cohort'^(se %t) 'targets'^(cu sy (ar (se %p))) ~)
        broadcast+(ot 'cohort'^(se %t) 'story'^story:dejs:sj ~)
        delete+(ot 'cohort'^(se %t) 'time-id'^(se %da) ~)
    ==
  --
--
