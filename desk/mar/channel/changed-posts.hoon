/-  cv=channels-ver
/+  j=channel-json
|_  changes=(map nest:cv (unit posts:v9:cv))
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    %-  pairs:enjs:format
    %+  turn  ~(tap by changes)
    |=  [=nest:cv posts=(unit posts:v9:cv)]
    :-  (nest-cord:enjs:j nest)
    ?~(posts ~ (posts:v9:enjs:j u.posts))
  --
++  grab
  |%
  ++  noun  (map nest:cv (unit posts:v9:cv))
  --
--
