/-  c=channels
/+  j=channel-json
|_  changes=(map nest:c posts:c)
++  grad  %noun
++  grow
  |%
  ++  noun  changes
  ++  json
    %-  pairs:enjs:format
    =,  enjs:j
    ::REVIEW  turn seems slightly faster than murn,
    ::        even if that means we produce bigger json
    %+  turn  ~(tap by changes)
    |=  [=nest:c =posts:c]
    [(nest-cord nest) (^posts posts)]
  --
++  grab
  |%
  ++  noun  (map nest:c posts:c)
  --
--
