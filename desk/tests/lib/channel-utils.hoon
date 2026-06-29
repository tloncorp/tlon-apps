/+  *test, cu=channel-utils
::  tests for the moon-parent vouching used by virtual bot identities.
|%
++  test-vouching
  =/  p=@p     ~sampel-palnet
  ::  a moon of .p: its sponsor is the low 32 bits of the @p (= .p)
  =/  moon=@p  `@p`(add `@`p (lsh [5 1] 1))
  ;:  weld
    ::  a planet may author content as a moon it sponsors
    (expect-eq !>(&) !>((can-author:cu p moon)))
    ::  any ship may author as itself
    (expect-eq !>(&) !>((can-author:cu p p)))
    ::  an unrelated ship may not author as someone else's moon
    (expect-eq !>(|) !>((can-author:cu ~bus moon)))
    ::  a planet may not author as an unrelated planet
    (expect-eq !>(|) !>((can-author:cu p ~bus)))
    ::  vouching is one-directional: a moon may not author as its parent
    (expect-eq !>(|) !>((can-author:cu moon p)))
  ==
--
