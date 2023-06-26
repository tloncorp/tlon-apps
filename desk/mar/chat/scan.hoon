/-  c=chat
/+  j=chat-json
|_  =scan:c
++  grad  %noun
++  grow
  |%
  ++  noun  scan
  ++  json
    =,  enjs:format
    :-  %a
    %+  turn
      scan
    |=  [t=@da =writ:c]
    ^-  ^json
    %-  pairs
    :~  time/s/(scot %ud t)
        writ/(writ:enjs:j writ)
    ==
  --
++  grab
  |%
  +$  noun  scan:c
  --
--
