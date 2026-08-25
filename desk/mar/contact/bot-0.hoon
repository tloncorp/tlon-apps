::  contact-bot-0: set a bot moon's contact profile on its host. local
::  writers only -- see the %contact-bot-0 case in /app/contacts.
::
/-  c=contacts
/+  j=contacts-json-1
|_  [who=ship con=contact:c]
++  grad  %noun
++  grow
  |%
  ++  noun  [who con]
  --
++  grab
  |%
  ++  noun  ,[ship con=contact:c]
  ++  json
    =,  dejs:format
    |=  jon=json
    ^-  [who=@p con=contact:c]
    %.  jon
    %-  ot
    :~  who+(se %p)
        con+contact:dejs:j
    ==
  --
--
