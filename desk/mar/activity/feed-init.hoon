/-  a=activity
/+  aj=activity-json
|_  [all=feed:a mentions=feed:a replies=feed:a]
++  grad  %noun
++  grow
  |%
  ++  noun  [all mentions replies]
  ++  json
    =,  enjs:format
    %-  pairs
    :~  all+(feed:enjs:aj all)
        mentions+(feed:enjs:aj mentions)
        replies+(feed:enjs:aj replies)
    ==
  --
++  grab
  |%
  ++  noun  [all=feed:a mentions=feed:a replies=feed:a]
  --
--
