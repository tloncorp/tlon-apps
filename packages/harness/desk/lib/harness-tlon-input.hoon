::  Native addressing syntax, not a second command interpreter. Only the head
::  decides which slash words are commands, after normal social admission.
/-  d=story, t=harness-tlon
/+  story=harness-tlon-story
|%
++  whitespace
  |=(c=@t |(=(c 32) =(c 9) =(c 10) =(c 13)))
++  text
  |=  [our=@p content=story:d]
  ^-  @t
  =/  original  (story-to-text:story content)
  ::  Only a single flat paragraph can address a command this way. Quoted,
  ::  styled and code content must not become commands by removing a mention.
  ?.  ?=([[%inline *] ~] content)  original
  =/  inlines  p.i.content
  |-
  ?~  inlines  original
  ?@  i.inlines
    ?:  (levy (trip i.inlines) whitespace)  $(inlines t.inlines)
    original
  ?.  ?=([%ship @] i.inlines)  original
  ?.  =(our p.i.inlines)  original
  ?.  (levy t.inlines |=(v=inline:d ?=(@ v)))  original
  =/  plain=@t
    %+  rap  3
    %+  turn  t.inlines
    |=  v=inline:d
    ?>  ?=(@ v)
    v
  =/  chars  (trip plain)
  |-
  ?~  chars  original
  ?:  (whitespace i.chars)  $(chars t.chars)
  ?.  =(i.chars '/')  original
  (crip chars)
::  A channel's session is shared, so each message names its speaker. A
::  slash command stays as written so the head still reads it as a command.
::
++  attribute
  |=  [actor=@p to=destination:t text=@t]
  ^-  @t
  ?:  ?=(%dm -.to)  text
  =/  chars  (trip text)
  |-
  ?:  &(?=(^ chars) (whitespace i.chars))  $(chars t.chars)
  ?:  &(?=(^ chars) =('/' i.chars))  text
  (rap 3 (scot %p actor) ': ' text ~)
::  The longest prefix +attribute adds: a comet's name, a colon and a space.
::
++  attribution-limit
  ^-  @ud
  (add 2 (met 3 (scot %p (dec (bex 128)))))
--
