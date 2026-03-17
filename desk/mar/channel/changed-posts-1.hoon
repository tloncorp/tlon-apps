/-  c=channels, cv=channels-ver
/+  j=channel-json
|_  changes=(map nest:c (unit posts:v10:cv))
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    %-  pairs:enjs:format
    =,  enjs:j
    %+  turn  ~(tap by changes)
    |=  [=nest:c posts=(unit posts:v10:cv)]
    :-  (nest-cord nest)
    ?~(posts ~ (posts:v10 u.posts))
  --
++  grab
  |%
  ++  noun  (map nest:c (unit posts:v10:cv))
  --
--
