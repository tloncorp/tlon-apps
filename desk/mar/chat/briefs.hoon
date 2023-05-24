/-  c=chat-0
/+  j=chat-json
|_  =briefs:c
++  grad  %noun
++  grow
  |%
  ++  noun  briefs
  ++  json
    =,  enjs:format
    %-  pairs
    %+  turn  ~(tap by briefs)
    |=  [w=whom:c b=brief:briefs:c]
    [(whom:enjs:j w) (brief:enjs:j b)]
  --
++  grab
  |%
  ++  noun  briefs:c
  --
--
