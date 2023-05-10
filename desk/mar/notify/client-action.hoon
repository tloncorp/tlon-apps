/-  *notify
|_  act=client-action
++  grad  %noun
++  grow
  |%
  ++  noun  act
  --
++  grab
  |%
  ++  noun  client-action
  ++  json
    |=  jon=^json
    =,  dejs:format
    ^-  client-action
    |^
    %.  jon
    %-  of
    :~  connect-provider+connect-provider
        remove-provider+remove-provider
        connect-provider-with-binding+connect-provider-with-binding
    ==
    ++  connect-provider
      %-  ot
      :~  who+(su fed:ag)
          service+so
          address+so
      ==
    ++  connect-provider-with-binding
      %-  ot
      :~  who+(su fed:ag)
          service+so
          address+so
          binding+so
      ==
    ++  remove-provider
      %-  ot
      :~  who+(su fed:ag)
          service+so
      ==
    --
  --
--
