/-  a=activity
/+  aj=activity-json
|_  =feed-init:a
++  grad  %noun
++  grow
  |%
  ++  noun  feed-init
  ++  json
    =,  enjs:format
    %-  pairs
    :~  all+a+(turn all.feed-init activity-bundle:enjs:aj)
        mentions+a+(turn mentions.feed-init activity-bundle:enjs:aj)
        replies+a+(turn replies.feed-init activity-bundle:enjs:aj)
        summaries+(activity:enjs:aj summaries.feed-init |)
    ==
  --
++  grab
  |%
  ++  noun  feed-init:a
  --
--
