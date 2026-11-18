::  Only host-confirmed channel responses prove publication. Pending client
::  echoes, reactions, tombstones and other authors are never receipts.
/-  t=harness-tlon, dv=channels-ver
|%
::
++  proof
  |=  [our=@p to=destination:t author=author:v9:dv sent=@da id=@da]
  ^-  (unit publication-proof:t)
  ?.  =(our ?@(author author ship.author))  ~
  `[to sent id]
::
++  channel
  |=  [our=@p response=r-channels:v9:dv]
  ^-  (list publication-proof:t)
  =/  nest  nest.response
  =/  channel-update  r-channel.response
  ?:  ?=(%posts -.channel-update)
    %+  murn  (tap:on-posts:v9:dv posts.channel-update)
    |=  [id=@da value=(may:v9:dv post:v9:dv)]
    ?:  ?=(%| -.value)  ~
    =/  post  +.value
    (proof our [%channel nest ~] author:+.+.post sent:+.+.post id)
  ?.  ?=(%post -.channel-update)  ~
  =/  post-update  r-post.channel-update
  =/  found=(unit publication-proof:t)
    ?:  ?=(%set -.post-update)
      ?:  ?=(%| -.post.post-update)  ~
      =/  post  +.post.post-update
      (proof our [%channel nest ~] author:+.+.post sent:+.+.post id.channel-update)
    ?.  ?=([%reply * * %set *] post-update)  ~
    ?:  ?=(%| -.reply.r-reply.post-update)  ~
    =/  reply  +.reply.r-reply.post-update
    (proof our [%channel nest `id.channel-update] author:+.+.reply sent:+.+.reply id.post-update)
  ?~  found  ~
  ~[u.found]
--
