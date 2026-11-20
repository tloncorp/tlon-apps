::  Live identity boundary. Rank and sponsor come from Urbit's title API,
::  never textual @p prefixes or the apparent layout of an address.
|_  =bowl:gall
++  moon
  ^-  ?
  =(%earl (clan:title our.bowl))
++  initial-owner
  |=  [initialized=@ud explicit=(unit @p)]
  ^-  [initialized=@ud explicit=(unit @p)]
  ?:  !=(0 initialized)  [initialized explicit]
  ?.  &(moon ?=(~ explicit))  [1 explicit]
  [1 `(sein:title our.bowl now.bowl our.bowl)]
++  sibling
  |=  who=@p
  ^-  ?
  ?.  &(moon =(%earl (clan:title who)) !=(our.bowl who))  |
  =((sein:title our.bowl now.bowl our.bowl) (sein:title our.bowl now.bowl who))
++  owner
  |=  [explicit=(unit @p) siblings=? who=@p]
  ^-  ?
  |(=(`who explicit) &(siblings (sibling who)))
--
