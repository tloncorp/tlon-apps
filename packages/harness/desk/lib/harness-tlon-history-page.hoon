::  Stateless bounded history pages. A cursor selects position, never authority.
/-  cv=chat-ver, dv=channels-ver, s=story
/+  hist=harness-tlon-history, story=harness-tlon-story
|%
+$  message  [id=@t author=@p sent=@da text=@t clipped=?]
+$  row  [at=@da message=(unit message)]
+$  page  [messages=(list message) scanned=@ud before=(unit @da)]
++  argument
  |=  [args=json key=@t]
  ^-  @t
  ?>  ?=(%o -.args)
  =/  value  (~(get by p.args) key)
  ?~  value  ''
  ?>  ?=(%s -.u.value)
  p.u.value
++  query
  |=  args=json
  ^-  @t
  =/  text  (argument args 'query')
  ?>  &((gth (met 3 text) 0) (lte (met 3 text) 128))
  =/  blank
    %+  levy  (trip text)
    |=(char=@t |(=(char 32) =(char 10) =(char 13) =(char 9)))
  ?>  !blank
  (crip (cass (trip text)))
++  cursor
  |=  [scope=@uv at=@da]
  ^-  @t
  (scot %uv (jam [%1 scope at]))
++  position
  |=  [scope=@uv token=@t]
  ^-  (unit @da)
  ?:  =('' token)  ~
  ?>  (lte (met 3 token) 256)
  =/  value  ;;([%1 scope=@uv at=@da] (cue (slav %uv token)))
  ?>  ?&  =(scope scope.value)
          (gth at.value 0)
          (lte (met 0 at.value) 128)
      ==
  `at.value
++  matches
  |=  [needle=@t message=message]
  ^-  ?
  ?:  =('' needle)  &
  ?=(^ (find (trip needle) (cass (trip text.message))))
++  scan
  |=  [rows=(list row) needle=@t]
  ^-  page
  ::  Native rows are chronological. Visit newest first; collect chronological
  ::  matches. One lookahead row makes continuation work across tombstones.
  =/  remaining  (flop rows)
  =/  limit=@ud  ?:(=('' needle) 20 64)
  =/  result=page  [~ 0 ~]
  =/  hits=@ud  0
  =/  bytes=@ud  0
  |-
  ?~  remaining  result(before ~)
  ?:  |(=(scanned.result limit) =(hits 20))  result
  =/  candidate=(unit message)
    ?~  message.i.remaining  ~
    ?.  (matches needle u.message.i.remaining)  ~
    =/  message  u.message.i.remaining
    %-  some
    %*  .  message
      text  (clip-text text.message 800)
      clipped  |(clipped.message (gth (met 3 text.message) 800))
    ==
  =/  size=@ud
    ?~  candidate  0
    (met 3 (en:json:html (message-json u.candidate)))
  ::  Preserve complete JSON under the head's 24 KB tool-result boundary.
  ::  Do not consume a matching row until it fits; the cursor must revisit it.
  ?:  (gth (add bytes size) 16.000)  result
  =.  result  result(scanned +(scanned.result), before `at.i.remaining)
  ?~  candidate  $(remaining t.remaining)
  %=  $
    remaining  t.remaining
    hits  +(hits)
    bytes  (add bytes size)
    result  result(messages [u.candidate messages.result])
  ==
++  clip-text
  |=  [text=@t cap=@ud]
  ^-  @t
  ?:  (lte (met 3 text) cap)  text
  ::  Never split a UTF-8 continuation sequence at the byte boundary. The
  ::  separate clipped flag replaces a synthetic suffix (which must not match).
  |-
  ?:  =(cap 0)  ''
  =/  next-byte=@ud  (cut 3 [cap 1] text)
  ?:  &((gte next-byte 128) (lth next-byte 192))  $(cap (dec cap))
  (end [3 cap] text)
++  make-message
  |=  [id=@t author=author:v9:dv sent=@da content=story:s]
  ^-  message
  =/  text  (story-to-text:story content)
  [id ?@(author author ship.author) sent text |]
++  dm-post
  |=  post=writ:v7:cv
  ^-  message
  (make-message (dm-id:hist id:-.post) author:+.post sent:+.post content:+.post)
++  dm-reply
  |=  reply=reply:v7:cv
  ^-  message
  (make-message (dm-id:hist id:-.reply) author:+.reply sent:+.reply content:+.reply)
++  channel-post
  |=  post=post:v9:dv
  ^-  message
  (make-message (scot %da id:-.post) author:+.+.post sent:+.+.post content:+.+.post)
++  channel-reply
  |=  reply=reply:v9:dv
  ^-  message
  (make-message (scot %da id:-.reply) author:+.+.reply sent:+.+.reply content:+.+.reply)
++  message-json
  |=  message=message
  ^-  json
  %-  pairs:enjs:format
  :~  ['message_id' %s id.message]
      ['author' %s (scot %p author.message)]
      ['sent' %s (scot %da sent.message)]
      ['text' %s (clip-text text.message 800)]
      ['text_truncated' %b |(clipped.message (gth (met 3 text.message) 800))]
  ==
++  encode
  |=  [scope=@uv page=page parent=(unit message) needle=@t]
  ^-  json
  =;  result=json
    ?>  (lte (met 3 (en:json:html result)) 23.000)
    result
  %-  pairs:enjs:format
  :~  ['messages' %a (turn messages.page message-json)]
      ['parent' ?~(parent ~ (message-json u.parent))]
      ['parent_matches' %b ?~(parent | (matches needle u.parent))]
      ['next_cursor' ?~(before.page ~ [%s (cursor scope u.before.page)])]
      ['has_more' %b ?=(^ before.page)]
      ['scanned' (numb:enjs:format scanned.page)]
      ['scan_limit' (numb:enjs:format ?:(=('' needle) 20 64))]
      ['text_limit_bytes' %n '800']
  ==
--
