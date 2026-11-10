::  Contacts owns the ship's public identity. Send only the edited fields:
::  a full profile replacement could erase a bio, color, or group membership.
/-  ct=contacts
|%
++  liveness
  |=  [online=? con=contact:ct]
  ^-  contact:ct
  =/  claim=value:ct
    [%text ?:(online '{"v":1,"state":"online"}' '{"v":1,"state":"offline"}')]
  ?:  =(`claim (~(get by con) %bot-liveness))  ~
  (my ~[[%bot-liveness claim]])
++  encode
  |=  con=contact:ct
  ^-  json
  =/  nick  (~(get by con) %nickname)
  =/  avatar  (~(get by con) %avatar)
  %-  pairs:enjs:format
  :~  ['nickname' %s ?:(?=([~ %text *] nick) p.u.nick '')]
      ['avatar' %s ?:(?=([~ %look *] avatar) p.u.avatar '')]
  ==
++  decode
  |=  jon=json
  ^-  contact:ct
  =/  val=[nickname=@t avatar=@t]
    ((ot:dejs:format ~[nickname+so:dejs:format avatar+so:dejs:format]) jon)
  ?>  (lte (met 3 nickname.val) 64)
  ?>  (lte (met 3 avatar.val) 2.048)
  ::  Empty fields remove these attributes. URLs remain references; the hand
  ::  never downloads the image or embeds it in its own durable state.
  ?>  |(=('' avatar.val) =('https://' (end 3^8 avatar.val)) =('http://' (end 3^7 avatar.val)))
  %-  my
  :~  [%nickname ?:(=('' nickname.val) ~ [%text nickname.val])]
      [%avatar ?:(=('' avatar.val) ~ [%look `@ta`avatar.val])]
  ==
--
