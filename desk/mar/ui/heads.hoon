/-  u=ui
/+  cj=chat-json, dj=channel-json
|_  =mixed-heads:u
++  grad  %noun
++  grow
  |%
  ++  noun  mixed-heads
  ++  json
    =,  enjs:format
    ^-  ^json
    %-  pairs
    :~  channels/(channel-heads:enjs:dj chan.mixed-heads)
        dms/(chat-heads:enjs:cj chat.mixed-heads)
    ==
  --
++  grab
  |%
  ++  noun  mixed-heads:u
  --
--
