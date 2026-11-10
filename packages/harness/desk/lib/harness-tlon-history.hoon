::  Bounded thread presentation, without selecting destinations or authority.
/-  cv=chat-ver, dv=channels-ver
/+  mp=mop-extensions, story=harness-tlon-story, ht=harness-tools
|%
+$  item  [id=@t author=@p sent=@da text=@t]
++  dm-id
  |=  id=id:v7:cv
  ^-  @t
  (rap 3 (scot %p p.id) '/' (scot %da q.id) ~)
++  dm-replies  ((mp @da (may:v7:cv reply:v7:cv)) lte)
++  dm-thread
  |=  post=writ:v7:cv
  ^-  (list item)
  =/  author  author:+.post
  :-  :*  (dm-id id:-.post)
          ?@(author author ship.author)
          sent:+.post
          (clip:ht (story-to-text:story content:+.post) 800)
      ==
  %+  murn  (top:dm-replies replies:-.post 19)
  |=  [time=@da value=(may:v7:cv reply:v7:cv)]
  ^-  (unit item)
  ?:  ?=(%| -.value)  ~
  =/  reply  +.value
  =/  author  author:+.reply
  %-  some
  :*  (dm-id id:-.reply)
      ?@(author author ship.author)
      sent:+.reply
      (clip:ht (story-to-text:story content:+.reply) 800)
  ==
++  channel-thread
  |=  [post=post:v9:dv replies=replies:v9:dv]
  ^-  (list item)
  =/  author  author:+.+.post
  :-  :*  (scot %da id:-.post)
          ?@(author author ship.author)
          sent:+.+.post
          (clip:ht (story-to-text:story content:+.+.post) 800)
      ==
  ::  Callers request at most 19 native replies; also bound pure projection.
  =/  ordered  ((mp @da (may:v9:dv reply:v9:dv)) lte)
  %+  murn  (top:ordered replies 19)
  |=  [time=@da value=(may:v9:dv reply:v9:dv)]
  ^-  (unit item)
  ?:  ?=(%| -.value)  ~
  =/  reply  +.value
  =/  author  author:+.+.reply
  %-  some
  :*  (scot %da id:-.reply)
      ?@(author author ship.author)
      sent:+.+.reply
      (clip:ht (story-to-text:story content:+.+.reply) 800)
  ==
--
