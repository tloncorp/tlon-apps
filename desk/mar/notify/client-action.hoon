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
        send-message+send-message
    ==
    ++  connect-provider
      %-  ot
      :~  who+(su fed:ag)
          service+so
          address+so
      ==
    ::  caps is optional: app builds older than push capability gating
    ::  register without it, and declare nothing by omitting it
    ::
    ++  connect-provider-with-binding
      %-  ou
      :~  who+(un (su fed:ag))
          service+(un so)
          address+(un so)
          binding+(un so)
          caps+(uf ~ (as so))
      ==
    ++  remove-provider
      %-  ot
      :~  who+(su fed:ag)
          service+so
      ==
    ++  send-message
      %-  ot
      :~  message+so
      ==
    --
  --
--
