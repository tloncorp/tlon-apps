/-  c=channels
/+  j=channel-json
|_  changes=(map nest:c (unit posts:c))
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    %-  pairs:enjs:format
    =,  enjs:j
    %+  turn  ~(tap by changes)
    |=  [=nest:c posts=(unit posts:c)]
    :-  (nest-cord nest)
    ?~(posts ~ (^posts u.posts))
  --
++  grab
  |%
  ++  noun  (map nest:c (unit posts:c))
  --
--
