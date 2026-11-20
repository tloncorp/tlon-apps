/-  h=harness
/+  hj=harness-json
|_  upd=update:h
++  grow
  |%
  ++  noun  upd
  ++  json  (update-json:hj upd)
  --
++  grab
  |%
  ++  noun  update:h
  --
++  grad  %noun
--
