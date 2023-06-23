/-  c=chat
/+  j=chat-json
|_  action=split-action:c
++  grad  %noun
++  grow
  |%
  ++  noun  action
  ++  json  (action:enjs:j action)
  --
++  grab
  |%
  ++  noun  split-action:c
  ++  json  action:dejs:j
  --
--
