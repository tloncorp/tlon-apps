/-  a=activity
/+  aj=activity-json
|_  [all=feed:v4:old:a mentions=feed:v4:old:a replies=feed:v4:old:a]
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
  ++  noun  [all=feed:v4:old:a mentions=feed:v4:old:a replies=feed:v4:old:a]
  --
--
