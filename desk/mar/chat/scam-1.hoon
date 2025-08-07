/-  c=chat
/+  j=chat-json
|_  =scam:v4:c
++  grad  %noun
++  grow
  |%
  ++  noun  scam
  ++  json
    =,  enjs:format
    %-  pairs
    :~  'last'^?~(last.scam ~ (time-id:v4:enjs:j u.last.scam))
        'scan'^a+(turn scan.scam reference:v4:enjs:j)
    ==
  --
++  grab
  |%
  +$  noun  scam:v4:c
  --
--
