/-  d=diary
/+  j=diary-json
|_  [=flag:d =action:d]
++  grad  %noun
++  grow
  |%
  ++  noun  [flag action]
  ++  json  (flag-action:enjs:j [flag action])  
  --
++  grab
  |%
  ++  noun  [flag:d action:d]
  ++  json  flag-action:dejs:j
  --
--
