/-  g=groups
/+  j=groups-json
|_  flags=(map flag:g ?)
++  grad  %noun
++  grow
  |%
  ++  noun  flags
  ++  json
    =,  enjs:format
    %-  pairs
    %+  turn  ~(tap by flags)
    |=  [f=flag:g mig=?]
    [(rap 3 (scot %p p.f) '/' q.f ~) b+mig]
  --
++  grab
  |%
  ++  noun  (map flag:g ?)
  --
--
