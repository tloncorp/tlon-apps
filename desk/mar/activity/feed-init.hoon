/-  av=activity-ver
/+  aj=activity-json
|_  [all=feed:v4:av mentions=feed:v4:av replies=feed:v4:av]
++  grad  %noun
++  grow
  |%
  ++  noun  [all mentions replies]
  ++  json
    =,  enjs:format
    %-  pairs
    :~  all+(feed:v4:enjs:aj all)
        mentions+(feed:v4:enjs:aj mentions)
        replies+(feed:v4:enjs:aj replies)
    ==
  --
++  grab
  |%
  ++  noun  [all=feed:v4:av mentions=feed:v4:av replies=feed:v4:av]
  --
--
