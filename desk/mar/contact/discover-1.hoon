|_  action=[who=@p nickname=(unit @t)]
++  grad  %noun
++  grow
  |%
  ++  noun  action
  --
++  grab
  |%
  ++  noun  ,[who=@p nickname=(unit @t)]
  ++  json
    |=  jon=^json
    =,  dejs:format
    ^-  [who=@p nickname=(unit @t)]
    %.  jon
    %-  ot
    :~  [%kip (su ;~(pfix sig fed:ag))]
        [%nickname |=(val=_jon ?~(val ~ `(so val)))]
    ==
  --
--
