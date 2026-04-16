/-  av=activity-ver
/+  aj=activity-json
|_  =feed-init:v8:av
++  grad  %noun
++  grow
  |%
  ++  noun  feed-init
  ++  json
    =,  enjs:format
    %-  pairs
    :~  all+a+(turn all.feed-init activity-bundle:v8:enjs:aj)
        mentions+a+(turn mentions.feed-init activity-bundle:v8:enjs:aj)
        replies+a+(turn replies.feed-init activity-bundle:v8:enjs:aj)
        summaries+(activity:v8:enjs:aj summaries.feed-init |)
    ==
  --
++  grab
  |%
  ++  noun  feed-init:v8:av
  --
--
