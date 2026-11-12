::  Native addressing syntax, not a second command interpreter. Only the head
::  decides which slash words are commands, after normal social admission.
/-  d=story
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
--
