/-  a=activity
/+  aj=activity-json
|_  [=index:a =unread-summary:a]
++  grad  %noun
++  grow
  |%
  ++  noun  [index unread-summary]
  ++  json  (index-unreads:enjs:aj [index unread-summary])
  --
++  grab
  |%
  ++  noun  (pair index:a unread-summary:a)
  --
--
